const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cash.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// 🚨 BLINDAJE: Aplicamos verifyToken para inyectar req.user en cada petición
router.post('/open', verifyToken, ctrl.open);
router.get('/current-status', verifyToken, ctrl.getStatus);
router.post('/close', verifyToken, ctrl.close);

module.exports = router;