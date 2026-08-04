const express = require('express');
const router = express.Router();
// 🚀 FIX ARQUITECTURA: Agregamos createDriver y updateDriver a la importación
const { 
    getDrivers, 
    createDriver, 
    updateDriver, 
    getActiveDeliveries, 
    linkSale, 
    updateStatus 
} = require('../controllers/delivery.controller');

// =========================================================================
// 📇 RUTAS DEL DIRECTORIO GENERAL (CRUD de Motorizados/Transportistas)
// =========================================================================
router.get('/drivers', getDrivers);
router.post('/drivers', createDriver);       // 🚀 NUEVA: Guarda un nuevo motorizado
router.put('/drivers/:id', updateDriver);    // 🚀 NUEVA: Edita datos y cambia estatus

// =========================================================================
// 📦 ZONA INTOCABLE: RUTAS DE DESPACHO Y LOGÍSTICA (Mantenidas al 100%)
// =========================================================================
router.get('/active', getActiveDeliveries);
router.post('/link', linkSale);
router.put('/:id/status', updateStatus);

module.exports = router;