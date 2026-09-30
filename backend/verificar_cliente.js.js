const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verificar() {
    try {
        const res = await pool.query(`
            SELECT id, full_name, institution, id_number, empresa_id 
            FROM customers 
            WHERE id_number LIKE '%30535278%' OR full_name ILIKE '%Arca%';
        `);

        console.log("=== REGISTRO EN BASE DE DATOS ===");
        console.table(res.rows);

        const salesRes = await pool.query(`
            SELECT id, customer_id, invoice_type, fiscal_invoice_number, empresa_id 
            FROM sales 
            WHERE fiscal_invoice_number = '00000001' OR control_number LIKE '%00000001%';
        `);

        console.log("=== VENTA 00000001 EN BASE DE DATOS ===");
        console.table(salesRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

verificar();