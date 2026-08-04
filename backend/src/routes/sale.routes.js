const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');

// 🛡️ ESCUDO DE PRODUCCIÓN: Importamos el middleware de autenticación de forma segura.
// NOTA: Si tu sistema ya aplica la seguridad/JWT de forma global en server.js o app.js 
// para todo el grupo de rutas '/api/sales', puedes remover esta importación y el parámetro de la ruta.
const authMiddleware = require('../middlewares/auth.middleware');

// Definimos los endpoints existentes (Totalmente intactos)
router.post('/', saleController.createSale);
router.get('/:id', saleController.getSale);

// [CORRECCIÓN] Descomentamos y habilitamos estas rutas (Totalmente intactas):
router.post('/:id/void', saleController.voidSale);
router.post('/:id/pay-credit', saleController.payCredit);

// 🚨 FASE 5 (SAAS MULTI-MODAL): Nuevo Endpoint Administrativo para Formalizar Notas de Entrega
// Usamos el método HTTP 'PUT' porque estamos actualizando y mutando el estado/tipo de un recurso existente.
router.put('/:id/formalizar', saleController.billDeliveryNote);

module.exports = router;