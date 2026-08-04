const pool = require('../config/db');

const getProviders = async (empresaId) => {
    const res = await pool.query('SELECT * FROM providers WHERE empresa_id = $1 ORDER BY name ASC', [empresaId]);
    return res.rows;
};

const upsertProvider = async (data, empresaId) => {
    const { id, name, rif, address, phone, status } = data;
    const client = await pool.connect();
    try {
        let result;
        if (id) {
            // Actualizar (Validando empresa_id)
            result = await client.query(
                `UPDATE providers SET rif = $1, name = $2, address = $3, phone = $4, status = $5 WHERE id = $6 AND empresa_id = $7 RETURNING *`,
                [rif, name, address, phone, status || 'ACTIVO', id, empresaId]
            );
            if (result.rowCount === 0) throw new Error('Proveedor no encontrado o acceso denegado');
        } else {
            // Crear (Con blindaje ON CONFLICT usando empresa_id)
            result = await client.query(
                `INSERT INTO providers (rif, name, address, phone, status, empresa_id) VALUES ($1, $2, $3, $4, $5, $6) 
                 ON CONFLICT (empresa_id, rif) DO UPDATE SET name = $2, address = $3, phone = $4, status = $5 RETURNING *`,
                [rif, name, address, phone, status || 'ACTIVO', empresaId]
            );
        }
        return result.rows[0];
    } finally {
        client.release();
    }
};

module.exports = { getProviders, upsertProvider };