// backend/src/controllers/saas.controller.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// 🛡️ BARRERA ABSOLUTA: Solo la Empresa Matriz (BMS Digital - ID 1) Y el Usuario Creador (ID 1)
const isSuperAdmin = (req) => {
    return req.user && req.user.empresa_id === 1 && req.user.id === 1;
};

// 1. Obtener todas las empresas y sus estatus (ACTUALIZADO PARA MODO EDICIÓN)
const getAllTenants = async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Acceso denegado. Exclusivo para BMS Digital.' });

    try {
        // 🚨 Unimos la Vista de Estatus con la tabla empresas para traer la configuración visual completa
        const result = await pool.query(`
            SELECT v.*, e.telefono, e.direccion, e.logo_url, e.config_fiscal 
            FROM vista_empresas_estatus v
            JOIN empresas e ON v.id = e.id
            ORDER BY v.id ASC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo los inquilinos.' });
    }
};

// 2. Dar de alta una NUEVA EMPRESA (Inquilino)
const createTenant = async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });

    // 🚨 Extraemos los nuevos campos: logo_url y config_fiscal
    const { 
        nombre_empresa, rif, telefono, direccion, 
        admin_username, admin_password, admin_email, meses_licencia,
        logo_url, config_fiscal 
    } = req.body;
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // A. Crear la Empresa y asignarle el tiempo de licencia
        const meses = parseInt(meses_licencia) || 1;
        
        // 🚨 Inyectamos el logo y la configuración fiscal (JSONB) en la base de datos
        const insertEmpresa = await client.query(`
            INSERT INTO empresas (nombre, rif, telefono, direccion, licencia_expira_el, logo_url, config_fiscal) 
            VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${meses} months', $5, $6) 
            RETURNING id, nombre
        `, [nombre_empresa, rif, telefono, direccion, logo_url || null, config_fiscal ? JSON.stringify(config_fiscal) : '{}']);

        const newEmpresaId = insertEmpresa.rows[0].id;

        // B. Crear el Rol de Administrador si no lo tenemos en memoria, lo buscamos
        const roleRes = await client.query("SELECT id FROM roles WHERE name = 'ADMINISTRADOR' LIMIT 1");
        const adminRoleId = roleRes.rows[0].id;

        // C. Crear el usuario Administrador del nuevo cliente
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(admin_password, salt);

        await client.query(`
            INSERT INTO users (username, password_hash, full_name, email, role_id, empresa_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [admin_username, password_hash, `Admin ${nombre_empresa}`, admin_email, adminRoleId, newEmpresaId]);

        // D. Crear la Caja Principal para este nuevo cliente y sus secuencias iniciales
        const insertCaja = await client.query(`
            INSERT INTO cash_registers (name, serie, margin_top, is_active, empresa_id)
            VALUES ('Caja Principal', 'A', 45, true, $1) RETURNING id
        `, [newEmpresaId]);

        const newCajaId = insertCaja.rows[0].id;
        const secuencias = ['FACTURA', 'FORMA_LIBRE', 'NOTA_CREDITO', 'NOTA_DEBITO', 'NOTA_ENTREGA'];
        
        for (const tipo of secuencias) {
            let prefijo = tipo === 'FACTURA' ? 'A' : (tipo === 'FORMA_LIBRE' ? 'FL-A' : (tipo.includes('CREDITO') ? 'NC-A' : (tipo.includes('DEBITO') ? 'ND-A' : 'NE-A')));
            await client.query(`
                INSERT INTO document_sequences (document_type, prefix, current_number, register_id, empresa_id)
                VALUES ($1, $2, 0, $3, $4)
            `, [tipo, prefijo, newCajaId, newEmpresaId]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: `Empresa ${nombre_empresa} creada con éxito y lista para operar.`, empresa_id: newEmpresaId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creando inquilino:', error);
        if (error.code === '23505') return res.status(400).json({ error: 'El usuario, correo o RIF ya existe.' });
        res.status(500).json({ error: 'Error interno al aprovisionar el nuevo cliente.' });
    } finally {
        client.release();
    }
};

// 3. Renovar Licencia (Añadir tiempo)
const renewLicense = async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
    const { id } = req.params;
    const { meses_adicionales } = req.body;

    try {
        const meses = parseInt(meses_adicionales) || 1;
        // Si ya estaba expirada, suma desde hoy. Si no, suma desde su fecha de corte actual
        const result = await pool.query(`
            UPDATE empresas 
            SET licencia_expira_el = CASE 
                WHEN licencia_expira_el < NOW() THEN NOW() + INTERVAL '${meses} months'
                ELSE licencia_expira_el + INTERVAL '${meses} months'
            END,
            suspendido_manualmente = FALSE
            WHERE id = $1 RETURNING id, nombre, licencia_expira_el
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada.' });
        res.json({ success: true, message: 'Licencia renovada correctamente.', data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Error renovando licencia.' });
    }
};

// 4. El Kill-Switch (Suspender o Reactivar manualmente)
const toggleSuspension = async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
    const { id } = req.params;
    const { suspender } = req.body; // boolean

    try {
        if (parseInt(id) === 1) return res.status(400).json({ error: 'No puedes suspender la cuenta maestra de BMS Digital.' });

        const result = await pool.query(`
            UPDATE empresas SET suspendido_manualmente = $1 WHERE id = $2 RETURNING nombre, suspendido_manualmente
        `, [suspender, id]);

        res.json({ success: true, message: suspender ? 'Empresa SUSPENDIDA con éxito.' : 'Empresa REACTIVADA con éxito.', data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estatus de suspensión.' });
    }
};

// 5. NUEVO: Actualizar Empresa Existente (Editar Modo Dios)
const updateTenant = async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
    const { id } = req.params;
    const { nombre_empresa, rif, telefono, direccion, logo_url, config_fiscal } = req.body;

    try {
        const result = await pool.query(`
            UPDATE empresas 
            SET nombre = $1, rif = $2, telefono = $3, direccion = $4, logo_url = $5, config_fiscal = $6
            WHERE id = $7 RETURNING *
        `, [nombre_empresa, rif, telefono, direccion, logo_url || null, config_fiscal ? JSON.stringify(config_fiscal) : '{}', id]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error actualizando inquilino:', error);
        res.status(500).json({ error: 'Error actualizando empresa.' });
    }
};

// 6. Obtener todas las facturas SaaS (Panel de Cobranza)
const getAllInvoices = async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });

    try {
        const result = await pool.query(`
            SELECT i.*, e.nombre as empresa 
            FROM saas_invoices i
            JOIN empresas e ON i.empresa_id = e.id
            ORDER BY i.due_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo facturas SaaS:', error);
        res.status(500).json({ error: 'Error al cargar las facturas.' });
    }
};

// 7. Registrar Pago, Liquidar Factura y Extender Licencia Automáticamente
const registerPayment = async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
    const { invoiceId } = req.params;
    const { payment_method, reference_number, amount_paid_usd, notes } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // A. Buscar la factura y el empresa_id asociado
        const invQuery = await client.query(`
            SELECT empresa_id, amount_usd, status FROM saas_invoices WHERE id = $1
        `, [invoiceId]);

        if (invQuery.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Factura no encontrada.' });
        }

        const invoice = invQuery.rows[0];
        if (invoice.status === 'PAGADA') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Esta factura ya fue liquidada anteriormente.' });
        }

        const empresaId = invoice.empresa_id;
        const paidUsd = parseFloat(amount_paid_usd) || invoice.amount_usd;
        const paidVes = paidUsd * 40; // O la tasa actual que maneje tu sistema

        // B. Registrar el pago en la tabla saas_payments
        await client.query(`
            INSERT INTO saas_payments (invoice_id, empresa_id, amount_paid_usd, amount_paid_ves, payment_method, reference_number, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6, 'APROBADO', $7)
        `, [invoiceId, empresaId, paidUsd, paidVes, payment_method, reference_number, notes || '']);

        // C. Marcar la factura como PAGADA
        await client.query(`
            UPDATE saas_invoices SET status = 'PAGADA' WHERE id = $1
        `, [invoiceId]);

        // D. Extender automáticamente la licencia de la empresa por 1 mes más (o reactivarla si estaba vencida)
        await client.query(`
            UPDATE empresas 
            SET licencia_expira_el = CASE 
                WHEN licencia_expira_el < NOW() THEN NOW() + INTERVAL '1 month'
                ELSE licencia_expira_el + INTERVAL '1 month'
            END,
            suspendido_manualmente = FALSE
            WHERE id = $1
        `, [empresaId]);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Pago registrado y licencia extendida con éxito.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error registrando pago SaaS:', error);
        res.status(500).json({ error: 'Error interno al procesar el pago.' });
    } finally {
        client.release();
    }
};

// 🚨 Se agregó updateTenant al export final
module.exports = { getAllTenants, createTenant, renewLicense, toggleSuspension, updateTenant, getAllInvoices, registerPayment};