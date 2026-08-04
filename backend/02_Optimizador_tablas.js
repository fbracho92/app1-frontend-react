// apply-optimizations.js
const { Pool } = require('pg');

// URL directa de tu base de datos en Render
const connectionString = 'postgresql://pos_venta_demo_user:bDrMiOSfhjBwZFCDfk0V0Epzk9horTbu@dpg-d98plf6cjfls73f33iog-a.ohio-postgres.render.com/pos_venta_demo';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const runOptimizations = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('馃殌 Conexi贸n establecida con Render. Iniciando optimizaci贸n...');
        
        await client.query('BEGIN');

        // 1. Aceleraci贸n de b煤squeda de productos
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_performance ON products (status, category, id);`);

        // 2. Optimizaci贸n de Lotes (Vuelo en el descuento de stock)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_product_batches_fast_lookup ON product_batches (product_id, expiration_date ASC NULLS LAST) WHERE stock > 0;`);

        // 3. Optimizaci贸n de Ventas y Cr茅ditos
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_customer_status_lookup ON sales (customer_id, status, created_at DESC);`);

        // 4. Optimizaci贸n de Kardex (Movimientos)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_history ON inventory_movements (product_id, created_at DESC);`);

        // 5. B煤squeda de Clientes por C茅dula
        await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_id_number_search ON customers (id_number, status);`);

        await client.query('COMMIT');
        console.log('鉁?隆脥ndices creados exitosamente en la nube!');
        
        await client.query('ANALYZE');
        console.log('鈿?Sistema optimizado y listo.');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('鉂?Error cr铆tico:', error.message);
    } finally {
        if (client) client.release();
        await pool.end();
        process.exit();
    }
};

runOptimizations();