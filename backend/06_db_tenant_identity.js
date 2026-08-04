// backend/06_db_tenant_identity.js
const { Pool } = require('pg');

const connectionString = 'postgresql://pos_venta_demo_user:bDrMiOSfhjBwZFCDfk0V0Epzk9horTbu@dpg-d98plf6cjfls73f33iog-a.ohio-postgres.render.com/pos_venta_demo';
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando Inyección de Identidad Corporativa...');
        await client.query('BEGIN');

        // Añadir columnas para almacenar configuración visual por inquilino
        await client.query(`
            ALTER TABLE empresas 
            ADD COLUMN IF NOT EXISTS logo_url TEXT,
            ADD COLUMN IF NOT EXISTS nombre_fantasia VARCHAR(150),
            ADD COLUMN IF NOT EXISTS config_fiscal JSONB DEFAULT '{"invoiceMode": "FORMA_LIBRE", "igtfRate": 0.03, "fiscalPrinterIP": "http://localhost:8080"}'::jsonb;
        `);

        // Asignar el logo de Cafetín Voluntariado temporalmente a las empresas de prueba
        // NOTA: Usa una URL estática de internet (Imgur, Postimages) para evitar problemas de CORS
        await client.query(`
            UPDATE empresas 
            SET logo_url = 'https://i.postimg.cc/Qtx1zQ7X/logo-cafetin.png', 
                nombre_fantasia = 'Cafetín Voluntariado'
            WHERE id > 0;
        `);

        await client.query('COMMIT');
        console.log('✅ Base de datos lista para Marca Blanca Dinámica.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();