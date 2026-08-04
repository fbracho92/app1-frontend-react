const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// Rutas Legacy para Inventario
// El frontend llama a /api/inventory/...

router.post('/movement', productController.move);       // Entrada/Salida
router.get('/history/:id', productController.history);  // Kardex
router.get('/batches/:id', productController.getBatches); // Lotes

module.exports = router;