// backend/src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth.middleware');

// Rutas para Usuarios
router.get('/', verifyToken, requireAdmin, userController.getUsers);
router.post('/', verifyToken, requireAdmin, userController.createUser);
router.put('/:id/status', verifyToken, requireAdmin, userController.toggleUserStatus);
router.put('/:id', verifyToken, requireAdmin, userController.updateUser);

// Rutas auxiliares
router.get('/roles', verifyToken, requireAdmin, userController.getRoles);
router.get('/audit-logs', verifyToken, requireAdmin, userController.getAuditLogs);

module.exports = router;