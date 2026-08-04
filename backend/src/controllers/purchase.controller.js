// backend/src/controllers/purchase.controller.js
const purchaseService = require('../services/purchase.service');

const create = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos el ID de la empresa del token de seguridad
        const empresaId = req.user.empresa_id;
        
        // Pasamos el empresaId como segundo parámetro al servicio
        const result = await purchaseService.createPurchase(req.body, empresaId);
        res.json(result);
    } catch (error) {
        console.error('Error en compra:', error);
        res.status(500).json({ error: error.message });
    }
};

const getAll = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos la empresa para asegurar que solo vea sus propias compras
        const empresaId = req.user.empresa_id;
        
        const result = await purchaseService.getPurchases(empresaId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo historial de compras' });
    }
};

module.exports = { create, getAll };