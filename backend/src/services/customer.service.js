// backend/src/services/customer.service.js
const pool = require('../config/db');
const { getRate } = require('../utils/bcvState');

// 1. OBTENER CLIENTES (Ordenado alfabéticamente para mejor UX y Filtrado por Empresa)
const getCustomers = async (empresaId) => {
    // 🚨 SAAS: Se agrega WHERE empresa_id = $1
    return (await pool.query('SELECT * FROM customers WHERE empresa_id = $1 ORDER BY full_name ASC', [empresaId])).rows;
};

// 2. UPSERT DE CLIENTE (Blindaje nativo contra duplicados y Multi-Inquilino)
const upsertCustomer = async (data, empresaId) => {
    const { id, full_name, id_number, phone, institution, status } = data;
    const client = await pool.connect();
    try {
        let result;
        if (id) {
            // 🚨 SAAS: Se agrega AND empresa_id = $7 para evitar que modifiquen clientes de otra empresa
            result = await client.query(
                'UPDATE customers SET full_name = $1, id_number = $2, phone = $3, institution = $4, status = $5 WHERE id = $6 AND empresa_id = $7 RETURNING *', 
                [full_name, id_number, phone, institution, status, id, empresaId]
            );
            if (result.rowCount === 0) throw new Error('Cliente no encontrado');
        } else {
            // 🚨 SAAS: El ON CONFLICT ahora usa (empresa_id, id_number) según la nueva base de datos
            result = await client.query(`
                INSERT INTO customers (full_name, id_number, phone, institution, status, empresa_id) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                ON CONFLICT (empresa_id, id_number) 
                DO UPDATE SET full_name = $1, phone = $3, institution = $4, status = $5 
                RETURNING *`, 
                [full_name, id_number, phone, institution, status || 'ACTIVO', empresaId]
            );
        }
        return result.rows[0];
    } finally { client.release(); }
};

// 3. BÚSQUEDA RÁPIDA (Optimizado con Límite y Aprovechamiento de Índices)
const search = async (q, empresaId) => {
    // 🚨 SAAS: Se añade filtro por empresa_id = $2
    const queryText = `
        SELECT id, full_name, id_number, phone, institution, status 
        FROM customers 
        WHERE (full_name ILIKE $1 OR id_number ILIKE $1 OR institution ILIKE $1) 
        AND status = 'ACTIVO' 
        AND empresa_id = $2
        ORDER BY full_name ASC 
        LIMIT 10
    `;
    const result = await pool.query(queryText, [`%${q}%`, empresaId]);
    return result.rows;
};

// 4. REGISTRO DE SALDO INICIAL (Blindaje Financiero para deudas anteriores)
const registerInitialBalance = async (customerId, { amount, description }, empresaId) => {
    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) throw new Error('Monto inválido');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 🚨 SAAS: Verificamos que el cliente exista y pertenezca a la empresa
        const checkClient = await client.query('SELECT full_name FROM customers WHERE id = $1 AND empresa_id = $2', [customerId, empresaId]);
        if (checkClient.rows.length === 0) throw new Error('Cliente no encontrado');

        const rate = getRate() || 40.00; // Fallback seguro si la tasa no ha cargado

        // Creamos la deuda en la tabla de ventas para que sea visible en el módulo de Créditos
        // 🚨 SAAS: Se añade la columna empresa_id en la inserción
        const saleQuery = `
            INSERT INTO sales (
                total_usd, total_ves, bcv_rate_snapshot, payment_method, status, customer_id, due_date,
                subtotal_taxable_usd, subtotal_exempt_usd, iva_rate, iva_usd, amount_paid_usd, empresa_id
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9, $10, $11, $12) RETURNING id
        `;
        
        await client.query(saleQuery, [
            cleanAmount.toFixed(2), 
            (cleanAmount * rate).toFixed(2), 
            rate, 
            `SALDO INICIAL - ${description || 'Deuda Anterior'}`, 
            'PENDIENTE', 
            customerId, 
            0,            // subtotal_taxable_usd
            cleanAmount,  // subtotal_exempt_usd
            0.16,         // iva_rate
            0,            // iva_usd
            0,            // amount_paid_usd
            empresaId     // 🚨 SAAS: El ID inyectado
        ]);

        await client.query('COMMIT');
        return { success: true, message: 'Saldo inicial registrado correctamente' };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { getCustomers, upsertCustomer, search, registerInitialBalance };