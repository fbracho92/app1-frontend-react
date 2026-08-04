const pool = require('../config/db');
const { getRate } = require('../utils/bcvState');

const getAllProducts = async (empresaId) => {
    // 1. Obtener la tasa actual de forma segura (Fallback automático si es 0)
    const rate = getRate() || 40.00; 

    // OPTIMIZACIÓN SENIOR REFORZADA: 
    // Se añade lógica condicional (CASE) para asegurar que los servicios (is_service) 
    // siempre reporten stock 0, independientemente de los lotes.
    // 🚨 SAAS: Se agrega filtrado por empresa_id
    const result = await pool.query(`
        SELECT 
            p.id, p.name, p.category, p.price_usd, p.icon_emoji, 
            p.is_taxable, p.barcode, p.status, p.last_stock_update, 
            p.is_perishable, p.is_raw_material, p.is_service,
            CASE 
                WHEN p.is_service = TRUE THEN 0 
                ELSE COALESCE(SUM(pb.stock), 0) 
            END as stock,
            MIN(pb.expiration_date) as expiration_date
        FROM products p
        LEFT JOIN product_batches pb ON p.id = pb.product_id AND pb.stock > 0
        WHERE p.empresa_id = $1
        GROUP BY p.id
        ORDER BY p.name ASC
    `, [empresaId]);
    
    // 2. Mapeo "Anti-Crash": Convertimos todo a números seguros antes de enviar
    return result.rows.map(product => {
        const priceUsd = parseFloat(product.price_usd) || 0;
        const priceVes = priceUsd * rate;

        return {
            ...product,
            price_usd: priceUsd,
            price_ves: parseFloat(priceVes.toFixed(2)), 
            // El stock ya viene filtrado desde la consulta SQL para servicios
            stock: parseFloat(product.stock) || 0,
            expiration_date: product.expiration_date ? new Date(product.expiration_date).toISOString().split('T')[0] : null
        };
    });
};

const getBatches = async (id, empresaId) => {
    // 🚨 SAAS: Se valida que el lote pertenezca a la empresa
    const res = await pool.query(`SELECT * FROM product_batches WHERE product_id = $1 AND stock > 0 AND empresa_id = $2 ORDER BY expiration_date ASC`, [id, empresaId]);
    return res.rows;
};

const upsertProduct = async (data, empresaId) => {
    const { id, name, category, price_usd, stock, icon_emoji, is_taxable, barcode, status, expiration_date, is_raw_material, is_service } = data;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const isTaxableVal = (is_taxable === 'true' || is_taxable === true);
        const isRawMaterialVal = (is_raw_material === 'true' || is_raw_material === true);
        const isServiceVal = (is_service === 'true' || is_service === true);
        const expirationVal = (expiration_date && expiration_date !== '') ? expiration_date : null;
        const isPerishableVal = !!expirationVal;
        
        // 🚨 BLINDAJE CONTRA EL ERROR 500 (Código de barras vacío)
        const finalBarcode = (barcode && barcode.trim() !== '') ? barcode.trim() : null;
        
        let result;
        if (id) {
            // 🚨 SAAS: Se actualiza solo si pertenece a la empresa ($13)
            result = await client.query(`
                UPDATE products SET name=$1, category=$2, price_usd=$3, icon_emoji=$4, is_taxable=$5, barcode=$6, status=$7, 
                expiration_date=$8, is_perishable=$9, is_raw_material=$11, is_service=$12, last_stock_update=CURRENT_TIMESTAMP 
                WHERE id=$10 AND empresa_id=$13 RETURNING *`, 
                [name, category, price_usd, icon_emoji, isTaxableVal, finalBarcode, status || 'ACTIVE', expirationVal, isPerishableVal, id, isRawMaterialVal, isServiceVal, empresaId]);
            
            if (result.rowCount === 0) throw new Error("Producto no encontrado o acceso denegado");
        } else {
            const initialStock = isServiceVal ? 0 : (parseInt(stock) || 0);
            // 🚨 SAAS: Inserción del producto con su empresa_id ($13)
            result = await client.query(`
                INSERT INTO products (name, category, price_usd, stock, icon_emoji, is_taxable, barcode, status, expiration_date, is_perishable, is_raw_material, is_service, empresa_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`, 
                [name, category, price_usd, initialStock, icon_emoji, isTaxableVal, finalBarcode, status || 'ACTIVE', expirationVal, isPerishableVal, isRawMaterialVal, isServiceVal, empresaId]);
            
            if (initialStock > 0 && !isServiceVal) {
                const pid = result.rows[0].id;
                // 🚨 SAAS: Los registros iniciales de lotes y movimientos también se atan a la empresa
                await client.query(`INSERT INTO product_batches (product_id, stock, expiration_date, cost_usd, batch_code, empresa_id) VALUES ($1, $2, $3, $4, $5, $6)`, [pid, initialStock, expirationVal, price_usd, 'LOTE-INICIAL', empresaId]);
                await client.query(`INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, cost_usd, new_stock, empresa_id) VALUES ($1, 'IN', $2, 'INVENTARIO_INICIAL', 'CARGA_SISTEMA', $3, $4, $5)`, [pid, initialStock, price_usd, initialStock, empresaId]);
            }
        }
        await client.query('COMMIT');
        return result.rows[0];
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

const registerMovement = async (data, empresaId) => {
    const { product_id, type, quantity, document_ref, reason, cost_usd, new_expiration, specific_batch_id } = data;
    const qty = parseInt(quantity);
    if (!product_id || isNaN(qty) || qty <= 0) throw new Error("Datos inválidos: Producto o cantidad incorrecta.");

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 🚨 SAAS: Verificamos que el producto exista y pertenezca a la empresa
        const prodRes = await client.query('SELECT price_usd, is_perishable, is_service FROM products WHERE id = $1 AND empresa_id = $2', [product_id, empresaId]);
        if (prodRes.rows.length === 0) throw new Error('Producto no existe o acceso denegado');
        const product = prodRes.rows[0];

        if (product.is_service) throw new Error('No se pueden registrar movimientos de inventario para un Servicio.');

        const currentCost = (cost_usd !== undefined && cost_usd !== '') ? parseFloat(cost_usd) : parseFloat(product.price_usd);

        if (type === 'IN') {
            let expDate = product.is_perishable ? (new_expiration || null) : null;
            const existingBatch = await client.query(
                'SELECT id FROM product_batches WHERE product_id = $1 AND expiration_date IS NOT DISTINCT FROM $2 AND cost_usd = $3 AND empresa_id = $4', 
                [product_id, expDate, currentCost, empresaId]
            );
            
            if (existingBatch.rows.length > 0) {
                await client.query('UPDATE product_batches SET stock = stock + $1 WHERE id = $2', [qty, existingBatch.rows[0].id]);
            } else {
                // 🚨 SAAS: Se agrega empresa_id al nuevo lote
                await client.query(
                    'INSERT INTO product_batches (product_id, expiration_date, stock, cost_usd, batch_code, empresa_id) VALUES ($1, $2, $3, $4, $5, $6)', 
                    [product_id, expDate, qty, currentCost, document_ref || 'ENTRADA', empresaId]
                );
            }
        } else {
            if (specific_batch_id) {
                const batchCheck = await client.query('SELECT stock FROM product_batches WHERE id = $1 AND empresa_id = $2', [specific_batch_id, empresaId]);
                if (batchCheck.rows.length === 0 || batchCheck.rows[0].stock < qty) throw new Error("Lote insuficiente o inválido");
                await client.query('UPDATE product_batches SET stock = stock - $1 WHERE id = $2', [qty, specific_batch_id]);
            } else {
                const batches = await client.query(`SELECT id, stock FROM product_batches WHERE product_id = $1 AND stock > 0 AND empresa_id = $2 ORDER BY expiration_date ASC NULLS LAST`, [product_id, empresaId]);
                let remaining = qty;
                const totalStock = batches.rows.reduce((s, b) => s + b.stock, 0);
                if (totalStock < qty) throw new Error(`Stock insuficiente. Disponibles: ${totalStock}`);

                for (let batch of batches.rows) {
                    if (remaining <= 0) break;
                    const take = Math.min(batch.stock, remaining);
                    await client.query('UPDATE product_batches SET stock = stock - $1 WHERE id = $2', [take, batch.id]);
                    remaining -= take;
                }
            }
        }
        
        const op = type === 'IN' ? '+' : '-';
        // 🚨 SAAS: Se actualiza el stock maestro asegurando la empresa ($3)
        const updateMaster = await client.query(
            `UPDATE products SET stock = stock ${op} $1, last_stock_update = CURRENT_TIMESTAMP WHERE id = $2 AND empresa_id = $3 RETURNING stock`, 
            [qty, product_id, empresaId]
        );
        const finalStock = updateMaster.rows[0].stock;
        
        // 🚨 SAAS: Se inyecta empresa_id al historial de movimientos
        await client.query(
            `INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, new_stock, cost_usd, empresa_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, 
            [product_id, type, qty, reason || 'MANUAL', document_ref || 'MANUAL', finalStock, currentCost, empresaId]
        );
        
        await client.query('COMMIT');
        return { success: true, new_stock: finalStock };
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

const getHistory = async (id, empresaId) => {
    // 🚨 SAAS: Aislado por empresa
    const res = await pool.query(`SELECT * FROM inventory_movements WHERE product_id = $1 AND empresa_id = $2 ORDER BY created_at DESC LIMIT 50`, [id, empresaId]);
    return res.rows;
};

module.exports = { getAllProducts, getBatches, upsertProduct, registerMovement, getHistory };