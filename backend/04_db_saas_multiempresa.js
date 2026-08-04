const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

(async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando Migración Maestra a Modelo SaaS Multi-Empresa...');
        await client.query('BEGIN');

        // 1. CREACIÓN DE LA TABLA MATRIZ DE EMPRESAS (LOS INQUILINOS)
        await client.query(`
            CREATE TABLE IF NOT EXISTS empresas (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                rif VARCHAR(20),
                telefono VARCHAR(20),
                direccion TEXT,
                estatus VARCHAR(20) DEFAULT 'ACTIVO',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "empresas" creada.');

        // 2. REGISTRAR LA EMPRESA PRINCIPAL (TUS DATOS ACTUALES)
        await client.query(`
            INSERT INTO empresas (id, nombre, rif) 
            VALUES (1, 'BMS Digital (Principal)', 'J-00000000-0') 
            ON CONFLICT (id) DO NOTHING;
        `);
        console.log('✅ Empresa matriz asignada con el ID 1.');

        // 3. INYECCIÓN MASIVA Y SEGURA DEL 'empresa_id' EN TODAS LAS TABLAS
        const tablas = [
            'users', 'roles', 'cash_registers', 'customers', 'products',
            'sales', 'sale_items', 'providers', 'credit_payments', 'purchases',
            'purchase_items', 'product_batches', 'inventory_movements',
            'cash_shifts', 'held_orders', 'delivery_drivers', 'audit_logs',
            'document_sequences'
        ];

        for (const tabla of tablas) {
            await client.query(`
                ALTER TABLE ${tabla} 
                ADD COLUMN IF NOT EXISTS empresa_id INTEGER DEFAULT 1 REFERENCES empresas(id);
            `);
        }
        console.log('✅ Columna "empresa_id" inyectada en todas las tablas con DEFAULT 1.');

        // 4. BLINDAJE SAAS: RE-CONFIGURACIÓN DE RESTRICCIONES ÚNICAS
        // Permitimos que distintos inquilinos tengan los mismos datos (Ej: mismo RIF de cliente) sin chocar entre sí.

        // Clientes
        await client.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_id_number_key;`);
        await client.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_empresa_id_id_number_unique;`);
        await client.query(`ALTER TABLE customers ADD CONSTRAINT customers_empresa_id_id_number_unique UNIQUE (empresa_id, id_number);`);

        // Productos (Código de Barras)
        await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;`);
        await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_empresa_id_barcode_unique;`);
        await client.query(`ALTER TABLE products ADD CONSTRAINT products_empresa_id_barcode_unique UNIQUE (empresa_id, barcode);`);

        // Proveedores (RIF)
        await client.query(`ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_rif_key;`);
        await client.query(`ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_empresa_id_rif_unique;`);
        await client.query(`ALTER TABLE providers ADD CONSTRAINT providers_empresa_id_rif_unique UNIQUE (empresa_id, rif);`);

        // Usuarios (Username y Email)
        await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;`);
        await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;`);
        await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_empresa_id_username_unique;`);
        await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_empresa_id_email_unique;`);
        await client.query(`ALTER TABLE users ADD CONSTRAINT users_empresa_id_username_unique UNIQUE (empresa_id, username);`);
        await client.query(`ALTER TABLE users ADD CONSTRAINT users_empresa_id_email_unique UNIQUE (empresa_id, email);`);

        // Delivery Drivers
        await client.query(`ALTER TABLE delivery_drivers DROP CONSTRAINT IF EXISTS delivery_drivers_id_number_key;`);
        await client.query(`ALTER TABLE delivery_drivers DROP CONSTRAINT IF EXISTS delivery_drivers_phone_key;`);
        await client.query(`ALTER TABLE delivery_drivers DROP CONSTRAINT IF EXISTS delivery_drivers_empresa_id_id_number_unique;`);
        await client.query(`ALTER TABLE delivery_drivers DROP CONSTRAINT IF EXISTS delivery_drivers_empresa_id_phone_unique;`);
        await client.query(`ALTER TABLE delivery_drivers ADD CONSTRAINT delivery_drivers_empresa_id_id_number_unique UNIQUE (empresa_id, id_number);`);
        await client.query(`ALTER TABLE delivery_drivers ADD CONSTRAINT delivery_drivers_empresa_id_phone_unique UNIQUE (empresa_id, phone);`);

        console.log('✅ Aislamiento de restricciones únicas (SaaS) configurado.');

        await client.query('COMMIT');
        console.log('🌟 ¡MIGRACIÓN SAAS COMPLETADA! La base de datos ahora es Multi-Inquilino.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico en la migración SaaS:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();