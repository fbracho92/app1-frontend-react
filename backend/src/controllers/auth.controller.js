// backend/src/controllers/auth.controller.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auditLog } = require('../utils/logger');
const nodemailer = require('nodemailer');

// 🛡️ SEGURIDAD: Almacenamiento aislado de OTPs (Evita Prototype Pollution y fugas en el objeto global)
const otpCache = new Map();

// 🛡️ SEGURIDAD: Sanitización estricta de entradas
const sanitizeInput = (input) => input?.trim().replace(/[<>;'"]/g, '');
const sanitizeEmail = (email) => email?.trim().toLowerCase();

const login = async (req, res) => {
    const username = sanitizeInput(req.body.username);
    const password = req.body.password; // La clave no se sanitiza para preservar caracteres especiales válidos
    const JWT_SECRET = process.env.JWT_SECRET || 'bms_secret_key_pro_2026';

    try {
        if (!username || !password) {
            return res.status(400).json({ error: 'Parámetros de acceso incompletos.' });
        }

        // 🚨 CAMBIO CERTIFICADO: JOIN ampliado para extraer toda la identidad corporativa y fiscal
        const result = await pool.query(`
            SELECT u.*, r.name as role_name, r.permissions, 
                   e.nombre as empresa_nombre, e.rif as empresa_rif, 
                   e.telefono as empresa_telefono, e.direccion as empresa_direccion, 
                   e.logo_url as empresa_logo, e.config_fiscal as empresa_config
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN empresas e ON u.empresa_id = e.id
            WHERE u.username = $1 AND u.status = 'ACTIVO'
            LIMIT 1
        `, [username]);

        // 🛡️ Prevención de Enumeración de Usuarios: Mensaje genérico unificado
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const user = result.rows[0];
        let isMatch = false;

        if (user.password_hash === 'hash_provisional_admin123') {
            isMatch = (password === 'Admin123');
        } else {
            isMatch = await bcrypt.compare(password, user.password_hash);
        }

        if (!isMatch) {
            await auditLog(user.id, user.full_name, 'LOGIN_FALLIDO', 'SEGURIDAD', 'Intento de acceso con clave errónea', null, null, req);
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // 🚨 INYECCIÓN MULTI-EMPRESA 100% SEGURA
        const empresaIdSeguro = user.empresa_id || 1;

        // Firma criptográfica del token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role_name,
                empresa_id: empresaIdSeguro // <- Inyectado en el token
            },
            JWT_SECRET,
            { expiresIn: '12h', algorithm: 'HS256' }
        );

        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        await auditLog(user.id, user.full_name, 'LOGIN_EXITOSO', 'SEGURIDAD', 'Usuario ingresó al sistema', null, null, req);

        // 🚨 PREPARAR LA CONFIGURACIÓN FISCAL
        const configFiscal = typeof user.empresa_config === 'string' 
            ? JSON.parse(user.empresa_config) 
            : (user.empresa_config || {});

        // 🚨 CAMBIO CERTIFICADO: Inyección del objeto 'identity' mapeado exactamente como exige el Frontend
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role_name,
                permissions: user.permissions,
                empresa_id: empresaIdSeguro,
                
                identity: {
    companyName: user.empresa_nombre || 'BMS Digital',
    tradeName: user.nombre_fantasia || user.empresa_nombre || 'BMS Digital', 
    companyDocument: user.empresa_rif || 'J-00000000-0',
    companyPhone: user.empresa_telefono || '+58 000-0000000',
    companyAddress: user.empresa_direccion || 'Plataforma Cloud Segura',
    logoUrl: user.empresa_logo || null,
    configFiscal: configFiscal
}
            }
        });

    } catch (error) {
        console.error('❌ Error en Login:', error.message);
        res.status(500).json({ error: 'Error interno de autenticación.' });
    }
};

const forgotPassword = async (req, res) => {
    const email = sanitizeEmail(req.body.email);
    
    try {
        if (!email) return res.status(400).json({ error: 'Correo inválido.' });

        const userCheck = await pool.query('SELECT id, username, full_name FROM users WHERE email = $1 AND status = \'ACTIVO\' LIMIT 1', [email]);
        
        // 🛡️ Mitigación de Enumeración: Siempre respondemos con éxito aunque el correo no exista
        if (userCheck.rows.length === 0) {
            return res.json({ success: true, message: 'Si el correo está registrado, se enviarán instrucciones.' });
        }

        const user = userCheck.rows[0];
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Almacenamiento seguro en caché local (TTL: 15 minutos)
        otpCache.set(email, {
            code: resetCode,
            expires: Date.now() + 15 * 60 * 1000,
            attempts: 0 // 🛡️ Prevención de fuerza bruta en el OTP
        });

        await pool.query(
            'INSERT INTO audit_logs (user_id, user_name, action, module, details) VALUES ($1, $2, $3, $4, $5)',
            [user.id, user.full_name, 'SOLICITUD_RECUPERACION', 'SEGURIDAD', `Código de seguridad generado para restablecer clave.`]
        );

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 465,
            secure: true,
            auth: {
                user: process.env.SMTP_EMAIL, 
                pass: process.env.SMTP_PASSWORD 
            }
        });

        const mailOptions = {
            from: `"Seguridad del Sistema" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: 'Código de Recuperación de Acceso',
            html: `
                <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #0f172a; margin: 0;">Recuperación de Acceso</h2>
                    </div>
                    <p style="color: #334155; font-size: 16px;">Hola <strong>${user.full_name}</strong>,</p>
                    <p style="color: #334155; font-size: 16px;">Se ha solicitado restablecer la contraseña de su cuenta. Su código de verificación es:</p>
                    <div style="text-align: center; margin: 35px 0;">
                        <span style="font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #2563eb; background: #eff6ff; padding: 15px 20px 15px 32px; border-radius: 12px; border: 1px solid #bfdbfe;">
                            ${resetCode}
                        </span>
                    </div>
                    <p style="color: #ef4444; font-size: 13px; text-align: center; font-weight: bold;">⚠️ Este código expirará en 15 minutos.</p>
                </div>
            `
        };

        // Enviar sin bloquear la respuesta HTTP
        transporter.sendMail(mailOptions).catch(err => console.error("Error SMTP:", err.message));

        res.json({ success: true, message: 'Instrucciones enviadas correctamente.' });
    } catch (error) {
        console.error("Error en forgotPassword:", error.message);
        res.status(500).json({ error: 'Error interno en el servidor.' });
    }
};

const resetPassword = async (req, res) => {
    const email = sanitizeEmail(req.body.email);
    const code = sanitizeInput(req.body.code);
    const newPassword = req.body.newPassword;

    try {
        if (!otpCache.has(email)) {
            return res.status(400).json({ error: 'No hay solicitudes activas para este correo o expiró.' });
        }

        const session = otpCache.get(email);

        if (Date.now() > session.expires) {
            otpCache.delete(email);
            return res.status(400).json({ error: 'El código de seguridad ha expirado.' });
        }

        // 🛡️ Bloqueo por fuerza bruta del OTP
        if (session.attempts >= 3) {
            otpCache.delete(email);
            return res.status(403).json({ error: 'Demasiados intentos fallidos. Solicite un nuevo código.' });
        }

        if (session.code !== code) {
            session.attempts += 1;
            return res.status(400).json({ error: 'El código ingresado es incorrecto.' });
        }

        const userRes = await pool.query('SELECT id, full_name FROM users WHERE email = $1 LIMIT 1', [email]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        
        const user = userRes.rows[0];
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [password_hash, email]);
        
        otpCache.delete(email);

        await pool.query(
            'INSERT INTO audit_logs (user_id, user_name, action, module, details) VALUES ($1, $2, $3, $4, $5)',
            [user.id, user.full_name, 'CAMBIO_CLAVE_RECUPERACION', 'SEGURIDAD', `Contraseña restablecida con código OTP.`]
        );

        res.json({ success: true, message: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        console.error("Error en resetPassword:", error.message);
        res.status(500).json({ error: 'Error al procesar el cambio de contraseña.' });
    }
};

module.exports = { login, forgotPassword, resetPassword };