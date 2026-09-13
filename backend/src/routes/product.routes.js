const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/product.controller');

router.get('/', ctrl.getAll);
router.post('/', ctrl.upsert);
router.get('/batches/:id', ctrl.getBatches); // Nota: En server.js era /api/inventory/batches/:id, ajústalo en frontend o usa /inventory/batches aquí
router.post('/movement', ctrl.move);
router.get('/history/:id', ctrl.history);

module.exports = router;