import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { formatBs, formatUSD } from './formatters';
import { tenantConfig } from '../config/tenantConfig'; // <-- INYECCIÓN DE MARCA BLANCA

// --- FUNCIÓN: IMPRIMIR REPORTE KARDEX (ADAPTADO A MARCA BLANCA) ---
export const printKardexReport = (kardexProduct, kardexHistory, bcvRate) => {
    if (!kardexProduct || kardexHistory.length === 0) return Swal.fire('Error', 'No hay datos para exportar', 'warning');

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    // --- PALETA ---
    const colors = {
        header: [30, 41, 59],    // Slate 800
        green: [22, 163, 74],    // Green 600
        red: [220, 38, 38],      // Red 600
        blue: [37, 99, 235]      // Blue 600
    };

    // 1. ENCABEZADO FISCAL
    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("KARDEX DE INVENTARIO VALORIZADO", 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CONTROL DE MOVIMIENTOS Y EXISTENCIAS (EXPRESADO EN ${tenantConfig.primaryCurrency === 'Bs' ? 'BOLÍVARES' : tenantConfig.primaryCurrency})`, 14, 18);

    // Datos de la Empresa y Tasa (DINÁMICO)
    doc.setFontSize(9);
    doc.text(`RIF: ${tenantConfig.companyDocument}`, pageWidth - 14, 10, { align: 'right' });
    doc.text(`Razón Social: ${tenantConfig.companyName}`, pageWidth - 14, 15, { align: 'right' });
    doc.text(`Emisión: ${new Date().toLocaleString('es-VE')}`, pageWidth - 14, 20, { align: 'right' });
    doc.text(`Tasa de Cambio Base: ${tenantConfig.primaryCurrency} ${formatBs(bcvRate)}`, pageWidth - 14, 25, { align: 'right' });

    // 2. DATOS DEL PRODUCTO
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 35, pageWidth - 28, 20, 2, 2, 'FD');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`PRODUCTO: ${kardexProduct.name.toUpperCase()}`, 20, 42);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`CÓDIGO: ${kardexProduct.barcode || 'S/C'}`, 20, 48);
    doc.text(`CATEGORÍA: ${kardexProduct.category || 'General'}`, 20, 52);

    const stockActual = kardexProduct.stock;
    const costoUnitRef = parseFloat(kardexProduct.price_usd);
    const costoUnitBs = costoUnitRef * bcvRate;
    const valorTotalBs = stockActual * costoUnitBs;

    doc.text(`EXISTENCIA: ${stockActual} UND`, 120, 48);
    doc.text(`COSTO UNITARIO: ${tenantConfig.primaryCurrency} ${formatBs(costoUnitBs)}`, 120, 52);

    doc.setFont('helvetica', 'bold');
    doc.text(`VALOR TOTAL (${tenantConfig.primaryCurrency}): ${tenantConfig.primaryCurrency} ${formatBs(valorTotalBs)}`, 200, 48);

    doc.setTextColor(...colors.blue);
    doc.setFontSize(8);
    doc.text(`(Ref. Total: $${formatUSD(stockActual * costoUnitRef)})`, 200, 52);
    doc.setTextColor(0, 0, 0);

    // 3. TABLA ANALÍTICA
    autoTable(doc, {
        startY: 60,
        head: [[
            'FECHA', 'DOC. REF', 'CONCEPTO', 
            'TIPO', 'CANT',
            `COSTO UNIT (${tenantConfig.primaryCurrency})`, `TOTAL OP (${tenantConfig.primaryCurrency})`, 
            `TOTAL OP (${tenantConfig.secondaryCurrency})`, 
            'SALDO'
        ]],
        body: kardexHistory.map(mov => {
            let costRef = parseFloat(mov.cost_usd);
            if (isNaN(costRef) || costRef === 0) {
                costRef = parseFloat(kardexProduct.price_usd) || 0;
            }

            const costBs = costRef * bcvRate;
            const totalRef = costRef * mov.quantity;
            const totalBs = totalRef * bcvRate;

            return [
                new Date(mov.created_at).toLocaleDateString('es-VE'),
                mov.document_ref || '-',
                mov.reason ? mov.reason.replace(/_/g, ' ') : 'MOVIMIENTO',
                mov.type === 'IN' ? 'ENTRADA' : 'SALIDA',
                mov.quantity,
                formatBs(costBs),
                formatBs(totalBs),
                formatUSD(totalRef),
                mov.new_stock
            ];
        }),
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        headStyles: {
            fillColor: colors.header,
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 20 },
            3: { fontStyle: 'bold', halign: 'center' },
            4: { halign: 'center', fontStyle: 'bold' },
            5: { halign: 'right' },
            6: { halign: 'right', fontStyle: 'bold' },
            7: { halign: 'right', textColor: colors.blue },
            8: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] }
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 3) {
                if (data.cell.raw === 'ENTRADA') data.cell.styles.textColor = colors.green;
                else data.cell.styles.textColor = colors.red;
            }
        }
    });

    // 4. PIE DE PÁGINA LEGAL
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(7);
    doc.setTextColor(100);

    doc.text(`NOTA: Los valores en ${tenantConfig.primaryCurrency === 'Bs' ? 'Bolívares' : tenantConfig.primaryCurrency} se calculan en base a la tasa de cambio vigente a la fecha de emisión de este reporte.`, 14, finalY);
    doc.text("BASE LEGAL: Art. 177 Reglamento ISLR (Sistema de Inventarios Permanentes) y Providencia Administrativa SNAT/2011/0071.", 14, finalY + 4);

    doc.setDrawColor(0, 0, 0);
    doc.line(200, finalY + 15, 270, finalY + 15);
    doc.text("Conformado Por (Firma y Sello)", 220, finalY + 20);

    doc.save(`Kardex_Valorizado_${kardexProduct.name.replace(/\s+/g, '_')}.pdf`);
};

// --- 1. FUNCIÓN DE REPORTE DE AUDITORÍA (MARCA BLANCA) ---
export const printInventoryAuditPDF = (products, bcvRate) => {
    if (!products || products.length === 0) return Swal.fire('Vacío', 'No hay datos de inventario para generar el reporte.', 'info');

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    const colors = {
        header: [30, 41, 59],    
        accent: [225, 29, 43],   
        text: [51, 65, 85],      
        bg: [241, 245, 249]      
    };

    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("REPORTE DE VALORIZACIÓN Y EXISTENCIAS", 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("CONTROL DE INVENTARIO FÍSICO", 14, 18);

    doc.setFontSize(9);
    doc.text(`RIF: ${tenantConfig.companyDocument}`, 14, 24); 
    doc.text(`Razón Social: ${tenantConfig.companyName}`, 14, 29); 

    const dateStr = new Date().toLocaleString('es-VE');
    const rateStr = formatBs(bcvRate);

    doc.text(`Fecha de Corte: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Tasa de Cambio BCV: ${tenantConfig.primaryCurrency} ${rateStr}`, pageWidth - 14, 18, { align: 'right' });
    doc.text(`Expresado en: ${tenantConfig.primaryCurrency} y Divisa Referencial (${tenantConfig.secondaryCurrency})`, pageWidth - 14, 24, { align: 'right' });

    let totalStock = 0;
    let totalValueUSD = 0;
    let totalValueVES = 0;

    products.forEach(item => {
        const stock = parseInt(item.stock) || 0;
        const price = parseFloat(item.price_usd) || 0;
        const totalUSD = stock * price;
        const totalVES = totalUSD * bcvRate;

        totalStock += stock;
        totalValueUSD += totalUSD;
        totalValueVES += totalVES;
    });

    const startYTotals = 40;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(14, startYTotals, pageWidth - 28, 20, 3, 3, 'S');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text("ITEMS TOTALES", 30, startYTotals + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${products.length}`, 30, startYTotals + 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("UNIDADES EN STOCK", 80, startYTotals + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${totalStock}`, 80, startYTotals + 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`VALOR TOTAL (${tenantConfig.primaryCurrency})`, 150, startYTotals + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.accent);
    doc.text(`${tenantConfig.primaryCurrency} ${formatBs(totalValueVES)}`, 150, startYTotals + 14, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`VALOR TOTAL (${tenantConfig.secondaryCurrency})`, 230, startYTotals + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 86, 179);
    doc.text(`Ref ${formatUSD(totalValueUSD)}`, 230, startYTotals + 14, { align: 'center' });

    autoTable(doc, {
        startY: startYTotals + 25,
        head: [['CÓDIGO', 'DESCRIPCIÓN DEL PRODUCTO', 'CATEGORÍA', 'STOCK', `COSTO UNIT (${tenantConfig.primaryCurrency})`, `TOTAL (${tenantConfig.primaryCurrency})`, `TOTAL (${tenantConfig.secondaryCurrency})`]],
        body: products.map(item => {
            const stock = parseInt(item.stock) || 0;
            const price = parseFloat(item.price_usd) || 0;
            const totalUSD = stock * price;
            const totalVES = totalUSD * bcvRate;
            const unitVES = price * bcvRate;

            return [
                item.barcode || `INT-${item.id}`,
                item.name.substring(0, 45),
                item.category || 'General',
                stock,
                formatBs(unitVES),
                formatBs(totalVES),
                formatUSD(totalUSD)
            ];
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: colors.header, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 25 },
            3: { halign: 'center', fontStyle: 'bold' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' },
            6: { halign: 'right', textColor: [0, 86, 179] }
        },
        alternateRowStyles: { fillColor: colors.bg }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("Este reporte refleja la valorización del inventario según los costos registrados en el sistema al momento de su emisión.", 14, finalY);
    doc.text("Base Legal: Art. 177 Reglamento de la Ley de ISLR (Valuación de Inventarios) y Providencia Administrativa 0071.", 14, finalY + 4);

    doc.setDrawColor(200, 200, 200);
    doc.line(200, finalY + 15, 270, finalY + 15);
    doc.text("Revisado por (Firma y Sello)", 215, finalY + 19);

    doc.save(`Auditoria_Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- FUNCIÓN: REPORTE DE TOMA DE INVENTARIO FÍSICO (MARCA BLANCA) ---
export const printPhysicalCountReport = (inventoryFilteredData, products) => {
    const dataToPrint = inventoryFilteredData.length > 0 ? inventoryFilteredData : products;
    if (!dataToPrint || dataToPrint.length === 0) return Swal.fire('Error', 'No hay datos para generar el acta', 'warning');

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    const colors = {
        header: [51, 65, 85],
        bg: [255, 255, 255]
    };

    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("ACTA DE TOMA DE INVENTARIO FÍSICO", 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("INSTRUMENTO DE CONTEO CIEGO (AUDITORÍA)", 14, 18);

    doc.setFontSize(9);
    doc.text(`RIF: ${tenantConfig.companyDocument}`, 14, 24);
    doc.text(`Razón Social: ${tenantConfig.companyName}`, 14, 28);

    const fecha = new Date().toLocaleDateString('es-VE');
    doc.text(`Fecha de Emisión: ${fecha}`, pageWidth - 14, 12, { align: 'right' });
    doc.text("Responsable de Conteo: ___________________", pageWidth - 14, 18, { align: 'right' });
    doc.text("Auditor Supervisor: ___________________", pageWidth - 14, 24, { align: 'right' });

    autoTable(doc, {
        startY: 35,
        head: [['CÓDIGO', 'CATEGORÍA', 'DESCRIPCIÓN DEL PRODUCTO', 'UNIDAD', 'CONTEO REAL (FÍSICO)']],
        body: dataToPrint.map(item => [
            item.barcode || `INT-${item.id}`,
            item.category || 'General',
            item.name,
            'UND',
            ''
        ]),
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle', lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: {
            fillColor: colors.header,
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 30 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 40, minCellHeight: 10 }
        },
        didDrawCell: function (data) {
            if (data.section === 'body' && data.column.index === 4) {
                const x = data.cell.x;
                const y = data.cell.y;
                const w = data.cell.width;
                const h = data.cell.height;
                doc.setDrawColor(100, 100, 100);
                doc.setLineWidth(0.5);
                doc.line(x + 5, y + h - 2, x + w - 5, y + h - 2);
            }
        },
        alternateRowStyles: { fillColor: [250, 250, 250] }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    doc.text("Certifico que he realizado el conteo físico de los artículos listados, verificando su existencia real en los almacenes.", 14, finalY);
    doc.text(`Este documento es propiedad exclusiva de ${tenantConfig.companyName} y sirve de soporte para el cierre contable.`, 14, finalY + 4);

    if (finalY < 250) {
        doc.line(40, finalY + 20, 90, finalY + 20);
        doc.text("Firma Responsable", 65, finalY + 24, { align: 'center' });

        doc.line(120, finalY + 20, 170, finalY + 20);
        doc.text("Firma Auditor", 145, finalY + 24, { align: 'center' });
    }

    doc.save(`Toma_Fisica_Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- NUEVO: REPORTE LEGAL DE CARTERA DE CRÉDITO (MARCA BLANCA) ---
export const printLegalDebtReport = async (ReportService, bcvRate) => {
    try {
        Swal.fire({ title: 'Generando Reporte Legal...', didOpen: () => Swal.showLoading() });
        const res = await ReportService.getAgedDebt();
        const debts = res.data;
        Swal.close();

        if (debts.length === 0) return Swal.fire('Sin Deudas', 'No hay cuentas por cobrar pendientes.', 'info');

        const doc = new jsPDF('l', 'mm', 'a4'); 
        const pageWidth = doc.internal.pageSize.width;

        const colors = {
            header: [30, 41, 59],    
            accent: [225, 29, 43],   
            text: [51, 65, 85],      
            bg: [241, 245, 249]      
        };

        doc.setFillColor(...colors.header);
        doc.rect(0, 0, pageWidth, 35, 'F');

        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text("RELACIÓN ANALÍTICA DE CUENTAS POR COBRAR", 14, 12);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("CONTROL DE CARTERA DE CRÉDITO Y VENCIMIENTOS", 14, 18);

        doc.setFontSize(9);
        doc.text(`RIF: ${tenantConfig.companyDocument}`, 14, 24);
        doc.text(`Razón Social: ${tenantConfig.companyName}`, 14, 29);

        const dateStr = new Date().toLocaleDateString('es-VE');
        doc.text(`Fecha de Corte: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
        doc.text(`Tasa de Cambio Cierre: ${tenantConfig.primaryCurrency} ${formatBs(bcvRate)}`, pageWidth - 14, 18, { align: 'right' });
        doc.text(`Expresado en: ${tenantConfig.primaryCurrency} y Divisas (${tenantConfig.secondaryCurrency})`, pageWidth - 14, 24, { align: 'right' });

        autoTable(doc, {
            startY: 40,
            head: [['CLIENTE / RAZÓN SOCIAL', 'RIF/CI', 'N° FACT', 'EMISIÓN', 'VENCIMIENTO', 'DÍAS VENC.', `SALDO (${tenantConfig.secondaryCurrency})`, `SALDO (${tenantConfig.primaryCurrency})`]],
            body: debts.map(d => {
                const daysOverdue = Math.ceil((new Date() - new Date(d.due_date)) / (1000 * 60 * 60 * 24));
                const balanceBs = parseFloat(d.balance_usd) * bcvRate; 

                return [
                    d.full_name.substring(0, 35),
                    d.id_number,
                    `#${d.invoice_id}`,
                    new Date(d.emission_date).toLocaleDateString('es-VE'),
                    new Date(d.due_date).toLocaleDateString('es-VE'),
                    daysOverdue > 0 ? `${daysOverdue}` : 'Vigente',
                    formatUSD(d.balance_usd),
                    formatBs(balanceBs)
                ];
            }),
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: {
                fillColor: colors.header,
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 60 },
                5: { halign: 'center', fontStyle: 'bold' },
                6: { halign: 'right', fontStyle: 'bold' },
                7: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] }
            },
            alternateRowStyles: { fillColor: colors.bg },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 5) {
                    const val = parseInt(data.cell.raw);
                    if (!isNaN(val) && val > 0) {
                        data.cell.styles.textColor = [220, 53, 69]; 
                    } else {
                        data.cell.styles.textColor = [40, 167, 69]; 
                    }
                }
            }
        });

        const totalRef = debts.reduce((acc, curr) => acc + parseFloat(curr.balance_usd), 0);
        const totalBs = totalRef * bcvRate;

        const finalY = doc.lastAutoTable.finalY + 10;

        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(pageWidth - 90, finalY, 76, 20, 2, 2, 'FD');

        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.text(`TOTAL POR COBRAR (${tenantConfig.secondaryCurrency}):`, pageWidth - 85, finalY + 6);
        doc.text(`TOTAL POR COBRAR (${tenantConfig.primaryCurrency}):`, pageWidth - 85, finalY + 14);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`$${formatUSD(totalRef)}`, pageWidth - 18, finalY + 6, { align: 'right' });
        doc.text(`${tenantConfig.primaryCurrency} ${formatBs(totalBs)}`, pageWidth - 18, finalY + 14, { align: 'right' });

        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'normal');
        doc.text("Este reporte refleja las cuentas por cobrar pendientes valorizadas a la tasa de cambio actual.", 14, finalY + 5);
        doc.text("Base Legal: Normas Internacionales de Información Financiera (NIC 21) y Normativa Nacional Vigente.", 14, finalY + 9);

        doc.setDrawColor(150);
        doc.line(14, finalY + 25, 80, finalY + 25);
        doc.text("Gerencia de Cobranzas", 30, finalY + 29);

        doc.save(`Cartera_Credito_Legal_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudo generar el reporte', 'error');
    }
};

// --- NUEVO: LIBRO DE VENTAS SENIAT (MARCA BLANCA - FASE 3 BLINDADO) ---
export const printSalesBookPDF = async (reportDateRange, ReportService) => {
    try {
        Swal.fire({
            title: 'Generando Libro de Ventas...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await ReportService.getSalesBook({
            startDate: reportDateRange.start,
            endDate: reportDateRange.end
        });

        const sales = res.data;
        Swal.close();

        if (!sales || sales.length === 0) {
            return Swal.fire('Vacío', 'No hay ventas en este rango', 'info');
        }

        // Usamos formato horizontal grande (legal o a4 apaisado) para que quepan las columnas fiscales
        const doc = new jsPDF('l', 'mm', 'legal');
        const pageWidth = doc.internal.pageSize.width;

        const colors = {
            header: [30, 41, 59], 
            bg: [248, 250, 252],
            red: [220, 38, 38]   
        };

        doc.setFillColor(...colors.header);
        doc.rect(0, 0, pageWidth, 35, 'F');

        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('LIBRO DE VENTAS', 14, 12);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('CUMPLIMIENTO PROVIDENCIA ADMINISTRATIVA 0071', 14, 18);

        doc.setFontSize(9);
        doc.text(`Contribuyente: ${tenantConfig.companyName}`, 14, 24);
        doc.text(`RIF: ${tenantConfig.companyDocument}`, 14, 29);

        doc.text(`Período Fiscal:`, pageWidth - 14, 12, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(`${new Date(reportDateRange.start).toLocaleDateString()} al ${new Date(reportDateRange.end).toLocaleDateString()}`, pageWidth - 14, 18, { align: 'right' });

        autoTable(doc, {
            startY: 40,
            head: [[
                'FECHA', 'RIF/CI', 'RAZÓN SOCIAL', 'N° FACTURA', 'N° CONTROL', 'N° N/CRÉDITO', 'MÁQ. FISCAL',
                `TOTAL VENTAS`, `EXENTO`, `BASE IMP.`, `IVA (${tenantConfig.defaultTaxRate * 100}%)`, 'IGTF (3%)'
            ]],
            // 🚨 CORRECCIÓN DEFINITIVA: Separamos la venta real de su Nota de Crédito (Reversión)
            body: sales.flatMap(s => {
                const rate = parseFloat(s.tasa || 0);
                
                // Calculamos los montos siempre en positivo primero
                const exentoBs = parseFloat(s.subtotal_exempt_usd || 0) * rate;
                const baseBs = parseFloat(s.subtotal_taxable_usd || 0) * rate;
                const ivaBs = parseFloat(s.iva_usd || 0) * rate;
                const igtfBs = parseFloat(s.igtf_ves || (parseFloat(s.igtf_usd || 0) * rate));
                const totalBs = parseFloat(s.total_ves || 0);

                const rows = [];
                
                // FILA 1: Factura Original (SIEMPRE en positivo, refleja que la venta ocurrió en el sistema)
                rows.push([
                    new Date(s.created_at).toLocaleDateString('es-VE'),
                    s.id_number || 'GENÉRICO',
                    (s.full_name || 'Consumidor Final').substring(0, 25),
                    s.invoice_number,
                    s.control_number,
                    '-', // Aquí no va N/C porque es la factura original
                    s.fiscal_machine_serial || '-',
                    formatBs(totalBs),
                    formatBs(exentoBs),
                    formatBs(baseBs),
                    formatBs(ivaBs),
                    formatBs(igtfBs)
                ]);

                // FILA 2: Si fue ANULADA, se inyecta la Nota de Crédito restando los montos
                if (s.status === 'ANULADO') {
                    // Si la máquina no dio un N° de N/C fiscal, le asignamos uno de control interno para justificar la reversión
                    const ncNumber = s.credit_note_number || `NC-${s.id}`;
                    
                    rows.push([
                        new Date(s.created_at).toLocaleDateString('es-VE'),
                        s.id_number || 'GENÉRICO',
                        (s.full_name || 'Consumidor Final').substring(0, 25),
                        s.invoice_number, // Referencia a la factura que anula
                        s.credit_note_control || s.control_number || '-', 
                        ncNumber, 
                        s.fiscal_machine_serial || '-',
                        `-${formatBs(totalBs)}`,
                        `-${formatBs(exentoBs)}`,
                        `-${formatBs(baseBs)}`,
                        `-${formatBs(ivaBs)}`,
                        `-${formatBs(igtfBs)}`
                    ]);
                }

                return rows;
            }),
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: {
                fillColor: colors.header,
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            alternateRowStyles: { fillColor: colors.bg },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 20 },
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'center' }, 
                6: { halign: 'center', fontSize: 6 },
                7: { halign: 'right', fontStyle: 'bold' },
                8: { halign: 'right' },
                9: { halign: 'right' },
                10: { halign: 'right' },
                11: { halign: 'right' }
            },
            // Estilo visual: Las Notas de Crédito se pintarán de rojo
            didParseCell: function(data) {
                if (data.section === 'body') {
                    const isCreditNoteRow = data.row.raw[5] !== '-'; 

                    if (isCreditNoteRow) {
                        data.cell.styles.textColor = colors.red; // Letra roja
                        // Fondo rojo claro
                        if (data.row.index % 2 === 0) data.cell.styles.fillColor = [254, 226, 226]; 
                        else data.cell.styles.fillColor = [254, 202, 202]; 
                    }
                }
            }
        });

        // Sumatorias finales del mes (Como las anuladas restan lo mismo que sumó la factura original, contablemente aportan 0 al total a declarar)
        const totalBase = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.subtotal_taxable_usd || 0) * parseFloat(s.tasa || 0)), 0);
        const totalIva = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.iva_usd || 0) * parseFloat(s.tasa || 0)), 0);
        const totalExento = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.subtotal_exempt_usd || 0) * parseFloat(s.tasa || 0)), 0);
        const totalIgtf = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.igtf_ves || (parseFloat(s.igtf_usd || 0) * parseFloat(s.tasa || 0)))), 0);

        let finalY = doc.lastAutoTable.finalY + 10;

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(`RESUMEN DEL PERÍODO (En ${tenantConfig.primaryCurrency === 'Bs' ? 'Bolívares' : tenantConfig.primaryCurrency}):`, 14, finalY);

        autoTable(doc, {
            startY: finalY + 2,
            head: [['CONCEPTO', 'BASE IMPONIBLE', `DÉBITO FISCAL (${tenantConfig.taxName})`]],
            body: [
                ['Ventas Internas No Gravadas (Exentas)', formatBs(totalExento), '0,00'],
                [`Ventas Internas Gravadas (${tenantConfig.defaultTaxRate * 100}%)`, formatBs(totalBase), formatBs(totalIva)],
                ['Percepción IGTF (3%)', '0,00', formatBs(totalIgtf)],
                ['TOTALES', formatBs(totalBase + totalExento), formatBs(totalIva + totalIgtf)]
            ],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' }
            },
            tableWidth: 160,
            margin: { left: 14 }
        });

        const bottomY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("Declaración jurada sin tachaduras ni enmiendas. Expresado en moneda de curso legal según Providencia 0071.", 14, bottomY);

        doc.setDrawColor(0);
        doc.line(200, bottomY, 300, bottomY); 
        doc.text("Firma del Contribuyente / Rep. Legal", 230, bottomY + 4);

        doc.save(`Libro_Ventas_${reportDateRange.start}_al_${reportDateRange.end}.pdf`);

    } catch (error) {
        console.error('QA Error:', error);
        Swal.fire('Error', 'No se pudo conectar con el servidor para generar el reporte', 'error');
    }
};

// --- FUNCIÓN INTELIGENTE PARA EXPORTAR CSV (MARCA BLANCA) ---
export const downloadCSV = (data, fileName, bcvRate) => {
    if (!data || data.length === 0) return Swal.fire('Vacío', 'No hay datos para exportar', 'info');

    const first = data[0];
    const isInventory = first.hasOwnProperty('stock') && first.hasOwnProperty('name');
    const isDailySummary = first.hasOwnProperty('sale_date') && first.hasOwnProperty('total_usd');
    const isKardex = first.hasOwnProperty('new_stock') && first.hasOwnProperty('reason');

    let orderedHeaders = [];
    let rowMapper = null;

    if (isInventory) {
        orderedHeaders = ["ID", "Producto", "Categoría", "Estatus", "Stock", "Costo Ref", `Costo ${tenantConfig.primaryCurrency}`, "Valor Total Ref", `Valor Total ${tenantConfig.primaryCurrency}`];
        rowMapper = (row) => ({
            "ID": row.id,
            "Producto": row.name,
            "Categoría": row.category,
            "Estatus": row.status,
            "Stock": row.stock,
            "Costo Ref": parseFloat(row.price_usd).toFixed(2),
            [`Costo ${tenantConfig.primaryCurrency}`]: (parseFloat(row.price_usd) * bcvRate).toFixed(2),
            "Valor Total Ref": parseFloat(row.total_value_usd || 0).toFixed(2),
            [`Valor Total ${tenantConfig.primaryCurrency}`]: (parseFloat(row.total_value_usd || 0) * bcvRate).toFixed(2)
        });

    } else if (isDailySummary) {
        orderedHeaders = ["Fecha", "Transacciones", "Total Recaudado (Ref)", `Total Recaudado (${tenantConfig.primaryCurrency})`];
        rowMapper = (row) => ({
            "Fecha": new Date(row.sale_date).toLocaleDateString(),
            "Transacciones": row.tx_count,
            "Total Recaudado (Ref)": parseFloat(row.total_usd).toFixed(2),
            [`Total Recaudado (${tenantConfig.primaryCurrency})`]: parseFloat(row.total_ves).toFixed(2)
        });

    } else if (isKardex) {
        orderedHeaders = ["Fecha", "Hora", "Tipo", "Concepto", "Referencia", "Costo Lote ($)", "Cantidad", "Saldo Final"];
        rowMapper = (row) => ({
            "Fecha": new Date(row.created_at).toLocaleDateString('es-VE'),
            "Hora": new Date(row.created_at).toLocaleTimeString('es-VE'),
            "Tipo": row.type === 'IN' ? 'ENTRADA' : 'SALIDA',
            "Concepto": row.reason ? row.reason.replace(/_/g, ' ') : '-',
            "Referencia": row.document_ref || '-',
            "Costo Lote ($)": row.cost_usd ? parseFloat(row.cost_usd).toFixed(2) : '-',
            "Cantidad": row.quantity,
            "Saldo Final": row.new_stock
        });

    } else {
        orderedHeaders = ["Nro Factura", "Fecha", "Cliente", "Documento", "Ítems", "Estado", "Pago", "Total Ref", `Total ${tenantConfig.primaryCurrency}`];
        rowMapper = (row) => ({
            "Nro Factura": row.id || row.sale_id,
            "Fecha": new Date(row.created_at).toLocaleString('es-VE'),
            "Cliente": row.full_name || row.client_name || 'Consumidor Final',
            "Documento": row.client_id || row.id_number || 'N/A',
            "Ítems": row.items_comprados || 'Sin detalle',
            "Estado": row.status,
            "Pago": row.payment_method,
            "Total Ref": parseFloat(row.total_usd).toFixed(2),
            [`Total ${tenantConfig.primaryCurrency}`]: parseFloat(row.total_ves).toFixed(2)
        });
    }

    const csvContent = [
        orderedHeaders.join(';'),
        ...data.map(originalRow => {
            const mappedRow = rowMapper(originalRow);
            return orderedHeaders.map(header => {
                let value = mappedRow[header];
                if (value === null || value === undefined) value = '';
                return String(value).replace(/(\r\n|\n|\r)/gm, " ").replace(/;/g, ",");
            }).join(';');
        })
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// =========================================================================
//  FUNCIÓN GENERADORA DE TICKET (DINÁMICA: TICKET TÉRMICO O FORMA LIBRE)
// =========================================================================
// 🚨 [NUEVO PARAMETRO] -> igtfUsd = 0
// 🚨 [NUEVO PARAMETRO] -> discountUsd = 0
// 🚨 [NUEVO PARAMETRO] -> userIdentity = null (Punto 4 UX/UI resuelto)
export const generateReceiptHTML = (saleId, customer, items, invoiceType = 'FISCAL', saleStatus = 'PAGADO', createdAt = new Date(), totalSaleUsd = 0, historicalRate = null, paymentMethod = 'NO ESPECIFICADO', bcvRate, igtfUsd = 0, discountUsd = 0, fiscalControlNumber = null, userIdentity = null) => {

    // 🚨 FASE 1 - PUNTO 4: Inyección de Marca Blanca
    // Fusionamos la configuración base (BMS Digital) con los datos fiscales reales de la empresa logueada
    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    const configFiscalBrand = brand.configFiscal || {};

    const rate = historicalRate ? parseFloat(historicalRate) : bcvRate;
    const isVoided = saleStatus === 'ANULADO';

    let itemsToPrint = items;
    if (!items || items.length === 0) {
        itemsToPrint = [{
            name: 'SALDO INICIAL / DEUDA ANTIGUA',
            quantity: 1,
            price_usd: totalSaleUsd,
            is_taxable: false
        }];
    }

    let rawTotalBsExento = 0;
    let rawTotalBsBase = 0;
    let totalRefBase = 0;
    let rawTotalUsdGravable = 0;
    let hasAdvanceGlobal = false;

    // 🚨 CONSTRUCCIÓN SIMULTÁNEA DE AMBOS FORMATOS
    let itemsTicketHTML = '';
    let itemsFormaLibreHTML = '';

    // 1. ITERACIÓN DE ITEMS (Con cumplimiento estricto Art. 34 Ley IVA)
    itemsToPrint.forEach(item => {
        const priceUsd = parseFloat(item.price_at_moment_usd || item.price_usd || 0);
        const qty = parseFloat(item.quantity);
        const totalItemUsd = priceUsd * qty;
        
        // Validación estricta de estatus gravable
        const isTaxable = (item.is_taxable === true || item.is_taxable === 'true' || item.is_taxable === 1);
        
        // Asignación obligatoria del marcador (G) o (E) según Providencia
        const taxMark = isTaxable ? ' (G)' : ' (E)';

        let isAdvance = false;
        let capitalTotalUsd = 0;
        let commissionTotalUsd = 0;

        if (item.name && (item.name.toUpperCase().includes('AVANCE') || item.name.includes('[CAP:'))) {
            try {
                const match = item.name.match(/\[CAP:\s*([\d\.,]+)\]/i);
                if (match && match[1]) {
                    isAdvance = true;
                    hasAdvanceGlobal = true;
                    const unitCapital = parseFloat(match[1].replace(',', '.'));
                    capitalTotalUsd = unitCapital;
                    commissionTotalUsd = totalItemUsd - capitalTotalUsd;
                    if (commissionTotalUsd < 0) isAdvance = false;
                }
            } catch (e) { isAdvance = false; }
        }

        if (isAdvance) {
            const commissionBs = commissionTotalUsd * rate;
            const capitalBs = capitalTotalUsd * rate;
            rawTotalBsExento += capitalBs;

            if (isTaxable) {
                rawTotalBsBase += commissionBs;
                rawTotalUsdGravable += commissionTotalUsd;
            } else {
                rawTotalBsExento += commissionBs;
            }
            totalRefBase += totalItemUsd;

            // HTML para Ticket Térmico
            itemsTicketHTML += `
            <div class="item-row">
                <div class="col-qty">${qty}</div>
                <div class="col-desc">SERV. FINANCIERO (COMISIÓN)${taxMark}</div>
                <div class="col-price">${formatBs(commissionBs)}</div>
            </div>
            <div class="item-row" style="color:#555;">
                <div class="col-qty">-</div>
                <div class="col-desc">ENTREGA DE EFECTIVO (E)</div>
                <div class="col-price">${formatBs(capitalBs)}</div>
            </div>`;

            // HTML para Forma Libre (Tabla)
            itemsFormaLibreHTML += `
            <tr>
                <td style="text-align: left;">SERV. FINANCIERO (COMISIÓN)${taxMark}</td>
                <td style="text-align: center;">${qty}</td>
                <td style="text-align: right;">${formatBs(commissionBs / qty)}</td>
                <td style="text-align: right;">${formatBs(commissionBs)}</td>
            </tr>
            <tr>
                <td style="text-align: left; color:#555;">ENTREGA DE EFECTIVO (E)</td>
                <td style="text-align: center; color:#555;">-</td>
                <td style="text-align: right; color:#555;">-</td>
                <td style="text-align: right; color:#555;">${formatBs(capitalBs)}</td>
            </tr>`;

        } else {
            const subtotalItemBs = totalItemUsd * rate;
            totalRefBase += totalItemUsd;
            
            if (isTaxable) {
                rawTotalBsBase += subtotalItemBs;
                rawTotalUsdGravable += totalItemUsd;
            } else {
                rawTotalBsExento += subtotalItemBs;
            }

            const cleanName = item.name.replace(/\[CAP:.*?\]/i, '').trim();
            
            // HTML para Ticket Térmico
            itemsTicketHTML += `
            <div class="item-row">
                <div class="col-qty">${qty}</div>
                <div class="col-desc">${cleanName.substring(0, 30)}${taxMark}</div>
                <div class="col-price">${formatBs(subtotalItemBs)}</div>
            </div>`;

            // HTML para Forma Libre (Tabla)
            itemsFormaLibreHTML += `
            <tr>
                <td style="text-align: left;">${cleanName.substring(0, 45)}${taxMark}</td>
                <td style="text-align: center;">${qty}</td>
                <td style="text-align: right;">${formatBs(priceUsd * rate)}</td>
                <td style="text-align: right;">${formatBs(subtotalItemBs)}</td>
            </tr>`;
        }
    });

    // 🚨 [CÁLCULOS FINALES CON DESCUENTO PRORRATEADO E IGTF INYECTADO]
    let totalBsExento = rawTotalBsExento;
    let totalBsBase = rawTotalBsBase;
    let totalUsdGravable = rawTotalUsdGravable;
    
    // Convertimos el descuento de Ref a Bs para el ticket local
    const discountBs = discountUsd * rate;

    // Si hay descuento, prorrateamos las bases antes de calcular el IVA
    if (discountUsd > 0) {
        const rawTotalBs = rawTotalBsExento + rawTotalBsBase;
        if (rawTotalBs > 0) {
            const proportionTaxable = rawTotalBsBase / rawTotalBs;
            const proportionExempt = rawTotalBsExento / rawTotalBs;
            
            totalBsBase = rawTotalBsBase - (discountBs * proportionTaxable);
            totalBsExento = rawTotalBsExento - (discountBs * proportionExempt);
            
            // Ajustamos la base en USD para no romper el cálculo final visual
            totalUsdGravable = rawTotalUsdGravable - (discountUsd * proportionTaxable);
        }
    }

    // 🚨 LECTURA DINÁMICA DE IMPUESTOS Y MONEDAS DESDE EL TENANT
    const ivaRate = configFiscalBrand.defaultTaxRate !== undefined ? configFiscalBrand.defaultTaxRate : brand.defaultTaxRate;
    const igtfRateAmount = configFiscalBrand.igtfRate !== undefined ? configFiscalBrand.igtfRate : brand.igtfRate;
    const taxName = configFiscalBrand.taxName || brand.taxName;
    const primaryCurrency = brand.primaryCurrency || 'Bs';
    const secondaryCurrency = brand.secondaryCurrency || 'Ref';

    const ivaBs = totalBsBase * ivaRate;
    const ivaUsd = totalUsdGravable * ivaRate;
    
    // IGTF convertido a Bolívares
    const igtfBs = igtfUsd * rate;

    // Sumatoria Total ajustada con Impuestos
    const totalGeneralBs = totalBsExento + totalBsBase + ivaBs + igtfBs;
    const totalGeneralRef = (totalRefBase - discountUsd) + ivaUsd + igtfUsd;

    const clientName = customer.full_name || 'CONSUMIDOR FINAL';
    const clientId = customer.id_number || 'V-00000000';
    const clientDir = customer.institution || '';

    // =========================================================
    // 🚨 FASE 5: LÓGICA DE BLINDAJE FISCAL MULTI-MODAL
    // =========================================================
    // Ahora reconocemos Forma Libre y Electrónica como facturas legales
    const isFiscal = ['FISCAL', 'FORMA_LIBRE', 'ELECTRONIC', 'ELECTRONIC_BILLING'].includes(invoiceType);
    const isCredit = saleStatus === 'PENDIENTE' || saleStatus === 'PARCIAL';

    let docTitle = 'FACTURA';
    let noFiscalWarning = '';

    if (!isFiscal) {
        docTitle = 'ORDEN DE DESPACHO';
        noFiscalWarning = '<div class="warning-box">DOCUMENTO NO VÁLIDO COMO FACTURA</div>';
    }
    
    if (isCredit && !isFiscal) {
        docTitle = 'CONTROL DE CRÉDITO';
        noFiscalWarning = '<div class="warning-box">DOCUMENTO NO VÁLIDO COMO FACTURA</div>';
    }
    
    if (isVoided) {
        docTitle = 'DOCUMENTO ANULADO';
    }

    const dateStr = new Date(createdAt).toLocaleString('es-VE');

    // =====================================================================
    // 🚨 RENDERIZADO 1: FORMA LIBRE (Media Carta / Carta)
    // =====================================================================
    // Leemos el modo directamente desde la configuración de la empresa inyectada
    const isFormaLibreMode = invoiceType === 'FORMA_LIBRE' || configFiscalBrand.invoiceMode === 'FORMA_LIBRE' || brand.invoiceMode === 'FORMA_LIBRE';
        
    if (isFormaLibreMode && isFiscal && !isCredit) {
            
            // 🛡️ PUNTO 1: CALCE DINÁMICO (Configurable por el usuario para esquivar el membrete)
            const marginTopMM = configFiscalBrand.formaLibreMarginTop || brand.formaLibreMarginTop || 45; 
            const marginLeftMM = configFiscalBrand.formaLibreMarginLeft || brand.formaLibreMarginLeft || 10;
            const formSize = configFiscalBrand.printerPaperSize || brand.formaLibrePaperSize || 'half-letter';
            const pageHeight = formSize === 'letter' ? '279mm' : '140mm';

            // 🛡️ PUNTO 2: IDENTIFICACIÓN CON SERIE DINÁMICA BLINDADA
            let docSerie = configFiscalBrand.formaLibreSerie || brand.formaLibreSerie || 'SERIE - A';
            
            // 1. Rescate Seguro Asíncrono (Lee lo que inyectó el Modal temporalmente)
            try {
                const printSerie = localStorage.getItem('bms_print_serie');
                const activeRegister = JSON.parse(localStorage.getItem('bms_active_register'));
                
                if (printSerie) {
                    docSerie = printSerie; // 🚨 Prioridad 1: Lee la variable del puente asíncrono (3 segundos)
                } else if (activeRegister && activeRegister.serie) {
                    docSerie = activeRegister.serie; // Prioridad 2: La caja abierta actualmente
                }
            } catch (e) {
                // Ignorar silenciosamente si no existe
            }

            // 2. Extracción Regex Mejorada y Estricta (Ej: Extrae la "B" de "B00000003")
            if (fiscalControlNumber && typeof fiscalControlNumber === 'string') {
                const match = fiscalControlNumber.match(/^[a-zA-Z]+/);
                if (match && match[0]) {
                    docSerie = match[0].toUpperCase(); 
                }
            }

            // 🛡️ BLINDAJE DE FORMATO: Si solo nos dio una letra (Ej: "B"), lo convertimos a "SERIE - B"
            const formattedSerie = docSerie.length === 1 ? `SERIE - ${docSerie.toUpperCase()}` : docSerie;

            // 3. Armado Final Inteligente
            let finalInvoiceString = (fiscalControlNumber && fiscalControlNumber.includes('SERIE')) 
                ? fiscalControlNumber // Si ya trae el formato completo desde la base de datos
                : `${formattedSerie} ${saleId.toString().padStart(8, '0')}`;;
                
                
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                /* Fuente monoespaciada para Epson LX 350 (Punto 3) */
                @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                @page { size: 216mm ${pageHeight}; margin: 0; }
                body {
                    font-family: 'Courier Prime', monospace;
                    font-size: 11px; color: #000; margin: 0; background: #fff;
                    padding-top: ${marginTopMM}mm; 
                    padding-left: ${marginLeftMM}mm;
                    padding-right: 15mm;
                    box-sizing: border-box; text-transform: uppercase;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .bold { font-weight: 700; }
            </style>
        </head>
        <body>
            ${isVoided ? '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 64px; color: rgba(0,0,0,0.1); font-weight: bold; border: 5px solid rgba(0,0,0,0.1); padding: 10px; z-index: -1;">ANULADO</div>' : ''}
            
            <div style="text-align: right; margin-bottom: 15px;">
                <div style="font-weight: 700; font-size: 13px;">Factura: ${finalInvoiceString}</div>
                <div>Fecha de Factura: ${new Date(createdAt).toLocaleDateString('es-VE')}</div>
            </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <div><b>Cliente:</b> ${clientName}</div>
        <div><b>CI/RIF:</b> ${clientId}</div>
    </div>
    <div style="margin-bottom: 15px;">
        <div><b>Dirección:</b> ${clientDir || 'S/D'}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <thead>
            <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align: left; padding-bottom: 4px;">Descripción</th>
                <th style="text-align: center; padding-bottom: 4px;">Cantidad</th>
                <th style="text-align: right; padding-bottom: 4px;">Precio Bs</th>
                <th style="text-align: right; padding-bottom: 4px;">Total Bs</th>
            </tr>
        </thead>
        <tbody>
            ${itemsFormaLibreHTML}
        </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 10px;">
        <div style="width: 50%; font-size: 10px; line-height: 1.4;">
            <p>Según el Art. 25 Ley del IVA y Art. 51<br/>Reglamento de la Ley del IVA.</p>
            <p style="margin-top: 10px;">
                <b>Tasa B.C.V:</b> ${formatBs(rate)}<br/>
                <b>Base IGTF Bs:</b> ${igtfUsd > 0 ? formatBs(totalGeneralRef * rate) : '0,00'} &nbsp;&nbsp; <b>IGTF ${(igtfRateAmount * 100).toFixed(0)}% Bs:</b> ${formatBs(igtfBs)}
            </p>
            <p><b>Cajero:</b> CAJA PRINCIPAL &nbsp;&nbsp;&nbsp; <b>Total a Pagar $:</b> ${totalGeneralRef.toFixed(2)}</p>
            ${hasAdvanceGlobal ? '<p style="margin-top:5px; font-size:8px;">* AVANCE EFECTIVO: Operación no sujeta a venta.</p>' : ''}
        </div>
        <div style="width: 45%; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; margin-bottom:2px;"><span>Sub Total Bs:</span> <span>${formatBs(rawTotalBsExento + rawTotalBsBase)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom:2px;"><span>Exento Bs:</span> <span>${formatBs(totalBsExento)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom:2px;"><span>Base Imponible Bs:</span> <span>${formatBs(totalBsBase)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom:2px;"><span>${taxName} (${(ivaRate * 100).toFixed(0)}%):</span> <span>${formatBs(ivaBs)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom:2px;"><span>Descuento:</span> <span>${formatBs(discountBs)}</span></div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-top: 8px;"><span>Total Factura Bs:</span> <span>${formatBs(totalGeneralBs)}</span></div>
        </div>
    </div>
</body>
</html>`;
    }

    // =====================================================================
    // 🚨 RENDERIZADO 2: TICKET TÉRMICO NORMAL (Control Interno / Imp. Fiscal)
    // =====================================================================
    // 🛡️ PUNTOS 1, 2, 3 y 4 APLICADOS AQUÍ PARA EL TICKET PEQUEÑO
    const ticketPaperSize = configFiscalBrand.printerPaperSize || brand.printerPaperSize || '80mm';
    const is58mm = ticketPaperSize === '58mm';
    const finalCompanyName = brand.companyName || brand.tradeName || 'EMPRESA NO DEFINIDA';
    const finalCompanyDocument = brand.companyDocument || 'J-00000000-0';
    const finalCompanyAddress = brand.companyAddress || 'Venezuela';
    const finalCompanyPhone = brand.companyPhone || '';
    
    // Extracción segura del mensaje al pie
    const receiptSecondary = configFiscalBrand.receiptSecondaryMessage || brand.receiptSecondaryMessage || 'Recibí conforme mercancía y servicios.';
    const receiptFooter = configFiscalBrand.receiptFooterMessage || brand.receiptFooterMessage || '*** GRACIAS POR SU COMPRA ***';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket ${saleId}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
        
        /* 🚨 BLINDAJE CSS: DISEÑO UX EN PANTALLA Y CORRECCIÓN DE CORTE EN PAPEL */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        @page { 
            margin: 0; 
            size: ${ticketPaperSize} auto;
        }
        
        /* ESTILO PARA LA PANTALLA (MODAL) */
        html, body { 
            background-color: #f1f5f9;
            display: flex;
            justify-content: center; /* Centra el ticket en la pantalla del monitor */
            align-items: flex-start;
            width: 100%;
            min-height: 100vh;
            padding: 10px 0;
            font-family: 'Roboto', sans-serif; 
        }
        
        .ticket-wrapper {
            background-color: #ffffff;
            width: ${is58mm ? '52mm' : '76mm'}; 
            padding: ${is58mm ? '10px' : '15px'};
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            font-size: ${is58mm ? '8.5px' : '10px'}; 
            line-height: 1.2;
            color: #000; 
            text-transform: uppercase;
            overflow: hidden;
        }
        
        .nums { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-justify { text-align: justify; }
        .bold { font-weight: 700; }
        .black { font-weight: 900; }
        .divider { border-bottom: 1px dashed #000; margin: 4px 0; width: 100%; }
        .divider-bold { border-bottom: 2px solid #000; margin: 6px 0; width: 100%; }
        
        /* Ajuste de fuentes para evitar desbordes */
        .header-title { font-size: ${is58mm ? '13px' : '14px'}; margin-bottom: 2px; text-align: center; }
        .header-meta { font-size: ${is58mm ? '8.5px' : '9px'}; text-align: center; }
        
        /* 🚨 CORRECCIÓN UX PANTALLA: Rectángulo negro con texto blanco */
        .doc-type { margin-top: 6px; margin-bottom: 2px; font-size: ${is58mm ? '12px' : '14px'}; font-weight: 900; background: #000; color: #fff; text-align: center; letter-spacing: 0.5px; padding: 4px 0; border: 2px solid #000; }
        
        .warning-box { margin-top: 2px; font-size: ${is58mm ? '9px' : '10px'}; font-weight: 900; border: 2px solid #000; padding: 3px; text-align: center; }
        
        .client-grid { display: flex; flex-direction: column; margin-top: 5px; gap: 2px; width: 100%; }
        .client-row { display: flex; width: 100%; justify-content: space-between; font-size: ${is58mm ? '8.5px' : '9px'}; }
        .label { font-weight: 700; margin-right: 2px; white-space: nowrap; }
        .val { flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        /* Sistema de columnas blindado */
        .item-container { margin: 6px 0; width: 100%; }
        .item-header { display: flex; width: 100%; font-size: ${is58mm ? '7.5px' : '8px'}; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; font-weight: 700; }
        .item-row { display: flex; width: 100%; margin-bottom: 3px; align-items: flex-start; font-size: ${is58mm ? '8.5px' : '9px'}; }
        
        .col-qty { width: 12%; text-align: left; flex-shrink: 0; }
        .col-desc { width: 56%; padding-right: 3px; line-height: 1.1; word-break: break-word; }
        .col-price { width: 32%; text-align: right; font-weight: 700; flex-shrink: 0; }
        
        .totals-area { display: flex; flex-direction: column; align-items: flex-end; margin-top: 5px; width: 100%; }
        .total-row { display: flex; justify-content: space-between; width: 100%; margin-bottom: 2px; font-size: ${is58mm ? '8.5px' : '9px'};}
        .total-val { font-weight: 700; text-align: right; }
        .final-total { font-size: ${is58mm ? '13px' : '14px'}; margin-top: 4px; padding-top: 4px; border-top: 2px solid #000; width: 100%; display: flex; justify-content: space-between; align-items: center; }
        .ref-total { font-size: ${is58mm ? '9.5px' : '10px'}; margin-top: 2px; text-align: right; width: 100%; }
        .legal-box { font-size: ${is58mm ? '8px' : '8px'}; text-transform: none; margin-top: 8px; line-height: 1.1; text-align: justify; }
        
        .watermark { position: fixed; top: 35%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 32px; color: rgba(0, 0, 0, 0.1); border: 4px solid rgba(0, 0, 0, 0.1); padding: 5px; z-index: 999; font-weight: 900; pointer-events: none; }
        
        /* 🚨 REGLAS ESTRICTAS PARA LA IMPRESORA TÉRMICA (PAPEL FÍSICO) */
        @media print {
            html, body { 
                background-color: #ffffff !important; 
                display: block !important; /* Elimina el centrado de flexbox */
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
            }
            .ticket-wrapper {
                box-shadow: none !important;
                
                /* Ancho seguro para 58mm */
                width: ${is58mm ? '48mm' : '72mm'} !important; 
                max-width: ${is58mm ? '48mm' : '72mm'} !important;
                
                margin: 0 !important; 
                
                /* 🚨 EL SECRETO DEL CENTRADO FÍSICO: Empujamos 5mm a la derecha desde adentro */
                padding: 0 1mm 0 5mm !important; 
            }
            
            /* 🚨 MAGIA UX: Invertimos los colores solo al imprimir para que la térmica no falle */
            .doc-type {
                background-color: #fff !important;
                color: #000 !important;
                border: 2px solid #000 !important;
            }
            
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="ticket-wrapper">
        ${isVoided ? '<div class="watermark">ANULADO</div>' : ''}

        <div class="text-center">
            <div class="header-title black">${finalCompanyName}</div>
            <div class="header-meta bold">RIF: ${finalCompanyDocument}</div>
            <div class="header-meta" style="text-transform: none;">${finalCompanyAddress}</div>
            ${finalCompanyPhone ? `<div class="header-meta">Tel: ${finalCompanyPhone}</div>` : ''}
            
            <div class="doc-type bold">${docTitle}</div>
            ${noFiscalWarning}
        </div>

        <div class="client-grid">
            <div class="client-row"><span class="label">RAZÓN SOCIAL:</span><span class="val">${clientName}</span></div>
            <div class="client-row"><span class="label">CI/RIF:</span><span class="val nums">${clientId}</span></div>
            ${clientDir ? `<div class="client-row"><span class="label">DIR:</span><span class="val" style="font-size:${is58mm ? '8px' : '8px'}; white-space: normal; text-align: right;">${clientDir.substring(0, 40)}</span></div>` : ''}
            <div class="divider"></div>
            <div class="client-row">
                <span class="label">${isFiscal ? 'FACTURA NRO:' : 'DOCUMENTO NRO:'}</span><span class="val nums bold">${saleId.toString().padStart(8, '0')}</span>
            </div>
            <div class="client-row">
                <span class="label">FECHA:</span><span class="val nums">${dateStr}</span>
            </div>
        </div>

        <div class="divider-bold"></div>

        <div class="item-container">
            <div class="item-header">
                <div class="col-qty">CANT</div>
                <div class="col-desc">DESCRIPCIÓN</div>
                <div class="col-price">TOTAL</div>
            </div>
            <div class="nums">
                ${itemsTicketHTML}
            </div>
        </div>

        <div class="divider-bold"></div>

        <div class="totals-area nums">

            ${discountUsd > 0 ? `
            <div class="total-row" style="margin-bottom: 5px; color: #555;">
                <span class="label">SUBTOTAL BRUTO:</span>
                <span class="total-val">${formatBs(rawTotalBsExento + rawTotalBsBase)}</span>
            </div>
            <div class="total-row" style="margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 3px;">
                <span class="label">(-) DESCUENTO:</span>
                <span class="total-val">-${formatBs(discountBs)}</span>
            </div>
            ` : ''}

            <div class="total-row"><span class="label">EXENTO:</span><span class="total-val">${formatBs(totalBsExento)}</span></div>
            <div class="total-row"><span class="label">BASE IMP:</span><span class="total-val">${formatBs(totalBsBase)}</span></div>
            <div class="total-row"><span class="label">${taxName} (${(ivaRate * 100).toFixed(0)}%):</span><span class="total-val">${formatBs(ivaBs)}</span></div>
            
            ${igtfUsd > 0 ? `
            <div class="total-row" style="margin-top: 3px; border-top: 1px dashed #000; padding-top: 3px;">
                <span class="label">IGTF (${(igtfRateAmount * 100).toFixed(0)}% s/Div):</span>
                <span class="total-val">${formatBs(igtfBs)}</span>
            </div>
            ` : ''}

            <div class="final-total">
                <span class="black">TOTAL ${primaryCurrency}</span>
                <span class="black">${formatBs(totalGeneralBs)}</span>
            </div>
            <div class="ref-total bold">${secondaryCurrency}: $${totalGeneralRef.toFixed(2)}</div>
            <div class="ref-total">Tasa BCV: Bs ${rate.toFixed(2)}</div>
            
            ${igtfUsd > 0 ? `<div class="ref-total" style="color: #555;">(Incluye IGTF Ref ${igtfUsd.toFixed(2)})</div>` : ''}
        </div>

        <div style="margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px;">
            <div class="bold" style="font-size: ${is58mm ? '9px' : '10px'};">MÉTODO DE PAGO:</div>
            <div style="font-size: ${is58mm ? '10px' : '11px'}; margin-top: 2px;" class="bold">
                ${paymentMethod}
            </div>
        </div>

        ${isCredit ? '<div class="text-center black warning-box">VENTA A CRÉDITO - POR PAGAR</div>' : ''}

        <div class="legal-box">
            ${receiptSecondary}
            ${hasAdvanceGlobal ? '<br/><br/><strong>* AVANCE EFECTIVO:</strong> Declaro recibir a mi satisfacción el monto detallado como "ENTREGA DE EFECTIVO", operación no sujeta a venta.' : ''}
        </div>

        <div class="text-center" style="font-size:${is58mm ? '9px' : '10px'}; margin-top:10px; font-weight: bold; padding-bottom: 20px;">
            ${receiptFooter}
            <br/><br/>.
        </div>
    </div> <!-- FIN TICKET WRAPPER -->
</body>
</html>
`;
};

// --- FUNCIÓN REPORTE PDF (UX PREMIUM MARCA BLANCA) ---
export const printClosingReport = (shift) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- 🏢 DATOS FISCALES DINÁMICOS ---
    const FISCAL_INFO = {
        name: tenantConfig.companyName,
        rif: tenantConfig.companyDocument,
        address: tenantConfig.companyAddress,
        providencia: "Providencia Administrativa SNAT/2024/00012"
    };

    const colors = {
        header: [15, 23, 42],    
        textHeader: [255, 255, 255],
        textDark: [30, 41, 59],  
        textLight: [100, 116, 139], 
        accent: [37, 99, 235],   
        bgRow: [248, 250, 252],  
        line: [226, 232, 240]
    };

    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 40, 'F'); 

    doc.setFontSize(18);
    doc.setTextColor(...colors.textHeader);
    doc.setFont('helvetica', 'bold');
    doc.text("REPORTE DE CIERRE (Z)", 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(FISCAL_INFO.name, 14, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`RIF: ${FISCAL_INFO.rif}`, 14, 26);
    const splitAddress = doc.splitTextToSize(FISCAL_INFO.address, 110);
    doc.text(splitAddress, 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225); 
    doc.text(`CONTROL FISCAL INTERNO`, pageWidth - 14, 15, { align: 'right' });

    doc.setFontSize(9);
    doc.text(`TURNO ID: #${shift.id}`, pageWidth - 14, 22, { align: 'right' });
    doc.text(`${new Date(shift.opened_at).toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE')}`, pageWidth - 14, 30, { align: 'right' });

    let y = 55; 

    doc.setFontSize(11);
    doc.setTextColor(...colors.textDark);
    doc.setFont('helvetica', 'bold');
    doc.text("1. CONCILIACIÓN DE EFECTIVO (GAVETA)", 14, y);

    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(0.5);
    doc.line(14, y + 2, pageWidth - 14, y + 2);
    y += 10;

    const drawSummaryRow = (label, vesVal, usdVal, isDeduction = false, isTotal = false) => {
        const xValVes = 140;
        const xValUsd = 180;

        doc.setFontSize(10);
        doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
        doc.setTextColor(...(isDeduction ? [220, 38, 38] : (isTotal ? colors.textDark : colors.textLight)));

        doc.text(label, 14, y);

        const prefix = isDeduction ? '-' : '';
        doc.text(`${prefix}${tenantConfig.primaryCurrency} ${vesVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, xValVes, y, { align: 'right' });
        doc.text(`${prefix}$${usdVal.toFixed(2)}`, xValUsd, y, { align: 'right' });

        y += 7;
    };

    const baseVes = parseFloat(shift.initial_cash_ves || 0);
    const baseUsd = parseFloat(shift.initial_cash_usd || 0);
    const ventasVes = parseFloat(shift.system_cash_ves || 0);
    const ventasUsd = parseFloat(shift.system_cash_usd || 0);
    const avancesVes = parseFloat(shift.cash_outflows_ves || 0);
    const avancesUsd = parseFloat(shift.cash_outflows_usd || 0);

    const esperadoVes = (baseVes + ventasVes) - avancesVes;
    const esperadoUsd = (baseUsd + ventasUsd) - avancesUsd;

    drawSummaryRow("(+) Fondo de Caja Inicial", baseVes, baseUsd);
    drawSummaryRow("(+) Ventas en Efectivo", ventasVes, ventasUsd);

    if (avancesVes > 0 || avancesUsd > 0) {
        drawSummaryRow("(-) Avances / Retiros", avancesVes, avancesUsd, true);
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(100, y - 4, pageWidth - 14, y - 4);

    drawSummaryRow("(=) TOTAL ESPERADO EN GAVETA", esperadoVes, esperadoUsd, false, true);

    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(...colors.textDark);
    doc.setFont('helvetica', 'bold');
    doc.text("2. DESGLOSE POR MÉTODO DE PAGO", 14, y);
    doc.setDrawColor(...colors.accent);
    doc.line(14, y + 2, pageWidth - 14, y + 2);
    y += 12;

    doc.setFillColor(...colors.bgRow);
    doc.rect(14, y - 6, pageWidth - 28, 10, 'F');
    doc.setFontSize(9);
    doc.text("MÉTODO", 18, y);
    doc.text("ESPERADO (SISTEMA)", 90, y, { align: 'right' });
    doc.text("CONTADO (REAL)", 140, y, { align: 'right' });
    doc.text("DIFERENCIA", 190, y, { align: 'right' });
    y += 12;

    const drawTableRow = (label, sysBs, sysRef, realBs, realRef) => {
        const diffBs = realBs - sysBs;
        const diffRef = realRef - sysRef;

        if (sysBs === 0 && sysRef === 0 && realBs === 0 && realRef === 0) return;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.textDark);
        doc.text(label, 18, y);

        doc.setFont('helvetica', 'normal');
        doc.text(`${tenantConfig.primaryCurrency} ${sysBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 90, y, { align: 'right' });
        doc.setTextColor(...colors.textLight);
        doc.setFontSize(8);
        doc.text(`Ref ${sysRef.toFixed(2)}`, 90, y + 4, { align: 'right' });

        doc.setFontSize(9);
        doc.setTextColor(...colors.textDark);
        doc.text(`${tenantConfig.primaryCurrency} ${realBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 140, y, { align: 'right' });
        doc.setTextColor(...colors.textLight);
        doc.setFontSize(8);
        doc.text(`Ref ${realRef.toFixed(2)}`, 140, y + 4, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        if (Math.abs(diffBs) < 1) doc.setTextColor(22, 163, 74);
        else doc.setTextColor(220, 38, 38);
        doc.text(`${tenantConfig.primaryCurrency} ${diffBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });

        if (Math.abs(diffRef) < 0.1) doc.setTextColor(22, 163, 74);
        else doc.setTextColor(220, 38, 38);
        doc.setFontSize(8);
        doc.text(`Ref ${diffRef.toFixed(2)}`, 190, y + 4, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(14, y + 6, pageWidth - 14, y + 6);

        y += 14;
    };

    drawTableRow("Efectivo (Gaveta)", esperadoVes, esperadoUsd, parseFloat(shift.real_cash_ves || 0), parseFloat(shift.real_cash_usd || 0));
    drawTableRow("Pago Móvil", parseFloat(shift.system_pago_movil || 0), 0, parseFloat(shift.real_pago_movil || 0), 0);
    drawTableRow("Punto de Venta", parseFloat(shift.system_punto || 0), 0, parseFloat(shift.real_punto || 0), 0);
    drawTableRow("Zelle", 0, parseFloat(shift.system_zelle || 0), 0, parseFloat(shift.real_zelle || 0));

    y += 10;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text(FISCAL_INFO.providencia, 14, pageHeight - 15);
    doc.text(`Documento generado por Sistema ${tenantConfig.companyName}`, pageWidth - 14, pageHeight - 15, { align: 'right' });

    doc.save(`Cierre_Fiscal_${shift.id}.pdf`);
};

// --- FUNCIÓN GENERAR REPORTE PDF (DISEÑO MODERNO: MARCA BLANCA) ---
export const exportReportToPDF = (analyticsData, reportDateRange) => {
    if (!analyticsData || !analyticsData.salesOverTime) {
        return Swal.fire('Sin datos', 'No hay información para generar el reporte.', 'warning');
    }

    const doc = new jsPDF();

    const colors = {
        primary: [0, 86, 179],   
        secondary: [225, 29, 43], 
        darkText: [30, 41, 59],   
        lightText: [100, 116, 139], 
        bgLight: [248, 250, 252],  
        border: [226, 232, 240]    
    };

    const drawModernCard = (x, y, width, height, title, valueRef, valueBs, accentColor) => {
        doc.setDrawColor(...colors.border);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, width, height, 4, 4, 'FD');

        doc.setFillColor(...accentColor);
        doc.rect(x + 1, y + 1, width - 2, 2, 'F');

        doc.setTextColor(...colors.lightText);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), x + 6, y + 12);

        doc.setTextColor(...accentColor);
        doc.setFontSize(14); 
        doc.setFont('helvetica', 'bold');
        doc.text(valueRef, x + 6, y + 20);

        if (valueBs) {
            doc.setFontSize(9);
            doc.setTextColor(...colors.darkText);
            doc.setFont('helvetica', 'bold'); 
            doc.text(valueBs, x + 6, y + 26);
        }
    };

    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, 210, 4, 'F');

    doc.setFontSize(24);
    doc.setTextColor(...colors.darkText);
    doc.setFont('helvetica', 'bold');
    doc.text("Reporte Gerencial", 14, 25);

    doc.setFontSize(10);
    doc.setTextColor(...colors.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text(`Inteligencia de Negocios ${tenantConfig.companyName}`, 14, 32);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text(`Periodo: ${new Date(reportDateRange.start).toLocaleDateString()} — ${new Date(reportDateRange.end).toLocaleDateString()}`, 14, 38);

    doc.setFontSize(8);
    doc.setTextColor(...colors.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleString()}`, 196, 25, { align: 'right' });


    let finalY = 50;
    doc.setFontSize(12);
    doc.setTextColor(...colors.darkText);
    doc.setFont('helvetica', 'bold');
    doc.text("Resumen Ejecutivo", 14, finalY);
    finalY += 8;

    const totalUSD = analyticsData.salesOverTime.reduce((acc, day) => acc + parseFloat(day.total_usd), 0);
    const totalVES = analyticsData.salesOverTime.reduce((acc, day) => acc + parseFloat(day.total_ves), 0);
    const totalTransacciones = analyticsData.salesOverTime.reduce((acc, day) => acc + parseInt(day.tx_count), 0);

    const ticketPromedioUSD = totalTransacciones > 0 ? totalUSD / totalTransacciones : 0;
    const ticketPromedioVES = totalTransacciones > 0 ? totalVES / totalTransacciones : 0;

    const cardWidth = 58;
    const cardHeight = 32; 
    const gap = 6;

    drawModernCard(
        14, finalY, cardWidth, cardHeight,
        "Dinero Recaudado",
        `Ref ${totalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
        `${tenantConfig.primaryCurrency} ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
        colors.primary
    );

    drawModernCard(
        14 + cardWidth + gap, finalY, cardWidth, cardHeight,
        "Transacciones",
        `${totalTransacciones}`,
        "Operaciones exitosas",
        colors.darkText
    );

    const ticketColor = ticketPromedioUSD > 50 ? colors.primary : colors.secondary;
    drawModernCard(
        14 + (cardWidth + gap) * 2, finalY, cardWidth, cardHeight,
        "Ticket Promedio",
        `Ref ${ticketPromedioUSD.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
        `${tenantConfig.primaryCurrency} ${ticketPromedioVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
        ticketColor
    );

    finalY += cardHeight + 15;

    const cleanTableStyles = {
        theme: 'striped',
        headStyles: {
            fillColor: colors.primary,
            textColor: 255,
            fontStyle: 'bold',
            halign: 'left',
            cellPadding: 3
        },
        bodyStyles: { textColor: colors.darkText, fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: colors.bgLight },
        styles: { lineColor: 255, lineWidth: 0.1 }
    };

    doc.setFontSize(11);
    doc.setTextColor(...colors.darkText);
    doc.text("1. Evolución de Ventas Diarias", 14, finalY);
    finalY += 4;

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['Fecha', 'Ops', 'Recaudado (Ref)', `Recaudado (${tenantConfig.primaryCurrency})`]],
        body: analyticsData.salesOverTime.map(row => [
            new Date(row.sale_date).toLocaleDateString(),
            row.tx_count,
            `Ref ${parseFloat(row.total_usd).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
            `${tenantConfig.primaryCurrency} ${parseFloat(row.total_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
        ]),
        columnStyles: {
            0: { cellWidth: 35 },
            1: { halign: 'center' },
            2: { fontStyle: 'bold', halign: 'right', textColor: colors.primary }, 
            3: { halign: 'right', textColor: colors.darkText } 
        }
    });

    finalY = doc.lastAutoTable.finalY + 15;

    if (finalY > 230) { doc.addPage(); finalY = 20; }

    doc.setFontSize(11);
    doc.setTextColor(...colors.darkText);
    doc.text("2. Productos Más Vendidos (Top 5)", 14, finalY);
    finalY += 4;

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['Producto', 'Unidades', 'Ingreso (Ref)']], 
        headStyles: { ...cleanTableStyles.headStyles, fillColor: colors.secondary },
        body: analyticsData.topProducts.map(row => [
            row.name,
            row.total_qty,
            `Ref ${parseFloat(row.total_revenue).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
        ]),
        columnStyles: {
            1: { halign: 'center' },
            2: { halign: 'right', fontStyle: 'bold' }
        }
    });

    finalY = doc.lastAutoTable.finalY + 15;

    if (finalY > 230) { doc.addPage(); finalY = 20; }

    doc.setFontSize(11);
    doc.setTextColor(...colors.darkText);
    doc.text("3. Rendimiento por Categoría", 14, finalY);
    finalY += 4;

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['Categoría', 'Participación', 'Total (Ref)']],
        body: analyticsData.salesByCategory.map(row => {
            const percentage = totalUSD > 0 ? (parseFloat(row.total_usd) / totalUSD * 100).toFixed(1) : 0;
            return [
                row.category,
                `${percentage}%`,
                `Ref ${parseFloat(row.total_usd).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
            ]
        }),
        columnStyles: {
            1: { halign: 'center', textColor: colors.lightText, fontSize: 8 },
            2: { halign: 'right', fontStyle: 'bold' }
        }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...colors.border);
        doc.line(14, 285, 196, 285);

        doc.setFontSize(8);
        doc.setTextColor(...colors.lightText);
        doc.text(`Sistema ${tenantConfig.companyName} - Reporte Gerencial`, 14, 290);
        doc.text(`${i} / ${pageCount}`, 196, 290, { align: 'right' });
    }

    doc.save(`Reporte_Gerencial_${reportDateRange.start}.pdf`);
};