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
            p.is_perishable, p.is_raw_material, p.is_service, p.unit_measure,
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
            // 🚨 BLINDAJE: Garantizamos que el frontend siempre reciba un string válido
            unit_measure: product.unit_measure || 'UND',
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
    // 🚨 1. Extraemos unit_measure del objeto data
    const { id, name, category, price_usd, stock, icon_emoji, is_taxable, barcode, status, expiration_date, is_raw_material, is_service, unit_measure } = data;
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
        
        // 🚨 2. Si llega vacío del frontend, forzamos 'UND' por seguridad
        const safeUnitMeasure = unit_measure || 'UND';

        let result;
        if (id) {
            // 🚨 3. UPDATE: Agregamos unit_measure=$13 y desplazamos empresa_id a $14
            result = await client.query(`
                UPDATE products SET name=$1, category=$2, price_usd=$3, icon_emoji=$4, is_taxable=$5, barcode=$6, status=$7, 
                expiration_date=$8, is_perishable=$9, is_raw_material=$11, is_service=$12, unit_measure=$13, last_stock_update=CURRENT_TIMESTAMP 
                WHERE id=$10 AND empresa_id=$14 RETURNING *`, 
                [name, category, price_usd, icon_emoji, isTaxableVal, finalBarcode, status || 'ACTIVE', expirationVal, isPerishableVal, id, isRawMaterialVal, isServiceVal, safeUnitMeasure, empresaId]);
            
            if (result.rowCount === 0) throw new Error("Producto no encontrado o acceso denegado");
        } else {
            // 🚨 4. BLINDAJE DECIMALES: Cambiamos parseInt a parseFloat para permitir stock inicial fraccionado (Ej: 10.500 Kg)
            const initialStock = isServiceVal ? 0 : (parseFloat(stock) || 0);
            
            // 🚨 5. INSERT: Agregamos unit_measure y desplazamos empresa_id a $14
            result = await client.query(`
                INSERT INTO products (name, category, price_usd, stock, icon_emoji, is_taxable, barcode, status, expiration_date, is_perishable, is_raw_material, is_service, unit_measure, empresa_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`, 
                [name, category, price_usd, initialStock, icon_emoji, isTaxableVal, finalBarcode, status || 'ACTIVE', expirationVal, isPerishableVal, isRawMaterialVal, isServiceVal, safeUnitMeasure, empresaId]);
            
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
    
    // 🚨 FIX UX PRO: Usamos parseFloat para admitir decimales reales (Ej: 0.350)
    const qty = parseFloat(quantity);
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
                // 🚨 FIX: Aseguramos que la base de datos lea el stock como número flotante para la comparación
                if (batchCheck.rows.length === 0 || parseFloat(batchCheck.rows[0].stock) < qty) throw new Error("Lote insuficiente o inválido");
                await client.query('UPDATE product_batches SET stock = stock - $1 WHERE id = $2', [qty, specific_batch_id]);
            } else {
                const batches = await client.query(`SELECT id, stock FROM product_batches WHERE product_id = $1 AND stock > 0 AND empresa_id = $2 ORDER BY expiration_date ASC NULLS LAST`, [product_id, empresaId]);
                let remaining = qty;
                
                // 🚨 FIX MATEMÁTICO: Forzamos parseFloat para sumar correctamente los stocks de PostgreSQL (evita concatenación)
                const totalStock = batches.rows.reduce((s, b) => s + parseFloat(b.stock), 0);
                if (totalStock < qty) throw new Error(`Stock insuficiente. Disponibles: ${totalStock}`);

                for (let batch of batches.rows) {
                    if (remaining <= 0) break;
                    // 🚨 FIX MATEMÁTICO: Math.min requiere valores numéricos para funcionar correctamente
                    const take = Math.min(parseFloat(batch.stock), remaining);
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
        // 🚨 FIX: Convertimos a parseFloat para la devolución segura al frontend
        const finalStock = parseFloat(updateMaster.rows[0].stock);
        
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

const processAudit = async (data, userId, userName, empresaId) => {
    const { auditResults, bcvRate, notes } = data;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Generar Código Único de Auditoría (Ej: AUD-0001)
        const codeRes = await client.query('SELECT COUNT(*) + 1 as next_id FROM inventory_audits WHERE tenant_id = $1', [empresaId]);
        const auditCode = `AUD-${String(codeRes.rows[0].next_id).padStart(4, '0')}`;
        
        let totalMermaUsd = 0;
        let totalSobranteUsd = 0;

        // 2. Crear el Acta Cabecera
        const auditHeader = await client.query(`
            INSERT INTO inventory_audits (tenant_id, audit_code, user_id, bcv_rate_snapshot, notes)
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `, [empresaId, auditCode, userId, bcvRate, notes || 'Auditoría de Inventario']);
        
        const auditId = auditHeader.rows[0].id;

        // 3. Procesar cada producto con diferencias
        for (const item of auditResults) {
            const { id: product_id, physical_stock } = item;
            
            // Bloqueamos la fila del producto para evitar ventas mientras lo auditamos
            const prodRes = await client.query('SELECT stock, price_usd, is_service FROM products WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [product_id, empresaId]);
            if (prodRes.rows.length === 0 || prodRes.rows[0].is_service) continue;
            
            const product = prodRes.rows[0];
            const theoretical_stock = parseFloat(product.stock) || 0;
            const diff = physical_stock - theoretical_stock;
            const costUsd = parseFloat(product.price_usd) || 0;
            
            if (diff === 0) continue; // Si está conforme, no afectamos el Kardex
            
            // A. Guardar en el Detalle del Acta
            await client.query(`
                INSERT INTO inventory_audit_details (audit_id, product_id, theoretical_stock, physical_stock, difference, unit_cost_usd)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [auditId, product_id, theoretical_stock, physical_stock, diff, costUsd]);
            
            // B. Impacto Financiero
            const diffValueUsd = Math.abs(diff) * costUsd;
            if (diff < 0) totalMermaUsd += diffValueUsd;
            else totalSobranteUsd += diffValueUsd;

            const absDiff = Math.abs(diff);

            // C. Lógica de Lotes (Sumar sobrante o Restar merma)
            if (diff > 0) { 
                // 🚨 CORRECCIÓN 1: Se añade fecha de expiración por defecto (+6 meses) para sobrantes
                await client.query(`
                    INSERT INTO product_batches (product_id, stock, cost_usd, batch_code, expiration_date, empresa_id) 
                    VALUES ($1, $2, $3, $4, CURRENT_DATE + INTERVAL '6 months', $5)
                `, [product_id, absDiff, costUsd, auditCode, empresaId]);
            } else if (diff < 0) { 
                // 🚨 CORRECCIÓN 2: Consumo de lotes asegurado matemáticamente
                const batches = await client.query(`
                    SELECT id, stock FROM product_batches 
                    WHERE product_id = $1 AND stock > 0 AND empresa_id = $2 
                    ORDER BY expiration_date ASC NULLS LAST FOR UPDATE
                `, [product_id, empresaId]);
                
                let remaining = absDiff;
                for (let batch of batches.rows) {
                    if (remaining <= 0) break;
                    const take = Math.min(parseFloat(batch.stock), remaining);
                    await client.query('UPDATE product_batches SET stock = stock - $1 WHERE id = $2', [take, batch.id]);
                    remaining -= take;
                }
            }

            // 🚨 CORRECCIÓN 3: Sincronización Matemática Estricta (La clave para evitar desfases)
            // Calculamos cuánto quedó realmente en la tabla de lotes tras sumar o restar
            const totalStockRes = await client.query(`
                SELECT COALESCE(SUM(stock), 0) AS total_stock 
                FROM product_batches 
                WHERE product_id = $1 AND stock > 0 AND empresa_id = $2
            `, [product_id, empresaId]);

            const actualRealStock = parseFloat(totalStockRes.rows[0].total_stock);

            // D. Actualizar Stock Maestro con el saldo real verificado
            await client.query(`
                UPDATE products 
                SET stock = $1, last_stock_update = CURRENT_TIMESTAMP 
                WHERE id = $2 AND empresa_id = $3
            `, [actualRealStock, product_id, empresaId]);

            // E. Grabar en Kardex de forma blindada usando el saldo real verificado
            await client.query(`
                INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, new_stock, cost_usd, empresa_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [product_id, diff > 0 ? 'IN' : 'OUT', absDiff, diff > 0 ? 'SOBRANTE DE INVENTARIO' : 'MERMA DE INVENTARIO', auditCode, actualRealStock, costUsd, empresaId]);
        }

        // 4. Actualizar Dinero Total en Acta y Bitácora Global
        await client.query(`UPDATE inventory_audits SET total_merma_usd = $1, total_sobrante_usd = $2 WHERE id = $3`, [totalMermaUsd, totalSobranteUsd, auditId]);
        
        await client.query(`
            INSERT INTO audit_logs (user_id, user_name, action, module, details, empresa_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, userName, 'AUDITORIA_INVENTARIO', 'INVENTARIO', `Acta ${auditCode} procesada. Impacto Merma: $${totalMermaUsd.toFixed(2)} | Sobrante: $${totalSobranteUsd.toFixed(2)}`, empresaId]);

        await client.query('COMMIT');
        return { success: true, auditCode };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const getAuditHistory = async (empresaId) => {
    const res = await pool.query(`
        SELECT a.id, a.audit_code, a.created_at, a.total_merma_usd, a.total_sobrante_usd, a.bcv_rate_snapshot, u.full_name as auditor_name
        FROM inventory_audits a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.tenant_id = $1
        ORDER BY a.created_at DESC
        LIMIT 50
    `, [empresaId]);
    return res.rows;
};

const getAuditDetails = async (auditId, empresaId) => {
    const headerRes = await pool.query(`
        SELECT a.*, u.full_name as auditor_name
        FROM inventory_audits a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.id = $1 AND a.tenant_id = $2
    `, [auditId, empresaId]);

    if (headerRes.rows.length === 0) throw new Error('Acta no encontrada o acceso denegado');

    const detailsRes = await pool.query(`
        SELECT d.*, p.name, p.barcode, p.category, p.unit_measure
        FROM inventory_audit_details d
        JOIN products p ON d.product_id = p.id
        WHERE d.audit_id = $1
    `, [auditId]);

    return { header: headerRes.rows[0], details: detailsRes.rows };
};

module.exports = { getAllProducts, getBatches, upsertProduct, registerMovement, getHistory, processAudit, getAuditHistory, getAuditDetails  };