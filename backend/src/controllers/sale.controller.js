// backend/src/controllers/sale.controller.js
const saleService = require('../services/sale.service');

const createSale = async (req, res) => {
    try {
        // 🚨 1. Capturamos la estaci\u00F3n desde el Interceptor del Frontend
        const registerId = req.headers['x-register-id'];
        
        // 🚨 2. BLINDAJE SAAS: Ya no forzamos el "1" ni bloqueamos con error 400. 
        // Si no viene, lo eliminamos para que el servicio busque la primera caja que le pertenezca a ESTA empresa.
        if (registerId && registerId !== 'null' && registerId !== 'undefined') {
            req.body.register_id = parseInt(registerId, 10);
        } else {
            delete req.body.register_id; 
        }

        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        // El servicio recibe el body completo y el empresaId
        const result = await saleService.createSale(req.body, empresaId);
        res.status(200).json(result);
    } catch (error) {
        console.error('\u274C Error en venta:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message, 
            details: error.stack 
        });
    }
};

const getSale = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        const sale = await saleService.getSaleById(req.params.id, empresaId);
        if (!sale) return res.status(404).json({ success: false, error: 'Venta no encontrada' });
        res.status(200).json(sale);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [ACTUALIZADO Y BLINDADO 100%] Funci\u00F3n para Anular Venta (Generaci\u00F3n de NC Segura Multi-Caja)
const voidSale = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 🛡️ ESCUDO 1: Aseguramos que req.body sea siempre un objeto v\u00E1lido, 
        // incluso si el frontend omite enviar datos en la petici\u00F3n.
        if (!req.body || typeof req.body !== 'object') {
            req.body = {};
        }
        
        // 🛡️ ESCUDO 2 (AGUJERO CERRADO): Interceptamos la caja que emite la anulaci\u00F3n.
        // Esto garantiza que la Nota de Cr\u00E9dito use la Serie y Secuencia de la caja correcta.
        const registerId = req.headers['x-register-id'];
        
        if (registerId && registerId !== 'null' && registerId !== 'undefined') {
            req.body.register_id = parseInt(registerId, 10);
        } else {
            delete req.body.register_id; // Dejamos que el servicio resuelva por empresa_id
        }

        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        // Pasamos todo el payload validado y la empresa al servicio
        const result = await saleService.voidSale(id, req.body, empresaId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('\u274C Error anulando venta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// [INTACTO] Funci\u00F3n para Abonar Cr\u00E9dito
const payCredit = async (req, res) => {
    try {
        const { id } = req.params;
        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        const result = await saleService.payCredit(id, req.body, empresaId);
        res.status(200).json(result);
    } catch (error) {
        console.error('\u274C Error pagando cr\u00E9dito:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const billDeliveryNote = async (req, res) => {
    try {
        const { id } = req.params;
        const registerId = req.headers['x-register-id'];

        if (!req.body || typeof req.body !== 'object') {
            req.body = {};
        }
        
        // 🚨 BLINDAJE SAAS: Atamos de forma obligatoria la petici\u00F3n a la estaci\u00F3n real
        // o dejamos que el servicio asigne la caja correcta de la empresa
        if (registerId && registerId !== 'null' && registerId !== 'undefined') {
            req.body.register_id = parseInt(registerId, 10);
        } else {
            delete req.body.register_id; 
        }

        // 🚨 SAAS: Extraemos la empresa logueada
        const empresaId = req.user.empresa_id;

        const result = await saleService.billDeliveryNote(id, req.body, empresaId);
        res.status(200).json(result);
    } catch (error) {
        console.error('\u274C Error formalizando Nota de Entrega:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { createSale, getSale, voidSale, payCredit, billDeliveryNote };