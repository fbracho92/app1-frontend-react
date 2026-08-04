// backend/src/controllers/delivery.controller.js
const DeliveryService = require('../services/delivery.service');

// 1. OBTENER TODOS LOS MOTORIZADOS
const getDrivers = async (req, res) => {
    try { 
        // 🚨 SAAS: Extraemos empresaId
        const empresaId = req.user.empresa_id;
        res.json(await DeliveryService.getDrivers(empresaId)); 
    } 
    catch (error) { res.status(500).json({ message: 'Error al obtener motorizados' }); }
};

// 🚀 NUEVO: CONTROLADOR PARA CREAR TRANSPORTISTA
const createDriver = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos empresaId
        const empresaId = req.user.empresa_id;
        const result = await DeliveryService.createDriver(req.body, empresaId);
        res.json(result);
    } catch (err) {
        console.error(err);
        // 🛡️ BLINDAJE: Capturamos el error 23505 de PostgreSQL (Duplicidad)
        if (err.code === '23505') {
            return res.status(409).json({ error: 'La Cédula/RIF o el Teléfono ya están registrados en su empresa.' });
        }
        res.status(500).json({ error: 'Error interno al crear transportista.' });
    }
};

// 🚀 NUEVO: CONTROLADOR PARA ACTUALIZAR TRANSPORTISTA
const updateDriver = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos empresaId
        const empresaId = req.user.empresa_id;
        const result = await DeliveryService.updateDriver(req.params.id, req.body, empresaId);
        res.json(result);
    } catch (err) {
        console.error(err);
        // 🛡️ BLINDAJE: Protegemos contra duplicidad al editar
        if (err.code === '23505') {
            return res.status(409).json({ error: 'La Cédula/RIF o el Teléfono ya pertenecen a otro transportista de su empresa.' });
        }
        res.status(500).json({ error: err.message || 'Error interno al actualizar transportista.' });
    }
};

// =========================================================================
// 📦 ZONA INTOCABLE: LÓGICA DE DESPACHOS Y VENTAS (MANTENIDA 100% ORIGINAL)
// =========================================================================

const getActiveDeliveries = async (req, res) => {
    try { 
        // 🚨 SAAS: Extraemos empresaId
        const empresaId = req.user.empresa_id;
        res.json(await DeliveryService.getActiveDeliveries(empresaId)); 
    } 
    catch (error) { res.status(500).json({ message: 'Error al obtener deliveries' }); }
};

const linkSale = async (req, res) => {
    try {
        const { saleId, deliveryInfo } = req.body;
        // 🚨 SAAS: Extraemos empresaId
        const empresaId = req.user.empresa_id;
        const result = await DeliveryService.linkSaleToDelivery(saleId, deliveryInfo, empresaId);
        res.json(result);
    } catch (error) { res.status(500).json({ message: 'Error al enlazar delivery' }); }
};

const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        // 🚨 SAAS: Extraemos empresaId
        const empresaId = req.user.empresa_id;
        const result = await DeliveryService.updateDeliveryStatus(req.params.id, status, empresaId);
        res.json(result);
    } catch (error) { res.status(500).json({ message: 'Error al actualizar estatus' }); }
};

// 🚀 FIX EXPORTACIONES: Agregamos createDriver y updateDriver al objeto final
module.exports = { 
    getDrivers, 
    createDriver, 
    updateDriver, 
    getActiveDeliveries, 
    linkSale, 
    updateStatus 
};