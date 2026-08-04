const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/report.controller');

// Rutas Generales
router.get('/daily', ctrl.getDaily);
router.get('/recent-sales', ctrl.getRecent);
router.get('/low-stock', ctrl.getLowStock);
router.get('/sales-today', ctrl.getToday);
router.get('/analytics', ctrl.getAnalytics);
router.get('/sales-detail', ctrl.getDetail);
router.get('/inventory-detail', ctrl.getInventory);
router.get('/closings', ctrl.getClosings);

// Rutas de Créditos (Alias para mantener orden)
router.get('/credit-pending', ctrl.getPendingCredits);
router.get('/credit-grouped', ctrl.getGroupedCredits);
// Nota: Esta ruta requiere parametro ID, asegúrate de llamarla correctamente desde frontend
// En server.js era /api/credits/customer/:id. Ahora será /api/reports/credits/customer/:id
router.get('/credits/customer/:id', ctrl.getCustomerCredits);

// Rutas Legales
router.get('/legal/sales-book', ctrl.getSalesBook);
router.get('/legal/aged-debt', ctrl.getAgedDebt);

router.get('/legal/connectivity-logs', ctrl.getConnectivityLogs);

module.exports = router;