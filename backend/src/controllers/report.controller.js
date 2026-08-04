// backend/src/controllers/report.controller.js
const reportService = require('../services/report.service');

// 🛡️ LÓGICA DE BLINDAJE (Regla de negocio centralizada) - INTACTA
const getFilter = (req) => {
    // 1. Identificamos quién hace la petición (injetado por auth.middleware)
    const user = req.user;
    const isMasterOrSupervisor = user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR';
    
    // 2. Si es Admin o Supervisor: Obligamos a ver el consolidado global (null)
    // Esto es vital para el SENIAT: el dueño nunca debe ver una caja aislada por error.
    if (isMasterOrSupervisor) return null;

    // 3. Si es Cajero: Forzamos el filtro a SU caja
    const registerId = req.headers['x-register-id'];
    return registerId || -1; // -1 bloquea datos si no hay caja definida
};

// --- RUTAS QUE REQUIEREN VISTA CONSOLIDADA LEGAL (Dueño/Admin) ---
// 🚨 SAAS: Extraemos empresaId del token y lo pasamos como parámetro final
const getAnalytics = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getAnalytics(req.query.startDate, req.query.endDate, getFilter(req), empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getDetail = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getSalesDetail(req.query.startDate, req.query.endDate, req.query.search, getFilter(req), empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getSalesBook = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getSalesBook(req.query.startDate, req.query.endDate, getFilter(req), empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getClosings = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getClosingsHistory(getFilter(req), empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};

// --- RUTAS OPERATIVAS (El cajero solo ve su caja) ---
const getDaily = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getDailyReport(getFilter(req), empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getRecent = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getRecentSales(getFilter(req), empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getToday = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getSalesToday(getFilter(req), empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};

// --- RUTAS GENERALES (Inventario, stock, etc. son globales por naturaleza dentro de la empresa) ---
const getLowStock = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getLowStock(empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getPendingCredits = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getCreditPending(empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getGroupedCredits = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getCreditGrouped(empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getCustomerCredits = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getCustomerCredits(req.params.id, empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getInventory = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getInventoryDetail(empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getAgedDebt = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getAgedDebt(empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};
const getConnectivityLogs = async (req, res) => { try { const empresaId = req.user.empresa_id; res.json(await reportService.getConnectivityLogs(empresaId)); } catch(e) { res.status(500).json({error: e.message}); }};

module.exports = { 
    getDaily, getRecent, getLowStock, getToday, getPendingCredits, getGroupedCredits, 
    getCustomerCredits, getAnalytics, getDetail, getInventory, getSalesBook, getAgedDebt, getClosings, getConnectivityLogs
};