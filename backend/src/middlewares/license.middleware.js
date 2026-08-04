// backend/src/middlewares/license.middleware.js
const pool = require('../config/db');

const checkLicense = async (req, res, next) => {
    try {
        // 1. Asegurarnos de que el usuario ya pasó por la autenticación y tenemos su empresa
        const empresaId = req.user?.empresa_id;
        
        if (!empresaId) {
            return res.status(401).json({ error: 'Identidad de empresa no encontrada en la sesión.' });
        }

        // 2. Consultar la vista maestra de estatus que creamos en la Fase 1
        const result = await pool.query(
            `SELECT estatus_licencia, dias_gracia, TO_CHAR(licencia_expira_el, 'DD/MM/YYYY') as fecha_corte 
             FROM vista_empresas_estatus 
             WHERE id = $1`,
            [empresaId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Empresa no registrada en el sistema matriz.' });
        }

        const { estatus_licencia, fecha_corte } = result.rows[0];

        // 3. 🛡️ REGLA: Bloqueo Manual (El "Kill Switch")
        if (estatus_licencia === 'BLOQUEADO_MANUAL') {
            return res.status(403).json({ 
                error: 'ACCESO SUSPENDIDO', 
                message: 'Su cuenta ha sido suspendida por la administración. Comuníquese con soporte de BMS Digital.' 
            });
        }

        // 4. 🛡️ REGLA: Bloqueo por Falta de Pago (Pasaron los 5 días de gracia)
        if (estatus_licencia === 'BLOQUEADO_POR_PAGO') {
            return res.status(402).json({ 
                error: 'LICENCIA EXPIRADA', 
                message: `Su suscripción venció el ${fecha_corte} y el período de gracia ha terminado. Por favor, regularice su pago para restaurar el servicio.` 
            });
        }

        // 5. ⚠️ REGLA: Período de gracia (Se permite operar, pero lanzamos una advertencia)
        if (estatus_licencia === 'EN_PERIODO_DE_GRACIA') {
            // Enviamos una cabecera HTTP oculta. Más adelante, Axios en React puede leer esto 
            // y mostrar un banner amarillo arriba que diga "Su licencia está por expirar".
            res.setHeader('X-License-Warning', `Su licencia venció el ${fecha_corte}. Está en período de gracia.`);
        }

        // 6. Todo en orden (ACTIVO o EN_PERIODO_DE_GRACIA) -> Permitimos el paso a la ruta solicitada
        next();

    } catch (error) {
        console.error('🛡️ Error en Middleware de Licencia:', error);
        res.status(500).json({ error: 'Error interno verificando el estado de su suscripción.' });
    }
};

module.exports = { checkLicense };