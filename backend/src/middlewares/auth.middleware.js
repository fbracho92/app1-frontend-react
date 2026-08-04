// backend/src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // 1. Buscamos el token en las cabeceras de la petición
    const bearerHeader = req.headers['authorization'];

    if (!bearerHeader) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere un token de seguridad.' });
    }

    // El formato estándar es "Bearer <token>"
    const token = bearerHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ error: 'Formato de token inválido.' });
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'bms_secret_key_pro_2026';
        
        // 2. Verificamos y desencriptamos el token
        const decoded = jwt.verify(token, JWT_SECRET);

        // 👇 INICIO DEL CÓDIGO NUEVO (Validación Multi-Empresa) 👇
        if (!decoded.empresa_id) {
            return res.status(401).json({ error: 'Token inválido: Usuario no asociado a ninguna empresa.' });
        }
        // 👆 FIN DEL CÓDIGO NUEVO 👆
        
        // 3. Guardamos los datos del usuario en la petición
        // Ahora req.user incluirá automáticamente req.user.empresa_id
        req.user = decoded;
        
        // 4. Damos paso libre a la ruta solicitada
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.' });
        }
        return res.status(401).json({ error: 'Token de seguridad inválido o corrompido.' });
    }
};

// Middleware de control de roles INTACTO
const requireAdmin = (req, res, next) => {
    // 1. Forzamos a mayúsculas para evitar errores por cómo esté escrito en la base de datos
    const role = (req.user.role || req.user.role_name || '').toString().toUpperCase(); 
    
    // 2. Permitimos el paso tanto a ADMINISTRADOR como a SUPERVISOR
    if (role !== 'ADMINISTRADOR' && role !== 'SUPERVISOR') {
        return res.status(403).json({ 
            error: 'ACCESO RESTRINGIDO: Esta acción requiere privilegios gerenciales (Administrador o Supervisor).' 
        });
    }
    
    // Si el usuario es ADMINISTRADOR o SUPERVISOR, permitimos que avance
    next();
};

module.exports = { verifyToken, requireAdmin };