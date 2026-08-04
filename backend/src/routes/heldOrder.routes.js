const express = require('express'); 
const router = express.Router();
const { saveOrder, getOrders, deleteOrder } = require('../controllers/heldOrder.controller');

router.post('/', saveOrder);
router.get('/', getOrders);
router.delete('/:id', deleteOrder);

module.exports = router;