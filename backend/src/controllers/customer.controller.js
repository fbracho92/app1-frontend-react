// backend/src/controllers/customer.controller.js
const customerService = require('../services/customer.service');
// Para mantener el orden, importamos el servicio de VENTAS aquí, ya que es una acción sobre ventas.
const saleService = require('../services/sale.service');

const getAll = async (req, res) => {
    try {
        // 🚨 SAAS: Extraemos el empresa_id del token de seguridad
        const empresaId = req.user.empresa_id;
        const customers = await customerService.getCustomers(empresaId);
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar clientes' });
    }
};

const upsert = async (req, res) => {
    const { full_name, id_number, status } = req.body;
    if (!full_name || !id_number || !status) {
        return res.status(400).json({ error: 'Datos obligatorios faltantes.' });
    }
    
    try {
        // 🚨 SAAS: Inyectamos empresaId
        const empresaId = req.user.empresa_id;
        const customer = await customerService.upsertCustomer(req.body, empresaId);
        res.json(customer);
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: `Identificador ${id_number} duplicado.` });
        } else if (err.message === 'Cliente no encontrado') {
            res.status(404).json({ error: err.message });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
};

const search = async (req, res) => {
    const { query } = req.query; 
    if (!query) return res.status(400).json({ error: 'Parámetro query requerido.' });
    
    try {
        // 🚨 SAAS: Inyectamos empresaId para no buscar clientes de otras empresas
        const empresaId = req.user.empresa_id;
        const results = await customerService.search(query, empresaId);
        res.json(results);
    } catch (error) {
        console.error('Error buscando clientes:', error);
        res.status(500).json({ error: 'Error al buscar cliente' });
    }
};

// Lógica para Saldo Inicial (Deuda Vieja)
const setInitialBalance = async (req, res) => {
    const { id } = req.params;
    const { amount, description } = req.body;

    try {
        // 🚨 SAAS: Inyectamos empresaId para asegurar que la deuda quede en la empresa correcta
        const empresaId = req.user.empresa_id;
        const result = await customerService.registerInitialBalance(id, { amount, description }, empresaId);
        res.json(result);
    } catch (error) {
        console.error('Error en saldo inicial:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================================
// 🛡️ Lógica para Saldar Toda la Deuda (Pay All) / Abono Global FIFO
// ============================================================================
const payAllDebt = async (req, res) => {
    const { id } = req.params;
    
    // 🚨 BLINDAJE APLICADO: Extraemos payment_details y amountUSD del Frontend
    const { paymentDetails, payment_details, amountUSD } = req.body;
    
    try {
        // 🚨 SAAS: Extraemos empresaId
        const empresaId = req.user.empresa_id;
        
        // Inyectamos el amountUSD al servicio para que haga el cálculo FIFO
        const result = await saleService.payAllCustomerCredits(id, { 
            paymentDetails: payment_details || paymentDetails, 
            amountUSD 
        }, empresaId); // <-- También se lo pasamos al servicio de ventas
        
        res.json(result);
    } catch (error) {
        console.error("Error en Pay-All:", error.message);
        // Manejo específico si el cliente ya está solvente
        if (error.message === 'Cliente solvente') {
            return res.status(400).json({ error: 'El cliente está solvente (sin deuda pendiente activa).' });
        }
        res.status(500).json({ error: 'Error al procesar el pago masivo: ' + error.message });
    }
};

module.exports = { getAll, upsert, search, setInitialBalance, payAllDebt };