// backend/src/controllers/heldOrder.controller.js
const HeldOrderService = require('../services/heldOrder.service');

const saveOrder = async (req, res) => {
    try {
        const { referenceName, cartData } = req.body;
        if (!referenceName || !cartData || cartData.length === 0) {
            return res.status(400).json({ message: 'Datos incompletos para pausar orden' });
        }
        
        // 🚨 SAAS: Extraemos el ID de la empresa del token
        const empresaId = req.user.empresa_id;
        
        const order = await HeldOrderService.saveOrder(referenceName, cartData, empresaId);
        res.status(201).json({ message: 'Orden pausada con éxito', order });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Error al pausar orden' });
    }
};

const getOrders = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos el ID de la empresa
        const empresaId = req.user.empresa_id;
        
        const orders = await HeldOrderService.getOrders(empresaId);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener órdenes' });
    }
};

const deleteOrder = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos el ID de la empresa para asegurar que solo borre órdenes propias
        const empresaId = req.user.empresa_id;
        
        await HeldOrderService.deleteOrder(req.params.id, empresaId);
        res.json({ message: 'Orden descartada' });
    } catch (error) {
        res.status(500).json({ message: 'Error al descartar orden' });
    }
};

module.exports = { saveOrder, getOrders, deleteOrder };