const providerService = require('../services/provider.service');
const { auditLog } = require('../utils/logger');

const getAll = async (req, res) => {
    try {
        const empresaId = req.user.empresa_id;
        const providers = await providerService.getProviders(empresaId);
        res.json(providers);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
};

const create = async (req, res) => {
    const { rif, name, address, phone, status } = req.body;
    try {
        const empresaId = req.user.empresa_id;
        const provider = await providerService.upsertProvider({ rif, name, address, phone, status }, empresaId);
        
        await auditLog(req.user.id, req.user.username, 'CREAR_PROVEEDOR', 'COMPRAS', `Proveedor registrado: ${provider.name}`, null, provider, req);
        res.json(provider);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'El RIF ya está registrado como proveedor en su empresa.' });
        res.status(500).json({ error: 'Error creando proveedor' });
    }
};

const update = async (req, res) => {
    const { id } = req.params;
    const { rif, name, address, phone, status } = req.body;
    try {
        const empresaId = req.user.empresa_id;
        const provider = await providerService.upsertProvider({ id, rif, name, address, phone, status }, empresaId);
        
        await auditLog(req.user.id, req.user.username, 'EDITAR_PROVEEDOR', 'COMPRAS', `Proveedor actualizado: ${provider.name}`, null, provider, req);
        res.json(provider);
    } catch (err) {
        if (err.message.includes('Proveedor no encontrado')) return res.status(404).json({ error: err.message });
        if (err.code === '23505') return res.status(409).json({ error: 'Este RIF ya pertenece a otro proveedor registrado en su empresa.' });
        res.status(500).json({ error: 'Error actualizando proveedor' });
    }
};

// Si tienes una función search, iría aquí también.
module.exports = { getAll, create, update };