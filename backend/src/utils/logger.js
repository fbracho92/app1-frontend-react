const pool = require('../config/db');

/**
 * 🛡️ Registra una acción en la Bitácora Fiscal
 */
const auditLog = async (userId, userName, action, module, details, oldValues = null, newValues = null, req = null) => {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '127.0.0.1';
        
        await pool.query(`
            INSERT INTO audit_logs (user_id, user_name, action, module, details, old_values, new_values, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [userId, userName, action, module, details, oldValues, newValues, ip]);
    } catch (error) {
        console.error('❌ Error en Bitácora:', error.message);
    }
};

module.exports = { auditLog };