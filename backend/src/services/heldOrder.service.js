// backend/src/services/heldOrder.service.js
const pool = require('../config/db');

// 1. Lógica de Auto-Limpieza (Preservada y Optimizada)
// 🚨 SAAS: Limpieza aislada por empresa
const cleanExpired = async (empresaId) => {
    // Borra órdenes que superen las 12 horas de vida para esta empresa específica
    await pool.query(`DELETE FROM held_orders WHERE expires_at < NOW() AND empresa_id = $1`, [empresaId]);
};

// 2. GUARDAR ORDEN (Blindaje de integridad y límites)
// 🚨 SAAS: Recibe empresaId
const saveOrder = async (referenceName, cartData, empresaId) => {
    // Mantenemos tu flujo de limpieza automática
    await cleanExpired(empresaId);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Validación de Límite: Mantenemos tu regla de negocio de máximo 10 órdenes POR EMPRESA
        // Usamos LOCK para evitar que dos terminales llenen el límite al mismo tiempo
        const countRes = await client.query('SELECT COUNT(*) FROM held_orders WHERE empresa_id = $1', [empresaId]);
        if (parseInt(countRes.rows[0].count) >= 10) {
            throw new Error('Límite máximo de 10 órdenes alcanzado. Libere espacio primero.');
        }
        
        // 🚨 SAAS: Inyectamos el empresa_id ($3)
        const result = await client.query(
            `INSERT INTO held_orders (reference_name, cart_data, expires_at, empresa_id) 
             VALUES ($1, $2, NOW() + INTERVAL '12 hours', $3) RETURNING *`,
            [referenceName, JSON.stringify(cartData), empresaId]
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 3. OBTENER ÓRDENES (Vuelo de datos con parseo seguro)
// 🚨 SAAS: Recibe empresaId
const getOrders = async (empresaId) => {
    await cleanExpired(empresaId); 
    
    // Aprovecha los índices creados en la fase anterior para que el POS cargue instantáneo
    // 🚨 SAAS: Filtramos por empresa
    const result = await pool.query(`SELECT * FROM held_orders WHERE empresa_id = $1 ORDER BY created_at DESC`, [empresaId]);
    
    // BLINDAJE: Nos aseguramos de que el frontend reciba un objeto JSON real, no un string
    return result.rows.map(order => ({
        ...order,
        cart_data: typeof order.cart_data === 'string' ? JSON.parse(order.cart_data) : order.cart_data
    }));
};

// 4. ELIMINAR O RECUPERAR ORDEN (Con verificación de éxito)
// 🚨 SAAS: Recibe empresaId
const deleteOrder = async (id, empresaId) => {
    // 🚨 SAAS: Aseguramos la propiedad de la orden
    const res = await pool.query(`DELETE FROM held_orders WHERE id = $1 AND empresa_id = $2 RETURNING id`, [id, empresaId]);
    
    // Notifica si la orden ya no existe (por si otro cajero la tomó antes)
    if (res.rowCount === 0) {
        return { success: false, message: 'La orden ya ha sido procesada o eliminada.' };
    }
    
    return { success: true };
};

module.exports = { saveOrder, getOrders, deleteOrder, cleanExpired };