// backend/src/controllers/product.controller.js
const productService = require('../services/product.service');

const getAll = async (req, res) => {
    try { 
        // 🚨 SAAS: Extraemos el ID de la empresa del token
        const empresaId = req.user.empresa_id;
        res.json(await productService.getAllProducts(empresaId)); 
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
};

const getBatches = async (req, res) => {
    try { 
        const empresaId = req.user.empresa_id;
        res.json(await productService.getBatches(req.params.id, empresaId)); 
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
};

const upsert = async (req, res) => {
    try { 
        const empresaId = req.user.empresa_id;
        res.json(await productService.upsertProduct(req.body, empresaId)); 
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
};

const move = async (req, res) => {
    try { 
        const empresaId = req.user.empresa_id;
        res.json(await productService.registerMovement(req.body, empresaId)); 
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
};

const history = async (req, res) => {
    try { 
        const empresaId = req.user.empresa_id;
        res.json(await productService.getHistory(req.params.id, empresaId)); 
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
};

const processAudit = async (req, res) => {
    try {
        const empresaId = req.user.empresa_id;
        const userId = req.user.id;
        const userName = req.user.username || 'Usuario';
        
        const result = await productService.processAudit(req.body, userId, userName, empresaId);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const getAuditHistory = async (req, res) => {
    try { res.json(await productService.getAuditHistory(req.user.empresa_id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
};

const getAuditDetails = async (req, res) => {
    try { res.json(await productService.getAuditDetails(req.params.id, req.user.empresa_id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getAll, getBatches, upsert, move, history, processAudit, getAuditHistory, getAuditDetails };