// backend/src/controllers/cash.controller.js
const cashService = require('../services/cash.service');

// 🚨 BLINDAJE 100%: Función helper con Auto-Sanado y Sanitización Estricta
const getRegisterId = (req) => {
    const id = req.headers['x-register-id'];
    
    // 🛡️ ESCUDO 1: Evitamos nulos, 'undefined' o strings vacíos
    if (!id || id === 'undefined' || id === 'null') {
        return 1; // Fallback seguro a la Caja Principal
    }
    
    // 🛡️ ESCUDO 2: Forzamos conversión a número entero. 
    // Si envían basura (Ej: "abc"), parseInt da NaN, y lo mandamos a la Caja 1 por seguridad.
    const parsedId = parseInt(id, 10);
    return isNaN(parsedId) ? 1 : parsedId;
};

const open = async (req, res) => {
    try {
        const registerId = getRegisterId(req);
        const userId = req.user.id; // Extraído gracias al middleware de autenticación
        
        // 🚨 SAAS: Extraemos la empresa logueada y el Rol
        const empresaId = req.user.empresa_id;
        const userRole = req.user.role || req.user.role_name; // 🚨 AÑADIDO: Extraemos el Rol
        
        // Pasamos el userRole al servicio para que bloquee a los Administradores
        const result = await cashService.openShift(req.body.initial_cash_usd, req.body.initial_cash_ves, registerId, userId, empresaId, userRole);
        res.status(200).json(result);
    } catch (e) {
        // Interceptamos tanto turnos abiertos como intentos de apertura por Administradores
        if (e.message === 'CONFLICTO_TURNO_ABIERTO' || e.message === 'RESTRICCION_ROL') {
            res.status(400).json({ error: e.message, message: e.details });
        } else {
            res.status(500).json({ error: e.message });
        }
    }
};

const getStatus = async (req, res) => {
    try {
        const registerId = getRegisterId(req);
        const userId = req.user.id;
        
        // 🚨 SAAS: Extraemos la empresa logueada y el Rol
        const empresaId = req.user.empresa_id;
        const userRole = req.user.role || req.user.role_name; // 🚨 AÑADIDO: Extraemos el Rol
        
        // Pasamos el userRole al servicio para dar el Pase VIP a los Administradores
        const result = await cashService.getStatus(registerId, userId, empresaId, userRole);
        res.status(200).json(result);
    } catch (e) {
        // 🚨 Interceptamos el bloqueo de caja ocupada para el control UX
        if (e.status === 403) res.status(403).json({ error: 'CAJA_OCUPADA', occupant: e.occupant });
        else res.status(500).json({ error: e.message });
    }
};

const close = async (req, res) => {
    try {
        const registerId = getRegisterId(req);
        const userId = req.user.id;
        const userRole = req.user.role || req.user.role_name; // Identificamos si es administrador
        
        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        // 🛡️ ESCUDO 3: Empaquetamos el body completo con valores por defecto (Fallbacks).
        // Si el frontend falla y no envía 'declared', usamos un objeto vacío {} para que la app no explote.
        // Si es Forma Libre o Nota de Entrega, 'fiscal_z_report' será null, lo cual es válido fiscalmente.
        const payload = {
            declared: req.body.declared || {},
            notes: req.body.notes || '',
            fiscal_z_report: req.body.fiscal_z_report || null
        };

        const result = await cashService.closeShift(payload, registerId, userId, userRole, empresaId);
        res.status(200).json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

module.exports = { open, getStatus, close };