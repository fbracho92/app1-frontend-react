// backend/src/routes/saas.routes.js
const express = require('express');
const router = express.Router();
const saasController = require('../controllers/saas.controller');

// Obtener la matriz de clientes
router.get('/tenants', saasController.getAllTenants);

// Crear una nueva empresa cliente
router.post('/tenants', saasController.createTenant);

// Renovar licencia (añadir tiempo)
router.put('/tenants/:id/renew', saasController.renewLicense);

// Suspender o reactivar (El Kill-Switch)
router.put('/tenants/:id/suspend', saasController.toggleSuspension);

// 🚨 NUEVO: Editar datos de la empresa (Modo Dios)
router.put('/tenants/:id', saasController.updateTenant);

// Obtener todas las facturas del sistema SaaS
router.get('/invoices', saasController.getAllInvoices);

// Registrar pago y extender licencia de un inquilino
router.post('/invoices/:invoiceId/pay', saasController.registerPayment);

module.exports = router;