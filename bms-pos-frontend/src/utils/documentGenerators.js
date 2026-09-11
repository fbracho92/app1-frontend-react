import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { formatBs, formatUSD } from './formatters';
import { tenantConfig } from '../config/tenantConfig'; // <-- INYECCI脫N DE MARCA BLANCA

// --- FUNCIóN: IMPRIMIR REPORTE KARDEX (ADAPTADO A MARCA BLANCA, UX PRO Y LEGAL VZLA) ---
export const printKardexReport = (kardexProduct, kardexHistory, bcvRate, userIdentity = null) => {
    if (!kardexProduct || kardexHistory.length === 0) return Swal.fire('Error', 'No hay datos para exportar', 'warning');

    // ?? ORDEN CRONOLóGICO LEGAL (Art. 177 ISLR): Invertimos el historial para que vaya del más antiguo al más reciente
    // Creamos una copia para no mutar el array original del componente
    const sortedHistory = [...kardexHistory].reverse();

    // ?? FASE MARCA BLANCA: Fusionamos identidad corporativa del inquilino activo
    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    const finalCompanyName = brand.companyName || brand.tradeName || tenantConfig.companyName;
    const finalCompanyDocument = brand.companyDocument || tenantConfig.companyDocument;

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    // --- PALETA ---
    const colors = {
        header: [30, 41, 59],    // Slate 800
        green: [22, 163, 74],    // Green 600
        red: [220, 38, 38],      // Red 600
        blue: [37, 99, 235]      // Blue 600
    };

    // ?? FORMATEADOR INTELIGENTE DE CANTIDADES
    const formatQuantity = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0' : num.toString();
    };

    // ?? FIX ENCODING: Textos sanitizados sin acentos
    // 1. ENCABEZADO FISCAL
    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("KARDEX DE INVENTARIO VALORIZADO", 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // ?? CUMPLIMIENTO BIMONETARIO EXPLíCITO
    doc.text(`CONTROL DE MOVIMIENTOS Y EXISTENCIAS (EXPRESADO EN Bs Y DIVISA REFERENCIAL)`, 14, 18);

    // Sanitizar Razón Social
    const safeName = finalCompanyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Datos de la Empresa y Tasa (DINáMICO)
    doc.setFontSize(9);
    doc.text(`RIF: ${finalCompanyDocument}`, pageWidth - 14, 10, { align: 'right' });
    doc.text(`Razon Social: ${safeName}`, pageWidth - 14, 15, { align: 'right' });
    doc.text(`Emision: ${new Date().toLocaleString('es-VE')}`, pageWidth - 14, 20, { align: 'right' });
    doc.text(`Tasa de Cambio Base: Bs ${formatBs(bcvRate)}`, pageWidth - 14, 25, { align: 'right' });

    // 2. DATOS DEL PRODUCTO
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 35, pageWidth - 28, 20, 2, 2, 'FD');

    // Sanitizar nombre de producto
    const cleanProductName = kardexProduct.name ? kardexProduct.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : 'N/A';
    const cleanCategory = kardexProduct.category ? kardexProduct.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'General';

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`PRODUCTO: ${cleanProductName}`, 20, 42);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`CODIGO: ${kardexProduct.barcode || 'S/C'}`, 20, 48);
    doc.text(`CATEGORIA: ${cleanCategory}`, 20, 52);

    const stockActual = parseFloat(kardexProduct.stock) || 0;
    const costoUnitRef = parseFloat(kardexProduct.price_usd);
    const costoUnitBs = costoUnitRef * bcvRate;
    const valorTotalBs = stockActual * costoUnitBs;
    
    // ?? UX PRO: Extracción y normalización de la unidad de medida real
    let unitDisplay = (kardexProduct.unit_measure || 'UND').toUpperCase().trim();
    if (unitDisplay === 'KILO' || unitDisplay === 'KILOGRAMO') unitDisplay = 'KG';
    else if (unitDisplay === 'LITRO') unitDisplay = 'LT';
    else if (unitDisplay === 'UNIDAD') unitDisplay = 'UND';

    doc.text(`EXISTENCIA: ${formatQuantity(stockActual)} ${unitDisplay}`, 120, 48);
    doc.text(`COSTO UNITARIO: Bs ${formatBs(costoUnitBs)}`, 120, 52);

    doc.setFont('helvetica', 'bold');
    doc.text(`VALOR TOTAL (Bs): Bs ${formatBs(valorTotalBs)}`, 200, 48);

    doc.setTextColor(...colors.blue);
    doc.setFontSize(8);
    doc.text(`(Ref. Total: $${formatUSD(stockActual * costoUnitRef)})`, 200, 52);
    doc.setTextColor(0, 0, 0);

    // 3. TABLA ANALíTICA (Consumiendo el array invertido: sortedHistory)
    autoTable(doc, {
        startY: 60,
        head: [[
            'FECHA', 'DOC. REF', 'CONCEPTO', 
            'TIPO', 'CANT',
            `COSTO UNIT (Bs)`, `TOTAL OP (Bs)`, 
            `TOTAL OP (Ref)`, 
            'SALDO'
        ]],
        body: sortedHistory.map(mov => {
            let costRef = parseFloat(mov.cost_usd);
            if (isNaN(costRef) || costRef === 0) {
                costRef = parseFloat(kardexProduct.price_usd) || 0;
            }

            const movQty = parseFloat(mov.quantity) || 0;
            const newStock = parseFloat(mov.new_stock) || 0;

            const costBs = costRef * bcvRate;
            const totalRef = costRef * movQty;
            const totalBs = totalRef * bcvRate;
            
            // Limpiar concepto para evitar caracteres raros
            const cleanReason = mov.reason ? mov.reason.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, ' ') : 'MOVIMIENTO';

            return [
                new Date(mov.created_at).toLocaleDateString('es-VE'),
                mov.document_ref || '-',
                cleanReason,
                mov.type === 'IN' ? 'ENTRADA' : 'SALIDA',
                formatQuantity(movQty), 
                formatBs(costBs),
                formatBs(totalBs),
                formatUSD(totalRef),
                formatQuantity(newStock) 
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

    // 4. PIE DE PáGINA LEGAL
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(7);
    doc.setTextColor(100);

    doc.text(`NOTA: Los valores en Bolivares se calculan en base a la tasa de cambio vigente a la fecha de emision de este reporte.`, 14, finalY);
    doc.text("BASE LEGAL: Art. 177 Reglamento ISLR (Sistema de Inventarios Permanentes) y Providencia Administrativa SNAT/2011/0071.", 14, finalY + 4);

    doc.setDrawColor(0, 0, 0);
    doc.line(200, finalY + 15, 270, finalY + 15);
    doc.text("Conformado Por (Firma y Sello)", 220, finalY + 20);
    
    // Sanitizar nombre para el archivo
    const safeFileName = cleanProductName.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Kardex_Valorizado_${safeFileName}.pdf`);
};

// --- 1. FUNCIóN DE REPORTE DE AUDITORíA (MARCA BLANCA, FILTRO LEGAL Y ORDENAMIENTO) ---
export const printInventoryAuditPDF = (products, bcvRate, userIdentity = null) => {
    
    // ?? 1. FILTRO LEGAL Y UX: Solo reflejar mercancía con stock > 0 y excluir SERVICIOS (intangibles)
    let existingProducts = products.filter(p => parseFloat(p.stock) > 0 && !p.is_service);

    if (!existingProducts || existingProducts.length === 0) {
        return Swal.fire('Sin Existencias', 'No hay productos con stock positivo para generar el reporte de valorizacion.', 'info');
    }

    // ?? 2. ORDEN LEGAL VENEZOLANO: Alfabéticamente por Categoría, luego por Nombre
    existingProducts.sort((a, b) => {
        const catA = (a.category || '').toUpperCase();
        const catB = (b.category || '').toUpperCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        
        const nameA = (a.name || '').toUpperCase();
        const nameB = (b.name || '').toUpperCase();
        return nameA.localeCompare(nameB);
    });

    // ?? 3. FASE MARCA BLANCA
    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    const finalCompanyName = brand.companyName || brand.tradeName || tenantConfig.companyName;
    const finalCompanyDocument = brand.companyDocument || tenantConfig.companyDocument;

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    const colors = {
        header: [30, 41, 59],    
        accent: [225, 29, 43],   
        text: [51, 65, 85],      
        bg: [241, 245, 249]      
    };

    const formatQuantity = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0' : num.toString();
    };

    // FIX ENCODING: Textos limpios sin acentos
    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("REPORTE DE VALORIZACION Y EXISTENCIAS", 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("CONTROL DE INVENTARIO FISICO (EXCLUYE STOCK AGOTADO Y SERVICIOS)", 14, 18);

    // Sanitizar Razón Social
    const safeName = finalCompanyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    doc.setFontSize(9);
    doc.text(`RIF: ${finalCompanyDocument}`, 14, 24); 
    doc.text(`Razon Social: ${safeName}`, 14, 29); 

    const dateStr = new Date().toLocaleString('es-VE');
    const rateStr = formatBs(bcvRate);

    doc.text(`Fecha de Corte: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Tasa de Cambio BCV: Bs ${rateStr}`, pageWidth - 14, 18, { align: 'right' });
    doc.text(`Expresado en: Bs y Divisa Referencial (Ref)`, pageWidth - 14, 24, { align: 'right' });

    let totalValueUSD = 0;
    let totalValueVES = 0;

    existingProducts.forEach(item => {
        const stock = parseFloat(item.stock) || 0;
        const price = parseFloat(item.price_usd) || 0;
        const totalUSD = stock * price;
        const totalVES = totalUSD * bcvRate;

        totalValueUSD += totalUSD;
        totalValueVES += totalVES;
    });

    const startYTotals = 40;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(14, startYTotals, pageWidth - 28, 20, 3, 3, 'S');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text("TOTAL PRODUCTOS", 60, startYTotals + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${existingProducts.length}`, 60, startYTotals + 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`VALOR TOTAL (Bs)`, 148, startYTotals + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.accent);
    doc.text(`Bs ${formatBs(totalValueVES)}`, 148, startYTotals + 14, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`VALOR TOTAL (Ref)`, 236, startYTotals + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 86, 179);
    doc.text(`Ref ${formatUSD(totalValueUSD)}`, 236, startYTotals + 14, { align: 'center' });

    autoTable(doc, {
        startY: startYTotals + 25,
        head: [['CODIGO', 'CATEGORIA', 'DESCRIPCION DEL PRODUCTO', 'CANTIDAD', `COSTO UNIT (Bs)`, `TOTAL (Bs)`, `TOTAL (Ref)`]],
        body: existingProducts.map(item => {
            const stock = parseFloat(item.stock) || 0;
            const price = parseFloat(item.price_usd) || 0;
            const totalUSD = stock * price;
            const totalVES = totalUSD * bcvRate;
            const unitVES = price * bcvRate;
            
            // UX PRO: Normalización de la unidad de medida (Kilo -> KG)
            let unitMeasure = (item.unit_measure || 'UND').toUpperCase().trim();
            if (unitMeasure === 'KILO' || unitMeasure === 'KILOGRAMO') unitMeasure = 'KG';
            else if (unitMeasure === 'LITRO') unitMeasure = 'LT';
            else if (unitMeasure === 'UNIDAD') unitMeasure = 'UND';

            // Sanitizamos para proteger el PDF de caracteres extra?os
            const cleanName = item.name ? item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 45) : 'N/A';
            const cleanCat = item.category ? item.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'General';

            return [
                item.barcode || `INT-${item.id}`,
                cleanCat, // Intercambiado para mostrar la categoría primero según el orden visual lógico
                cleanName,
                `${formatQuantity(stock)} ${unitMeasure}`,
                formatBs(unitVES),
                formatBs(totalVES),
                formatUSD(totalUSD)
            ];
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: colors.header, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 35 }, // Categoría
            2: { cellWidth: 'auto' }, // Nombre
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
    doc.text("Este reporte refleja la valorizacion del inventario fisico segun los costos registrados en el sistema al momento de su emision.", 14, finalY);
    doc.text("Base Legal: Art. 177 Reglamento de la Ley de ISLR (Valuacion de Inventarios) y Providencia Administrativa 0071.", 14, finalY + 4);

    doc.setDrawColor(200, 200, 200);
    doc.line(200, finalY + 15, 270, finalY + 15);
    doc.text("Revisado por (Firma y Sello)", 215, finalY + 19);

    doc.save(`Auditoria_Inventario_Valorizado_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- FUNCIóN: REPORTE DE TOMA DE INVENTARIO FíSICO (MARCA BLANCA / UX PRO / LEGAL VZLA) ---
export const printPhysicalCountReport = (inventoryFilteredData, products, userIdentity = null) => {
    // ?? 1. OBTENCIóN DE DATOS BASE
    const rawData = inventoryFilteredData && inventoryFilteredData.length > 0 ? inventoryFilteredData : products;
    if (!rawData || rawData.length === 0) return Swal.fire('Error', 'No hay datos para generar el acta', 'warning');

    // ?? 2. LIMPIEZA, CRUCE DE DATOS Y NORMALIZACIóN DE UNIDADES
    let cleanData = [];

    rawData.forEach(item => {
        // A. Eliminar "Filas Fantasmas" (Subtotales SQL que vienen sin nombre)
        if (!item.name || item.name.trim() === '') return;

        // B. Cruzar con el Inventario Maestro (garantiza tener is_service y unit_measure correctos)
        const masterItem = products.find(p => p.id === item.id) || item;

        // C. Excluir Servicios (Ej: "Avance de Efectivo" no se puede contar físicamente)
        if (masterItem.is_service) return;

        // D. Normalizar la unidad para que se vea profesional en el PDF (Kilo -> KG)
        let unitDisplay = (masterItem.unit_measure || 'UND').toUpperCase().trim();
        if (unitDisplay === 'KILO' || unitDisplay === 'KILOGRAMO') unitDisplay = 'KG';
        else if (unitDisplay === 'LITRO') unitDisplay = 'LT';
        else if (unitDisplay === 'UNIDAD') unitDisplay = 'UND';

        cleanData.push({
            ...item,
            category: masterItem.category || item.category || 'General',
            name: masterItem.name || item.name,
            unitDisplay: unitDisplay,
            barcode: masterItem.barcode || item.barcode
        });
    });

    // ?? 3. ORDEN LEGAL VENEZOLANO: Alfabéticamente por Categoría, luego por Nombre
    cleanData.sort((a, b) => {
        const catA = (a.category || '').toUpperCase();
        const catB = (b.category || '').toUpperCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        
        const nameA = (a.name || '').toUpperCase();
        const nameB = (b.name || '').toUpperCase();
        return nameA.localeCompare(nameB);
    });

    if (cleanData.length === 0) {
        return Swal.fire('Atención', 'No hay productos físicos válidos para contar (se excluyeron los servicios).', 'info');
    }

    // ?? 4. FASE MARCA BLANCA: Identidad corporativa del inquilino activo
    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    const finalCompanyName = brand.companyName || brand.tradeName || tenantConfig.companyName;
    const finalCompanyDocument = brand.companyDocument || tenantConfig.companyDocument;

    // =========================================================
    // A PARTIR DE AQUí: TU DISE?O ORIGINAL EXACTO E INTACTO
    // =========================================================
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
    
    // FIX ENCODING: Textos limpios sin acentos
    doc.text("ACTA DE TOMA DE INVENTARIO FISICO", 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("INSTRUMENTO DE CONTEO CIEGO (AUDITORIA)", 14, 18);

    // Sanitizar Razón Social
    const safeName = finalCompanyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    doc.setFontSize(9);
    doc.text(`RIF: ${finalCompanyDocument}`, 14, 24);
    doc.text(`Razon Social: ${safeName}`, 14, 28);

    const fecha = new Date().toLocaleDateString('es-VE');
    doc.text(`Fecha de Emision: ${fecha}`, pageWidth - 14, 12, { align: 'right' });
    doc.text("Responsable de Conteo: ___________________", pageWidth - 14, 18, { align: 'right' });
    doc.text("Auditor Supervisor: ___________________", pageWidth - 14, 24, { align: 'right' });

    autoTable(doc, {
        startY: 35,
        head: [['CODIGO', 'CATEGORIA', 'DESCRIPCION DEL PRODUCTO', 'UNIDAD', 'CONTEO REAL (FISICO)']],
        body: cleanData.map(item => {
            // Sanitizamos textos dinámicos desde la BD para la tabla
            const cleanName = item.name ? item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 45) : 'N/A';
            const cleanCat = item.category ? item.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'General';
            
            return [
                item.barcode || `INT-${item.id}`,
                cleanCat,
                cleanName,
                item.unitDisplay, // ?? Muestra la unidad real saneada (KG, LT, UND)
                ''
            ];
        }),
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
            3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
            4: { cellWidth: 40, minCellHeight: 10 }
        },
        didDrawCell: function (data) {
            // Mantiene tu lógica original de dibujo de línea
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

    doc.text("Certifico que he realizado el conteo fisico de los articulos listados, verificando su existencia real en los almacenes.", 14, finalY);
    doc.text(`Este documento es propiedad exclusiva de ${safeName} y sirve de soporte para el cierre contable.`, 14, finalY + 4);

    if (finalY < 250) {
        doc.line(40, finalY + 20, 90, finalY + 20);
        doc.text("Firma Responsable", 65, finalY + 24, { align: 'center' });

        doc.line(120, finalY + 20, 170, finalY + 20);
        doc.text("Firma Auditor", 145, finalY + 24, { align: 'center' });
    }

    doc.save(`Toma_Fisica_Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
};
// --- NUEVO: REPORTE LEGAL DE CARTERA DE CREDITO (MARCA BLANCA BLINDADA) ---
export const printLegalDebtReport = async (ReportService, bcvRate, userIdentity = null) => {
    try {
        Swal.fire({ title: 'Generando Reporte Legal...', didOpen: () => Swal.showLoading() });
        const res = await ReportService.getAgedDebt();
        const debts = res.data;
        Swal.close();

        if (debts.length === 0) return Swal.fire('Sin Deudas', 'No hay cuentas por cobrar pendientes.', 'info');

        // ?? FASE MARCA BLANCA: Extraer datos reales del inquilino (SaaS)
        const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
        const finalCompanyName = brand.companyName || brand.tradeName || tenantConfig.companyName || 'Empresa';
        const finalCompanyDocument = brand.companyDocument || tenantConfig.companyDocument || 'J-00000000-0';
        
        // Anti-corrupción de acentos para el PDF
        const safeName = finalCompanyName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 

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
        doc.text("RELACION ANALITICA DE CUENTAS POR COBRAR", 14, 12);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("CONTROL DE CARTERA DE CREDITO Y VENCIMIENTOS", 14, 18);

        // ?? INYECCIóN DE LA IDENTIDAD LEGAL
        doc.setFontSize(9);
        doc.text(`RIF: ${finalCompanyDocument}`, 14, 24);
        doc.text(`Razon Social: ${safeName}`, 14, 29);

        const dateStr = new Date().toLocaleDateString('es-VE');
        doc.text(`Fecha de Corte: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
        doc.text(`Tasa de Cambio Cierre: ${tenantConfig.primaryCurrency} ${formatBs(bcvRate)}`, pageWidth - 14, 18, { align: 'right' });
        doc.text(`Expresado en: ${tenantConfig.primaryCurrency} y Divisas (${tenantConfig.secondaryCurrency})`, pageWidth - 14, 24, { align: 'right' });

        autoTable(doc, {
            startY: 40,
            head: [['CLIENTE / RAZON SOCIAL', 'RIF/CI', 'Nro FACT', 'EMISION', 'VENCIMIENTO', 'DIAS VENC.', `SALDO (${tenantConfig.secondaryCurrency})`, `SALDO (${tenantConfig.primaryCurrency})`]],
            body: debts.map(d => {
                const daysOverdue = Math.ceil((new Date() - new Date(d.due_date)) / (1000 * 60 * 60 * 24));
                const balanceBs = parseFloat(d.balance_usd) * bcvRate; 
                
                // Limpieza de caracteres para el nombre del cliente
                const cleanFullName = d.full_name ? d.full_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 35) : 'Desconocido';

                return [
                    cleanFullName,
                    d.id_number || 'S/I',
                    `#${d.invoice_id}`,
                    new Date(d.emission_date).toLocaleDateString('es-VE'),
                    new Date(d.due_date).toLocaleDateString('es-VE'),
                    daysOverdue > 0 ? `${daysOverdue}` : 'Vigente',
                    formatUSD(d.balance_usd),
                    formatBs(balanceBs)
                ];
            }),
            styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
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
        doc.text("Base Legal: Normas Internacionales de Informacion Financiera (NIC 21) y Normativa Nacional Vigente.", 14, finalY + 9);

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
            return Swal.fire('Vac铆o', 'No hay ventas en este rango', 'info');
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

        doc.text(`Per铆odo Fiscal:`, pageWidth - 14, 12, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(`${new Date(reportDateRange.start).toLocaleDateString()} al ${new Date(reportDateRange.end).toLocaleDateString()}`, pageWidth - 14, 18, { align: 'right' });

        autoTable(doc, {
            startY: 40,
            head: [[
                'FECHA', 'RIF/CI', 'RAZ脫N SOCIAL', 'N掳 FACTURA', 'N掳 CONTROL', 'N掳 N/CR脡DITO', 'M脕Q. FISCAL',
                `TOTAL VENTAS`, `EXENTO`, `BASE IMP.`, `IVA (${tenantConfig.defaultTaxRate * 100}%)`, 'IGTF (3%)'
            ]],
            // 馃毃 CORRECCI脫N DEFINITIVA: Separamos la venta real de su Nota de Cr茅dito (Reversi贸n)
            body: sales.flatMap(s => {
                const rate = parseFloat(s.tasa || 0);
                
                // Calculamos los montos siempre en positivo primero
                const exentoBs = parseFloat(s.subtotal_exempt_usd || 0) * rate;
                const baseBs = parseFloat(s.subtotal_taxable_usd || 0) * rate;
                const ivaBs = parseFloat(s.iva_usd || 0) * rate;
                const igtfBs = parseFloat(s.igtf_ves || (parseFloat(s.igtf_usd || 0) * rate));
                const totalBs = parseFloat(s.total_ves || 0);

                const rows = [];
                
                // FILA 1: Factura Original (SIEMPRE en positivo, refleja que la venta ocurri贸 en el sistema)
                rows.push([
                    new Date(s.created_at).toLocaleDateString('es-VE'),
                    s.id_number || 'GEN脡RICO',
                    (s.full_name || 'Consumidor Final').substring(0, 25),
                    s.invoice_number,
                    s.control_number,
                    '-', // Aqu铆 no va N/C porque es la factura original
                    s.fiscal_machine_serial || '-',
                    formatBs(totalBs),
                    formatBs(exentoBs),
                    formatBs(baseBs),
                    formatBs(ivaBs),
                    formatBs(igtfBs)
                ]);

                // FILA 2: Si fue ANULADA, se inyecta la Nota de Cr茅dito restando los montos
                if (s.status === 'ANULADO') {
                    // Si la m谩quina no dio un N掳 de N/C fiscal, le asignamos uno de control interno para justificar la reversi贸n
                    const ncNumber = s.credit_note_number || `NC-${s.id}`;
                    
                    rows.push([
                        new Date(s.created_at).toLocaleDateString('es-VE'),
                        s.id_number || 'GEN脡RICO',
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
            // Estilo visual: Las Notas de Cr茅dito se pintar谩n de rojo
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

        // Sumatorias finales del mes (Como las anuladas restan lo mismo que sum贸 la factura original, contablemente aportan 0 al total a declarar)
        const totalBase = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.subtotal_taxable_usd || 0) * parseFloat(s.tasa || 0)), 0);
        const totalIva = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.iva_usd || 0) * parseFloat(s.tasa || 0)), 0);
        const totalExento = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.subtotal_exempt_usd || 0) * parseFloat(s.tasa || 0)), 0);
        const totalIgtf = sales.reduce((acc, s) => acc + (s.status === 'ANULADO' ? 0 : parseFloat(s.igtf_ves || (parseFloat(s.igtf_usd || 0) * parseFloat(s.tasa || 0)))), 0);

        let finalY = doc.lastAutoTable.finalY + 10;

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(`RESUMEN DEL PER脥ODO (En ${tenantConfig.primaryCurrency === 'Bs' ? 'Bol铆vares' : tenantConfig.primaryCurrency}):`, 14, finalY);

        autoTable(doc, {
            startY: finalY + 2,
            head: [['CONCEPTO', 'BASE IMPONIBLE', `D脡BITO FISCAL (${tenantConfig.taxName})`]],
            body: [
                ['Ventas Internas No Gravadas (Exentas)', formatBs(totalExento), '0,00'],
                [`Ventas Internas Gravadas (${tenantConfig.defaultTaxRate * 100}%)`, formatBs(totalBase), formatBs(totalIva)],
                ['Percepci贸n IGTF (3%)', '0,00', formatBs(totalIgtf)],
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
        doc.text("Declaraci贸n jurada sin tachaduras ni enmiendas. Expresado en moneda de curso legal seg煤n Providencia 0071.", 14, bottomY);

        doc.setDrawColor(0);
        doc.line(200, bottomY, 300, bottomY); 
        doc.text("Firma del Contribuyente / Rep. Legal", 230, bottomY + 4);

        doc.save(`Libro_Ventas_${reportDateRange.start}_al_${reportDateRange.end}.pdf`);

    } catch (error) {
        console.error('QA Error:', error);
        Swal.fire('Error', 'No se pudo conectar con el servidor para generar el reporte', 'error');
    }
};

// --- FUNCIóN INTELIGENTE PARA EXPORTAR EXCEL NATIVO (MARCA BLANCA / UX PRO / ANCHOS AMPLIOS) ---
export const downloadCSV = (data, fileName, bcvRate) => {
    if (!data || data.length === 0) return Swal.fire('Vacío', 'No hay datos para exportar', 'info');

    const first = data[0];
    const isInventory = first.hasOwnProperty('stock') && first.hasOwnProperty('name');
    const isDailySummary = first.hasOwnProperty('sale_date') && first.hasOwnProperty('total_usd');
    const isKardex = first.hasOwnProperty('new_stock') && first.hasOwnProperty('reason');

    let processedData = [...data];
    let orderedHeaders = [];
    let rowMapper = null;

    const formatExcel = (num, decimals = 2) => {
        const parsed = parseFloat(num);
        return isNaN(parsed) ? '0,00' : parsed.toFixed(decimals).replace('.', ',');
    };

    if (isInventory) {
        processedData = processedData.filter(p => {
            const stock = parseFloat(p.stock) || 0;
            const isServiceFlag = p.is_service === true;
            const categoryText = (p.category || '').toUpperCase();
            const nameText = (p.name || '').toUpperCase();

            if (stock <= 0) return false;
            if (isServiceFlag) return false;
            if (categoryText.includes('SERVICIO')) return false;
            if (nameText.includes('AVANCE DE EFECTIVO')) return false;

            return true;
        });

        if (processedData.length === 0) {
            return Swal.fire('Atención', 'No hay mercancía física con stock para exportar.', 'info');
        }

        processedData.sort((a, b) => {
            const catA = (a.category || '').toUpperCase();
            const catB = (b.category || '').toUpperCase();
            if (catA < catB) return -1;
            if (catA > catB) return 1;
            return (a.name || '').toUpperCase().localeCompare((b.name || '').toUpperCase());
        });

        orderedHeaders = ["CODIGO", "CATEGORIA", "PRODUCTO", "UNIDAD", "CANTIDAD", "COSTO UNIT (Ref)", `COSTO UNIT (${tenantConfig.primaryCurrency})`, "TOTAL (Ref)", `TOTAL (${tenantConfig.primaryCurrency})`];
        
        rowMapper = (row) => {
            let unitMeasure = (row.unit_measure || 'UND').toUpperCase().trim();
            if (unitMeasure === 'KILO' || unitMeasure === 'KILOGRAMO') unitMeasure = 'KG';
            else if (unitMeasure === 'LITRO') unitMeasure = 'LT';
            else if (unitMeasure === 'UNIDAD') unitMeasure = 'UND';

            const stock = parseFloat(row.stock) || 0;
            const priceUsd = parseFloat(row.price_usd) || 0;
            const totalUsd = stock * priceUsd;

            return {
                "CODIGO": row.barcode || `INT-${row.id}`,
                "CATEGORIA": row.category ? row.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'General',
                "PRODUCTO": row.name ? row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '',
                "UNIDAD": unitMeasure,
                "CANTIDAD": formatExcel(stock, 3),
                "COSTO UNIT (Ref)": formatExcel(priceUsd),
                [`COSTO UNIT (${tenantConfig.primaryCurrency})`]: formatExcel(priceUsd * bcvRate),
                "TOTAL (Ref)": formatExcel(totalUsd),
                [`TOTAL (${tenantConfig.primaryCurrency})`]: formatExcel(totalUsd * bcvRate)
            };
        };

    } else if (isDailySummary) {
        orderedHeaders = ["Fecha", "Transacciones", "Total Recaudado (Ref)", `Total Recaudado (${tenantConfig.primaryCurrency})`];
        rowMapper = (row) => ({
            "Fecha": new Date(row.sale_date).toLocaleDateString('es-VE'),
            "Transacciones": row.tx_count,
            "Total Recaudado (Ref)": formatExcel(row.total_usd),
            [`Total Recaudado (${tenantConfig.primaryCurrency})`]: formatExcel(row.total_ves)
        });

    } else if (isKardex) {
        orderedHeaders = ["Fecha", "Hora", "Tipo", "Concepto", "Referencia", "Costo Lote ($)", "Cantidad", "Saldo Final"];
        rowMapper = (row) => ({
            "Fecha": new Date(row.created_at).toLocaleDateString('es-VE'),
            "Hora": new Date(row.created_at).toLocaleTimeString('es-VE'),
            "Tipo": row.type === 'IN' ? 'ENTRADA' : 'SALIDA',
            "Concepto": row.reason ? row.reason.replace(/_/g, ' ') : '-',
            "Referencia": row.document_ref || '-',
            "Costo Lote ($)": row.cost_usd ? formatExcel(row.cost_usd) : '-',
            "Cantidad": formatExcel(row.quantity, 3),
            "Saldo Final": formatExcel(row.new_stock, 3)
        });

    } else {
        orderedHeaders = ["Nro Factura", "Fecha", "Cliente", "Documento", "Items", "Estado", "Pago", "Total Ref", `Total ${tenantConfig.primaryCurrency}`];
        rowMapper = (row) => ({
            "Nro Factura": row.id || row.sale_id,
            "Fecha": new Date(row.created_at).toLocaleString('es-VE'),
            "Cliente": row.full_name || row.client_name || 'Consumidor Final',
            "Documento": row.client_id || row.id_number || 'N/A',
            "Items": row.items_comprados || 'Sin detalle',
            "Estado": row.status,
            "Pago": row.payment_method,
            "Total Ref": formatExcel(row.total_usd),
            [`Total ${tenantConfig.primaryCurrency}`]: formatExcel(row.total_ves)
        });
    }

    // ?? CONSTRUCCIóN DE TABLA HTML NATIVA (Fuerza anchos amplios y evita recortes en Excel)
    let htmlTable = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <style>
                table { border-collapse: collapse; width: 100%; font-family: Calibri, sans-serif; font-size: 11pt; }
                th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; padding: 8px 12px; border: 1px solid #cbd5e1; }
                td { padding: 6px 10px; border: 1px solid #cbd5e1; vertical-align: middle; }
                .text { mso-number-format:"\\@"; }
                .number { mso-number-format:"#,##0.00"; text-align: right; }
                /* Anchos generosos predeterminados para que no salgan cortadas las descripciones o categorías */
                .col-codigo { width: 120px; text-align: center; }
                .col-categoria { width: 180px; }
                .col-producto { width: 320px; }
                .col-unidad { width: 90px; text-align: center; }
                .col-cantidad { width: 110px; text-align: right; }
                .col-monto { width: 140px; text-align: right; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        ${orderedHeaders.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    processedData.forEach(originalRow => {
        const mappedRow = rowMapper(originalRow);
        htmlTable += "<tr>";
        orderedHeaders.forEach((header, idx) => {
            let value = mappedRow[header];
            if (value === null || value === undefined) value = '';
            
            // Asignamos clases de ancho según la columna
            let cssClass = "text";
            if (idx === 0) cssClass += " col-codigo";
            else if (idx === 1) cssClass += " col-categoria";
            else if (idx === 2) cssClass += " col-producto";
            else if (idx === 3) cssClass += " col-unidad";
            else if (idx === 4) cssClass += " col-cantidad";
            else if (idx >= 5) cssClass += " number col-monto";

            htmlTable += `<td class="${cssClass}">${String(value)}</td>`;
        });
        htmlTable += "</tr>";
    });

    htmlTable += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    // Cambiamos la extensión a .xls para que Excel lo abra de forma nativa con los anchos y estilos aplicados
    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// =========================================================================
//  FUNCI脫N GENERADORA DE TICKET (DIN脕MICA: TICKET T脡RMICO O FORMA LIBRE)
// =========================================================================
// 馃毃 [NUEVO PARAMETRO] -> igtfUsd = 0
// 馃毃 [NUEVO PARAMETRO] -> discountUsd = 0
// 馃毃 [NUEVO PARAMETRO] -> userIdentity = null (Punto 4 UX/UI resuelto)
export const generateReceiptHTML = (saleId, customer, items, invoiceType = 'FISCAL', saleStatus = 'PAGADO', createdAt = new Date(), totalSaleUsd = 0, historicalRate = null, paymentMethod = 'NO ESPECIFICADO', bcvRate, igtfUsd = 0, discountUsd = 0, fiscalControlNumber = null, userIdentity = null) => {

    // 馃毃 FASE 1 - PUNTO 4: Inyecci贸n de Marca Blanca
    // Fusionamos la configuraci贸n base (BMS Digital) con los datos fiscales reales de la empresa logueada
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

    // 馃毃 CONSTRUCCI脫N SIMULT脕NEA DE AMBOS FORMATOS
    let itemsTicketHTML = '';
    let itemsFormaLibreHTML = '';

    // 1. ITERACI脫N DE ITEMS (Con cumplimiento estricto Art. 34 Ley IVA)
    itemsToPrint.forEach(item => {
        const priceUsd = parseFloat(item.price_at_moment_usd || item.price_usd || 0);
        const qty = parseFloat(item.quantity);
        const totalItemUsd = priceUsd * qty;
        
        // Validaci贸n estricta de estatus gravable
        const isTaxable = (item.is_taxable === true || item.is_taxable === 'true' || item.is_taxable === 1);
        
        // Asignaci贸n obligatoria del marcador (G) o (E) seg煤n Providencia
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

            // HTML para Ticket T茅rmico
            itemsTicketHTML += `
            <div class="item-row">
                <div class="col-qty">${qty}</div>
                <div class="col-desc">SERV. FINANCIERO (COMISI脫N)${taxMark}</div>
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
                <td style="text-align: left;">SERV. FINANCIERO (COMISI脫N)${taxMark}</td>
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
            
            // 馃毃 UX PRO BLINDAJE: Limpieza nativa de decimales innecesarios (Ej: 10.000 -> 10 | 0.350 -> 0.35)
            // Esto asegura que la vista impresa sea impecable sin afectar la contabilidad.
            const displayQty = parseFloat(qty).toString();

            // HTML para Ticket T茅rmico
            itemsTicketHTML += `
            <div class="item-row">
                <div class="col-qty">${displayQty}</div>
                <div class="col-desc">${cleanName.substring(0, 30)}${taxMark}</div>
                <div class="col-price">${formatBs(subtotalItemBs)}</div>
            </div>`;

            // HTML para Forma Libre (Tabla)
            itemsFormaLibreHTML += `
            <tr>
                <td style="text-align: left;">${cleanName.substring(0, 45)}${taxMark}</td>
                <td style="text-align: center;">${displayQty}</td>
                <td style="text-align: right;">${formatBs(priceUsd * rate)}</td>
                <td style="text-align: right;">${formatBs(subtotalItemBs)}</td>
            </tr>`;
        }
    });

    // 馃毃 [C脕LCULOS FINALES CON DESCUENTO PRORRATEADO E IGTF INYECTADO]
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
            
            // Ajustamos la base en USD para no romper el c谩lculo final visual
            totalUsdGravable = rawTotalUsdGravable - (discountUsd * proportionTaxable);
        }
    }

    // 馃毃 LECTURA DIN脕MICA DE IMPUESTOS Y MONEDAS DESDE EL TENANT
    const ivaRate = configFiscalBrand.defaultTaxRate !== undefined ? configFiscalBrand.defaultTaxRate : brand.defaultTaxRate;
    const igtfRateAmount = configFiscalBrand.igtfRate !== undefined ? configFiscalBrand.igtfRate : brand.igtfRate;
    const taxName = configFiscalBrand.taxName || brand.taxName;
    const primaryCurrency = brand.primaryCurrency || 'Bs';
    const secondaryCurrency = brand.secondaryCurrency || 'Ref';

    const ivaBs = totalBsBase * ivaRate;
    const ivaUsd = totalUsdGravable * ivaRate;
    
    // IGTF convertido a Bol铆vares
    const igtfBs = igtfUsd * rate;

    // Sumatoria Total ajustada con Impuestos
    const totalGeneralBs = totalBsExento + totalBsBase + ivaBs + igtfBs;
    const totalGeneralRef = (totalRefBase - discountUsd) + ivaUsd + igtfUsd;

    const clientName = customer.full_name || 'CONSUMIDOR FINAL';
    const clientId = customer.id_number || 'V-00000000';
    const clientDir = customer.institution || '';

    // =========================================================
    // 馃毃 FASE 5: L脫GICA DE BLINDAJE FISCAL MULTI-MODAL
    // =========================================================
    // Ahora reconocemos Forma Libre y Electr贸nica como facturas legales
    const isFiscal = ['FISCAL', 'FORMA_LIBRE', 'ELECTRONIC', 'ELECTRONIC_BILLING'].includes(invoiceType);
    const isCredit = saleStatus === 'PENDIENTE' || saleStatus === 'PARCIAL';

    let docTitle = 'FACTURA';
    let noFiscalWarning = '';

    if (!isFiscal) {
        docTitle = 'ORDEN DE DESPACHO';
        noFiscalWarning = '<div class="warning-box">DOCUMENTO NO V脕LIDO COMO FACTURA</div>';
    }
    
    if (isCredit && !isFiscal) {
        docTitle = 'CONTROL DE CR脡DITO';
        noFiscalWarning = '<div class="warning-box">DOCUMENTO NO V脕LIDO COMO FACTURA</div>';
    }
    
    if (isVoided) {
        docTitle = 'DOCUMENTO ANULADO';
    }

    const dateStr = new Date(createdAt).toLocaleString('es-VE');

    // =====================================================================
    // 馃毃 RENDERIZADO 1: FORMA LIBRE (Media Carta / Carta)
    // =====================================================================
    // Leemos el modo directamente desde la configuraci贸n de la empresa inyectada
    const isFormaLibreMode = invoiceType === 'FORMA_LIBRE' || configFiscalBrand.invoiceMode === 'FORMA_LIBRE' || brand.invoiceMode === 'FORMA_LIBRE';
        
    if (isFormaLibreMode && isFiscal && !isCredit) {
            
            // 馃洝锔?PUNTO 1: CALCE DIN脕MICO (Configurable por el usuario para esquivar el membrete)
            const marginTopMM = configFiscalBrand.formaLibreMarginTop || brand.formaLibreMarginTop || 45; 
            const marginLeftMM = configFiscalBrand.formaLibreMarginLeft || brand.formaLibreMarginLeft || 10;
            const formSize = configFiscalBrand.printerPaperSize || brand.formaLibrePaperSize || 'half-letter';
            const pageHeight = formSize === 'letter' ? '279mm' : '140mm';

            // 馃洝锔?PUNTO 2: IDENTIFICACI脫N CON SERIE DIN脕MICA BLINDADA
            let docSerie = configFiscalBrand.formaLibreSerie || brand.formaLibreSerie || 'SERIE - A';
            
            // 1. Rescate Seguro As铆ncrono (Lee lo que inyect贸 el Modal temporalmente)
            try {
                const printSerie = localStorage.getItem('bms_print_serie');
                const activeRegister = JSON.parse(localStorage.getItem('bms_active_register'));
                
                if (printSerie) {
                    docSerie = printSerie; // 馃毃 Prioridad 1: Lee la variable del puente as铆ncrono (3 segundos)
                } else if (activeRegister && activeRegister.serie) {
                    docSerie = activeRegister.serie; // Prioridad 2: La caja abierta actualmente
                }
            } catch (e) {
                // Ignorar silenciosamente si no existe
            }

            // 2. Extracci贸n Regex Mejorada y Estricta (Ej: Extrae la "B" de "B00000003")
            if (fiscalControlNumber && typeof fiscalControlNumber === 'string') {
                const match = fiscalControlNumber.match(/^[a-zA-Z]+/);
                if (match && match[0]) {
                    docSerie = match[0].toUpperCase(); 
                }
            }

            // 馃洝锔?BLINDAJE DE FORMATO: Si solo nos dio una letra (Ej: "B"), lo convertimos a "SERIE - B"
            const formattedSerie = docSerie.length === 1 ? `SERIE - ${docSerie.toUpperCase()}` : docSerie;

            // 馃殌 FIX UX APLICADO: Extraemos solo los n煤meros de forma segura
            const cleanFormaLibreNum = String(saleId).replace(/[^0-9]/g, '');

            // 3. Armado Final Inteligente
            let finalInvoiceString = (fiscalControlNumber && fiscalControlNumber.includes('SERIE')) 
                ? fiscalControlNumber // Si ya trae el formato completo desde la base de datos
                : `${formattedSerie} ${cleanFormaLibreNum.padStart(8, '0')}`;
                
                
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
        <div><b>Direcci贸n:</b> ${clientDir || 'S/D'}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <thead>
            <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align: left; padding-bottom: 4px;">Descripci贸n</th>
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
            <p>Seg煤n el Art. 25 Ley del IVA y Art. 51<br/>Reglamento de la Ley del IVA.</p>
            <p style="margin-top: 10px;">
                <b>Tasa B.C.V:</b> ${formatBs(rate)}<br/>
                <b>Base IGTF Bs:</b> ${igtfUsd > 0 ? formatBs(totalGeneralRef * rate) : '0,00'} &nbsp;&nbsp; <b>IGTF ${(igtfRateAmount * 100).toFixed(0)}% Bs:</b> ${formatBs(igtfBs)}
            </p>
            <p><b>Cajero:</b> CAJA PRINCIPAL &nbsp;&nbsp;&nbsp; <b>Total a Pagar $:</b> ${totalGeneralRef.toFixed(2)}</p>
            ${hasAdvanceGlobal ? '<p style="margin-top:5px; font-size:8px;">* AVANCE EFECTIVO: Operaci贸n no sujeta a venta.</p>' : ''}
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
    // 馃毃 RENDERIZADO 2: TICKET T脡RMICO NORMAL (Control Interno / Imp. Fiscal)
    // =====================================================================
    // 馃洝锔?PUNTOS 1, 2, 3 y 4 APLICADOS AQU脥 PARA EL TICKET PEQUE脩O
    const ticketPaperSize = configFiscalBrand.printerPaperSize || brand.printerPaperSize || '80mm';
    const is58mm = ticketPaperSize === '58mm';
    const finalCompanyName = brand.companyName || brand.tradeName || 'EMPRESA NO DEFINIDA';
    const finalCompanyDocument = brand.companyDocument || 'J-00000000-0';
    const finalCompanyAddress = brand.companyAddress || 'Venezuela';
    const finalCompanyPhone = brand.companyPhone || '';
    
    // Extracci贸n segura del mensaje al pie
    const receiptSecondary = configFiscalBrand.receiptSecondaryMessage || brand.receiptSecondaryMessage || 'Recib铆 conforme mercanc铆a y servicios.';
    const receiptFooter = configFiscalBrand.receiptFooterMessage || brand.receiptFooterMessage || '*** GRACIAS POR SU COMPRA ***';

    // 馃殌 FIX UX APLICADO: Extraemos los n煤meros exactos enviados desde el frontend (saleId ahora trae el correlativo)
    const cleanRawNum = String(saleId).replace(/[^0-9]/g, '');
    const ticketNumber = cleanRawNum.padStart(8, '0');

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket ${ticketNumber}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
        
        /* 馃毃 BLINDAJE CSS: DISE脩O UX EN PANTALLA Y CORRECCI脫N DE CORTE EN PAPEL */
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
        
        /* 馃毃 CORRECCI脫N UX PANTALLA: Rect谩ngulo negro con texto blanco */
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
        
        /* 馃毃 REGLAS ESTRICTAS PARA LA IMPRESORA T脡RMICA (PAPEL F脥SICO) */
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
                
                /* 馃毃 EL SECRETO DEL CENTRADO F脥SICO: Empujamos 5mm a la derecha desde adentro */
                padding: 0 1mm 0 5mm !important; 
            }
            
            /* 馃毃 MAGIA UX: Invertimos los colores solo al imprimir para que la t茅rmica no falle */
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
            <div class="client-row"><span class="label">RAZ脫N SOCIAL:</span><span class="val">${clientName}</span></div>
            <div class="client-row"><span class="label">CI/RIF:</span><span class="val nums">${clientId}</span></div>
            ${clientDir ? `<div class="client-row"><span class="label">DIR:</span><span class="val" style="font-size:${is58mm ? '8px' : '8px'}; white-space: normal; text-align: right;">${clientDir.substring(0, 40)}</span></div>` : ''}
            <div class="divider"></div>
            <div class="client-row">
                <span class="label">${isFiscal ? 'FACTURA NRO:' : 'DOCUMENTO NRO:'}</span><span class="val nums bold">${ticketNumber}</span>
            </div>
            <div class="client-row">
                <span class="label">FECHA:</span><span class="val nums">${dateStr}</span>
            </div>
        </div>

        <div class="divider-bold"></div>

        <div class="item-container">
            <div class="item-header">
                <div class="col-qty">CANT</div>
                <div class="col-desc">DESCRIPCI脫N</div>
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
            <div class="bold" style="font-size: ${is58mm ? '9px' : '10px'};">M脡TODO DE PAGO:</div>
            <div style="font-size: ${is58mm ? '10px' : '11px'}; margin-top: 2px;" class="bold">
                ${paymentMethod}
            </div>
        </div>

        ${isCredit ? '<div class="text-center black warning-box">VENTA A CR脡DITO - POR PAGAR</div>' : ''}

        <div class="legal-box">
            ${receiptSecondary}
            ${hasAdvanceGlobal ? '<br/><br/><strong>* AVANCE EFECTIVO:</strong> Declaro recibir a mi satisfacci贸n el monto detallado como "ENTREGA DE EFECTIVO", operaci贸n no sujeta a venta.' : ''}
        </div>

        <div class="text-center" style="font-size:${is58mm ? '9px' : '10px'}; margin-top:10px; font-weight: bold; padding-bottom: 20px;">
            ${receiptFooter}
            <br/><br/>.
        </div>
    </div> <!-- FIN TICKET WRAPPER -->
</body>
</html>
`;
    }

// --- FUNCI脫N REPORTE PDF (UX PREMIUM MARCA BLANCA) ---
export const printClosingReport = (shift, tenantIdentity = null) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // 馃殌 EXTRACCI脫N DIN脕MICA DE MARCA BLANCA (Con Fallbacks de Seguridad)
    const companyName = tenantIdentity?.companyName || tenantIdentity?.tradeName || tenantConfig.companyName || 'EMPRESA';
    const companyDoc = tenantIdentity?.companyDocument || tenantConfig.companyDocument || 'J-00000000-0';
    const companyAddress = tenantIdentity?.companyAddress || tenantConfig.companyAddress || 'Venezuela';

    // --- 馃彚 DATOS FISCALES DIN脕MICOS ---
    const FISCAL_INFO = {
        name: companyName,
        rif: companyDoc,
        address: companyAddress,
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
    // 馃殌 FIX APLICADO: Imprimimos el correlativo interno secuencial si existe, sino caemos al ID global
    doc.text(`TURNO ID: #${shift.correlativo_interno || shift.id}`, pageWidth - 14, 22, { align: 'right' });
    doc.text(`${new Date(shift.opened_at).toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE')}`, pageWidth - 14, 30, { align: 'right' });

    let y = 55; 

    doc.setFontSize(11);
    doc.setTextColor(...colors.textDark);
    doc.setFont('helvetica', 'bold');
    doc.text("1. CONCILIACI脫N DE EFECTIVO (GAVETA)", 14, y);

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
        doc.text(`${prefix}${tenantConfig.primaryCurrency || 'Bs'} ${vesVal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, xValVes, y, { align: 'right' });
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
    doc.text("2. DESGLOSE POR M脡TODO DE PAGO", 14, y);
    doc.setDrawColor(...colors.accent);
    doc.line(14, y + 2, pageWidth - 14, y + 2);
    y += 12;

    doc.setFillColor(...colors.bgRow);
    doc.rect(14, y - 6, pageWidth - 28, 10, 'F');
    doc.setFontSize(9);
    doc.text("M脡TODO", 18, y);
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
        doc.text(`${tenantConfig.primaryCurrency || 'Bs'} ${sysBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 90, y, { align: 'right' });
        doc.setTextColor(...colors.textLight);
        doc.setFontSize(8);
        doc.text(`Ref ${sysRef.toFixed(2)}`, 90, y + 4, { align: 'right' });

        doc.setFontSize(9);
        doc.setTextColor(...colors.textDark);
        doc.text(`${tenantConfig.primaryCurrency || 'Bs'} ${realBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 140, y, { align: 'right' });
        doc.setTextColor(...colors.textLight);
        doc.setFontSize(8);
        doc.text(`Ref ${realRef.toFixed(2)}`, 140, y + 4, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        if (Math.abs(diffBs) < 1) doc.setTextColor(22, 163, 74);
        else doc.setTextColor(220, 38, 38);
        doc.text(`${tenantConfig.primaryCurrency || 'Bs'} ${diffBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });

        if (Math.abs(diffRef) < 0.1) doc.setTextColor(22, 163, 74);
        else doc.setTextColor(220, 38, 38);
        doc.setFontSize(8);
        doc.text(`Ref ${diffRef.toFixed(2)}`, 190, y + 4, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(14, y + 6, pageWidth - 14, y + 6);

        y += 14;
    };

    drawTableRow("Efectivo (Gaveta)", esperadoVes, esperadoUsd, parseFloat(shift.real_cash_ves || 0), parseFloat(shift.real_cash_usd || 0));
    drawTableRow("Pago M贸vil", parseFloat(shift.system_pago_movil || 0), 0, parseFloat(shift.real_pago_movil || 0), 0);
    drawTableRow("Punto de Venta", parseFloat(shift.system_punto || 0), 0, parseFloat(shift.real_punto || 0), 0);
    drawTableRow("Zelle", 0, parseFloat(shift.system_zelle || 0), 0, parseFloat(shift.real_zelle || 0));

    y += 10;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text(FISCAL_INFO.providencia, 14, pageHeight - 15);
    doc.text(`Documento generado por Sistema ${companyName}`, pageWidth - 14, pageHeight - 15, { align: 'right' });

    doc.save(`Cierre_Fiscal_${shift.id}.pdf`);
};


// --- FUNCIóN GENERAR REPORTE PDF (DISE?O MODERNO: MARCA BLANCA FULL PRO) ---
export const exportReportToPDF = (analyticsData, reportDateRange, tenantBrand = null) => {
    if (!analyticsData || !analyticsData.salesOverTime) {
        return Swal.fire('Sin datos', 'No hay información para generar el reporte.', 'warning');
    }

    const doc = new jsPDF();

    // ?? EXTRACCIóN BLINDADA DE DATOS JURíDICOS (MULTI-INQUILINO)
    const brandName = (tenantBrand?.companyName || tenantBrand?.tradeName || tenantConfig?.companyName || 'BMS Digital');
    const safeName = brandName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const safeId = tenantBrand?.companyDocument || tenantBrand?.id_number || tenantConfig?.companyDocument || tenantConfig?.id_number || 'J-00000000-0';
    const safePhone = tenantBrand?.companyPhone || tenantBrand?.phone || tenantConfig?.companyPhone || tenantConfig?.phone || '';
    const safeAddress = (tenantBrand?.companyAddress || tenantBrand?.address || tenantConfig?.companyAddress || tenantConfig?.address || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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

    doc.setFontSize(22);
    doc.setTextColor(...colors.darkText);
    doc.setFont('helvetica', 'bold');
    doc.text("Reporte Gerencial", 14, 25);

    // ?? IMPRESIóN DE DATOS JURíDICOS MULTI-INQUILINO
    let headerY = 31;
    doc.setFontSize(10);
    doc.setTextColor(...colors.darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(safeName, 14, headerY);
    
    doc.setFontSize(9);
    doc.setTextColor(...colors.lightText);
    doc.setFont('helvetica', 'normal');
    headerY += 5;
    doc.text(`RIF: ${safeId}`, 14, headerY);
    
    if (safePhone || safeAddress) {
        headerY += 4;
        const extraInfo = [safePhone ? `Tel: ${safePhone}` : '', safeAddress ? `Dir: ${safeAddress}` : ''].filter(Boolean).join(' | ');
        doc.text(extraInfo.length > 95 ? extraInfo.substring(0, 95) + '...' : extraInfo, 14, headerY);
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    headerY += 6;
    const dateStart = new Date(reportDateRange.start).toLocaleDateString('es-VE');
    const dateEnd = new Date(reportDateRange.end).toLocaleDateString('es-VE');
    doc.text(`Periodo: ${dateStart} al ${dateEnd}`, 14, headerY);

    doc.setFontSize(8);
    doc.setTextColor(...colors.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, 196, 25, { align: 'right' });


    let finalY = headerY + 8;
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
        `Ref ${totalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${tenantConfig.primaryCurrency} ${totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
        `Ref ${ticketPromedioUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${tenantConfig.primaryCurrency} ${ticketPromedioVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
    doc.text("1. Evolucion de Ventas Diarias", 14, finalY);
    finalY += 4;

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['Fecha', 'Ops', 'Recaudado (Ref)', `Recaudado (${tenantConfig.primaryCurrency})`]],
        body: analyticsData.salesOverTime.map(row => [
            new Date(row.sale_date).toLocaleDateString('es-VE'),
            row.tx_count,
            `Ref ${parseFloat(row.total_usd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `${tenantConfig.primaryCurrency} ${parseFloat(row.total_ves).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    // ?? TOP 10
    doc.text("2. Productos Mas Vendidos (Top 10)", 14, finalY);
    finalY += 4;

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['Producto', 'Unidades', 'Ingreso (Ref)']], 
        headStyles: { ...cleanTableStyles.headStyles, fillColor: colors.secondary },
        // ?? CORTE EXACTO EN TOP 10 CON ESCUDO ANTI-UNDEFINED
        body: (analyticsData.topProducts || []).slice(0, 10).map(row => [
            (row.name || 'Desconocido').normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
            `${parseFloat(row.total_qty || 0)}`,
            `Ref ${parseFloat(row.total_revenue || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    doc.text("3. Rendimiento por Categoria", 14, finalY);
    finalY += 4;

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['Categoria', 'Participacion', 'Total (Ref)']],
        body: (analyticsData.salesByCategory || []).map(row => {
            const percentage = totalUSD > 0 ? (parseFloat(row.total_usd || 0) / totalUSD * 100).toFixed(1) : 0;
            return [
                (row.category || 'Sin Categoría').normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
                `${percentage}%`,
                `Ref ${parseFloat(row.total_usd || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        doc.text(`Sistema ${safeName} - Reporte Gerencial`, 14, 290);
        doc.text(`${i} / ${pageCount}`, 196, 290, { align: 'right' });
    }

    doc.save(`Reporte_Gerencial_${reportDateRange.start}.pdf`);
};

// =========================================================================
// ?? 1. REPORTE DE REPOSICION Y STOCK CRITICO (BIMONETARIO / UX PRO / LEGAL)
// =========================================================================
export const printLowStockReportPDF = (allProducts, bcvRate, userIdentity = null) => {
    
    // ?? 1. FILTRADO: Garantizamos precios y excluimos intangibles (Servicios)
    const lowStockProducts = allProducts.filter(p => {
        const stock = parseFloat(p.stock) || 0;
        return stock <= 10 && !p.is_service; 
    });

    if (!lowStockProducts || lowStockProducts.length === 0) {
        return Swal.fire('Inventario Sano', 'No existen articulos en nivel critico de reposicion.', 'info');
    }

    // ?? 2. ORDEN LEGAL VENEZOLANO Y LOGíSTICO: Alfabéticamente por Categoría, luego por Nombre
    lowStockProducts.sort((a, b) => {
        const catA = (a.category || '').toUpperCase();
        const catB = (b.category || '').toUpperCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        
        const nameA = (a.name || '').toUpperCase();
        const nameB = (b.name || '').toUpperCase();
        return nameA.localeCompare(nameB);
    });

    // ?? 3. FASE MARCA BLANCA
    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    const finalCompanyName = brand.companyName || brand.tradeName || tenantConfig.companyName;
    const finalCompanyDocument = brand.companyDocument || tenantConfig.companyDocument;

    const doc = new jsPDF('p', 'mm', 'a4'); // Orientacion Vertical
    const pageWidth = doc.internal.pageSize.width;

    const colors = {
        header: [30, 41, 59],
        accent: [225, 29, 72], // Rose/Red alerta
        bg: [248, 250, 252]
    };

    const formatQty = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0' : num.toString();
    };

    // Header Corporativo (Sin Acentos)
    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("REPORTE DE ARTICULOS CON STOCK BAJO", 14, 11);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text("CONTROL DE QUIEBRE DE INVENTARIO Y REPOSICION", 14, 17);
    
    // Sanitizamos la Razon Social
    const safeName = finalCompanyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`RIF: ${finalCompanyDocument}  |  Razon Social: ${safeName}`, 14, 23);

    const dateStr = new Date().toLocaleString('es-VE');
    doc.setFontSize(8);
    doc.text(`Emision: ${dateStr}`, pageWidth - 14, 11, { align: 'right' });
    doc.text(`Tasa Base BCV: Bs ${formatBs(bcvRate)}`, pageWidth - 14, 17, { align: 'right' });
    doc.text(`Expresado en: Bs y Divisa Referencial (Ref)`, pageWidth - 14, 23, { align: 'right' });

    // Tarjeta de Resumen
    const startY = 38;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, startY, pageWidth - 28, 16, 2, 2, 'S');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL ARTICULOS EN RIESGO", 35, startY + 5, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.accent);
    doc.text(`${lowStockProducts.length}`, 35, startY + 12, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text("ESTADO OPERATIVO", 120, startY + 5, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text("REQUIERE ORDEN DE COMPRA", 120, startY + 12, { align: 'center' });

    // Tabla de Productos Bimonetaria
    autoTable(doc, {
        startY: startY + 22,
        // ?? UX PRO: Intercambiamos Categoría y Descripción para mayor orden visual
        head: [['CODIGO', 'CATEGORIA', 'DESCRIPCION', 'EXISTENCIA', 'COSTO (Bs)', 'COSTO (Ref)', 'TOTAL (Bs)', 'TOTAL (Ref)']],
        body: lowStockProducts.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const priceUsd = parseFloat(p.price_usd) || 0;
            const totalUSD = stock * priceUsd;
            
            const priceBs = priceUsd * bcvRate;
            const totalBs = totalUSD * bcvRate;
            
            // UX PRO: Normalización de la unidad de medida (Kilo -> KG)
            let unitMeasure = (p.unit_measure || 'UND').toUpperCase().trim();
            if (unitMeasure === 'KILO' || unitMeasure === 'KILOGRAMO') unitMeasure = 'KG';
            else if (unitMeasure === 'LITRO') unitMeasure = 'LT';
            else if (unitMeasure === 'UNIDAD') unitMeasure = 'UND';

            const cleanName = p.name ? p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 30) : 'N/A';
            const cleanCat = p.category ? p.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'General';

            return [
                p.barcode || `INT-${p.id}`,
                cleanCat,
                cleanName,
                `${formatQty(stock)} ${unitMeasure}`,
                formatBs(priceBs),
                formatUSD(priceUsd),
                formatBs(totalBs),
                formatUSD(totalUSD)
            ];
        }),
        styles: { fontSize: 7.5, cellPadding: 2 }, 
        headStyles: { fillColor: colors.header, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 25 }, // Asignamos ancho fijo a la Categoría
            2: { cellWidth: 'auto' }, // La Descripción toma el espacio restante
            3: { halign: 'center', fontStyle: 'bold', textColor: colors.accent },
            4: { halign: 'right' }, 
            5: { halign: 'right', textColor: [0, 86, 179] }, 
            6: { halign: 'right', fontStyle: 'bold' }, 
            7: { halign: 'right', fontStyle: 'bold', textColor: [0, 86, 179] }
        },
        alternateRowStyles: { fillColor: colors.bg }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Reporte generado para planificacion de compras segun existencias minimas de seguridad.", 14, finalY);
    doc.text("Base Legal: Providencia Administrativa 0071 (SUNDDE) y control interno de valorizacion bimonetaria.", 14, finalY + 4);

    doc.save(`Stock_Critico_Reposicion_${new Date().toISOString().split('T')[0]}.pdf`);
};


// =========================================================================
// ?? 2. REPORTE DE CONTROL SANITARIO Y VENCIMIENTO DE LOTES (SACS / FEFO / UX PRO)
// =========================================================================
export const printBatchExpirationReportPDF = (products, bcvRate, userIdentity = null) => {
    const batchRows = [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    products.forEach(prod => {
        if (prod.is_perishable && parseFloat(prod.stock) > 0 && prod.expiration_date) {
            const [year, month, day] = prod.expiration_date.split('-');
            const expDate = new Date(year, month - 1, day);
            
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let status = 'VIGENTE';
            if (diffDays < 0) status = 'VENCIDO';
            else if (diffDays <= 30) status = 'CRITICO';
            else if (diffDays <= 60) status = 'PRECAUCION';

            // ?? UX PRO: Normalización de unidad (Kilo -> KG)
            let unitMeasure = (prod.unit_measure || 'UND').toUpperCase().trim();
            if (unitMeasure === 'KILO' || unitMeasure === 'KILOGRAMO') unitMeasure = 'KG';
            else if (unitMeasure === 'LITRO') unitMeasure = 'LT';
            else if (unitMeasure === 'UNIDAD') unitMeasure = 'UND';

            batchRows.push({
                id: prod.id,
                name: prod.name,
                category: prod.category || 'General',
                unit: unitMeasure,
                barcode: prod.barcode || `INT-${prod.id}`,
                expiration_date: expDate.toLocaleDateString('es-VE'),
                days_left: diffDays < 0 ? 0 : diffDays,
                stock: parseFloat(prod.stock) || 0,
                cost_usd: parseFloat(prod.price_usd) || 0,
                status
            });
        }
    });

    if (batchRows.length === 0) {
        return Swal.fire('Inventario Sano', 'No hay productos perecederos con riesgo de vencimiento o no tienen fecha asignada.', 'info');
    }

    // ?? ORDEN LEGAL Y SANITARIO (PRINCIPIO MIXTO): Categoría -> Días Restantes (FEFO) -> Nombre
    batchRows.sort((a, b) => {
        // 1. Agrupamos por Categoría (A -> Z)
        const catA = (a.category || '').toUpperCase();
        const catB = (b.category || '').toUpperCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        
        // 2. Si son de la misma categoría, el más crítico (FEFO) va primero
        if (a.days_left !== b.days_left) {
            return a.days_left - b.days_left;
        }

        // 3. Si empatan en categoría y fecha, ordenamos por Nombre (A -> Z)
        const nameA = (a.name || '').toUpperCase();
        const nameB = (b.name || '').toUpperCase();
        return nameA.localeCompare(nameB);
    });

    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    const finalCompanyName = brand.companyName || brand.tradeName || tenantConfig.companyName;
    const finalCompanyDocument = brand.companyDocument || tenantConfig.companyDocument;

    const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal
    const pageWidth = doc.internal.pageSize.width;

    const colors = {
        header: [15, 23, 42],
        accent: [217, 119, 6],
        bg: [248, 250, 252]
    };

    const formatQty = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0' : num.toString();
    };

    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("CONTROL SANITARIO DE VENCIMIENTOS (SACS / FEFO)", 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("TRAZABILIDAD DE PRODUCTOS PERECEDEROS Y DISPOSICION SANITARIA", 14, 18);
    
    // Sanitizar Razón Social
    const safeName = finalCompanyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`RIF: ${finalCompanyDocument}  |  Razon Social: ${safeName}`, 14, 25);

    const dateStr = new Date().toLocaleString('es-VE');
    doc.text(`Fecha de Auditoria: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Tasa Oficial BCV: Bs ${formatBs(bcvRate)}`, pageWidth - 14, 18, { align: 'right' });
    doc.text(`Expresado en: Bs y Divisa Referencial (Ref)`, pageWidth - 14, 25, { align: 'right' });

    // Tabla Detallada SACS Bimonetaria con la nueva estructura de columnas
    autoTable(doc, {
        startY: 42,
        head: [['CODIGO', 'CATEGORIA', 'DESCRIPCION', 'VENCE', 'ESTATUS SANITARIO', 'CANTIDAD', 'VALOR (Bs)', 'VALOR (Ref)']],
        body: batchRows.map(r => {
            const valUSD = r.stock * r.cost_usd;
            const valVES = valUSD * bcvRate;
            
            // Sanitizamos textos
            const cleanName = r.name ? r.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 35) : 'N/A';
            const cleanCat = r.category ? r.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'General';
            
            // UX PRO: Agrupamos Estatus y Días en una sola columna para ganar espacio y limpieza
            let statusText = r.status === 'VENCIDO' ? 'VENCIDO' : `${r.status} (${r.days_left} dias)`;

            return [
                r.barcode,
                cleanCat,
                cleanName,
                r.expiration_date,
                statusText,
                `${formatQty(r.stock)} ${r.unit}`,
                formatBs(valVES),
                formatUSD(valUSD)
            ];
        }),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: colors.header, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 30 }, // Ancho estricto para Categoría
            2: { cellWidth: 'auto' }, // Descripción toma el resto
            3: { halign: 'center', fontStyle: 'bold' }, 
            4: { halign: 'center', fontStyle: 'bold' }, 
            5: { halign: 'right', fontStyle: 'bold' }, 
            6: { halign: 'right' }, 
            7: { halign: 'right', fontStyle: 'bold', textColor: [0, 86, 179] } 
        },
        didParseCell: function(data) {
            // Semáforo visual en la nueva columna de Estatus (Index 4)
            if (data.column.index === 4 && data.section === 'body') {
                const val = data.cell.raw;
                if (val.includes('VENCIDO')) data.cell.styles.textColor = [225, 29, 72];
                else if (val.includes('CRITICO')) data.cell.styles.textColor = [217, 119, 6];
                else if (val.includes('PRECAUCION')) data.cell.styles.textColor = [202, 138, 4];
                else data.cell.styles.textColor = [16, 185, 129];
            }
        },
        alternateRowStyles: { fillColor: colors.bg }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Base Legal: Normas de Buenas Practicas de Almacenamiento y Distribucion (SACS) y Providencia Administrativa 0071.", 14, finalY);
    
    // ?? Agregamos la justificación del ordenamiento en el footer
    doc.text("Principio Mixto aplicado: Agrupacion por rubro (Legal) y ordenamiento por fecha critica FEFO (Sanitario).", 14, finalY + 4);

    doc.setDrawColor(203, 213, 225);
    doc.line(210, finalY + 15, 280, finalY + 15);
    doc.text("Responsable Sanitario / Almacen", 220, finalY + 19);

    doc.save(`Auditoria_Lotes_SACS_${new Date().toISOString().split('T')[0]}.pdf`);
};

// =========================================================================
// ?? 3. REPORTE DE CONCILIACIóN Y DESVIACIONES DE INVENTARIO (AUDITORíA / UX PRO)
// =========================================================================
export const printInventoryReconciliationPDF = (countedData, allProducts, bcvRate, userIdentity = null) => {
    
    // 1. FILTRADO Y CRUCE MATEMáTICO (Teórico vs Físico)
    let reconciliationRows = [];

    // Tomamos los datos contados o el inventario general si no hay conteo previo ingresado
    const baseData = countedData && countedData.length > 0 ? countedData : allProducts;

    baseData.forEach(item => {
        if (item.is_service) return; // Excluimos intangibles

        const masterItem = allProducts.find(p => p.id === item.id) || item;
        const stockTeorico = parseFloat(masterItem.stock) || 0;
        
        // Si el ítem viene de un conteo físico interactivo, usará item.physical_stock, de lo contrario asumimos el teórico para análisis
        const stockFisico = item.physical_stock !== undefined ? parseFloat(item.physical_stock) : stockTeorico;
        const diferencia = stockFisico - stockTeorico;

        let statusDesviacion = 'CONFORME';
        if (diferencia < 0) statusDesviacion = 'FALTANTE (MERMA)';
        else if (diferencia > 0) statusDesviacion = 'SOBRANTE';

        const priceRef = parseFloat(masterItem.price_usd) || 0;
        const costoTotalRef = Math.abs(diferencia) * priceRef;
        const costoTotalBs = costoTotalRef * bcvRate;

        let unitMeasure = (masterItem.unit_measure || 'UND').toUpperCase().trim();
        if (unitMeasure === 'KILO' || unitMeasure === 'KILOGRAMO') unitMeasure = 'KG';
        else if (unitMeasure === 'LITRO') unitMeasure = 'LT';
        else if (unitMeasure === 'UNIDAD') unitMeasure = 'UND';

        reconciliationRows.push({
            barcode: masterItem.barcode || `INT-${masterItem.id}`,
            category: masterItem.category || 'General',
            name: masterItem.name || 'Sin nombre',
            unit: unitMeasure,
            teorico: stockTeorico,
            fisico: stockFisico,
            diferencia: diferencia,
            status: statusDesviacion,
            costoRef: priceRef,
            impactoRef: costoTotalRef,
            impactoBs: costoTotalBs
        });
    });

    if (reconciliationRows.length === 0) {
        return Swal.fire('Sin Datos', 'No hay registros válidos para realizar la conciliación.', 'info');
    }

    // 2. ORDEN LEGAL VENEZOLANO: Categoría -> Nombre
    reconciliationRows.sort((a, b) => {
        const catA = (a.category || '').toUpperCase();
        const catB = (b.category || '').toUpperCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        return (a.name || '').toUpperCase().localeCompare((b.name || '').toUpperCase());
    });

    // 3. FASE MARCA BLANCA
    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    const finalCompanyName = brand.companyName || brand.tradeName || tenantConfig.companyName;
    const finalCompanyDocument = brand.companyDocument || tenantConfig.companyDocument;

    const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal para máxima visibilidad gerencial
    const pageWidth = doc.internal.pageSize.width;

    const colors = {
        header: [30, 41, 59],
        accent: [225, 29, 72],
        green: [22, 163, 74],
        bg: [248, 250, 252]
    };

    const formatQty = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0' : num.toString();
    };

    // Encabezado Corporativo
    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("REPORTE DE CONCILIACION Y DESVIACIONES DE INVENTARIO", 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("AUDITORIA FINANCIERA Y CONTROL DE MERMAS (TEORICO VS FISICO)", 14, 18);
    
    const safeName = finalCompanyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`RIF: ${finalCompanyDocument}  |  Razon Social: ${safeName}`, 14, 25);

    const dateStr = new Date().toLocaleString('es-VE');
    doc.text(`Fecha de Conciliacion: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Tasa BCV: Bs ${formatBs(bcvRate)}`, pageWidth - 14, 18, { align: 'right' });
    doc.text(`Expresado en: Bs y Divisa Referencial (Ref)`, pageWidth - 14, 25, { align: 'right' });

    // 4. TABLA DE CONCILIACIóN
    autoTable(doc, {
        startY: 42,
        head: [['CODIGO', 'CATEGORIA', 'DESCRIPCION', 'TEORICO', 'FISICO', 'DIFERENCIA', 'ESTATUS', 'IMPACTO (Bs)', 'IMPACTO (Ref)']],
        body: reconciliationRows.map(r => {
            const cleanName = r.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 30);
            const cleanCat = r.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            return [
                r.barcode,
                cleanCat,
                cleanName,
                `${formatQty(r.teorico)} ${r.unit}`,
                `${formatQty(r.fisico)} ${r.unit}`,
                `${r.diferencia > 0 ? '+' : ''}${formatQty(r.diferencia)} ${r.unit}`,
                r.status,
                formatBs(r.impactoBs),
                formatUSD(r.impactoRef)
            ];
        }),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: colors.header, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 32 },
            2: { cellWidth: 'auto' },
            3: { halign: 'center' },
            4: { halign: 'center', fontStyle: 'bold' },
            5: { halign: 'center', fontStyle: 'bold' },
            6: { halign: 'center', fontStyle: 'bold' },
            7: { halign: 'right', fontStyle: 'bold' },
            8: { halign: 'right', fontStyle: 'bold', textColor: [0, 86, 179] }
        },
        didParseCell: function(data) {
            // Pintar la columna de Estatus (Index 6) según el resultado del cruce
            if (data.column.index === 6 && data.section === 'body') {
                const val = data.cell.raw;
                if (val.includes('FALTANTE')) data.cell.styles.textColor = colors.accent;
                else if (val.includes('SOBRANTE')) data.cell.styles.textColor = [202, 138, 4];
                else data.cell.styles.textColor = colors.green;
            }
        },
        alternateRowStyles: { fillColor: colors.bg }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Base Legal: Art. 177 Reglamento de la Ley de ISLR (Control de Inventarios Permanentes) y Normas de Auditoria Interna.", 14, finalY);
    doc.text("Nota Gerencial: Las diferencias detectadas deben ser justificadas contablemente para la emision de asientos de ajuste.", 14, finalY + 4);

    doc.setDrawColor(203, 213, 225);
    doc.line(190, finalY + 15, 275, finalY + 15);
    doc.text("Comite de Auditoria / Administracion", 210, finalY + 19);

    doc.save(`Conciliacion_Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- NUEVO: REIMPRIMIR ACTA HISTóRICA DE AUDITORíA ---
export const printHistoricalAuditPDF = (auditData, userIdentity = null) => {
    const { header, details } = auditData;
    const brand = userIdentity ? { ...tenantConfig, ...userIdentity } : tenantConfig;
    
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const colors = { header: [30, 41, 59], accent: [225, 29, 72], green: [22, 163, 74], bg: [248, 250, 252] };

    doc.setFillColor(...colors.header);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    
    // ?? FIX UX: Textos sin tildes para evitar corrupción en jsPDF
    doc.text("COPIA FIEL: ACTA DE AUDITORIA DE INVENTARIO", 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    // ?? FIX UX: "CóDIGO" a "CODIGO"
    doc.text(`CODIGO DE ACTA: ${header.audit_code} | RESPONSABLE: ${header.auditor_name.toUpperCase()}`, 14, 18);
    
    const safeName = (brand.companyName || 'Empresa').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`RIF: ${brand.companyDocument}  |  Razon Social: ${safeName}`, 14, 25);

    doc.text(`Fecha del Acta: ${new Date(header.created_at).toLocaleString('es-VE')}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Tasa BCV Aplicada: Bs ${formatBs(header.bcv_rate_snapshot)}`, pageWidth - 14, 18, { align: 'right' });

    autoTable(doc, {
        startY: 42,
        head: [['CODIGO', 'CATEGORIA', 'DESCRIPCION', 'TEORICO', 'FISICO', 'DIFERENCIA', 'ESTATUS', 'IMPACTO (Bs)', 'IMPACTO (Ref)']],
        body: details.map(d => {
            const diff = parseFloat(d.difference);
            const status = diff < 0 ? 'FALTANTE (MERMA)' : (diff > 0 ? 'SOBRANTE' : 'CONFORME');
            const impactRef = Math.abs(diff) * parseFloat(d.unit_cost_usd);
            const impactBs = impactRef * parseFloat(header.bcv_rate_snapshot);
            let unit = (d.unit_measure || 'UND').toUpperCase().trim();
            if (unit === 'KILO' || unit === 'KILOGRAMO') unit = 'KG';
            else if (unit === 'LITRO') unit = 'LT';

            // ?? FIX UX: Limpiamos los nombres que vienen de la base de datos por si traen acentos
            const cleanName = d.name ? d.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 30) : 'N/A';
            const cleanCat = d.category ? d.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'General';

            return [
                d.barcode || 'S/C', cleanCat, cleanName,
                `${parseFloat(d.theoretical_stock)} ${unit}`,
                `${parseFloat(d.physical_stock)} ${unit}`,
                `${diff > 0 ? '+' : ''}${diff} ${unit}`,
                status, formatBs(impactBs), formatUSD(impactRef)
            ];
        }),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: colors.header, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            3: { halign: 'center' }, 4: { halign: 'center', fontStyle: 'bold' },
            5: { halign: 'center', fontStyle: 'bold' }, 6: { halign: 'center', fontStyle: 'bold' },
            7: { halign: 'right', fontStyle: 'bold' }, 8: { halign: 'right', fontStyle: 'bold', textColor: [0, 86, 179] }
        },
        didParseCell: function(data) {
            if (data.column.index === 6 && data.section === 'body') {
                const val = data.cell.raw;
                if (val.includes('FALTANTE')) data.cell.styles.textColor = colors.accent;
                else if (val.includes('SOBRANTE')) data.cell.styles.textColor = [202, 138, 4];
                else data.cell.styles.textColor = colors.green;
            }
        },
        alternateRowStyles: { fillColor: colors.bg }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setTextColor(100);
    // ?? FIX UX: "auditoría" a "auditoria"
    doc.text("Este documento es una copia fiel de la auditoria ejecutada y almacenada en la base de datos inmutable.", 14, finalY);
    doc.text("Base Legal: Art. 177 Reglamento de la Ley de ISLR.", 14, finalY + 4);

    doc.save(`Copia_Acta_${header.audit_code}.pdf`);
};

// --- NUEVO: GUíA DE TRASLADO LEGAL (LOGíSTICA Y DELIVERY) - VERSIóN ENTERPRISE ---
export const printDeliveryGuidePDF = (deliveryData, saleData, tenantConfig, driverData) => {
    const doc = new jsPDF('p', 'mm', 'a5'); // Formato A5
    const pageWidth = doc.internal.pageSize.width;
    
    const colors = { primary: [30, 41, 59], accent: [79, 70, 229], text: [71, 85, 105], bgLight: [248, 250, 252], alert: [220, 38, 38], success: [22, 163, 74] };

    // ?? DETERMINAR ESTATUS LOGíSTICO
    const logisticStatus = deliveryData.status || saleData.delivery_info?.status || 'PENDIENTE';

    // 1. CABECERA
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("GUIA DE TRASLADO DE MERCANCIA", pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text("DOCUMENTO LOGISTICO SIN VALIDEZ FISCAL PARA RESPALDO DE INVENTARIO", pageWidth / 2, 17, { align: 'center' });
    
    const safeDocId = saleData.fiscal_invoice_number || saleData.correlativo_interno || saleData.sale_id || saleData.id || 'S/N';
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth / 2 - 20, 20, 40, 6, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...colors.primary);
    doc.setFont('helvetica', 'bold');
    doc.text(`TICKET #${safeDocId}`, pageWidth / 2, 24, { align: 'center' });

    // 2. EMISOR
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("ORIGEN (EMISOR)", 10, 36);
    doc.setFont('helvetica', 'normal');
    const safeName = (tenantConfig.companyName || 'Empresa').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`Razon Social: ${safeName}`, 10, 41);
    doc.text(`RIF: ${tenantConfig.companyDocument || 'J-00000000-0'}`, 10, 45);
    doc.text(`Doc. Asociado: Venta #${safeDocId}`, 10, 49);

    // 3. RECEPTOR (CLIENTE)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("DESTINO (RECEPTOR)", 75, 36);
    doc.setFont('helvetica', 'normal');
    
    const safeClientName = saleData.customer_name || saleData.client_name || 'Consumidor Final';
    const safeClientId = saleData.id_number || saleData.client_id || 'N/A';
    const safeClientPhone = saleData.customer_phone || saleData.phone || deliveryData.phone || deliveryData.client_phone || 'N/A';
    
    doc.text(`Cliente: ${safeClientName.substring(0, 35)}`, 75, 41);
    doc.text(`CI/RIF: ${safeClientId}`, 75, 45);
    doc.text(`Telefono: ${safeClientPhone}`, 75, 49);

    // 4. DIRECCIóN
    doc.setFillColor(...colors.bgLight);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(10, 54, pageWidth - 20, 14, 2, 2, 'FD'); 
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text("DIRECCION DE ENTREGA:", 13, 59);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const safeAddress = deliveryData.address || deliveryData.shipping_address || 'Retiro en Tienda / Dirección no especificada';
    doc.text(doc.splitTextToSize(safeAddress, pageWidth - 26), 13, 64);

    // 5. MOTORIZADO
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 10, 10);
    doc.text("DATOS DEL MOTORIZADO / TRANSPORTISTA", 10, 75);
    doc.setFont('helvetica', 'normal');
    doc.text(`Conductor: ${driverData.name || 'N/A'}`, 10, 80);
    doc.text(`Cedula / RIF: ${driverData.id_number || 'N/A'}`, 75, 80);
    doc.text(`Info Vehiculo: ${driverData.vehicle_info || 'N/A'}`, 10, 84);

    // 6. TABLA UX PRO
    const rawItems = saleData.items_comprados ? saleData.items_comprados.split(', ') : [];
    
    const tableBody = rawItems.map(item => {
        const cleanItem = item.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = cleanItem.match(/(.*)\s+\(([\d\.]+)\s*(?:UND|KG|LT)?\)$/i) || cleanItem.match(/(.*)\s+\(([\d\.]+)\)$/);
        
        if (match) {
            const desc = match[1].trim();
            const qty = match[2].trim();
            return [`${qty} UND`, desc];
        }
        return ["-", cleanItem]; 
    });

    autoTable(doc, {
        startY: 89,
        head: [['CANT.', 'DESCRIPCION DE LA MERCANCIA']],
        body: tableBody.length > 0 ? tableBody : [['-', 'Articulos vinculados al Ticket #' + safeDocId]],
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: colors.primary, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }, 
            1: { halign: 'left' } 
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        tableLineColor: 226, tableLineWidth: 0.1,
    });

    let finalY = doc.lastAutoTable.finalY + 8;

    // 7. ALERTA COBRO
    const isPending = saleData.sale_status === 'PENDIENTE' || saleData.status === 'PENDIENTE';
    const totalToCollect = parseFloat(saleData.total_usd) || 0;

    if (isPending) {
        doc.setFillColor(254, 242, 242); doc.setDrawColor(...colors.alert);
        doc.roundedRect(10, finalY, pageWidth - 20, 16, 2, 2, 'FD');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...colors.alert);
        doc.text("ATENCION: COBRO CONTRA ENTREGA (C.O.D)", 14, finalY + 6);
        doc.setFontSize(12); doc.text(`Monto a Recaudar: Ref ${totalToCollect.toFixed(2)}`, 14, finalY + 12);
        finalY += 20;
    } else {
        doc.setFillColor(240, 253, 244); doc.setDrawColor(...colors.success);
        doc.roundedRect(10, finalY, pageWidth - 20, 12, 2, 2, 'FD');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...colors.success);
        doc.text("PEDIDO PRE-PAGADO (No cobrar al cliente)", pageWidth / 2, finalY + 7, { align: 'center' });
        finalY += 16;
    }

    // ?? 8. ETIQUETA UX PRO PARA DEVOLUCIONES / CANCELACIONES (Elegante y no invasiva)
    if (logisticStatus === 'DEVUELTO' || logisticStatus === 'CANCELADO') {
        const isCancel = logisticStatus === 'CANCELADO';
        
        // Colores limpios: Fondo suave, borde sólido
        doc.setFillColor(isCancel ? 254 : 255, isCancel ? 226 : 251, isCancel ? 226 : 235); // bg-rose-100 / bg-amber-100
        doc.setDrawColor(isCancel ? 220 : 217, isCancel ? 38 : 119, isCancel ? 38 : 6); // border-rose-600 / border-amber-600
        doc.setLineWidth(0.5);
        doc.roundedRect(10, finalY, pageWidth - 20, 10, 2, 2, 'FD');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isCancel ? 220 : 217, isCancel ? 38 : 119, isCancel ? 38 : 6);
        doc.text(`ARCHIVADO: TICKET ${logisticStatus}`, pageWidth / 2, finalY + 6.5, { align: 'center' });
        
        finalY += 14;
    }

    // 9. FIRMAS
    doc.setDrawColor(200, 200, 200);
    doc.line(20, finalY + 10, 65, finalY + 10); doc.line(pageWidth - 65, finalY + 10, pageWidth - 20, finalY + 10);
    doc.setFontSize(7); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
    doc.text("Despachado por (Firma/Sello)", 42.5, finalY + 14, { align: 'center' });
    doc.text("Recibido Conforme (Firma Cliente)", pageWidth - 42.5, finalY + 14, { align: 'center' });
    doc.setFontSize(6); doc.setTextColor(150);
    doc.text(`Generado el: ${new Date().toLocaleString('es-VE')} | Sistema BMS Digital`, pageWidth / 2, doc.internal.pageSize.height - 8, { align: 'center' });

    doc.save(`Guia_Traslado_Ticket_${safeDocId}.pdf`);
};

// --- NUEVO: MANIFIESTO DIARIO DE DESPACHOS (CUADRE LOGíSTICO) - UX PRO ---
export const printDailyManifestPDF = (deliveries, tenantConfig) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    // Paleta Corporativa BMS Digital
    const colors = { primary: [30, 41, 59], accent: [79, 70, 229], bgLight: [248, 250, 252], alert: [220, 38, 38], success: [22, 163, 74], border: [200, 200, 200] };

    // 1. CABECERA GERENCIAL
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("MANIFIESTO DIARIO DE DESPACHOS", pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    // ?? Ajuste de Copy: Terminología administrativa
    doc.text("CONTROL INTERNO DE RUTAS Y RECAUDACION (SOPORTE ADMINISTRATIVO)", pageWidth / 2, 20, { align: 'center' });

    // 2. DATOS DE EMISIóN Y EMPRESA
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const safeName = (tenantConfig.companyName || 'Empresa').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`Razon Social: ${safeName}`, 14, 40);
    doc.text(`RIF: ${tenantConfig.companyDocument || 'J-00000000-0'}`, 14, 45);

    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Emision: ${new Date().toLocaleString('es-VE')}`, pageWidth - 14, 40, { align: 'right' });
    doc.text(`Total Ordenes Activas: ${deliveries.length}`, pageWidth - 14, 45, { align: 'right' });

    // 3. PROCESAMIENTO DE DATOS (Agrupación y Cálculos)
    let totalExpectedCash = 0;

    const sortedDeliveries = [...deliveries].sort((a, b) => {
        const driverA = a.delivery_info?.driver_name || 'Z_Sin Asignar';
        const driverB = b.delivery_info?.driver_name || 'Z_Sin Asignar';
        return driverA.localeCompare(driverB);
    });

    const tableBody = sortedDeliveries.map(order => {
        const deliveryInfo = order.delivery_info || {};
        const isPendingPayment = order.sale_status === 'PENDIENTE' || order.status === 'PENDIENTE';
        const amount = parseFloat(order.total_usd) || 0;

        if (isPendingPayment) totalExpectedCash += amount;

        const driver = deliveryInfo.driver_name || 'POR ASIGNAR';
        const client = (order.customer_name || 'Consumidor Final').substring(0, 32);
        const status = (deliveryInfo.status || 'PENDIENTE').replace('_', ' ');
        
        // ?? FIX UX: Ahora muestra el monto incluso si ya está pagado para control del administrador
        const paymentAction = isPendingPayment 
            ? `COBRAR: Ref ${amount.toFixed(2)}` 
            : `PRE-PAGADO (Ref ${amount.toFixed(2)})`;

        return [
            `#${order.sale_id}`,
            driver,
            client,
            status,
            paymentAction
        ];
    });

    // 4. TABLA DE RUTAS
    autoTable(doc, {
        startY: 55,
        head: [['TICKET', 'MOTORIZADO', 'CLIENTE DESTINO', 'ESTATUS', 'CONDICION DE COBRO']],
        body: tableBody.length > 0 ? tableBody : [['-', '-', 'No hay despachos activos', '-', '-']],
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: colors.primary, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
            1: { cellWidth: 40 },
            2: { cellWidth: 50 },
            3: { cellWidth: 25 },
            4: { fontStyle: 'bold', halign: 'right' } // Contabilidad: Montos siempre alineados a la derecha
        },
        didParseCell: function(data) {
            if (data.column.index === 4 && data.section === 'body') {
                const val = data.cell.raw;
                if (val.includes('COBRAR')) data.cell.styles.textColor = colors.alert;
                else if (val.includes('PRE-PAGADO')) data.cell.styles.textColor = colors.success;
            }
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        tableLineColor: 226, tableLineWidth: 0.1,
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    // 5. RESUMEN DE RECAUDACIóN (C.O.D) - UX PRO
    doc.setFillColor(...colors.bgLight);
    doc.setDrawColor(...colors.border);
    doc.roundedRect(14, finalY, 100, 24, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(10, 10, 10);
    doc.setFont('helvetica', 'bold');
    doc.text("TOTAL EFECTIVO A RECAUDAR EN RUTA:", 18, finalY + 8);

    doc.setFontSize(14);
    doc.setTextColor(...colors.alert);
    doc.text(`Ref ${totalExpectedCash.toFixed(2)}`, 18, finalY + 16);

    // ?? BLINDAJE LEGAL: Aclaratoria de conversión BCV
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text("* Monto base. Sujeto a conversion segun Tasa BCV oficial del dia.", 18, finalY + 21);

    // 6. FIRMAS DE CIERRE Y AUDITORíA
    finalY += 50;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, finalY, 80, finalY);
    doc.line(pageWidth - 80, finalY, pageWidth - 20, finalY);

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'bold');
    doc.text("FIRMA DEL DESPACHADOR", 50, finalY + 5, { align: 'center' });
    doc.text("FIRMA GERENTE / AUDITORIA", pageWidth - 50, finalY + 5, { align: 'center' });

    // Nota al pie
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text("Soporte Administrativo Interno. Los montos recaudados en ruta deben declararse en el Cierre Fiscal (Reporte Z).", pageWidth / 2, finalY + 15, { align: 'center' });

    doc.save(`Manifiesto_Despachos_${new Date().getTime()}.pdf`);
};

// ============================================================================
// ?? NUEVO: REPORTE GERENCIAL DE LOGíSTICA Y DESPACHOS (PROVIDENCIA 0071)
// ============================================================================
export const printDeliveryManagerReportPDF = (dateRange, historyData, bcvRate, tenantConfig) => {
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const pageWidth = doc.internal.pageSize.width;
    
    // ?? PALETA DE COLORES NATIVA
    const colors = { 
        primary: [30, 41, 59],     
        accent: [0, 86, 179],      
        text: [71, 85, 105],       
        bgLight: [248, 250, 252],  
        success: [16, 185, 129],   
        alert: [245, 158, 11],     
        danger: [239, 68, 68]      
    };

    const filteredData = historyData.filter(order => {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        return orderDate >= dateRange.start && orderDate <= dateRange.end;
    });

    if (filteredData.length === 0) {
        throw new Error("EMPTY_DATA");
    }

    // 2. CABECERA DEL REPORTE
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("REPORTE GERENCIAL DE LOGISTICA Y DESPACHOS", 14, 16);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const safeName = (tenantConfig.companyName || 'Empresa').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`${safeName} | RIF: ${tenantConfig.companyDocument || 'J-00000000-0'}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`PERIODO AUDITADO`, pageWidth - 14, 16, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Desde: ${dateRange.start}  |  Hasta: ${dateRange.end}`, pageWidth - 14, 22, { align: 'right' });

    // 3. PROCESAMIENTO MATEMáTICO (Desglose de Ingresos y Liquidación)
    let totalEntregados = 0, totalDevueltos = 0, totalCancelados = 0;
    let sumaTotalUSD = 0, sumaTotalVES = 0;
    let sumaDeliveryUSD = 0;   
    let sumaMercanciaUSD = 0;  

    // ?? UX PRO: Objeto agrupador para la liquidación de motorizados
    const driverStats = {};

    const tableBody = filteredData.map(order => {
        const dateObj = new Date(order.created_at);
        const timeString = dateObj.toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', hour12: true}).replace(/\./g, '').toUpperCase();
        const fechaHora = `${dateObj.toLocaleDateString('es-VE')} ${timeString}`;
        
        const safeSaleId = order.sale_id || order.id || 'S/N';
        
        // ??? UX PRO: Estandarización de nomenclaturas pendientes
        let status = order.delivery_info?.status || 'ENTREGADO';
        if (status === 'PREPARANDO' || status === 'EN RUTA') {
            status = 'PENDIENTE';
        }

        const driverName = order.delivery_info?.driver_name || 'Desconocido';
        const customerName = (order.customer_name || order.full_name || 'Consumidor Final').substring(0, 25);
        const address = (order.delivery_info?.address || 'Sin especificar').substring(0, 35);
        
        const totalUSD = parseFloat(order.total_usd || 0);
        const totalVES = parseFloat(order.total_ves || 0);

        // Revenue Split
        const deliveryFee = parseFloat(order.delivery_fee || order.delivery_info?.fee || order.delivery_info?.tarifa || 0);
        const mercanciaUSD = totalUSD - deliveryFee;

        if (status === 'ENTREGADO') { 
            totalEntregados++; 
            sumaTotalUSD += totalUSD; 
            sumaTotalVES += totalVES; 
            sumaDeliveryUSD += deliveryFee;
            sumaMercanciaUSD += mercanciaUSD;

            // Llenamos la matriz de motorizados solo con entregas exitosas
            if (!driverStats[driverName]) {
                driverStats[driverName] = { viajes: 0, recaudado: 0 };
            }
            driverStats[driverName].viajes += 1;
            driverStats[driverName].recaudado += deliveryFee;
        }
        else if (status === 'DEVUELTO') { totalDevueltos++; }
        else if (status === 'CANCELADO') { totalCancelados++; }

        return [
            fechaHora,
            `#${safeSaleId}`,
            status,
            driverName,
            customerName,
            address,
            `${totalUSD.toFixed(2)}`,
            `${totalVES.toFixed(2)}`
        ];
    });

    // 4. DIBUJAR LA TABLA PRINCIPAL
    autoTable(doc, {
        startY: 38,
        head: [['FECHA / HORA', 'TICKET', 'ESTATUS', 'MOTORIZADO', 'CLIENTE', 'ZONA / DIRECCION', 'TOTAL REF', 'TOTAL BS']],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: colors.primary, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 18, fontStyle: 'bold' },
            // ??? UX PRO: Ampliado a 28 para evitar salto de línea en "PENDIENTE"
            2: { cellWidth: 28, fontStyle: 'bold' }, 
            3: { cellWidth: 35 },
            // ??? UX PRO: Reducido a 39 para balancear el ancho
            4: { cellWidth: 39 }, 
            5: { cellWidth: 'auto' }, 
            6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
            7: { cellWidth: 25, halign: 'right', textColor: 100 }
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 2) {
                if (data.cell.raw === 'ENTREGADO') data.cell.styles.textColor = colors.success;
                if (data.cell.raw === 'DEVUELTO') data.cell.styles.textColor = colors.alert;
                if (data.cell.raw === 'CANCELADO') data.cell.styles.textColor = colors.danger;
            }
        }
    });

    // 5. RESUMEN GERENCIAL GENERAL
    let finalY = doc.lastAutoTable.finalY + 10;
    
    if (finalY > doc.internal.pageSize.height - 70) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFillColor(...colors.bgLight);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY, pageWidth - 28, 28, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(...colors.primary);
    doc.setFont('helvetica', 'bold');
    doc.text("RESUMEN DE OPERACIONES LOGISTICAS (Solo Entregas Efectivas)", 18, finalY + 7);

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Entregados: ${totalEntregados}`, 18, finalY + 13);
    doc.text(`Total Devueltos: ${totalDevueltos}`, 18, finalY + 18);
    doc.text(`Total Cancelados: ${totalCancelados}`, 18, finalY + 23);
    
    doc.setFontSize(10);
    doc.text(`Recaudacion Mercancia:`, pageWidth - 55, finalY + 13, { align: 'right' });
    doc.text(`Recaudacion Fletes (Delivery):`, pageWidth - 55, finalY + 18, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Ref ${sumaMercanciaUSD.toFixed(2)}`, pageWidth - 20, finalY + 13, { align: 'right' });
    doc.text(`Ref ${sumaDeliveryUSD.toFixed(2)}`, pageWidth - 20, finalY + 18, { align: 'right' });

    doc.setFontSize(12);
    doc.text(`TOTAL GENERAL:`, pageWidth - 55, finalY + 24, { align: 'right' });
    doc.setTextColor(...colors.success); 
    doc.text(`Ref ${sumaTotalUSD.toFixed(2)}`, pageWidth - 20, finalY + 24, { align: 'right' });

    // ?? 6. NUEVA TABLA: ANEXO DE LIQUIDACIóN DE MOTORIZADOS
    const driverTableBody = Object.keys(driverStats).map(name => {
        const data = driverStats[name];
        return [
            name,
            `${data.viajes} Entregas Efectivas`,
            `Ref ${data.recaudado.toFixed(2)}`
        ];
    });

    if (driverTableBody.length > 0) {
        autoTable(doc, {
            startY: finalY + 35, 
            head: [['LIQUIDACION POR MOTORIZADO', 'VOLUMEN DE VIAJES', 'TOTAL FLETES GENERADOS']],
            body: driverTableBody,
            styles: { fontSize: 8, cellPadding: 4, font: 'helvetica' },
            headStyles: { fillColor: colors.primary, textColor: 255, fontStyle: 'bold' }, 
            columnStyles: {
                0: { cellWidth: 80, fontStyle: 'bold', textColor: colors.primary }, 
                1: { cellWidth: 50, halign: 'center' }, 
                2: { cellWidth: 50, halign: 'right', fontStyle: 'bold', textColor: colors.success } 
            },
            alternateRowStyles: { fillColor: colors.bgLight },
            margin: { left: 14 }
        });
    }

    // Paginación y sello de tiempo
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el: ${new Date().toLocaleString('es-VE')} | Sistema BMS Digital - Logistica`, 14, doc.internal.pageSize.height - 8);
        doc.text(`Pagina ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.height - 8, { align: 'right' });
    }

    doc.save(`Reporte_Logistica_Despachos_${new Date().getTime()}.pdf`);
};

// ============================================================================
// ?? NUEVO: REPORTE MAESTRO DE TERCEROS (CLIENTES, PROVEEDORES, TRANSPORTE)
// ============================================================================
export const printDirectoryReportPDF = (directoryData, filterType, tenantConfig) => {
    const doc = new jsPDF('p', 'mm', 'a4'); // Formato Vertical (Portrait)
    const pageWidth = doc.internal.pageSize.width;
    
    // ?? PALETA DE COLORES CORPORATIVA
    const colors = { 
        primary: [30, 41, 59],     // Slate 800
        text: [71, 85, 105],       // Slate 500
        bgLight: [248, 250, 252],  // Slate 50
        success: [16, 185, 129],   // Activo
        alert: [245, 158, 11],     // Suspendido
        cliente: [59, 130, 246],   // Azul (Cliente)
        proveedor: [139, 92, 246], // Morado (Proveedor)
        transporte: [100, 116, 139] // Gris (Transporte)
    };

    if (!directoryData || directoryData.length === 0) {
        throw new Error("EMPTY_DATA");
    }

    // CABECERA DEL REPORTE
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("DIRECTORIO MAESTRO DE TERCEROS", 14, 16);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const safeName = (tenantConfig.companyName || 'Empresa').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    doc.text(`${safeName} | RIF: ${tenantConfig.companyDocument || 'J-00000000-0'}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`FILTRO APLICADO`, pageWidth - 14, 16, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Categoria: ${filterType}`, pageWidth - 14, 22, { align: 'right' });

    // PROCESAMIENTO DE LA TABLA
    let contClientes = 0, contProveedores = 0, contTransporte = 0;

    const tableBody = directoryData.map(contact => {
        const id = contact.id ? `#${contact.id}` : 'S/I';
        const type = (contact.type || 'CLIENTE').toUpperCase();
        const name = (contact.full_name || contact.name || 'Sin Razon Social').substring(0, 35);
        const docNumber = contact.id_number || 'S/I';
        const phone = contact.phone || 'No registrado';
        const status = (contact.status || 'ACTIVO').toUpperCase();

        if (type === 'CLIENTE') contClientes++;
        else if (type === 'PROVEEDOR') contProveedores++;
        else if (type === 'TRANSPORTE') contTransporte++;

        return [ id, type, name, docNumber, phone, status ];
    });

    // DIBUJAR LA TABLA
    autoTable(doc, {
        startY: 38,
        head: [['ID', 'TIPO', 'RAZON SOCIAL / NOMBRE', 'CEDULA / RIF', 'TELEFONO', 'ESTATUS']],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: colors.primary, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 15, fontStyle: 'bold' },
            1: { cellWidth: 32, fontStyle: 'bold' }, // ?? Ajuste: De 25 a 32 para evitar el salto de línea en TRANSPORTE
            2: { cellWidth: 'auto' }, 
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
            5: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: colors.bgLight },
        didParseCell: function (data) {
            if (data.section === 'body') {
                if (data.column.index === 1) {
                    if (data.cell.raw === 'CLIENTE') data.cell.styles.textColor = colors.cliente;
                    if (data.cell.raw === 'PROVEEDOR') data.cell.styles.textColor = colors.proveedor;
                    if (data.cell.raw === 'TRANSPORTE') data.cell.styles.textColor = colors.transporte;
                }
                if (data.column.index === 5) {
                    if (data.cell.raw === 'ACTIVO') data.cell.styles.textColor = colors.success;
                    else data.cell.styles.textColor = colors.alert;
                }
            }
        }
    });

    // RESUMEN GERENCIAL
    let finalY = doc.lastAutoTable.finalY + 10;
    if (finalY > doc.internal.pageSize.height - 40) { doc.addPage(); finalY = 20; }

    doc.setFillColor(...colors.bgLight);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY, pageWidth - 28, 20, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(...colors.primary);
    doc.setFont('helvetica', 'bold');
    doc.text("RESUMEN DEL DIRECTORIO", 18, finalY + 7);

    doc.setFont('helvetica', 'normal');
    doc.text(`Clientes: ${contClientes}`, 18, finalY + 14);
    doc.text(`Proveedores: ${contProveedores}`, 65, finalY + 14);
    doc.text(`Transporte: ${contTransporte}`, 115, finalY + 14);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL REGISTROS: ${directoryData.length}`, pageWidth - 20, finalY + 14, { align: 'right' });

    // Paginación
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el: ${new Date().toLocaleString('es-VE')} | Sistema BMS Digital`, 14, doc.internal.pageSize.height - 8);
        doc.text(`Pagina ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.height - 8, { align: 'right' });
    }

    doc.save(`Directorio_${filterType}_${new Date().getTime()}.pdf`);
};

// --- NUEVO: REPORTE ANALíTICO DE VENTAS POR CATEGORíA Y TODOS LOS PRODUCTOS (UX PRO) ---
export const printCategorySalesAnalyticsPDF = (analyticsData, reportDateRange, bcvRate, tenantBrand = null) => {
    if (!analyticsData || (!analyticsData.salesByCategory && !analyticsData.topProducts)) {
        return Swal.fire('Sin datos', 'No hay información suficiente para generar el análisis completo.', 'warning');
    }

    const brandName = tenantBrand?.companyName || tenantBrand?.tradeName || tenantConfig?.companyName || 'BMS Digital';
    const safeName = brandName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const safeId = tenantBrand?.companyDocument || tenantBrand?.id_number || tenantConfig?.companyDocument || tenantConfig?.id_number || 'J-00000000-0';
    const currency = tenantConfig?.primaryCurrency || 'Bs';

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    const colors = {
        primary: [30, 41, 59],     // Slate 800
        secondary: [0, 86, 179],   // Azul Corporativo
        darkText: [30, 41, 59],   
        lightText: [100, 116, 139], 
        bgLight: [248, 250, 252],  
        border: [226, 232, 240],
        success: [16, 185, 129]
    };

    // 1. Cabecera Corporativa Legal
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("ANALISIS INTEGRAL DE VENTAS Y PRODUCTOS", 14, 12);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text("REPORTE GERENCIAL DE RENDIMIENTO (BIMONETARIO - RANGO COMPLETO)", 14, 17);
    doc.text(`RIF: ${safeId}  |  Razon Social: ${safeName}`, 14, 23);

    const dateStart = new Date(reportDateRange.start).toLocaleDateString('es-VE');
    const dateEnd = new Date(reportDateRange.end).toLocaleDateString('es-VE');
    doc.setFontSize(8);
    doc.text(`Periodo: ${dateStart} al ${dateEnd}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Tasa Base BCV: Bs ${formatBs(bcvRate)}`, pageWidth - 14, 17, { align: 'right' });
    doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, pageWidth - 14, 23, { align: 'right' });

    let finalY = 40;

    const cleanTableStyles = {
        theme: 'striped',
        headStyles: { fillColor: colors.primary, textColor: 255, fontStyle: 'bold', halign: 'left', cellPadding: 3, fontSize: 8 },
        bodyStyles: { textColor: colors.darkText, fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: colors.bgLight },
        styles: { lineColor: colors.border, lineWidth: 0.1 }
    };

    // --- CáLCULOS DE TOTALES GENERALES ---
    const totalUSDGeneral = (analyticsData.salesByCategory || []).reduce((acc, c) => acc + parseFloat(c.total_usd || 0), 0);
    const totalVESGeneral = totalUSDGeneral * bcvRate;
    const totalUnidadesGeneral = (analyticsData.topProducts || []).reduce((acc, p) => acc + parseFloat(p.total_qty || 0), 0);

    // --- TABLA 1: RENDIMIENTO POR CATEGORíA (Bimonetario) ---
    doc.setFontSize(11);
    doc.setTextColor(...colors.darkText);
    doc.setFont('helvetica', 'bold');
    doc.text("1. Distribucion Consolidada por Categoria", 14, finalY);
    finalY += 4;

    const catBody = (analyticsData.salesByCategory || []).map(row => {
        const totalUSD = parseFloat(row.total_usd || 0);
        const totalVES = totalUSD * bcvRate;
        const percentage = totalUSDGeneral > 0 ? ((totalUSD / totalUSDGeneral) * 100).toFixed(1) : 0;
        
        // ??? CORRECCIóN CERTIFICADA: Limpieza estricta anti-mojibake para evitar caracteres extra?os en tildes
        let catName = row.category ? row.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'Sin Categoria';
        if (catName.toLowerCase().includes('categoria') || catName.toLowerCase().includes('categora')) {
            catName = 'Sin Categoria';
        }

        return [
            catName,
            `${percentage}%`,
            formatBs(totalVES),
            `Ref ${totalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ];
    });

    // ?? FILA DE TOTALES GENERALES - TABLA 1
    catBody.push([
        'TOTAL GENERAL',
        '100.0%',
        formatBs(totalVESGeneral),
        `Ref ${totalUSDGeneral.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['CATEGORIA DE PRODUCTOS', 'PARTICIPACION', `TOTAL (${currency})`, 'TOTAL (Ref)']],
        body: catBody,
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'center', textColor: colors.lightText },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold', textColor: colors.secondary }
        },
        didParseCell: function(data) {
            // Estilo resaltado para la fila de cierre
            if (data.section === 'body' && data.row.index === catBody.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [226, 232, 240];
                data.cell.styles.textColor = [15, 23, 42];
            }
        }
    });

    finalY = doc.lastAutoTable.finalY + 14;
    if (finalY > 220) { doc.addPage(); finalY = 20; }

    // --- TABLA 2: LISTADO GENERAL Y EXTENDIDO DE TODOS LOS PRODUCTOS VENDIDOS ---
    doc.setFontSize(11);
    doc.setTextColor(...colors.darkText);
    doc.text("2. Relacion General de Todos los Productos Vendidos", 14, finalY);
    finalY += 4;

    const prodBody = (analyticsData.topProducts || []).map(row => {
        const revUSD = parseFloat(row.total_revenue || 0);
        const revVES = revUSD * bcvRate;
        const cleanQty = parseFloat(row.total_qty || 0);
        return [
            (row.name || 'Desconocido').normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
            `${cleanQty} UND`,
            formatBs(revVES),
            `Ref ${revUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ];
    });

    // ?? FILA DE TOTALES GENERALES - TABLA 2
    prodBody.push([
        'TOTAL GENERAL ACUMULADO',
        `${totalUnidadesGeneral} UND`,
        formatBs(totalVESGeneral),
        `Ref ${totalUSDGeneral.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
        ...cleanTableStyles,
        startY: finalY,
        head: [['PRODUCTO / DESCRIPCION', 'UNIDADES', `INGRESO (${currency})`, 'INGRESO (Ref)']],
        headStyles: { ...cleanTableStyles.headStyles, fillColor: [0, 86, 179] },
        body: prodBody,
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold', textColor: colors.success }
        },
        didParseCell: function(data) {
            // Estilo resaltado para la fila de cierre
            if (data.section === 'body' && data.row.index === prodBody.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [226, 232, 240];
                data.cell.styles.textColor = [15, 23, 42];
            }
        }
    });

    // Paginación y Pie de página legal
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...colors.border);
        doc.line(14, 285, 196, 285);
        doc.setFontSize(7);
        doc.setTextColor(...colors.lightText);
        doc.text(`Analisis de Ventas por Categoria y Rango - ${safeName}`, 14, 290);
        doc.text(`Pagina ${i} de ${pageCount}`, 196, 290, { align: 'right' });
    }

    doc.save(`Ventas_Completas_Por_Categoria_${reportDateRange.start}_al_${reportDateRange.end}.pdf`);
};