// backend/src/services/cash.service.js
const pool = require('../config/db');
const { getRate } = require('../utils/bcvState');

// 1. ABRIR TURNO (Aislado por Estacion y Atado al Usuario)
// 🚨 SAAS: Recibimos empresaId
const openShift = async (initial_cash_usd, initial_cash_ves, registerId, userId, empresaId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 🚨 SAAS: Bloqueamos la caja de ESTA empresa
        await client.query('SELECT id FROM cash_registers WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [registerId, empresaId]);
        
        // 🚨 SAAS: Verificamos turnos abiertos de ESTA empresa
        const checkOpen = await client.query("SELECT id FROM cash_shifts WHERE status = 'ABIERTA' AND register_id = $1 AND empresa_id = $2 LIMIT 1", [registerId, empresaId]);
        if (checkOpen.rows.length > 0) {
            await client.query('ROLLBACK');
            throw { status: 400, message: 'CONFLICTO_TURNO_ABIERTO', details: `Esta estacion ya tiene el turno #${checkOpen.rows[0].id} abierto.` };
        }

        // 🚨 SAAS: Insertamos el turno atado a la empresa ($5)
        const result = await client.query(`
            INSERT INTO cash_shifts (initial_cash_usd, initial_cash_ves, status, register_id, user_id, empresa_id)
            VALUES ($1, $2, 'ABIERTA', $3, $4, $5) RETURNING *
        `, [parseFloat(initial_cash_usd) || 0, parseFloat(initial_cash_ves) || 0, registerId, userId, empresaId]);
        
        await client.query('COMMIT');
        return result.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// 2. PROCESAR TOTALES (Revision Quirurgica)
// 🛡️ INTACTO: 100% igual a tu codigo original. No hace llamadas a la BD, solo matemáticas.
const processPaymentTotals = (salesRows, creditsRows, currentRate) => {
    let sys = { cash_usd: 0, cash_ves: 0, zelle: 0, pm: 0, punto: 0, donations: 0, credits: 0 };

    const processPayment = (pmRaw, amount, rate) => {
        const pm = (pmRaw || '').toUpperCase();
        
        if (pm.includes('DONACION') || pm.includes('REGALO')) { sys.donations += amount; return; }
        
        if ((pm.includes('CREDITO') || pm.includes('CREDITO')) && !pm.includes('+') && !pm.includes('LIQ.')) {
            if (amount === 0) sys.credits += 0; return;
        }

        if (pm.includes('[CAP:')) {
            const match = pm.match(/\[CAP:\s*([\d\.,]+)\]/);
            if (match && match[1]) {
                const capital = parseFloat(match[1].replace(',', '.'));
                if (!isNaN(capital)) sys.cash_ves -= (capital * rate);
            }
        }

        if (pm.includes(' + ')) {
            const parts = pmRaw.split(' + '); 
            parts.forEach(part => {
                const partUp = part.toUpperCase();
                const matchNum = part.match(/:\s*(?:Bs\.?|USD|\$|Ref)?\s*([\d\.,]+)/i);
                if (matchNum && matchNum[1]) {
                    let val = parseFloat(matchNum[1].replace(',', '.'));
                    if (partUp.includes('EFECTIVO') && (partUp.includes('USD') || partUp.includes('REF'))) sys.cash_usd += val;
                    else if (partUp.includes('EFECTIVO') && (partUp.includes('BS') || partUp.includes('BOLIVARES'))) sys.cash_ves += val;
                    else if (partUp.includes('ZELLE')) sys.zelle += val;
                    else if (partUp.includes('PAGO MOVIL') || partUp.includes('MOVIL')) sys.pm += val;
                    else if (partUp.includes('PUNTO') || partUp.includes('TARJETA')) sys.punto += val;
                }
            });
        } else {
            if (pm.includes('EFECTIVO') && (pm.includes('USD') || pm.includes('REF'))) sys.cash_usd += amount;
            else if (pm.includes('EFECTIVO') && (pm.includes('BS') || pm.includes('BOLIVARES'))) sys.cash_ves += (amount * rate);
            else if (pm.includes('ZELLE')) sys.zelle += amount;
            else if (pm.includes('PAGO MOVIL') || pm.includes('MOVIL')) sys.pm += (amount * rate);
            else if (pm.includes('PUNTO') || pm.includes('TARJETA') || pm.includes('DEBITO')) sys.punto += (amount * rate);
        }
    };

    salesRows.forEach(row => {
        const totalPaid = parseFloat(row.amount_paid_usd || 0);
        const abonosEnEsteTurno = creditsRows.filter(c => c.sale_id === row.id).reduce((sum, c) => sum + parseFloat(c.amount_usd || 0), 0);
        const initialPayment = totalPaid - abonosEnEsteTurno;

        if (initialPayment > 0.005) {
            const initialMethod = (row.payment_method || '').split(' || ')[0];
            const rateSnapshot = parseFloat(row.bcv_rate_snapshot);
            const rate = (rateSnapshot && rateSnapshot > 0) ? rateSnapshot : (currentRate || 1);
            processPayment(initialMethod, initialPayment, rate);
        }
    });

    creditsRows.forEach(row => {
        processPayment(row.payment_method, parseFloat(row.amount_usd || 0), currentRate || 1);
    });

    return sys;
};

// 3. OBTENER ESTADO (Aislado por Estacion y con Bloqueo de Acceso)
// 🚨 SAAS: Recibimos empresaId
const getStatus = async (registerId, userId, empresaId) => {
    // 🚨 SAAS: Aseguramos el turno por empresa
    const shiftRes = await pool.query(`
        SELECT cs.*, u.username as occupant_name 
        FROM cash_shifts cs
        LEFT JOIN users u ON cs.user_id = u.id
        WHERE cs.status = 'ABIERTA' AND cs.register_id = $1 AND cs.empresa_id = $2
        ORDER BY cs.id DESC LIMIT 1
    `, [registerId, empresaId]);
    
    if (shiftRes.rows.length === 0) return { status: 'CERRADA' };
    
    const shift = shiftRes.rows[0];

    // BLOQUEO FISCAL: Si la caja la abrio otra persona, rechaza la entrada
    if (shift.user_id && shift.user_id !== userId) {
        throw { 
            status: 403, 
            occupant: shift.occupant_name || 'Otro usuario' 
        };
    }

    const globalRate = getRate() || 40.00;

    // 🚨 SAAS: Filtramos ventas y abonos del turno por empresa_id ($3)
    const salesRes = await pool.query(`SELECT id, payment_method, amount_paid_usd, bcv_rate_snapshot FROM sales WHERE created_at >= $1 AND status != 'ANULADO' AND register_id = $2 AND empresa_id = $3`, [shift.opened_at, registerId, empresaId]);
    const creditsRes = await pool.query(`SELECT cp.sale_id, cp.amount_usd, cp.payment_method FROM credit_payments cp JOIN sales s ON cp.sale_id = s.id WHERE cp.payment_date >= $1 AND s.status != 'ANULADO' AND s.register_id = $2 AND s.empresa_id = $3`, [shift.opened_at, registerId, empresaId]);

    const systemTotals = processPaymentTotals(salesRes.rows, creditsRes.rows, globalRate);

    return {
        status: 'ABIERTA',
        shift_info: shift,
        system_totals: systemTotals
    };
};

// 4. CERRAR TURNO (Aislado por Estacion y Control de Roles)
// 🚨 SAAS: Recibimos empresaId
const closeShift = async (payload, registerId, userId, userRole, empresaId) => {
    const { declared, notes, fiscal_z_report } = payload;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // FOR UPDATE: Bloquea la fila de ESA estacion especifica para que no entren ventas
        // 🚨 SAAS: Validamos turno de la empresa actual
        const shiftRes = await client.query("SELECT * FROM cash_shifts WHERE status = 'ABIERTA' AND register_id = $1 AND empresa_id = $2 FOR UPDATE", [registerId, empresaId]);
        if (shiftRes.rows.length === 0) throw new Error('No hay caja abierta en esta estacion.');
        const shift = shiftRes.rows[0];
        
        // BLINDAJE Y PERMISOS: Solo el dueno de la caja o el Administrador puede forzar el cierre
        if (shift.user_id && shift.user_id !== userId && userRole !== 'ADMINISTRADOR') {
            throw new Error('No tienes permisos para cerrar la caja de otro usuario.');
        }

        const globalRate = getRate() || 40.00;

        // 🚨 SAAS: Recalculamos con los datos específicos de la empresa
        const salesRes = await client.query(`SELECT id, payment_method, amount_paid_usd, bcv_rate_snapshot FROM sales WHERE created_at >= $1 AND status != 'ANULADO' AND register_id = $2 AND empresa_id = $3`, [shift.opened_at, registerId, empresaId]);
        const creditsRes = await client.query(`SELECT cp.sale_id, cp.amount_usd, cp.payment_method FROM credit_payments cp JOIN sales s ON cp.sale_id = s.id WHERE cp.payment_date >= $1 AND s.status != 'ANULADO' AND s.register_id = $2 AND s.empresa_id = $3`, [shift.opened_at, registerId, empresaId]);

        const sys = processPaymentTotals(salesRes.rows, creditsRes.rows, globalRate);

        const safeDeclared = {
            cash_usd: parseFloat(declared?.cash_usd) || 0,
            cash_ves: parseFloat(declared?.cash_ves) || 0,
            zelle:    parseFloat(declared?.zelle) || 0,
            pm:       parseFloat(declared?.pm) || 0,
            punto:    parseFloat(declared?.punto) || 0
        };

        const expected_usd = parseFloat(shift.initial_cash_usd || 0) + sys.cash_usd;
        const expected_ves = parseFloat(shift.initial_cash_ves || 0) + sys.cash_ves;
        const diff_usd = safeDeclared.cash_usd - expected_usd;
        const diff_ves = safeDeclared.cash_ves - expected_ves;

        // Actualizamos usando los datos limpios de 'safeDeclared' y garantizando el ID exacto
        // 🚨 SAAS: Agregamos empresa_id = $17 al filtro de seguridad
        await client.query(`
            UPDATE cash_shifts SET 
                closed_at = CURRENT_TIMESTAMP, status = 'CERRADA',
                system_cash_usd=$1, system_cash_ves=$2, system_zelle=$3, system_pago_movil=$4, system_punto=$5,
                real_cash_usd=$6, real_cash_ves=$7, real_zelle=$8, real_pago_movil=$9, real_punto=$10,
                diff_usd=$11, diff_ves=$12, notes=$13, fiscal_z_report=$14
            WHERE id = $15 AND register_id = $16 AND empresa_id = $17
        `, [
            sys.cash_usd.toFixed(2), sys.cash_ves.toFixed(2), sys.zelle.toFixed(2), sys.pm.toFixed(2), sys.punto.toFixed(2),
            safeDeclared.cash_usd.toFixed(2), safeDeclared.cash_ves.toFixed(2), safeDeclared.zelle.toFixed(2), 
            safeDeclared.pm.toFixed(2), safeDeclared.punto.toFixed(2),
            diff_usd.toFixed(2), diff_ves.toFixed(2), notes, fiscal_z_report || null, shift.id, registerId, empresaId
        ]);

        await client.query('COMMIT');
        return { success: true };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { openShift, getStatus, closeShift };