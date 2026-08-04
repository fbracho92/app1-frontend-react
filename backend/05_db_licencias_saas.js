// backend/05_db_licencias_saas.js
const { Pool } = require('pg');

// Utilizamos tu conexión segura
const connectionString = 'postgresql://pos_venta_demo_user:bDrMiOSfhjBwZFCDfk0V0Epzk9horTbu@dpg-d98plf6cjfls73f33iog-a.ohio-postgres.render.com/pos_venta_demo';
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando Fase 1: Motor de Licenciamiento SaaS...');
        await client.query('BEGIN');

        // 1. Inyectamos los campos de control de licencias a la tabla de inquilinos
        await client.query(`
            ALTER TABLE empresas 
            ADD COLUMN IF NOT EXISTS licencia_expira_el TIMESTAMP,
            ADD COLUMN IF NOT EXISTS dias_gracia INTEGER DEFAULT 5,
            ADD COLUMN IF NOT EXISTS suspendido_manualmente BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS plan_actual VARCHAR(50) DEFAULT 'BÁSICO';
        `);

        // 2. Blindaje para tu empresa principal (El dueño del SaaS nunca expira ni se suspende)
        // Le damos una licencia que vence en el año 2099
        await client.query(`
            UPDATE empresas 
            SET 
                licencia_expira_el = '2099-12-31 23:59:59',
                dias_gracia = 0,
                suspendido_manualmente = FALSE,
                plan_actual = 'ILIMITADO (DUEÑO)'
            WHERE id = 1;
        `);

        // 3. Crear una función automática en PostgreSQL (Trigger) para calcular el estatus dinámico
        // Esto es seguridad de élite: la base de datos sabe si está expirada sin que Node.js tenga que calcularlo
        await client.query(`
            CREATE OR REPLACE VIEW vista_empresas_estatus AS
            SELECT 
                id,
                nombre,
                rif,
                licencia_expira_el,
                dias_gracia,
                suspendido_manualmente,
                plan_actual,
                CASE
                    WHEN suspendido_manualmente = TRUE THEN 'BLOQUEADO_MANUAL'
                    WHEN licencia_expira_el IS NULL THEN 'ACTIVO'
                    WHEN NOW() > (licencia_expira_el + (dias_gracia || ' days')::interval) THEN 'BLOQUEADO_POR_PAGO'
                    WHEN NOW() > licencia_expira_el THEN 'EN_PERIODO_DE_GRACIA'
                    ELSE 'ACTIVO'
                END as estatus_licencia
            FROM empresas;
        `);

        console.log('✅ Columnas de control de pagos añadidas con éxito.');
        console.log('✅ Empresa Principal (ID: 1) configurada como vitalicia.');
        console.log('✅ Motor de cálculo de estatus (Días de gracia y Bloqueo) compilado en la Base de Datos.');

        await client.query('COMMIT');
        console.log('🏁 FASE 1 COMPLETADA.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico inyectando licencias:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();