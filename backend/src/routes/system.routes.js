// backend/src/routes/system.routes.js
const express = require('express');
const router = express.Router();
const { getRate, getFallback } = require('../utils/bcvState');

// 🚨 Importamos los middlewares de seguridad (FULL QA)
const { verifyToken, requireAdmin } = require('../middlewares/auth.middleware');

// 🚨 Importamos el nuevo controlador de secuencias (Fase 5)
const systemController = require('../controllers/system.controller');

// =======================================================
// 1. TU C\u00D3DIGO ORIGINAL INTACTO (Salud del servidor y BCV)
// =======================================================
router.get('/', (req, res) => {
    res.json({
        status: 'online',
        bcv_rate: getRate(),        // Esto asegura que bcvRate nunca sea undefined
        fallback_rate: getFallback(),
        server_time: new Date()
    });
});

// =======================================================
// 2. NUEVAS RUTAS FASE 5 (Control de Correlativos Forma Libre)
// =======================================================
// GET: Trae los n\u00FAmeros actuales de las facturas (Solo Admin)
router.get('/sequences', verifyToken, requireAdmin, systemController.getSequences);

// PUT: Permite al administrador editar el n\u00FAmero (Ej: Cambiar a la Factura 49) (Solo Admin)
router.put('/sequences', verifyToken, requireAdmin, systemController.updateSequence);

// 🚨 [NUEVO] Ruta para guardar configuraciones del sistema (Solo Admin)
router.put('/settings', verifyToken, requireAdmin, systemController.updateSettings);

// 🚨 [NUEVO] Ruta para LEER configuraciones del sistema (GET) - ESTA ERA LA QUE FALTABA (Solo Admin)
router.get('/settings', verifyToken, requireAdmin, systemController.getSettings);

// 🚨 [NUEVO] Rutas de Control Multi-Caja (Fase 5)
// Solo requiere verifyToken porque el Supervisor/Cajero necesita listar las cajas para abrir turno
router.get('/registers', verifyToken, systemController.getRegisters);

// Crear o actualizar cajas es exclusivo del Administrador
router.put('/registers/:id', verifyToken, requireAdmin, systemController.updateRegister);
router.post('/registers', verifyToken, requireAdmin, systemController.createRegister);

// 🏢 [NUEVO SAAS] Ruta para guardar configuraci\u00F3n aislada de la empresa (Solo Admin)
router.put('/tenant-settings', verifyToken, requireAdmin, systemController.updateTenantSettings);

module.exports = router;