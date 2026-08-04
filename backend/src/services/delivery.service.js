// backend/src/services/delivery.service.js
const pool = require('../config/db');

// 1. OBTENER MOTORIZADOS / TRANSPORTE (Adaptado para el Directorio Unificado)
// 🚨 SAAS: Recibimos empresaId y filtramos
const getDrivers = async (empresaId) => {
    // 🚀 FIX: Quitamos el "WHERE status = 'ACTIVO'" para que el Directorio pueda ver a los inactivos y permitir editarlos.
    const res = await pool.query(
        "SELECT * FROM delivery_drivers WHERE empresa_id = $1 ORDER BY name ASC",
        [empresaId]
    );
    return res.rows;
};

// 🚀 NUEVA FUNCIÓN: Crear Motorizado / Transporte
// 🚨 SAAS: Inyectamos empresaId
const createDriver = async (data, empresaId) => {
    const { id_number, name, phone, vehicle_info, status } = data;
    const res = await pool.query(
        `INSERT INTO delivery_drivers (id_number, name, phone, vehicle_info, status, empresa_id) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        // 🛡️ BLINDAJE: Si un dato viene vacío (ej. placa), se guarda como null en lugar de fallar
        [id_number || null, name, phone || null, vehicle_info || null, status || 'ACTIVO', empresaId]
    );
    return res.rows[0];
};

// 🚀 NUEVA FUNCIÓN: Actualizar Motorizado / Transporte
// 🚨 SAAS: Validamos propiedad con empresaId
const updateDriver = async (id, data, empresaId) => {
    const { id_number, name, phone, vehicle_info, status } = data;
    const res = await pool.query(
        `UPDATE delivery_drivers 
         SET id_number = $1, name = $2, phone = $3, vehicle_info = $4, status = $5 
         WHERE id = $6 AND empresa_id = $7 RETURNING *`,
        [id_number || null, name, phone || null, vehicle_info || null, status || 'ACTIVO', id, empresaId]
    );
    
    // 🛡️ BLINDAJE: Evita bloqueos si se envía un ID que no existe
    if (res.rowCount === 0) throw new Error('Transportista no encontrado en la base de datos o sin permisos.');
    return res.rows[0];
};

// 2. ENTREGAS ACTIVAS (Vuelo de Datos para el Dashboard de Despachos)
// 🚨 SAAS: Filtramos ventas por empresaId
const getActiveDeliveries = async (empresaId) => {
    // Mantiene tu consulta exacta de filtrado por estados PENDIENTE y EN_RUTA
    // Esta consulta ahora aprovecha los índices de base de datos creados anteriormente para ser instantánea.
    const res = await pool.query(`
        SELECT s.id as sale_id, s.total_ves, s.total_usd, s.status as sale_status, s.payment_method, s.created_at, 
               s.delivery_info, c.full_name as customer_name, c.phone as customer_phone
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.is_delivery = true 
          AND (s.delivery_info->>'status' = 'PENDIENTE' OR s.delivery_info->>'status' = 'EN_RUTA')
          AND s.empresa_id = $1
        ORDER BY s.created_at DESC
    `, [empresaId]);
    return res.rows;
};

// 3. VINCULAR VENTA A DELIVERY (Blindaje de Integridad JSON)
// 🚨 SAAS: Validamos propiedad de la venta
const linkSaleToDelivery = async (saleId, deliveryInfo, empresaId) => {
    // Se mantiene tu lógica de vinculación.
    // Se añade un blindaje para asegurar que deliveryInfo sea siempre un JSON válido antes de enviarlo a PostgreSQL.
    const res = await pool.query(
        `UPDATE sales SET is_delivery = true, delivery_info = $1 WHERE id = $2 AND empresa_id = $3 RETURNING *`,
        [typeof deliveryInfo === 'string' ? deliveryInfo : JSON.stringify(deliveryInfo), saleId, empresaId]
    );
    return res.rows[0];
};

// 4. ACTUALIZAR ESTADO (Blindaje de Trazabilidad JSONB)
// 🚨 SAAS: Validamos propiedad de la venta
const updateDeliveryStatus = async (saleId, status, empresaId) => {
    // Mantiene tu lógica avanzada de jsonb_set para no borrar datos adicionales (como el motorizado asignado).
    // Se corrige el formato de entrada del parámetro status para asegurar compatibilidad 100% con tipos JSONB.
    const res = await pool.query(`
        UPDATE sales
        SET delivery_info = jsonb_set(
            COALESCE(delivery_info, '{}'::jsonb), 
            '{status}', 
            $1::jsonb
        )
        WHERE id = $2 AND empresa_id = $3 RETURNING *
    `, [JSON.stringify(status), saleId, empresaId]);
    
    return res.rows[0];
};

// 🚀 FIX EXPORTACIONES: Se agregan createDriver y updateDriver al final
module.exports = { 
    getDrivers, 
    createDriver, 
    updateDriver, 
    getActiveDeliveries, 
    linkSaleToDelivery, 
    updateDeliveryStatus 
};