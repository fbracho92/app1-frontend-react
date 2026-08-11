// backend/src/controllers/system.controller.js
const pool = require('../config/db');

// 🛡️ UTILIDAD DE BLINDAJE: Sanitización estricta UTF-8 
// Elimina caracteres invisibles que causan errores de "Correlativos No Visibles"
const sanitizeText = (text) => {
    if (!text) return '';
    return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/\s+/g, ' ');
};

// 🔄 ACTUALIZADO: Obtener secuencias de todas las estaciones (ahora agrupado por prefijo/serie)
const getSequences = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;
        
        // 🚨 SAAS: Filtramos las secuencias por empresa_id y ordenamos por prefijo
        const query = 'SELECT * FROM document_sequences WHERE empresa_id = $1 ORDER BY prefix ASC, id ASC';
        const result = await pool.query(query, [empresaId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('❌ Error obteniendo secuencias globales:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener el maestro de secuencias.' });
    }
};

// 🛡️ BLINDADO: Maneja Edición de Secuencias por Serie (Prefijo)
const updateSequence = async (req, res) => {
    const { document_type, prefix, current_number, is_locked, modified_by, admin_user_id } = req.body;
    
    if (!document_type || !prefix) {
        return res.status(400).json({ error: 'Parámetros insuficientes. Falta el tipo de documento o el prefijo de la serie.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        // 🚀 FASE 3: Buscamos y actualizamos por (document_type, prefix, empresa_id)
        const result = await client.query(`
            UPDATE document_sequences 
            SET 
                current_number = COALESCE($1, current_number),
                is_locked = COALESCE($2, is_locked),
                last_modified_by = COALESCE($3, last_modified_by),
                updated_at = CURRENT_TIMESTAMP
            WHERE document_type = $4 AND prefix = $5 AND empresa_id = $6
            RETURNING *
        `, [
            current_number !== undefined && current_number !== null ? parseInt(current_number, 10) : null, 
            is_locked !== undefined && is_locked !== null ? is_locked : null,
            modified_by || 'Admin Principal', 
            document_type,
            prefix,
            empresaId
        ]);

        if (result.rows.length === 0) {
            throw new Error('La secuencia solicitada no existe para esta empresa y serie.');
        }

        // 🧾 Trazabilidad Fiscal Inalterable
        await client.query(`
            INSERT INTO audit_logs (user_id, user_name, action, module, details, new_values, created_at, empresa_id)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        `, [
            admin_user_id || 1, 
            modified_by || 'SISTEMA',
            'UPDATE_SEQUENCE',
            'ADMINISTRACION',
            `Modificación de secuencia ${document_type} (Serie ${prefix})`,
            JSON.stringify(result.rows[0]),
            empresaId
        ]);

        await client.query('COMMIT');

        res.status(200).json({ 
            success: true, 
            message: `Secuencia fiscal blindada y actualizada con éxito para la Serie ${prefix}.`,
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico actualizando secuencia fiscal:', error);
        res.status(error.message.includes('no existe') ? 404 : 500).json({ 
            error: error.message.includes('no existe') ? error.message : 'Error interno de base de datos al asegurar la secuencia.' 
        });
    } finally {
        client.release();
    }
};

// ⚙️ [INTACTO 100%] Controlador AUTO-SANABLE (Sin depender de la columna ID)
// 🚨 SAAS: Esta tabla NO lleva empresa_id porque maneja configuraciones globales
const updateSettings = async (req, res) => {
    try {
        const { forma_libre_serie, forma_libre_margin_top } = req.body;

        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                forma_libre_serie VARCHAR(50) DEFAULT 'SERIE - A',
                forma_libre_margin_top INTEGER DEFAULT 45,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            ALTER TABLE system_settings 
            ADD COLUMN IF NOT EXISTS forma_libre_serie VARCHAR(50) DEFAULT 'SERIE - A',
            ADD COLUMN IF NOT EXISTS forma_libre_margin_top INTEGER DEFAULT 45,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);

        const check = await pool.query('SELECT * FROM system_settings LIMIT 1');
        
        if (check.rows.length === 0) {
            await pool.query(`
                INSERT INTO system_settings (forma_libre_serie, forma_libre_margin_top) 
                VALUES ('SERIE - A', 45)
            `);
        }

        const result = await pool.query(`
            UPDATE system_settings 
            SET forma_libre_serie = COALESCE($1, forma_libre_serie),
                forma_libre_margin_top = COALESCE($2, forma_libre_margin_top),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [forma_libre_serie, forma_libre_margin_top]);

        res.json({ success: true, message: "Configuración actualizada de forma blindada", data: result.rows[0] });
    } catch (error) {
        console.error('❌ Error guardando configuraciones:', error);
        res.status(500).json({ error: error.message });
    }
};

// ⚙️ [INTACTO 100%] Controlador para LEER configuraciones al abrir la pantalla
const getSettings = async (req, res) => {
    try {
        const check = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'system_settings'
            );
        `);
        
        if (!check.rows[0].exists) {
            return res.json({ forma_libre_serie: 'SERIE - A', forma_libre_margin_top: 45 });
        }

        const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
        res.json(result.rows.length > 0 ? result.rows[0] : { forma_libre_serie: 'SERIE - A', forma_libre_margin_top: 45 });
    } catch (error) {
        console.error('❌ Error leyendo configuraciones:', error);
        res.json({ forma_libre_serie: 'SERIE - A', forma_libre_margin_top: 45 }); 
    }
};

// 🖥️ [INTACTO 100%] MULTI-CAJA: Obtener todas las estaciones
const getRegisters = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        // 🚨 SAAS: Filtramos cr.empresa_id y cs.empresa_id
        const result = await pool.query(`
            SELECT 
                cr.*,
                cs.status AS shift_status,
                u.full_name AS occupant_name,
                u.id AS occupant_id
            FROM cash_registers cr
            LEFT JOIN cash_shifts cs ON cr.id = cs.register_id AND cs.status = 'ABIERTA' AND cs.empresa_id = $1
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE cr.empresa_id = $1
            ORDER BY cr.id ASC
        `, [empresaId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('❌ Error obteniendo cajas:', error);
        res.status(500).json({ error: 'Error obteniendo cajas registradoras.' });
    }
};

// 🖥️ [INTACTO 100%] MULTI-CAJA: Actualizar Serie y Calce de una estación específica
const updateRegister = async (req, res) => {
    const { id } = req.params;
    const { serie, margin_top } = req.body;
    
    try {
        const empresaId = req.user.empresa_id; // 🚨 SAAS

        // 🚨 SAAS: Agregamos empresa_id = $4 para seguridad
        const result = await pool.query(`
            UPDATE cash_registers 
            SET 
                serie = COALESCE($1, serie),
                margin_top = COALESCE($2, margin_top)
            WHERE id = $3 AND empresa_id = $4
            RETURNING *
        `, [
            serie !== undefined ? sanitizeText(serie).toUpperCase() : null, 
            margin_top, 
            id,
            empresaId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Estación no encontrada en su empresa.' });
        }

        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('❌ Error actualizando caja:', error);
        res.status(500).json({ error: 'Error interno al actualizar la estación.' });
    }
};

// 🛡️ BLINDADO MULTI-CAJA: Crear estación y asociar secuencias de forma segura
const createRegister = async (req, res) => {
    const { name, serie, margin_top, admin_user_id, admin_user_name } = req.body;
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Transacción segura iniciada
        
        const empresaId = req.user.empresa_id; // 🚨 SAAS

        // Sanitización para evitar colisiones y caracteres inválidos
        const safeName = sanitizeText(name) || 'Nueva Caja';
        const safeSerie = sanitizeText(serie).toUpperCase() || 'B';
        const safeMarginTop = parseInt(margin_top) || 45;

        // 1. Creamos la nueva Caja
        const newReg = await client.query(`
            INSERT INTO cash_registers (name, serie, margin_top, is_active, created_at, empresa_id)
            VALUES ($1, $2, $3, true, NOW(), $4)
            RETURNING *
        `, [safeName, safeSerie, safeMarginTop, empresaId]);

        const newCajaSerie = newReg.rows[0].serie;

        // 2. 🚀 FASE 3: Asignamos secuencias vírgenes por PREFIJO (Sin asociarlas al ID de la caja)
        const defaultSequences = [
            { type: 'FACTURA', prefix: newCajaSerie },
            { type: 'FORMA_LIBRE', prefix: `FL-${newCajaSerie}` }, 
            { type: 'NOTA_CREDITO', prefix: `NC-${newCajaSerie}` },
            { type: 'NOTA_DEBITO', prefix: `ND-${newCajaSerie}` },
            { type: 'NOTA_ENTREGA', prefix: `NE-${newCajaSerie}` },
            { type: 'TICKET', prefix: `T-${newCajaSerie}` }
        ];

        for (const seq of defaultSequences) {
            // Se inyecta la empresa y se ignora el insert si ya existe esa secuencia con ese prefijo
            await client.query(`
                INSERT INTO document_sequences (document_type, prefix, current_number, is_active, is_locked, empresa_id)
                VALUES ($1, $2, 0, true, true, $3)
                ON CONFLICT (empresa_id, document_type, prefix) DO NOTHING
            `, [seq.type, seq.prefix, empresaId]);
        }

        // 3. Auditoría de creación de caja
        await client.query(`
            INSERT INTO audit_logs (user_id, user_name, action, module, details, new_values, created_at, empresa_id)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        `, [
            admin_user_id || 1, 
            admin_user_name || 'Admin Principal',
            'CREATE_REGISTER',
            'ADMINISTRACION',
            `Creación de estación POS: ${safeName} (Serie ${newCajaSerie})`,
            JSON.stringify(newReg.rows[0]),
            empresaId
        ]);

        await client.query('COMMIT'); 
        res.status(201).json({ success: true, data: newReg.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error('❌ Error creando caja:', error);
        res.status(500).json({ error: 'Error interno al crear la estación y sus secuencias.' });
    } finally {
        client.release();
    }
};

// 🏢 [INTACTO 100%] Controlador para Actualizar la Identidad y Configuración Fiscal de la Empresa
const updateTenantSettings = async (req, res) => {
    const client = await pool.connect();
    try {
        const empresaId = req.user.empresa_id;
        const { 
            companyName, tradeName, companyDocument, 
            companyPhone, companyAddress, logoUrl, 
            configFiscal 
        } = req.body;

        await client.query('BEGIN');

        // 🚨 BLINDAJE SAAS: Actualizamos SÓLO la fila donde id = empresaId
        const result = await client.query(`
            UPDATE empresas 
            SET nombre = COALESCE($1, nombre),
                nombre_fantasia = COALESCE($2, nombre_fantasia),
                rif = COALESCE($3, rif),
                telefono = COALESCE($4, telefono),
                direccion = COALESCE($5, direccion),
                logo_url = COALESCE($6, logo_url),
                config_fiscal = COALESCE($7, config_fiscal)
            WHERE id = $8
            RETURNING *
        `, [
            companyName, tradeName, companyDocument,
            companyPhone, companyAddress, logoUrl,
            configFiscal ? JSON.stringify(configFiscal) : null,
            empresaId
        ]);

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: 'Configuración guardada exitosamente',
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error actualizando settings de empresa:', error);
        res.status(500).json({ error: 'Error interno al actualizar la configuración.' });
    } finally {
        client.release();
    }
};

module.exports = {
    getSequences,
    updateSequence,
    updateSettings,
    getSettings,
    getRegisters,   
    updateRegister,   
    createRegister,
    updateTenantSettings
};