// backend/src/utils/billingCron.js
const cron = require('node-cron');
const pool = require('../config/db');
const nodemailer = require('nodemailer');
const { getRate } = require('./bcvState');
const PDFDocument = require('pdfkit'); // 🚨 NUEVO: Motor de PDF super ligero

const NUMERO_SOPORTE_WHATSAPP = '584120000000'; // Reemplaza con el tuyo real (sin el +)

const runDailyBillingCheck = async () => {
    console.log('🔍 [SAAS] Iniciando barrido automático de facturación (8:00 AM)...');
    const client = await pool.connect();
    
    try {
        // 1. Buscamos empresas cuya licencia expire en 5, 3, 1 o 0 días, INCLUYENDO SU CONFIGURACIÓN FISCAL Y DATOS
        const res = await client.query(`
            SELECT e.id, e.nombre, e.config_fiscal, u.email as admin_email, u.full_name as admin_name,
                   e.licencia_expira_el, e.rif, e.direccion, e.telefono,
                   FLOOR(DATE_PART('day', e.licencia_expira_el - NOW())) as dias_restantes
            FROM empresas e
            JOIN users u ON u.empresa_id = e.id
            JOIN roles r ON u.role_id = r.id
            WHERE r.name = 'ADMINISTRADOR'
              AND e.suspendido_manualmente = FALSE
              AND e.id != 1 -- Excluimos tu cuenta maestra
        `);

        const currentRate = getRate() || 40.00;

        for (const tenant of res.rows) {
            const dias = parseInt(tenant.dias_restantes);

            // Filtro exacto de días para no enviar spam diario
            if ([5, 3, 1, 0, -1].includes(dias)) {
                let invoiceId, invoiceNumber;

                // 🚨 EXTRACCIÓN DINÁMICA DE PRECIOS:
                const config = typeof tenant.config_fiscal === 'string' ? JSON.parse(tenant.config_fiscal) : (tenant.config_fiscal || {});
                const basePrice = Number(config.planPrice) || 30.00;
                const spreadPercent = Number(config.cryptoSpread) || 15;
                
                // Calculamos el Monto Total USD y VES
                const totalAmountUsd = basePrice * (1 + (spreadPercent / 100));
                const currentAmountVes = totalAmountUsd * currentRate;

                // 2. Revisamos si ya existe una factura PENDIENTE para este ciclo
                const invoiceCheck = await client.query(`
                    SELECT id, control_number FROM saas_invoices 
                    WHERE empresa_id = $1 AND status = 'PENDIENTE'
                `, [tenant.id]);

                if (invoiceCheck.rows.length === 0) {
                    // 3A. Generamos una nueva factura
                    invoiceNumber = `BMS-${Date.now().toString().slice(-6)}-${tenant.id}`;
                    const newInvoice = await client.query(`
                        INSERT INTO saas_invoices (empresa_id, control_number, amount_usd, amount_ves, bcv_rate, due_date)
                        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
                    `, [tenant.id, invoiceNumber, totalAmountUsd, currentAmountVes, currentRate, tenant.licencia_expira_el]);
                    invoiceId = newInvoice.rows[0].id;
                } else {
                    // 3B. Si ya existe, actualizamos montos según tasa del día
                    invoiceId = invoiceCheck.rows[0].id;
                    invoiceNumber = invoiceCheck.rows[0].control_number;
                    await client.query(`
                        UPDATE saas_invoices SET amount_ves = $1, bcv_rate = $2 WHERE id = $3
                    `, [currentAmountVes, currentRate, invoiceId]);
                }

                // 4. Generamos PDF y Enviamos el Correo Corporativo
                if (tenant.admin_email) {
                    // 🚨 Generamos el PDF en memoria (Buffer)
                    const pdfBuffer = await generarFacturaPDF(tenant, invoiceNumber, totalAmountUsd, currentAmountVes, currentRate, dias);
                    // 🚨 Adjuntamos el Buffer al correo
                    await enviarCorreoCobranza(tenant, invoiceNumber, totalAmountUsd, currentAmountVes, dias, pdfBuffer);
                }
            }
        }
        console.log('✅ [SAAS] Barrido de facturación y generación de PDFs finalizado con éxito.');
    } catch (error) {
        console.error('❌ [SAAS] Error crítico en el cron de facturación:', error.message);
    } finally {
        client.release();
    }
};

// 📄 FUNCIÓN PARA GENERAR EL PDF NATIVO EN MEMORIA (Sin usar disco duro)
const generarFacturaPDF = (tenant, controlNumber, amountUsd, amountVes, bcvRate, dias) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            let buffers = [];
            
            // Recolectar datos en memoria
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                let pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            const fechaEmision = new Date().toLocaleDateString('es-VE');
            const fechaVencimiento = new Date(tenant.licencia_expira_el).toLocaleDateString('es-VE');

            // --- CABECERA ---
            doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('BMS Digital', 50, 50);
            doc.fillColor('#64748b').fontSize(10).font('Helvetica').text('Soluciones Tecnológicas y Software SaaS', 50, 75);
            doc.fillColor('#64748b').text('Barquisimeto, Venezuela', 50, 90);

            doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('ESTADO DE CUENTA', 200, 50, { align: 'right' });
            doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text(`N° Control: ${controlNumber}`, 200, 75, { align: 'right' });
            doc.font('Helvetica').text(`Fecha de Emisión: ${fechaEmision}`, 200, 90, { align: 'right' });

            doc.moveTo(50, 115).lineTo(545, 115).lineWidth(1).strokeColor('#e2e8f0').stroke();

            // --- DATOS DEL CLIENTE ---
            doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Facturar a:', 50, 135);
            doc.font('Helvetica').fontSize(10).text(`Empresa: ${tenant.nombre}`, 50, 155);
            doc.text(`RIF: ${tenant.rif || 'N/A'}`, 50, 170);
            doc.text(`Atención: ${tenant.admin_name}`, 50, 185);
            doc.text(`Correo: ${tenant.admin_email}`, 50, 200);

            // --- DETALLE DEL SERVICIO ---
            doc.rect(50, 240, 495, 30).fill('#f8fafc');
            doc.fillColor('#475569').font('Helvetica-Bold').fontSize(10);
            doc.text('DESCRIPCIÓN', 60, 250);
            doc.text('VENCIMIENTO', 350, 250);
            doc.text('TOTAL USD', 460, 250);

            doc.moveTo(50, 270).lineTo(545, 270).lineWidth(1).strokeColor('#e2e8f0').stroke();

            doc.fillColor('#0f172a').font('Helvetica').fontSize(10);
            doc.text('Renovación Mensual de Licencia de Software BMS', 60, 290, { width: 250 });
            doc.fillColor('#dc2626').font('Helvetica-Bold').text(fechaVencimiento, 350, 290);
            doc.fillColor('#0f172a').text(`$${amountUsd.toFixed(2)}`, 460, 290);

            doc.moveTo(50, 330).lineTo(545, 330).lineWidth(1).strokeColor('#e2e8f0').stroke();

            // --- TOTALES Y TASAS ---
            doc.font('Helvetica-Bold').fontSize(12).text('Total a Pagar (USD):', 250, 350, { align: 'right', width: 200 });
            doc.fontSize(14).text(`$${amountUsd.toFixed(2)}`, 460, 350);

            doc.font('Helvetica-Bold').fontSize(12).text('Equivalente a Transferir (Bs):', 200, 375, { align: 'right', width: 250 });
            doc.fontSize(14).text(`Bs ${amountVes.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 460, 375);

            doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(`Tasa de cálculo aplicada: Bs ${bcvRate} por USD`, 300, 395);

            // --- PIE DE PÁGINA ---
            doc.rect(50, 700, 495, 50).fill('#f1f5f9');
            doc.fillColor('#475569').fontSize(9).text(
                'Nota: Por favor envíe su comprobante de pago a través de nuestro soporte por WhatsApp indicando el número de control de este documento para procesar la renovación de su licencia de forma automática.',
                60, 710, { width: 475, align: 'center' }
            );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

// ✉️ Plantilla Profesional de Envío (Con Adjunto PDF)
const enviarCorreoCobranza = async (tenant, controlNumber, amountUsd, amountVes, dias, pdfBuffer) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 465,
        secure: true,
        auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD }
    });

    const isOverdue = dias < 0;
    const estadoTxt = isOverdue ? 'VENCIDA' : (dias === 0 ? 'VENCE HOY' : `Vence en ${dias} días`);
    const colorCode = isOverdue ? '#dc2626' : (dias <= 1 ? '#f59e0b' : '#2563eb');
    
    // Link dinámico de WhatsApp pre-llenado
    const wappMsg = encodeURIComponent(`Hola BMS Digital. Soy administrador de ${tenant.nombre}. Deseo reportar el pago de la Factura ${controlNumber}.`);
    const wappLink = `https://wa.me/${NUMERO_SOPORTE_WHATSAPP}?text=${wappMsg}`;

    const mailOptions = {
        from: `"BMS Digital Finanzas" <${process.env.SMTP_EMAIL}>`,
        to: tenant.admin_email,
        subject: `[BMS Digital] Factura N° ${controlNumber} - ${tenant.nombre}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <h2 style="color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Aviso de Facturación</h2>
                <p>Estimado/a <strong>${tenant.admin_name}</strong>,</p>
                <p>Adjunto a este correo encontrará su factura corporativa en formato PDF correspondiente al ciclo de renovación actual.</p>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0;">
                    <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Detalles del Documento</p>
                    <h3 style="margin: 0 0 15px 0; color: #0f172a;">Factura N°: ${controlNumber}</h3>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;">
                        <span style="color: #475569;">Total a Pagar (Equivalente USD):</span>
                        <strong style="color: #0f172a; font-size: 18px;">$${amountUsd.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;">
                        <span style="color: #475569;">Total a Transferir (Bs):</span>
                        <strong style="color: #0f172a; font-size: 18px;">Bs ${amountVes.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #475569;">Estatus de Licencia:</span>
                        <strong style="color: ${colorCode};">${estadoTxt}</strong>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="${wappLink}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Reportar Pago vía WhatsApp
                    </a>
                </div>
                
                <p style="color: #64748b; font-size: 11px; margin-top: 30px; text-align: center;">
                    Para garantizar la continuidad operativa de sus terminales, le sugerimos realizar el pago antes de la fecha de corte.
                </p>
            </div>
        `,
        // 🚨 INYECCIÓN DEL ARCHIVO PDF ADJUNTO
        attachments: [
            {
                filename: `Factura_BMS_${controlNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    };

    await transporter.sendMail(mailOptions).catch(err => console.error("Error enviando cobro SMTP:", err.message));
};

const startBillingCron = () => {
    cron.schedule('0 8 * * *', () => {
        runDailyBillingCheck();
    }, {
        scheduled: true,
        timezone: "America/Caracas"
    });
    console.log('⏰ Servicio Cron de Facturación con Motor PDF inicializado (Hora objetivo: 08:00 AM VET).');
};

module.exports = { startBillingCron };