const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando unificación de correlativos Multi-Empresa (SENIAT)...');
        await client.query('BEGIN');

        // 1. Rescatar el correlativo más alto actual de cada empresa y serie para no perder el hilo
        const secuenciasActuales = await client.query(`
            SELECT empresa_id, document_type, prefix, MAX(current_number) as max_number
            FROM document_sequences
            GROUP BY empresa_id, document_type, prefix
        `);

        // 2. Destruir las restricciones viejas que causan el conflicto
        await client.query('ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_document_type_key;');
        await client.query('ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_document_type_register_id_key;');
        await client.query('ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS doc_seq_empresa_tipo_prefijo_unique;');

        // 3. Limpiar la tabla de secuencias (Ya respaldamos en memoria)
        await client.query('TRUNCATE TABLE document_sequences RESTART IDENTITY;');

        // 4. Inyectar el nuevo constraint fiscal: Un correlativo por Empresa + Documento + Serie
        await client.query(`
            ALTER TABLE document_sequences 
            ADD CONSTRAINT doc_seq_empresa_tipo_prefijo_unique UNIQUE (empresa_id, document_type, prefix);
        `);

        // 5. Re-insertar los correlativos consolidados
        for (const seq of secuenciasActuales.rows) {
            if (seq.empresa_id) { // Solo si tiene empresa válida
                await client.query(`
                    INSERT INTO document_sequences (empresa_id, document_type, prefix, current_number, is_active)
                    VALUES ($1, $2, $3, $4, TRUE)
                `, [seq.empresa_id, seq.document_type, seq.prefix, seq.max_number]);
            }
        }

        await client.query('COMMIT');
        console.log('✅ JUGADA MAESTRA COMPLETADA: Correlativos independizados por Empresa y Serie.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();