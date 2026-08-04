// db_wipe_all.js
// Script para borrar AUTOMÁTICAMENTE todas las tablas del esquema público
// No requiere listar los nombres de las tablas manualmente.

const { Pool } = require('pg');

// Conexión obtenida de tu configuración original
const connectionString = 'postgresql://pos_venta_demo_user:bDrMiOSfhjBwZFCDfk0V0Epzk9horTbu@dpg-d98plf6cjfls73f33iog-a.ohio-postgres.render.com/pos_venta_demo'; 

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const wipeAllSql = `
    DO $$ 
    DECLARE
        r RECORD;
    BEGIN
        -- Busca todas las tablas en el esquema 'public'
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            -- Ejecuta el borrado de cada tabla encontrada de forma dinámica
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END $$;
`;

(async () => {
    console.log('⚠️  Iniciando limpieza total de la estructura...');
    
    try {
        // Ejecuta el bloque anónimo de PostgreSQL
        await pool.query(wipeAllSql);
        console.log('🗑️  ¡Hecho! Todas las tablas han sido eliminadas automáticamente.');
    } catch (err) {
        console.error('❌ Error durante la ejecución:', err.message);
    } finally {
        await pool.end();
        console.log('🔌 Conexión cerrada.');
    }
})();