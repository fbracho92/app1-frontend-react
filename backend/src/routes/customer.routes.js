const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// Rutas base /api/customers
router.get('/', customerController.getAll);
router.post('/', customerController.upsert);
router.get('/search', customerController.search);

// Ruta para Saldo Inicial (Deuda Vieja)
router.post('/:id/initial-balance', customerController.setInitialBalance);

// Ruta para Saldar Deuda Total (Aunque es una acción financiera, en tu server.js estaba ligada al cliente)
// OJO: En tu server.js original la ruta era /api/credits/customer/:id/pay-all
// Si decides moverla aquí bajo /api/customers, la ruta final será /api/customers/:id/pay-all
// Asegúrate de actualizar el Frontend si cambias la URL base.
// Si quieres mantener estrictamente la ruta vieja, deberías poner esto en report.routes o sale.routes,
// pero por orden RESTful, pertenece aquí o a créditos. La dejaré aquí para que sea funcional.
router.post('/:id/pay-all', customerController.payAllDebt);

module.exports = router;