const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
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