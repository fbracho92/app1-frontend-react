const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// 🚀 MOTOR DE MIGRACIONES (Actualizaciones Estructurales Seguras)
const migrations = [
    {
        name: "Añadir columna 'unit_measure' a productos (Multi-empresa)",
        query: `ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_measure VARCHAR(50) DEFAULT 'UND';`
    },
    {
        name: "Asegurar que los productos existentes tengan 'UND' por defecto",
        // Esto protege la integridad de todas las empresas en el modelo SaaS
        query: `UPDATE products SET unit_measure = 'UND' WHERE unit_measure IS NULL;`
    },
    // =======================================================================
    // 🚨 NUEVAS MIGRACIONES: MÓDULO LEGAL DE AUDITORÍAS DE INVENTARIO
    // =======================================================================
    {
        name: "Crear tabla maestra de Actas de Auditoría (Cabecera)",
        query: `CREATE TABLE IF NOT EXISTS inventory_audits (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            audit_code VARCHAR(50) NOT NULL,
            user_id INTEGER,
            bcv_rate_snapshot DECIMAL(10, 4) NOT NULL,
            total_merma_usd DECIMAL(15, 2) DEFAULT 0,
            total_sobrante_usd DECIMAL(15, 2) DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
    },
    {
        name: "Crear tabla de Detalles de Auditoría (Renglones contados)",
        query: `CREATE TABLE IF NOT EXISTS inventory_audit_details (
            id SERIAL PRIMARY KEY,
            audit_id INTEGER REFERENCES inventory_audits(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL,
            theoretical_stock DECIMAL(10, 3) NOT NULL,
            physical_stock DECIMAL(10, 3) NOT NULL,
            difference DECIMAL(10, 3) NOT NULL,
            unit_cost_usd DECIMAL(15, 2) NOT NULL
        );`
    }
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