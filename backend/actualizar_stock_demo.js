const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// --- FUNCIÓN PRINCIPAL DE AJUSTE DE STOCK DEMO ---
async function ajustarStockDemo() {
    const client = await pool.connect();
    
    // DEFINIMOS EL ID DE LA EMPRESA SAAS (Empresa 1 - Demo)
    const EMPRESA_ID = 1; 

    console.log(`🚀 Iniciando ajuste de stock UX para Demo en Empresa ID ${EMPRESA_ID}...`);
    console.log('--------------------------------------------------');

    try {
        await client.query('BEGIN'); // Transacción segura

        // 1. Obtenemos todos los productos existentes del Tenant 1
        const checkQuery = `
            SELECT id, barcode, name, category, price_usd, stock, is_perishable 
            FROM products 
            WHERE empresa_id = $1 
            ORDER BY id ASC;
        `;
        const { rows: productos } = await client.query(checkQuery, [EMPRESA_ID]);

        console.log(`📦 Procesando ${productos.length} productos de la Empresa ${EMPRESA_ID}...`);

        for (const prod of productos) {
            // Regla de Stock para Demo UX
            let demoStock = 30; // Base estándar

            if (prod.barcode === 'INT-175446') {
                demoStock = 999999; // Avance de efectivo / servicio
            } else if (prod.category === 'Cafeteria' || prod.category === 'Golosinas') {
                demoStock = 50;
            } else if (prod.category === 'Bebidas') {
                demoStock = 40;
            } else if (prod.category === 'Postre') {
                demoStock = 15;
            } else if (prod.barcode === 'INT-474931' || prod.barcode === 'INT-426196') {
                demoStock = 2;  // Alerta de stock crítico (Panqué Queen / Doritos)
            } else if (prod.barcode === 'INT-836350') {
                demoStock = 0;  // Jabón de tocador (Agotado para probar validación UX)
            }

            // 2. Actualizamos el stock en la tabla maestra products
            const updateProductQuery = `
                UPDATE products 
                SET stock = $1, last_stock_update = CURRENT_TIMESTAMP 
                WHERE id = $2 AND empresa_id = $3;
            `;
            await client.query(updateProductQuery, [demoStock, prod.id, EMPRESA_ID]);

            // 3. Crear Lote Inicial o Actualizar Lote existente y Movimiento en Kardex SOLO si demoStock > 0
            if (demoStock > 0 && prod.barcode !== 'INT-175446') {
                const expDate = prod.is_perishable 
                    ? new Date(new Date().setMonth(new Date().getMonth() + 6)) 
                    : null;
                const costoEstimado = (Number(prod.price_usd || 0) * 0.70).toFixed(2);

                // Verificamos si ya existe el lote de auditoría para este producto en la empresa
                const checkLote = await client.query(
                    `SELECT id FROM product_batches WHERE product_id = $1 AND batch_code = 'LOTE-INICIAL-2026' AND empresa_id = $2 LIMIT 1;`,
                    [prod.id, EMPRESA_ID]
                );

                if (checkLote.rowCount === 0) {
                    // Si estaba en 0 y no tenía lote, lo insertamos
                    await client.query(`
                        INSERT INTO product_batches (product_id, stock, cost_usd, batch_code, expiration_date, created_at, empresa_id)
                        VALUES ($1, $2, $3, 'LOTE-INICIAL-2026', $4, CURRENT_TIMESTAMP, $5)
                    `, [prod.id, demoStock, costoEstimado, expDate, EMPRESA_ID]);

                    // Insertar movimiento inicial en kardex
                    await client.query(`
                        INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, cost_usd, new_stock, created_at, empresa_id)
                        VALUES ($1, 'IN', $2, 'INVENTARIO_INICIAL_DEMO', 'AUDIT-DEMO-2026', $3, $4, CURRENT_TIMESTAMP, $5)
                    `, [prod.id, demoStock, costoEstimado, demoStock, EMPRESA_ID]);
                } else {
                    // Si ya tenía el lote, sincronizamos la cantidad para que coincida exactamente
                    await client.query(`
                        UPDATE product_batches 
                        SET stock = $1, cost_usd = $2 
                        WHERE id = $3 AND empresa_id = $4;
                    `, [demoStock, costoEstimado, checkLote.rows[0].id, EMPRESA_ID]);
                }
            }

            console.log(`🔄 Actualizado: ${prod.name} -> Stock Demo: ${demoStock}`);
        }

        await client.query('COMMIT'); 
        console.log('--------------------------------------------------');
        console.log(`✨ ¡AJUSTE DE STOCK A EMPRESA ${EMPRESA_ID} COMPLETADO CON ÉXITO! ✨`);
        console.log(`🛡️ Empresas 2 y 3 quedaron 100% aisladas e intactas.`);

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error('❌ Error fatal, se revirtieron los cambios:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar script
ajustarStockDemo();