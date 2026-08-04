const pool = require('../config/db');
const { getRate } = require('../utils/bcvState');

// Helper interno para clientes
// 🚨 SAAS: Recibimos empresaId
async function findOrCreateCustomer(client, customerData, empresaId) {
    const { full_name, id_number, phone, institution } = customerData;
    // 🚨 SAAS: Filtramos por empresa_id
    let result = await client.query("SELECT id FROM customers WHERE id_number = $1 AND empresa_id = $2 AND status = 'ACTIVO'", [id_number, empresaId]);
    if (result.rows.length > 0) return result.rows[0].id;
    
    // 🚨 SAAS: Inyectamos empresa_id en el INSERT y en el ON CONFLICT
    const insertQuery = 'INSERT INTO customers (full_name, id_number, phone, institution, status, empresa_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (empresa_id, id_number) DO UPDATE SET full_name = $1, phone = $3, institution = $4, status = $5 RETURNING id';
    const insertValues = [full_name, id_number, phone || null, institution || null, 'ACTIVO', empresaId];
    result = await client.query(insertQuery, insertValues);
    return result.rows[0].id;
}

// 🚨 SAAS: Recibimos empresaId
const createSale = async (data, empresaId) => {
    const { 
        items, payment_method, customer_data, customer_id, 
        is_credit, due_days, invoice_type, bcv_rate_snapshot, amount_paid,
        discount, is_delivery, delivery_info,
        fiscal_invoice_number, fiscal_control_number, fiscal_machine_serial, igtf_usd,
        register_id
    } = data;

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Gesti\u00F3n de Cliente
        let finalCustomerId = customer_id;
        if (!finalCustomerId && customer_data) {
             if (customer_data.id) finalCustomerId = customer_data.id;
             else finalCustomerId = await findOrCreateCustomer(client, customer_data, empresaId); // 🚨 SAAS
        }

        const globalRate = getRate();
        const rateToUse = bcv_rate_snapshot ? parseFloat(bcv_rate_snapshot) : globalRate;
        let subtotalTaxableUsd = 0;
        let subtotalExemptUsd = 0;
        let capitalTags = "";

        // 2. Pre-procesamiento
        const processedItems = [];
        for (const item of items) {
            let finalProductId = item.product_id;
            let isService = item.is_service === true;

            if (item.name && item.name.includes('[CAP:')) {
                const match = item.name.match(/\[CAP:([\d\.]+)\]/);
                if (match) capitalTags += ` ${match[0]}`; 
            }

            if (isNaN(finalProductId) || (typeof finalProductId === 'string' && finalProductId.startsWith('ADV'))) {
                // 🚨 SAAS: Validamos la existencia del servicio POR EMPRESA
                const serviceCheck = await client.query("SELECT id FROM products WHERE name = 'AVANCE DE EFECTIVO' AND empresa_id = $1 LIMIT 1", [empresaId]);
                if (serviceCheck.rows.length > 0) {
                    finalProductId = serviceCheck.rows[0].id;
                } else {
                    const newService = await client.query(`INSERT INTO products (name, category, price_usd, stock, is_taxable, status, is_service, empresa_id) VALUES ('AVANCE DE EFECTIVO', 'SERVICIOS', 0, 999999, false, 'ACTIVE', true, $1) RETURNING id`, [empresaId]);
                    finalProductId = newService.rows[0].id;
                }
                isService = true; 
                item.is_taxable = false;
            }
            
            processedItems.push({ ...item, product_id: finalProductId, is_service: isService });
        }

        // 3. Procesar Inventario y Totales
        for (const item of processedItems) {
            const qtyToDeduct = parseInt(item.quantity);
            const itemTotalBase = parseFloat(item.price_usd) * qtyToDeduct;

            if (item.is_taxable) subtotalTaxableUsd += itemTotalBase;
            else subtotalExemptUsd += itemTotalBase;

            if (item.is_service) continue; 

            const productId = item.product_id;
            // 🚨 SAAS: Buscamos lotes espec\u00EDficos de la empresa
            const batchesRes = await client.query(`SELECT id, stock FROM product_batches WHERE product_id = $1 AND empresa_id = $2 AND stock > 0 ORDER BY expiration_date ASC NULLS LAST`, [productId, empresaId]);
            let remainingQty = qtyToDeduct;
            
            for (let batch of batchesRes.rows) {
                if (remainingQty <= 0) break;
                const take = Math.min(batch.stock, remainingQty);
                // 🚨 SAAS: Validamos empresa_id al actualizar stock
                await client.query('UPDATE product_batches SET stock = stock - $1 WHERE id = $2 AND empresa_id = $3', [take, batch.id, empresaId]);
                remainingQty -= take;
            }

            if (batchesRes.rows.length > 0) {
                 const finalStockRes = await client.query('SELECT COALESCE(SUM(stock), 0) as total FROM product_batches WHERE product_id = $1 AND empresa_id = $2', [productId, empresaId]);
                 await client.query('UPDATE products SET stock = $1, last_stock_update = CURRENT_TIMESTAMP WHERE id = $2 AND empresa_id = $3', [finalStockRes.rows[0].total, productId, empresaId]);
            } else {
                 await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2 AND empresa_id = $3', [qtyToDeduct, productId, empresaId]);
            }
        }
        
        // 4. C\u00E1lculos Financieros e IGTF
        const IVA_RATE = 0.16;
        const ivaUsd = subtotalTaxableUsd * IVA_RATE;
        const discountUsd = discount ? parseFloat(discount) : 0;
        const finalTotalUsd = (subtotalTaxableUsd + subtotalExemptUsd + ivaUsd) - discountUsd;
        const totalVes = finalTotalUsd * rateToUse; 
        
        const finalIgtfUsd = igtf_usd ? parseFloat(igtf_usd) : 0;
        const finalIgtfVes = finalIgtfUsd * rateToUse;

        // 5. Estado de Pago
        let saleStatus = 'PAGADO';
        let dueDate = null;
        let amountPaidUsd = finalTotalUsd; 
        
        if (is_credit) {
            if (!finalCustomerId) throw new Error("No se puede procesar venta a CR\u00C9DITO sin seleccionar un Cliente.");
            const initialPayment = amount_paid ? parseFloat(amount_paid) : 0;
            if (initialPayment > 0 && initialPayment < finalTotalUsd) {
                saleStatus = 'PARCIAL';
                amountPaidUsd = initialPayment;
            } else {
                saleStatus = 'PENDIENTE';
                amountPaidUsd = 0; 
            }
            const days = due_days ? parseInt(due_days) : 15;
            const date = new Date();
            date.setDate(date.getDate() + days);
            dueDate = date;
        }

        const finalPaymentMethod = (payment_method || 'CONTADO') + capitalTags;

        // ====================================================================================
        // 🚀 FASE SAAS: CORRELATIVOS INDEPENDIENTES PARA TODOS LOS DOCUMENTOS
        // ====================================================================================
        let finalInvoiceNumber = fiscal_invoice_number || null;
        let finalFiscalControl = fiscal_control_number || null;
        let internalControlNumber = null;

        // 1. Identificar la Caja Activa de la Empresa (Evita el hardcode cruzado)
        let activeRegisterId = data.register_id;
        if (!activeRegisterId) {
            const shiftCheck = await client.query(`
                SELECT register_id FROM cash_shifts 
                WHERE status = 'ABIERTA' AND empresa_id = $1
                ORDER BY opened_at DESC LIMIT 1
            `, [empresaId]);
            
            if (shiftCheck.rows.length > 0) {
                activeRegisterId = shiftCheck.rows[0].register_id;
            } else {
                const regCheck = await client.query('SELECT id FROM cash_registers WHERE empresa_id = $1 ORDER BY id ASC LIMIT 1', [empresaId]);
                if (regCheck.rows.length === 0) throw new Error("No existen cajas registradas para esta empresa.");
                activeRegisterId = regCheck.rows[0].id; 
            }
        }

        // 2. Determinar el Tipo de Secuencia a Usar
        let seqDocType = 'TICKET';
        if (invoice_type === 'FORMA_LIBRE' || invoice_type === 'FISCAL') seqDocType = 'FACTURA';
        else if (invoice_type === 'NOTA_ENTREGA') seqDocType = 'NOTA_ENTREGA';

        // 3. Generar el Correlativo SI NO VIENE de un spooler fiscal (impresora f\u00EDsica)
        if (!finalInvoiceNumber) {
            let seqRes = await client.query(`
                UPDATE document_sequences 
                SET current_number = current_number + 1, updated_at = CURRENT_TIMESTAMP 
                WHERE document_type = $1 AND register_id = $2 AND empresa_id = $3 AND is_active = TRUE
                RETURNING prefix, current_number
            `, [seqDocType, activeRegisterId, empresaId]);

            if (!seqRes || seqRes.rows.length === 0) {
                const cajaRes = await client.query("SELECT serie FROM cash_registers WHERE id = $1 AND empresa_id = $2 FOR UPDATE", [activeRegisterId, empresaId]);
                const serie = cajaRes.rows.length > 0 ? cajaRes.rows[0].serie : 'A';
                
                let defaultPrefix = '';
                if (seqDocType === 'FACTURA') defaultPrefix = `FL-${serie}`;
                else if (seqDocType === 'NOTA_ENTREGA') defaultPrefix = `NE-${serie}`;
                else if (seqDocType === 'TICKET') defaultPrefix = `T-${serie}`;

                await client.query(`
                    INSERT INTO document_sequences (document_type, prefix, current_number, register_id, is_active, empresa_id)
                    VALUES ($1, $2, 1, $3, TRUE, $4)
                `, [seqDocType, defaultPrefix, activeRegisterId, empresaId]);
                seqRes = { rows: [{ prefix: defaultPrefix, current_number: 1 }] };
            }

            const { prefix, current_number } = seqRes.rows[0];
            const paddedNum = current_number.toString().padStart(8, '0');
            
            internalControlNumber = `${prefix}${paddedNum}`;

            if (seqDocType === 'FACTURA') {
                finalInvoiceNumber = paddedNum;
                finalFiscalControl = finalFiscalControl || internalControlNumber;
            }
        } else {
            internalControlNumber = finalFiscalControl || `${invoice_type}-${finalInvoiceNumber}`;
        }
        // ====================================================================================

        // 6. Insertar Venta con Datos Fiscales
        // 🚀 INYECTAMOS 'control_number' DIRECTO EN LA TABLA SALES
        const saleQuery = `
            INSERT INTO sales (
                total_usd, total_ves, bcv_rate_snapshot, payment_method, status, customer_id, due_date,
                subtotal_taxable_usd, subtotal_exempt_usd, iva_rate, iva_usd, amount_paid_usd, invoice_type, discount_usd,
                is_delivery, delivery_info,
                fiscal_invoice_number, fiscal_control_number, fiscal_machine_serial, igtf_usd, igtf_ves, register_id, empresa_id,
                control_number,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW() AT TIME ZONE 'America/Caracas') RETURNING id, created_at`;
            
        const saleValues = [
            finalTotalUsd.toFixed(2), totalVes.toFixed(2), rateToUse, finalPaymentMethod, saleStatus, finalCustomerId, dueDate,
            subtotalTaxableUsd.toFixed(2), subtotalExemptUsd.toFixed(2), IVA_RATE, ivaUsd.toFixed(2), amountPaidUsd.toFixed(2), invoice_type || 'TICKET',
            discountUsd.toFixed(2), !!is_delivery, is_delivery && delivery_info ? delivery_info : null,
            finalInvoiceNumber, finalFiscalControl, fiscal_machine_serial || null, finalIgtfUsd.toFixed(2), finalIgtfVes.toFixed(2),
            activeRegisterId, empresaId, 
            internalControlNumber // 🚀 INYECTADO AQU\u00CD
        ];
        
        const saleResult = await client.query(saleQuery, saleValues);
        const saleId = saleResult.rows[0].id;
        const officialCreatedAt = saleResult.rows[0].created_at; // 🔒 Hora inalterable de la BD

        // 7. Insert Masivo de Detalles y Kardex
        const itemValues = [];
        const itemParams = [];
        const movementValues = [];
        const movementParams = [];

        processedItems.forEach((item, index) => {
            // 🚨 SAAS: 5 par\u00E1metros por fila
            const offset = index * 5;
            itemValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
            itemParams.push(saleId, item.product_id, item.quantity, item.price_usd, empresaId);

            if (!item.is_service) {
                const mOffset = movementParams.length;
                // 🚨 SAAS: Validamos kardex y calculamos nuevo stock por empresa
                movementValues.push(`($${mOffset + 1}, 'OUT', $${mOffset + 2}, 'VENTA', $${mOffset + 3}, (SELECT stock FROM products WHERE id = $${mOffset + 1} AND empresa_id = $${mOffset + 4}), $${mOffset + 4})`);
                movementParams.push(item.product_id, item.quantity, `VENTA #${saleId}`, empresaId);
            }
        });

        if (itemValues.length > 0) {
            await client.query(`INSERT INTO sale_items (sale_id, product_id, quantity, price_at_moment_usd, empresa_id) VALUES ${itemValues.join(',')}`, itemParams);
        }

        if (movementValues.length > 0) {
            await client.query(`INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, new_stock, empresa_id) VALUES ${movementValues.join(',')}`, movementParams);
        }

        await client.query('COMMIT');
        
        return { 
            success: true, 
            saleId, 
            created_at: officialCreatedAt, // 👈 Se env\u00EDa la hora real devuelta por la BD
            fiscal_invoice_number: finalInvoiceNumber, 
            fiscal_control_number: finalFiscalControl,
            control_number: internalControlNumber,
            message: 'Venta exitosa', 
            status: saleStatus 
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error; 
    } finally {
        client.release();
    }
};

// 🚨 SAAS: Recibimos empresaId
const getSaleById = async (id, empresaId) => {
    const client = await pool.connect();
    try {
        const saleResult = await client.query(`
            SELECT s.*, 
                   c.full_name, c.id_number, c.phone, c.institution,
                   cr.serie as register_serie
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN cash_registers cr ON s.register_id = cr.id
            WHERE s.id = $1 AND s.empresa_id = $2
        `, [id, empresaId]);

        if (saleResult.rows.length === 0) return null;
        const sale = saleResult.rows[0];

        const itemsResult = await client.query(`
            SELECT si.product_id, si.quantity, si.price_at_moment_usd, 
                   p.name, p.category, p.is_taxable, p.icon_emoji
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = $1 AND si.empresa_id = $2
        `, [id, empresaId]);

        sale.items = itemsResult.rows.map(item => ({
            ...item,
            quantity: parseFloat(item.quantity),
            price_at_moment_usd: parseFloat(item.price_at_moment_usd)
        }));

        return sale;
    } catch (err) {
        console.error("Error al obtener venta por ID:", err);
        throw err;
    } finally {
        client.release();
    }
};

// 🚨 SAAS: Recibimos empresaId
const payCredit = async (saleId, { paymentDetails, amountUSD }, empresaId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const saleRes = await client.query("SELECT total_usd, amount_paid_usd FROM sales WHERE id = $1 AND empresa_id = $2", [saleId, empresaId]);
        if (saleRes.rows.length === 0) throw new Error('Venta no encontrada');
        
        const sale = saleRes.rows[0];
        const total = parseFloat(sale.total_usd);
        const currentPaid = parseFloat(sale.amount_paid_usd || 0);
        const payAmount = amountUSD ? parseFloat(amountUSD) : (total - currentPaid);
        
        if (payAmount <= 0) throw new Error('Monto inv\u00E1lido');
        const newPaid = currentPaid + payAmount;
        if (newPaid > total + 0.05) throw new Error('El monto excede la deuda restante.');

        let newStatus = newPaid >= total - 0.05 ? 'PAGADO' : 'PARCIAL';

        await client.query(`
            UPDATE sales SET status = $1, amount_paid_usd = $2, payment_method = payment_method || ' || ' || $3 
            WHERE id = $4 AND empresa_id = $5`, [newStatus, newPaid.toFixed(2), `[Abono: $${payAmount.toFixed(2)} - ${paymentDetails}]`, saleId, empresaId]);

        await client.query(`INSERT INTO credit_payments (sale_id, amount_usd, payment_method, empresa_id) VALUES ($1, $2, $3, $4)`, 
            [saleId, payAmount.toFixed(2), paymentDetails, empresaId]);

        await client.query('COMMIT');
        return { success: true, newStatus, remaining: total - newPaid };
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

// 🚨 SAAS: Recibimos empresaId
const payAllCustomerCredits = async (customerId, { paymentDetails, amountUSD }, empresaId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. ORDEN FIFO: Seleccionamos deudas cruzando empresa_id
        const pendingSales = await client.query(`
            SELECT id, total_usd, amount_paid_usd 
            FROM sales 
            WHERE customer_id = $1 AND empresa_id = $2 AND status IN ('PENDIENTE', 'PARCIAL') AND status != 'ANULADO'
            ORDER BY created_at ASC`, [customerId, empresaId]);

        if (pendingSales.rows.length === 0) { 
            await client.query('ROLLBACK'); 
            return { message: 'Cliente solvente' }; 
        }

        let totalProcessed = 0;
        let remainingAbono = (amountUSD !== undefined && amountUSD !== null && amountUSD !== '') ? parseFloat(amountUSD) : null;

        for (const sale of pendingSales.rows) {
            if (remainingAbono !== null && remainingAbono <= 0.005) break; 

            const debt = parseFloat(sale.total_usd) - parseFloat(sale.amount_paid_usd || 0);
            
            if (debt > 0.005) {
                let payAmount = debt; 
                
                if (remainingAbono !== null) {
                    payAmount = Math.min(debt, remainingAbono); 
                    remainingAbono -= payAmount; 
                }

                const newPaid = parseFloat(sale.amount_paid_usd || 0) + payAmount;
                const newStatus = (parseFloat(sale.total_usd) - newPaid) <= 0.005 ? 'PAGADO' : 'PARCIAL';

                await client.query(`
                    UPDATE sales 
                    SET status = $1, 
                        amount_paid_usd = $2, 
                        payment_method = COALESCE(payment_method, '') || ' || ' || $3, 
                        updated_at = NOW() 
                    WHERE id = $4 AND empresa_id = $5`, 
                    [newStatus, newPaid.toFixed(2), `[ABONO GLOBAL: $${payAmount.toFixed(2)} - ${paymentDetails}]`, sale.id, empresaId]);
                
                await client.query(`
                    INSERT INTO credit_payments (sale_id, amount_usd, payment_method, empresa_id) 
                    VALUES ($1, $2, $3, $4)`, 
                    [sale.id, payAmount.toFixed(2), `ABONO GLOBAL: ${paymentDetails}`, empresaId]);
                
                totalProcessed += payAmount;
            }
        }
        
        await client.query('COMMIT');
        return { success: true, total_paid: totalProcessed };
    } catch (e) { 
        await client.query('ROLLBACK'); 
        throw e; 
    } finally { 
        client.release(); 
    }
};

// 🚨 SAAS: Recibimos empresaId
const voidSale = async (saleId, payloadData, empresaId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const reason = typeof payloadData === 'object' ? payloadData.reason : payloadData;
        const creditNoteNumber = typeof payloadData === 'object' ? payloadData.credit_note_number : null;
        const creditNoteControl = typeof payloadData === 'object' ? payloadData.credit_note_control : null;

        // 🚨 SAAS: Validamos propiedad de la venta
        const saleCheck = await client.query('SELECT status, invoice_type, register_id FROM sales WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [saleId, empresaId]);
        if (saleCheck.rows.length === 0) throw new Error('Venta no encontrada');
        if (saleCheck.rows[0].status === 'ANULADO') throw new Error('Ya est\u00E1 anulada');
        if (saleCheck.rows[0].status === 'PARCIAL') throw new Error('No se puede anular venta PARCIAL.');

        const invoiceType = saleCheck.rows[0].invoice_type;
        let originalRegisterId = saleCheck.rows[0].register_id; 
        
        if (!originalRegisterId) {
            const regCheck = await client.query('SELECT id FROM cash_registers WHERE empresa_id = $1 ORDER BY id ASC LIMIT 1', [empresaId]);
            originalRegisterId = regCheck.rows.length > 0 ? regCheck.rows[0].id : 1; 
        }

        // 🚨 SAAS: Validamos items por empresa
        const itemsRes = await client.query(`SELECT si.product_id, si.quantity, p.name, p.category, p.price_usd FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1 AND si.empresa_id = $2`, [saleId, empresaId]);
        
        for (const item of itemsRes.rows) {
            const isService = item.name.toUpperCase().includes('AVANCE') || item.category === 'SERVICIOS' || item.product_id.toString().startsWith('ADV');
            if (!isService) {
                await client.query('SELECT id FROM products WHERE id = $1 AND empresa_id = $2 FOR UPDATE', [item.product_id, empresaId]); 
                
                // 🚨 SAAS: Validamos lote por empresa
                const targetBatch = await client.query(`SELECT id FROM product_batches WHERE product_id = $1 AND empresa_id = $2 ORDER BY expiration_date DESC NULLS FIRST LIMIT 1 FOR UPDATE`, [item.product_id, empresaId]);
                if (targetBatch.rows.length > 0) {
                    await client.query('UPDATE product_batches SET stock = stock + $1 WHERE id = $2 AND empresa_id = $3', [item.quantity, targetBatch.rows[0].id, empresaId]);
                } else {
                    await client.query(`INSERT INTO product_batches (product_id, stock, batch_code, cost_usd, empresa_id) VALUES ($1, $2, 'REINGRESO-ANULACION', $3, $4)`, [item.product_id, item.quantity, item.price_usd, empresaId]);
                }
                const updateMaster = await client.query('UPDATE products SET stock = stock + $1, last_stock_update = CURRENT_TIMESTAMP WHERE id = $2 AND empresa_id = $3 RETURNING stock', [item.quantity, item.product_id, empresaId]);
                await client.query(`INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, new_stock, empresa_id) VALUES ($1, 'IN', $2, 'ANULACION_VENTA', $3, $4, $5)`, 
                    [item.product_id, item.quantity, `ANULACION VENTA #${saleId}`, updateMaster.rows[0].stock, empresaId]);
            }
        }
        
        let finalNcNumber = creditNoteNumber;
        let finalNcControl = creditNoteControl;

        if (!finalNcNumber && invoiceType === 'FORMA_LIBRE') {
            
            // 🚨 SAAS: Validamos secuencia de NC por empresa
            const seqRes = await client.query(`
                UPDATE document_sequences 
                SET current_number = current_number + 1, updated_at = CURRENT_TIMESTAMP 
                WHERE document_type = 'NOTA_CREDITO' AND register_id = $1 AND empresa_id = $2 AND is_active = TRUE 
                RETURNING prefix, current_number
            `, [originalRegisterId, empresaId]);

            if (seqRes.rows.length > 0) {
                const { prefix, current_number } = seqRes.rows[0];
                const paddedNum = current_number.toString().padStart(8, '0');
                
                finalNcNumber = paddedNum;
                finalNcControl = creditNoteControl ? creditNoteControl : `${prefix}${paddedNum}`; 
            } else {
                throw new Error(`Error Fiscal: La secuencia de Nota de Cr\u00E9dito no est\u00E1 inicializada o activa para la estaci\u00F3n actual.`);
            }
        }
        
        await client.query(`
            UPDATE sales 
            SET status = 'ANULADO', 
                payment_method = payment_method || ' [ANULADO: ' || $1 || ']',
                credit_note_number = $3,
                credit_note_control = $4
            WHERE id = $2 AND empresa_id = $5`, 
        [reason, saleId, finalNcNumber, finalNcControl, empresaId]);
        
        await client.query('COMMIT');
        
        return { 
            success: true, 
            message: 'Venta anulada correctamente',
            credit_note_number: finalNcNumber,
            credit_note_control: finalNcControl
        };
    } catch (e) { 
        await client.query('ROLLBACK'); throw e; 
    } finally { 
        client.release(); 
    }
};

// 🚨 SAAS: Recibimos empresaId
const billDeliveryNote = async (saleId, fiscalData, empresaId) => {
    const { invoice_type, fiscal_invoice_number, fiscal_control_number, fiscal_machine_serial } = fiscalData;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN'); 

        // 🚨 SAAS: Validamos propiedad
        const saleCheck = await client.query(`
            SELECT s.id, s.invoice_type, s.status, s.total_usd, s.register_id, c.id_number 
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.id = $1 AND s.empresa_id = $2 FOR UPDATE OF s
        `, [saleId, empresaId]);

        if (saleCheck.rows.length === 0) throw new Error('Documento no encontrado.');
        if (saleCheck.rows[0].status === 'ANULADO') throw new Error('No se puede facturar una Nota de Entrega anulada.');
        
        const dbInvoiceType = saleCheck.rows[0].invoice_type || 'TICKET';
        
        if (dbInvoiceType !== 'NOTA_ENTREGA' && dbInvoiceType !== 'TICKET') {
            throw new Error(`Este documento ya ha sido fiscalizado (${dbInvoiceType}) o no es de control interno.`);
        }

        if (invoice_type === 'FORMA_LIBRE') {
            const customerIdNumber = saleCheck.rows[0].id_number || '';
            if (!customerIdNumber || customerIdNumber === 'S/I' || customerIdNumber.includes('00000000')) {
                throw new Error('Providencia 0071: Prohibido emitir Forma Libre a Consumidor Final. El documento original carece de RIF v\u00E1lido.');
            }
        }

        let originalRegisterId = saleCheck.rows[0].register_id;
        if (!originalRegisterId) {
            const regCheck = await client.query('SELECT id FROM cash_registers WHERE empresa_id = $1 ORDER BY id ASC LIMIT 1', [empresaId]);
            originalRegisterId = regCheck.rows.length > 0 ? regCheck.rows[0].id : 1; 
        }

        let finalInvoiceNumber = fiscal_invoice_number || null;
        let finalControlNumber = fiscal_control_number || null;
        let finalMachineSerial = fiscal_machine_serial || null;

        if (invoice_type === 'FORMA_LIBRE' && !finalInvoiceNumber) {
            
            // 🚨 SAAS: Validamos secuencia por caja y empresa
            let seqRes = await client.query(`
                UPDATE document_sequences 
                SET current_number = current_number + 1, updated_at = CURRENT_TIMESTAMP 
                WHERE document_type = 'FACTURA' AND register_id = $1 AND empresa_id = $2 AND is_active = TRUE
                RETURNING prefix, current_number
            `, [originalRegisterId, empresaId]);

            if (!seqRes || seqRes.rows.length === 0) {
                const regCheck = await client.query("SELECT serie FROM cash_registers WHERE id = $1 AND empresa_id = $2", [originalRegisterId, empresaId]);
                const serie = regCheck.rows.length > 0 ? regCheck.rows[0].serie : 'A'; 

                await client.query(`
                    INSERT INTO document_sequences (document_type, prefix, current_number, register_id, is_active, empresa_id)
                    VALUES ('FACTURA', $1, 1, $2, TRUE, $3)
                `, [`FL-${serie}`, originalRegisterId, empresaId]);

                seqRes = { rows: [{ prefix: `FL-${serie}`, current_number: 1 }] };
            }

            const { prefix, current_number } = seqRes.rows[0];
            const paddedNum = current_number.toString().padStart(8, '0'); 
            finalInvoiceNumber = paddedNum;
            finalControlNumber = `${prefix}${paddedNum}`;
        }
        
        const formalizationNote = ` [FORMALIZADO: ${invoice_type} ref NE#${saleId}]`;

        const updateQuery = `
            UPDATE sales 
            SET 
                invoice_type = $1,
                fiscal_invoice_number = $2,
                fiscal_control_number = $3,
                fiscal_machine_serial = $4,
                payment_method = payment_method || $5,
                created_at = CURRENT_TIMESTAMP, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 AND empresa_id = $7
            RETURNING *
        `;
        
        const result = await client.query(updateQuery, [
            invoice_type, 
            finalInvoiceNumber, 
            finalControlNumber, 
            finalMachineSerial, 
            formalizationNote, 
            saleId,             
            empresaId // 🚨 SAAS
        ]);

        await client.query('COMMIT'); 
        
        return {
            success: true,
            message: 'Nota de Entrega formalizada a Factura Fiscal exitosamente',
            data: result.rows[0]
        };

    } catch (error) {
        await client.query('ROLLBACK'); 
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { createSale, getSaleById, payCredit, payAllCustomerCredits, voidSale, billDeliveryNote };