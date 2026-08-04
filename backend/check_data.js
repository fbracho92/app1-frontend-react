const { Pool } = require('pg');

const connectionString = 'postgresql://pos_venta_demo_user:bDrMiOSfhjBwZFCDfk0V0Epzk9horTbu@dpg-d98plf6cjfls73f33iog-a.ohio-postgres.render.com/pos_venta_demo'; 

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('🔍 Extrayendo valores de configuración y blindaje...\n');

        // 1. Ver la Tasa BCV guardada
        const bcvRes = await pool.query("SELECT * FROM system_settings WHERE key = 'bcv_rate'");
        console.log('📌 CONFIGURACIÓN BCV (Tabla system_settings):');
        if (bcvRes.rows.length > 0) {
            console.table(bcvRes.rows.map(r => ({
                Clave: r.key,
                Monto: r.value.amount,
                Estado: r.value.status,
                Actualizado: r.updated_at
            })));
        } else {
            console.log('⚠️ No se encontró la tasa BCV.');
        }

        // 2. Ver las Secuencias de Facturación
        const seqRes = await pool.query("SELECT * FROM document_sequences ORDER BY id ASC");
        console.log('\n📌 SECUENCIAS ACTIVAS (Tabla document_sequences):');
        console.table(seqRes.rows.map(r => ({
            Tipo: r.document_type,
            Prefijo: r.prefix,
            Siguiente_Numero: parseInt(r.current_number) + 1,
            Activa: r.is_active
        })));

        // 3. Ver los Motorizados
        const driverRes = await pool.query("SELECT id, name, phone FROM delivery_drivers");
        console.log('\n📌 MOTORIZADOS REGISTRADOS (Tabla delivery_drivers):');
        console.table(driverRes.rows);

    } catch (err) {
        console.error('❌ Error al consultar:', err.message);
    } finally {
        await pool.end();
    }
})();