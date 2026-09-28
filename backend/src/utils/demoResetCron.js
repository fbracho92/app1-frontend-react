// backend/src/utils/demoResetCron.js
const cron = require('node-cron');
const pool = require('../config/db');

const ejecutarAjusteDemo = async () => {
    const EMPRESA_ID = 1; // Estrictamente limitado al tenant DEMO
    console.log(`⏰ [CRON DEMO] Ejecutando reseteo automático nocturno para Empresa ID ${EMPRESA_ID}...`);
    
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Obtener los productos actuales del Tenant 1
        const checkQuery = `
            SELECT id, barcode, name, category, price_usd, stock, is_perishable 
            FROM products 
            WHERE empresa_id = $1 
            ORDER BY id ASC;
        `;
        const { rows: productos } = await client.query(checkQuery, [EMPRESA_ID]);

        for (const prod of productos) {
            let demoStock = 30;

            if (prod.barcode === 'INT-175446') {
                demoStock = 999999;
            } else if (prod.category === 'Cafeteria' || prod.category === 'Golosinas') {
                demoStock = 50;
            } else if (prod.category === 'Bebidas') {
                demoStock = 40;
            } else if (prod.category === 'Postre') {
                demoStock = 15;
            } else if (prod.barcode === 'INT-474931' || prod.barcode === 'INT-426196') {
                demoStock = 2; // Stock crítico para pruebas
            } else if (prod.barcode === 'INT-836350') {
                demoStock = 0; // Agotado para pruebas
            }

            // 2. Actualizar stock en tabla products
            await client.query(
                `UPDATE products 
                 SET stock = $1, last_stock_update = CURRENT_TIMESTAMP 
                 WHERE id = $2 AND empresa_id = $3;`,
                [demoStock, prod.id, EMPRESA_ID]
            );

            // 3. Sincronizar lotes e inventario
            if (demoStock > 0 && prod.barcode !== 'INT-175446') {
                const expDate = prod.is_perishable 
                    ? new Date(new Date().setMonth(new Date().getMonth() + 6)) 
                    : null;
                const costoEstimado = (Number(prod.price_usd || 0) * 0.70).toFixed(2);

                const checkLote = await client.query(
                    `SELECT id FROM product_batches 
                     WHERE product_id = $1 AND batch_code = 'LOTE-INICIAL-2026' AND empresa_id = $2 
                     LIMIT 1;`,
                    [prod.id, EMPRESA_ID]
                );

                if (checkLote.rowCount === 0) {
                    await client.query(`
                        INSERT INTO product_batches (product_id, stock, cost_usd, batch_code, expiration_date, created_at, empresa_id)
                        VALUES ($1, $2, $3, 'LOTE-INICIAL-2026', $4, CURRENT_TIMESTAMP, $5);
                    `, [prod.id, demoStock, costoEstimado, expDate, EMPRESA_ID]);

                    await client.query(`
                        INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, cost_usd, new_stock, created_at, empresa_id)
                        VALUES ($1, 'IN', $2, 'AUTO_RESETEO_DEMO_NOCTURNO', 'CRON-03AM', $3, $4, CURRENT_TIMESTAMP, $5);
                    `, [prod.id, demoStock, costoEstimado, demoStock, EMPRESA_ID]);
                } else {
                    await client.query(`
                        UPDATE product_batches 
                        SET stock = $1, cost_usd = $2 
                        WHERE id = $3 AND empresa_id = $4;
                    `, [demoStock, costoEstimado, checkLote.rows[0].id, EMPRESA_ID]);
                }
            }
        }

        await client.query('COMMIT');
        console.log(`✅ [CRON DEMO] Reseteo nocturno completado. Empresa ${EMPRESA_ID} lista.`);
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ [CRON DEMO] Error durante el reseteo automático:', error.message);
    } finally {
        if (client) client.release();
    }
};

const startDemoResetCron = () => {
    // Se ejecuta a las 03:00 AM todos los días (Zona horaria de Venezuela)
    cron.schedule('0 3 * * *', () => {
        ejecutarAjusteDemo();
    }, {
        scheduled: true,
        timezone: "America/Caracas"
    });

    console.log('🕒 Servicio Cron de Reseteo Demo inicializado (Hora objetivo: 03:00 AM VET).');
};

module.exports = { startDemoResetCron };