// backend/src/services/purchase.service.js
const pool = require('../config/db');

// 🚨 SAAS: Recibimos el empresaId desde el controlador
const createPurchase = async (data, empresaId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Iniciar Transacción

        const { 
            provider_id, invoice_number, control_number, 
            purchase_date, items, exchange_rate 
        } = data;

        // Validaciones básicas preservadas
        if (!items || items.length === 0) throw new Error("La compra no tiene ítems");

        // 🛡️ BLINDAJE SAAS: Verificar que el proveedor exista y pertenezca a la empresa
        const providerCheck = await client.query('SELECT id FROM providers WHERE id = $1 AND empresa_id = $2', [provider_id, empresaId]);
        if (providerCheck.rows.length === 0) throw new Error("Proveedor no válido o no pertenece a su empresa");

        // 1. Calcular totales con precisión decimal (Mismo cálculo que tu original)
        let totalUsd = 0;
        let totalBs = 0;

        items.forEach(item => {
            totalUsd += (parseFloat(item.cost_usd) * parseFloat(item.quantity));
            totalBs += (parseFloat(item.cost_bs) * parseFloat(item.quantity));
        });

        // 2. Insertar Cabecera de Compra
        // 🚨 SAAS: Inyectamos el empresa_id ($8)
        const purchaseRes = await client.query(`
            INSERT INTO purchases 
            (provider_id, invoice_number, control_number, purchase_date, total_amount_usd, total_amount_bs, exchange_rate, empresa_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [provider_id, invoice_number, control_number, purchase_date, totalUsd.toFixed(2), totalBs.toFixed(2), exchange_rate, empresaId]);

        const purchaseId = purchaseRes.rows[0].id;

        // 3. Procesar cada ítem con Blindaje Senior (Optimizado para FEFO)
        for (const item of items) {
            const qty = parseFloat(item.quantity);
            const costUsd = parseFloat(item.cost_usd);
            const costBs = parseFloat(item.cost_bs);

            // 🛡️ BLINDAJE SAAS: Verificar que el producto pertenece a la empresa
            const prodCheck = await client.query('SELECT id FROM products WHERE id = $1 AND empresa_id = $2', [item.product_id, empresaId]);
            if (prodCheck.rows.length === 0) throw new Error(`El producto con ID ${item.product_id} no pertenece a su empresa.`);

            // A. Insertar Detalle
            // 🚨 SAAS: Inyectamos el empresa_id ($6)
            await client.query(`
                INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_usd, cost_bs, empresa_id)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [purchaseId, item.product_id, qty, costUsd, costBs, empresaId]);

            // B. BLINDAJE SENIOR: Registrar Lote para permitir salida por vencimiento (FEFO)
            // 🚨 SAAS: Inyectamos el empresa_id ($5)
            await client.query(`
                INSERT INTO product_batches (product_id, stock, cost_usd, batch_code, empresa_id)
                VALUES ($1, $2, $3, $4, $5)
            `, [item.product_id, qty, costUsd, `COMPRA FACT #${invoice_number}`, empresaId]);

            // C. AUMENTAR INVENTARIO (Lógica Quirúrgica idéntica al original)
            // 🚨 SAAS: Validamos con AND empresa_id = $3
            const updateRes = await client.query(
                `UPDATE products SET stock = stock + $1, last_stock_update = CURRENT_TIMESTAMP WHERE id = $2 AND empresa_id = $3 RETURNING stock`, 
                [qty, item.product_id, empresaId]
            );
            const finalStock = updateRes.rows[0].stock;

            // D. Registrar Movimiento en Kardex con integridad total (Incluyendo costo y nuevo stock)
            // 🚨 SAAS: Inyectamos el empresa_id ($6)
            await client.query(`
                INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, new_stock, cost_usd, empresa_id)
                VALUES ($1, 'IN', $2, 'COMPRA', $3, $4, $5, $6)
            `, [item.product_id, qty, `COMPRA FACT #${invoice_number}`, finalStock, costUsd, empresaId]);
        }

        await client.query('COMMIT');
        return { success: true, message: 'Compra registrada e inventario actualizado' };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en compra:", err);
        throw err;
    } finally {
        client.release();
    }
};

// 🚨 SAAS: Recibimos el empresaId desde el controlador
const getPurchases = async (empresaId) => {
    // Optimización: LEFT JOIN para evitar errores si el proveedor fue eliminado
    // 🚨 SAAS: Agregamos WHERE p.empresa_id = $1
    const result = await pool.query(`
        SELECT p.*, pr.name as provider_name 
        FROM purchases p
        LEFT JOIN providers pr ON p.provider_id = pr.id
        WHERE p.empresa_id = $1
        ORDER BY p.purchase_date DESC, p.id DESC LIMIT 100
    `, [empresaId]);
    return result.rows;
};

module.exports = { createPurchase, getPurchases };