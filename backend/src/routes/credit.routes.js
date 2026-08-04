const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const customerController = require('../controllers/customer.controller');

// 1. Obtener Detalle de Créditos del Cliente
// Ruta Legacy: /api/credits/customer/:id
router.get('/customer/:id', reportController.getCustomerCredits);

// 2. Saldar Toda la Deuda (Pay All)
// Ruta Legacy: /api/credits/customer/:id/pay-all
router.post('/customer/:id/pay-all', customerController.payAllDebt);

module.exports = router;