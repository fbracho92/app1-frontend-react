const express = require('express');
const router = express.Router();
const providerController = require('../controllers/provider.controller');

router.get('/', providerController.getAll);
router.post('/', providerController.create);
router.put('/:id', providerController.update);

module.exports = router;