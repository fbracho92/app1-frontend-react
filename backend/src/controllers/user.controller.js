// backend/src/controllers/user.controller.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { auditLog } = require('../utils/logger');

// 1. Obtener todos los usuarios (sin revelar contraseñas)
const getUsers = async (req, res) => {
    try {
        const empresaId = req.user.empresa_id; // 🚨 SAAS
        const result = await pool.query(`
            SELECT u.id, u.username, u.full_name, u.email, u.status, u.last_login, u.created_at, r.name as role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.empresa_id = $1
            ORDER BY u.id DESC
        `, [empresaId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios.' });
    }
};

// 2. Obtener roles disponibles (Los roles son globales, no cambian)
const getRoles = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM roles ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roles.' });
    }
};

// 3. Crear un nuevo usuario (Cajero, Supervisor, etc.)
const createUser = async (req, res) => {
    const { username, password, full_name, email, role_id } = req.body;

    try {
        const empresaId = req.user.empresa_id; // 🚨 SAAS
        
        // Encriptación blindada de la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 🚨 SAAS: Inyectamos el empresa_id al crear el usuario
        const result = await pool.query(`
            INSERT INTO users (username, password_hash, full_name, email, role_id, empresa_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name
        `, [username, password_hash, full_name, email, role_id, empresaId]);

        const newUser = result.rows[0];

        // Guardamos en la bitácora quién creó a este usuario
        await auditLog(req.user.id, req.user.username, 'USUARIO_CREADO', 'SEGURIDAD', `Se creó el usuario: ${username}`, null, newUser, req);

        res.status(201).json({ success: true, message: 'Usuario creado exitosamente.', user: newUser });
    } catch (error) {
        if (error.code === '23505') { // Error de duplicado en PostgreSQL
            return res.status(400).json({ error: 'El nombre de usuario o correo ya existe en su empresa.' });
        }
        res.status(500).json({ error: 'Error al crear usuario.' });
    }
};

// 4. Activar / Inactivar Usuario (Legal: No se borran)
const toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVO' o 'INACTIVO'

    try {
        const empresaId = req.user.empresa_id; // 🚨 SAAS
        
        // Evitamos que el administrador se desactive a sí mismo por error
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'No puedes inactivar tu propio usuario en uso.' });
        }

        // 🚨 MEJORA UX: Buscamos el nombre real del usuario afectado antes de cambiarlo (Validando empresa)
        const targetUser = await pool.query('SELECT full_name FROM users WHERE id = $1 AND empresa_id = $2', [id, empresaId]);
        
        if (targetUser.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado o sin permisos.' });
        }
        
        const targetName = targetUser.rows[0].full_name;

        // 🚨 SAAS: Validamos actualización por empresa
        await pool.query('UPDATE users SET status = $1 WHERE id = $2 AND empresa_id = $3', [status, id, empresaId]);
        
        // 🚨 MEJORA UX: Registramos en bitácora con el nombre real
        await auditLog(req.user.id, req.user.username, 'ESTADO_USUARIO_CAMBIADO', 'SEGURIDAD', `El usuario ${targetName} cambió a estado ${status}`, null, { status }, req);

        res.json({ success: true, message: `Usuario marcado como ${status}.` });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el estado del usuario.' });
    }
};

// 5. Obtener la Bitácora del Sistema (El Ojo que todo lo ve)
const getAuditLogs = async (req, res) => {
    try {
        const empresaId = req.user.empresa_id; // 🚨 SAAS
        
        // Traemos los últimos 200 movimientos para el reporte (Aislados por empresa)
        const result = await pool.query(`
            SELECT * FROM audit_logs 
            WHERE empresa_id = $1
            ORDER BY created_at DESC 
            LIMIT 200
        `, [empresaId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la bitácora.' });
    }
};

// 6. Actualizar Usuario (Email, Nombre, Rol y Clave opcional)
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { full_name, email, role_id, password } = req.body;

    try {
        const empresaId = req.user.empresa_id; // 🚨 SAAS
        
        // 🚨 SAAS: Verificamos correos duplicados solo dentro de la misma empresa
        const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2 AND empresa_id = $3', [email, id, empresaId]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'El correo ya está en uso por otro usuario.' });
        }

        let updateQuery;
        let queryParams;

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            updateQuery = `UPDATE users SET full_name = $1, email = $2, role_id = $3, password_hash = $4 WHERE id = $5 AND empresa_id = $6`;
            queryParams = [full_name, email, role_id, password_hash, id, empresaId];
        } else {
            updateQuery = `UPDATE users SET full_name = $1, email = $2, role_id = $3 WHERE id = $4 AND empresa_id = $5`;
            queryParams = [full_name, email, role_id, id, empresaId];
        }

        const result = await pool.query(updateQuery, queryParams);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado o sin permisos.' });
        }
        
        // 🚨 MEJORA UX: Usamos la variable full_name directamente para la bitácora
        await auditLog(req.user.id, req.user.username, 'USUARIO_MODIFICADO', 'SEGURIDAD', `Actualizó los datos de: ${full_name}`, null, { full_name, email }, req);

        res.json({ success: true, message: 'Usuario actualizado correctamente.' });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        res.status(500).json({ error: 'Error al actualizar los datos del usuario.' });
    }
};

module.exports = { getUsers, getRoles, createUser, toggleUserStatus, getAuditLogs, updateUser };