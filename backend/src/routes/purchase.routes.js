const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase.controller');

// Rutas para /api/purchases
router.get('/', purchaseController.getAll);
router.post('/', purchaseController.create);

module.exports = router;