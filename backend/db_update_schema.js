const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// 🚀 MOTOR DE MIGRACIONES (Añade aquí futuras columnas o tablas)
const migrations = [
    {
        name: "Añadir columna 'unit_measure' a productos (Multi-empresa)",
        query: `ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_measure VARCHAR(50) DEFAULT 'UND';`
    },
    {
        name: "Asegurar que los productos existentes tengan 'UND' por defecto",
        // Esto protege la integridad de todas las empresas en el modelo SaaS
        query: `UPDATE products SET unit_measure = 'UND' WHERE unit_measure IS NULL;`
    }
    // 💡 EJEMPLO FUTURO:
    // {
    //     name: "Añadir nueva funcionalidad X a clientes",
    //     query: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS nueva_columna VARCHAR(50);`
    // }
];

async function runMigrations() {
    const client = await pool.connect();
    try {
        console.clear();
        console.log('🚀 Iniciando Motor de Actualizaciones Estructurales (BMS-POS)...\n');
        
        // Transacción segura: Si una falla, se cancelan todas (Rollback)
        await client.query('BEGIN');

        for (const [index, migration] of migrations.entries()) {
            console.log(`⏳ [${index + 1}/${migrations.length}] Ejecutando: ${migration.name}...`);
            await client.query(migration.query);
            console.log(`✅ Completado.\n`);
        }

        await client.query('COMMIT');
        console.log('🏆 Todas las actualizaciones de base de datos se aplicaron con éxito.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico durante la actualización. Cambios revertidos para proteger la BD.', err.message);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Conexión cerrada.');
    }
}

runMigrations();