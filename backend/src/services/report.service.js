// backend/src/services/report.service.js
const pool = require('../config/db');
const { getRate } = require('../utils/bcvState');

// --- Helper Compartido: Desglose de Métodos de Pago ---
const calculateBreakdown = () => {
    const breakdown = { "EFECTIVO": 0, "PAGO MOVIL": 0, "PUNTO": 0, "ZELLE": 0, "BIOPAGO": 0, "OTROS": 0 };
    
    const addToBreakdown = (methodStr, amount) => {
        const m = (methodStr || "").toUpperCase();
        if (m.includes("EFECTIVO") || m.includes("DIVISA")) breakdown["EFECTIVO"] += amount;
        else if (m.includes("MOVIL") || m.includes("MÓVIL")) breakdown["PAGO MOVIL"] += amount;
        else if (m.includes("PUNTO") || m.includes("TARJETA")) breakdown["PUNTO"] += amount;
        else if (m.includes("ZELLE")) breakdown["ZELLE"] += amount;
        else if (m.includes("BIOPAGO")) breakdown["BIOPAGO"] += amount;
        else breakdown["OTROS"] += amount;
    };
    return { breakdown, addToBreakdown };
};

// 1. REPORTE DIARIO (Ventas + Abonos de hoy - OPTIMIZADO: Complejidad O(n))
const getDailyReport = async (registerId, empresaId) => { // 🚨 SAAS
    const client = await pool.connect();
    try {
        const currentRate = getRate() || 40.00;
        
        let salesParams = [empresaId]; // 🚨 SAAS: Inyectamos $1
        let salesQuery = `
            SELECT id, amount_paid_usd, bcv_rate_snapshot, payment_method
            FROM sales 
            WHERE DATE(created_at AT TIME ZONE 'America/Caracas') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Caracas')
            AND status != 'ANULADO'
            AND empresa_id = $1
        `;
        
        if (registerId && registerId !== -1) {
            salesParams.push(registerId); // 🚨 SAAS: $2
            salesQuery += ` AND register_id = $2`;
        }

        let paymentsParams = [empresaId]; // 🚨 SAAS: Inyectamos $1
        let paymentsQuery = `
            SELECT cp.sale_id, cp.amount_usd, cp.payment_method
            FROM credit_payments cp
            JOIN sales s ON cp.sale_id = s.id
            WHERE DATE(cp.payment_date AT TIME ZONE 'America/Caracas') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Caracas')
            AND cp.empresa_id = $1
        `;
        
        if (registerId && registerId !== -1) {
            paymentsParams.push(registerId); // 🚨 SAAS: $2
            paymentsQuery += ` AND s.register_id = $2`;
        }

        const [salesResult, paymentsResult] = await Promise.all([
            client.query(salesQuery, salesParams),
            client.query(paymentsQuery, paymentsParams)
        ]);

        const paymentsMap = {};
        paymentsResult.rows.forEach(p => {
            if (!paymentsMap[p.sale_id]) paymentsMap[p.sale_id] = [];
            paymentsMap[p.sale_id].push(p);
        });

        let totalIngresoBrutoUSD = 0;
        let totalIngresoBrutoVES = 0;
        let totalCapitalAvances = 0;
        const { breakdown, addToBreakdown } = calculateBreakdown();

        salesResult.rows.forEach(row => {
            const totalPaidInDb = parseFloat(row.amount_paid_usd || 0);
            const rate = parseFloat(row.bcv_rate_snapshot || currentRate);
            
            const abonosHoyParaEstaVenta = (paymentsMap[row.id] || []).reduce((sum, p) => sum + parseFloat(p.amount_usd), 0);
            const pagoInicial = totalPaidInDb - abonosHoyParaEstaVenta;

            if (pagoInicial > 0) {
                totalIngresoBrutoUSD += pagoInicial;
                totalIngresoBrutoVES += (pagoInicial * rate);
                addToBreakdown(row.payment_method, pagoInicial);
            }

            if (row.payment_method && row.payment_method.includes('[CAP:')) {
                const m = row.payment_method.match(/\[CAP:([\d\.]+)\]/);
                if (m) totalCapitalAvances += parseFloat(m[1]);
            }
        });

        paymentsResult.rows.forEach(payment => {
            const amount = parseFloat(payment.amount_usd);
            totalIngresoBrutoUSD += amount;
            totalIngresoBrutoVES += (amount * currentRate);
            addToBreakdown(payment.payment_method, amount);
        });

        const ventaNetaUSD = totalIngresoBrutoUSD - totalCapitalAvances;
        const ventaNetaVES = totalIngresoBrutoVES - (totalCapitalAvances * currentRate);

        return {
            total_transactions: salesResult.rowCount + paymentsResult.rowCount, 
            total_usd: ventaNetaUSD.toFixed(2),
            total_ves: ventaNetaVES.toFixed(2),
            breakdown,
            current_rate: currentRate,
            is_contingency: false
        };
    } finally {
        client.release();
    }
};

// 2. ÚLTIMAS VENTAS
const getRecentSales = async (registerId, empresaId) => {
    let params = [empresaId]; // 🚨 SAAS
    let queryText = `
        SELECT s.id, s.total_usd, s.total_ves, s.payment_method, 
            to_char(s.created_at, 'DD/MM/YYYY HH12:MI AM') as full_date, 
            s.status, s.invoice_type, c.full_name, c.id_number, s.discount_usd
        FROM sales s 
        LEFT JOIN customers c ON s.customer_id = c.id 
        WHERE s.empresa_id = $1
    `;
    
    if (registerId && registerId !== -1) {
        params.push(registerId); // 🚨 SAAS
        queryText += ` AND s.register_id = $2 `;
    }
    queryText += ` ORDER BY s.id DESC LIMIT 10`;

    const result = await pool.query(queryText, params);
    return result.rows;
};

// 3. STOCK BAJO
const getLowStock = async (empresaId) => { // 🚨 SAAS
    const result = await pool.query(`
        SELECT 
            id, 
            name, 
            stock, 
            category, 
            icon_emoji, 
            is_taxable, 
            is_service, 
            is_raw_material 
        FROM products 
        WHERE stock <= 10 
        AND status = 'ACTIVE' 
        AND (is_service = FALSE OR is_service IS NULL)
        AND empresa_id = $1
        ORDER BY stock ASC
    `, [empresaId]);
    return result.rows;
};

// 4. VENTAS DE HOY
const getSalesToday = async (registerId, empresaId) => { // 🚨 SAAS
    let params = [empresaId];
    let queryText = `
        SELECT s.id, s.created_at, s.total_usd, s.amount_paid_usd, 
            (s.total_usd - s.amount_paid_usd) as debt, s.total_ves, 
            s.payment_method, s.status, c.full_name, s.discount_usd
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE DATE(s.created_at AT TIME ZONE 'America/Caracas') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Caracas')
        AND s.empresa_id = $1
    `;
    
    if (registerId && registerId !== -1) {
        params.push(registerId);
        queryText += ` AND s.register_id = $2 `;
    }
    queryText += ` ORDER BY s.id DESC`;

    const result = await pool.query(queryText, params);
    return result.rows;
};

// 5. CRÉDITOS PENDIENTES
const getCreditPending = async (empresaId) => { // 🚨 SAAS
    const result = await pool.query(`
        SELECT s.id, s.total_usd, s.total_ves, s.status, s.created_at, s.due_date, c.full_name, c.id_number, c.phone,
            CASE WHEN s.due_date < NOW() THEN TRUE ELSE FALSE END as is_overdue
        FROM sales s JOIN customers c ON s.customer_id = c.id 
        WHERE s.status IN ('PENDIENTE', 'PARCIAL') 
        AND s.empresa_id = $1
        ORDER BY s.due_date ASC
    `, [empresaId]);
    return result.rows;
};

// 6. CRÉDITO AGRUPADO POR CLIENTE
const getCreditGrouped = async (empresaId) => { // 🚨 SAAS
    const result = await pool.query(`
        SELECT c.id as customer_id, c.full_name, c.id_number, c.phone,
            COUNT(s.id) as total_bills, SUM(s.total_usd) as total_debt, SUM(s.amount_paid_usd) as total_paid,
            (SUM(s.total_usd) - SUM(s.amount_paid_usd)) as remaining_balance
        FROM sales s JOIN customers c ON s.customer_id = c.id
        WHERE s.status IN ('PENDIENTE', 'PARCIAL')
        AND s.empresa_id = $1
        GROUP BY c.id, c.full_name, c.id_number, c.phone
        ORDER BY remaining_balance DESC
    `, [empresaId]);
    return result.rows;
};

// 7. DETALLE DE CRÉDITOS DE UN CLIENTE ESPECÍFICO
const getCustomerCredits = async (customerId, empresaId) => { // 🚨 SAAS
    const result = await pool.query(`
        SELECT s.id, s.total_usd, s.amount_paid_usd, (s.total_usd - s.amount_paid_usd) as remaining_amount,
            s.total_ves, s.status, s.created_at, s.due_date,
            CASE WHEN s.due_date < NOW() THEN TRUE ELSE FALSE END as is_overdue
        FROM sales s
        WHERE s.customer_id = $1 AND s.status IN ('PENDIENTE', 'PARCIAL') AND s.empresa_id = $2
        ORDER BY s.due_date ASC
    `, [customerId, empresaId]);
    return result.rows;
};

// 8. ESTADÍSTICAS
const getAnalytics = async (startDate, endDate, registerId, empresaId) => { // 🚨 SAAS
    let start = startDate;
    let end = endDate;

    if (!start || !end) {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        start = thirtyDaysAgo.toISOString();
        end = now.toISOString();
    }
    if (end.length <= 10) end = `${end} 23:59:59`;

    const client = await pool.connect();
    try {
        let params = [start, end, empresaId]; // 🚨 SAAS: Parámetro 3
        let regFilter = ' AND s.empresa_id = $3 ';
        
        let pDebtors = [empresaId]; // 🚨 SAAS: Parámetro 1 para deudores
        let qDebtors = `SELECT c.full_name, (SUM(s.total_usd) - SUM(s.amount_paid_usd)) as debt FROM sales s JOIN customers c ON s.customer_id = c.id WHERE s.status IN ('PENDIENTE', 'PARCIAL') AND s.empresa_id = $1`;
        
        if (registerId && registerId !== -1) {
            params.push(registerId); // $4
            regFilter += ` AND s.register_id = $4 `;
            
            pDebtors.push(registerId); // $2
            qDebtors += ` AND s.register_id = $2 `;
        }
        qDebtors += ` GROUP BY c.id, c.full_name ORDER BY debt DESC LIMIT 5`;

        const [topProducts, topCustomers, salesTime, salesCat, topDebtors] = await Promise.all([
            client.query(`SELECT p.name, SUM(si.quantity) as total_qty, SUM(si.quantity * si.price_at_moment_usd) as total_revenue FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id WHERE s.created_at BETWEEN $1 AND $2 AND s.status != 'ANULADO' ${regFilter} GROUP BY p.id, p.name ORDER BY total_qty DESC LIMIT 5`, params),
            
            client.query(`SELECT c.full_name, COUNT(s.id) as transactions, SUM(s.amount_paid_usd) as total_spent FROM sales s JOIN customers c ON s.customer_id = c.id WHERE s.created_at BETWEEN $1 AND $2 AND s.status != 'ANULADO' ${regFilter} GROUP BY c.id, c.full_name ORDER BY total_spent DESC LIMIT 5`, params),
            
            client.query(`SELECT DATE(s.created_at) as sale_date, SUM(s.amount_paid_usd) as total_usd, SUM(s.amount_paid_usd * s.bcv_rate_snapshot) as total_ves, COUNT(*) as tx_count FROM sales s WHERE s.created_at BETWEEN $1 AND $2 AND s.status != 'ANULADO' ${regFilter} GROUP BY DATE(s.created_at) ORDER BY sale_date ASC`, params),
            
            client.query(`SELECT p.category, SUM(si.quantity) as total_qty, SUM(si.quantity * si.price_at_moment_usd) as total_usd FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id WHERE s.created_at BETWEEN $1 AND $2 AND s.status != 'ANULADO' ${regFilter} GROUP BY p.category ORDER BY total_usd DESC`, params),
            
            client.query(qDebtors, pDebtors)
        ]);

        return {
            topProducts: topProducts.rows,
            topCustomers: topCustomers.rows,
            salesOverTime: salesTime.rows,
            salesByCategory: salesCat.rows,
            topDebtors: topDebtors.rows
        };
    } finally {
        client.release();
    }
};

// 9. REPORTE DETALLADO DE VENTAS
const getSalesDetail = async (startDate, endDate, search, registerId, empresaId) => { // 🚨 SAAS
    if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    
    let finalEndDateString = endDate;
    if (finalEndDateString.length <= 10) finalEndDateString = `${endDate} 23:59:59`;

    const queryParams = [startDate, finalEndDateString, empresaId]; // 🚨 SAAS: Inyectado
    let paramCount = 3;
    
    let queryText = `
        SELECT s.id, s.created_at, COALESCE(c.full_name, 'Consumidor Final') as client_name,
            COALESCE(c.id_number, 'N/A') as client_id, s.payment_method, s.status, s.invoice_type, 
            s.total_usd, s.total_ves, s.bcv_rate_snapshot,
            s.fiscal_invoice_number, s.fiscal_control_number, s.credit_note_number, s.credit_note_control, s.control_number,
            cr.serie AS serie, cr.name AS name_caja,
            (SELECT STRING_AGG(CONCAT(p.name, ' (', si.quantity, ')'), ', ') 
             FROM sale_items si JOIN products p ON si.product_id = p.id 
             WHERE si.sale_id = s.id) as items_comprados
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN cash_registers cr ON s.register_id = cr.id
        WHERE s.created_at BETWEEN $1 AND $2 
        AND s.empresa_id = $3
    `;

    if (registerId && registerId !== -1) {
        paramCount++;
        queryText += ` AND s.register_id = $${paramCount} `;
        queryParams.push(registerId);
    }

    if (search) {
        paramCount++;
        queryText += ` AND (CAST(s.id AS TEXT) ILIKE $${paramCount} OR c.full_name ILIKE $${paramCount} OR c.id_number ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
    }
    
    queryText += ` ORDER BY s.id DESC`;

    const result = await pool.query(queryText, queryParams);
    return result.rows;
};

// 10. REPORTE DE INVENTARIO
const getInventoryDetail = async (empresaId) => { // 🚨 SAAS
    const currentRate = getRate() || 40.00;
    const result = await pool.query(`
        SELECT id, name, category, barcode, status, stock, price_usd, (stock * price_usd) as total_value_usd,
            is_taxable, is_perishable, last_stock_update
        FROM products WHERE status = 'ACTIVE' AND empresa_id = $1 ORDER BY category ASC, name ASC
    `, [empresaId]);

    return result.rows.map(p => ({
        ...p,
        price_ves: (parseFloat(p.price_usd) * currentRate).toFixed(2),
        total_value_ves: (parseFloat(p.total_value_usd) * currentRate).toFixed(2),
        bcv_rate_snapshot: currentRate
    }));
};

// 11. LIBRO DE VENTAS (SENIAT)
const getSalesBook = async (startDate, endDate, registerId, empresaId) => { // 🚨 SAAS
    let queryText = `
        SELECT 
            s.id, 
            s.created_at, 
            s.invoice_type, 
            s.status, 
            COALESCE(s.fiscal_invoice_number, CAST(s.id AS VARCHAR)) as invoice_number,
            COALESCE(s.fiscal_control_number, s.control_number, '00-' || s.id) as control_number,
            s.fiscal_machine_serial,
            s.credit_note_number,
            s.credit_note_control,
            c.full_name, 
            c.id_number, 
            s.bcv_rate_snapshot as tasa, 
            s.total_ves,
            s.subtotal_taxable_usd, 
            s.subtotal_exempt_usd, 
            s.iva_usd, 
            s.iva_rate,
            s.igtf_usd,
            s.igtf_ves,
            cr.serie AS serie
        FROM sales s 
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN cash_registers cr ON s.register_id = cr.id
        WHERE DATE(s.created_at) BETWEEN $1 AND $2 
        AND s.invoice_type NOT IN ('NOTA_ENTREGA', 'TICKET')
        AND s.empresa_id = $3
    `;
    
    let params = [startDate, endDate, empresaId];
    if (registerId && registerId !== -1) {
        params.push(registerId);
        queryText += ` AND s.register_id = $4 `;
    }
    queryText += ` ORDER BY s.created_at ASC`;

    const result = await pool.query(queryText, params);
    return result.rows;
};

// 12. ANÁLISIS DE VENCIMIENTO
const getAgedDebt = async (empresaId) => { // 🚨 SAAS
    const result = await pool.query(`
        SELECT c.full_name, c.id_number, c.phone, s.id as invoice_id, s.created_at as emission_date,
            s.due_date, s.total_usd, s.amount_paid_usd, (s.total_usd - s.amount_paid_usd) as balance_usd,
            s.bcv_rate_snapshot as tasa_historica
        FROM sales s JOIN customers c ON s.customer_id = c.id
        WHERE s.status IN ('PENDIENTE', 'PARCIAL') AND s.empresa_id = $1 ORDER BY c.full_name ASC, s.created_at ASC
    `, [empresaId]);
    return result.rows;
};

// 13. HISTORIAL DE CIERRES
const getClosingsHistory = async (registerId, empresaId) => { // 🚨 SAAS
    let params = [empresaId];
    
    // 🚀 BLINDAJE SAAS: Generamos una secuencia dinámica y perfecta por cada empresa usando ROW_NUMBER()
    // Añadimos 'WHERE 1=1' en la consulta externa para que la concatenación de filtros sea 100% segura.
    let queryText = `
        WITH TenantShifts AS (
            SELECT *, ROW_NUMBER() OVER(PARTITION BY empresa_id ORDER BY opened_at ASC) as correlativo_interno
            FROM cash_shifts
            WHERE empresa_id = $1
        )
        SELECT * FROM TenantShifts
        WHERE 1=1 
    `;
    
    // Si el usuario filtra por una caja específica, lo agregamos de forma segura
    if (registerId && registerId !== -1) {
        params.push(registerId);
        queryText += ` AND register_id = $2 `;
    }
    
    queryText += ` ORDER BY opened_at DESC LIMIT 50`;
    
    const result = await pool.query(queryText, params);
    return result.rows;
};

// 14. LOGS DE CONECTIVIDAD (Global: Tasa BCV)
// 🚨 SAAS: Esta tabla NO se filtra por empresa_id porque la tasa del BCV afecta a todas las empresas en Venezuela.
const getConnectivityLogs = async () => {
    const result = await pool.query(`
        SELECT 
            id, 
            to_char(created_at, 'DD/MM/YYYY HH12:MI AM') as fecha,
            used_rate as tasa_aplicada,
            error_message as detalle_tecnico
        FROM audit_rate_contingency 
        ORDER BY created_at DESC 
        LIMIT 50
    `);
    return result.rows;
};

module.exports = {
    getDailyReport,
    getRecentSales,
    getLowStock,
    getSalesToday,
    getCreditPending,
    getCreditGrouped,
    getCustomerCredits,
    getAnalytics,
    getSalesDetail,
    getInventoryDetail,
    getSalesBook,
    getAgedDebt,
    getClosingsHistory,
    getConnectivityLogs
};