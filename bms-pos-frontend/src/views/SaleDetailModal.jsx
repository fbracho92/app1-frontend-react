import React from 'react';
import Swal from 'sweetalert2';
import { SystemService } from '../api/services'; // Asegúrate de que la ruta sea correcta

export const SaleDetailModal = ({
    selectedSaleDetail,
    setSelectedSaleDetail,
    handlePrintTicket,
    handleVoidSale,
    onSuccess // 🚨 NUEVO: Prop para recargar la tabla de ventas tras formalizar
}) => {
    if (!selectedSaleDetail) return null;

   // 🚨 FASE 5: IDENTIFICADORES MULTIMODALES Y NOTAS DE CRÉDITO (LEY SENIAT)
    // 🛡️ ESCUDO: Si viene vacío (null), forzamos a que sea reconocido como TICKET internamente
    const currentInvoiceType = selectedSaleDetail.invoice_type || 'TICKET'; 

    const isFiscalDoc = ['FISCAL', 'FORMA_LIBRE', 'ELECTRONIC', 'ELECTRONIC_BILLING'].includes(currentInvoiceType);
    const isCreditNote = currentInvoiceType === 'NOTA_CREDITO' || (isFiscalDoc && selectedSaleDetail.status === 'ANULADO');
    const isAnulado = selectedSaleDetail.status === 'ANULADO';
    const isDeuda = selectedSaleDetail.status === 'PENDIENTE' || selectedSaleDetail.status === 'PARCIAL';
    
    // 🚨 Ahora el botón aparecerá siempre que sea un documento de control interno
    const isNotaEntrega = currentInvoiceType === 'NOTA_ENTREGA' || currentInvoiceType === 'TICKET';
    
    // 🚨 CASCADA DE RESPALDOS (FALLBACKS) PARA EL MODAL
    const numDocLegacy = selectedSaleDetail.control_number || selectedSaleDetail["Nro Factura"] || selectedSaleDetail.id;
    const numControlLegacy = selectedSaleDetail.fiscal_control_number || selectedSaleDetail["Nro Control"] || 'S/A';

    // 🚨 CORRECCIÓN: NC independiente, si no tiene número mostrará S/A (Sin Asignar)
    const finalCreditNoteNum = selectedSaleDetail.credit_note_number || 'S/A';
    const finalCreditNoteCtrl = selectedSaleDetail.credit_note_control || 'S/A';

    const finalFiscalNum = selectedSaleDetail.fiscal_invoice_number || numDocLegacy;
    const finalFiscalCtrl = selectedSaleDetail.fiscal_control_number || numControlLegacy;

    // =========================================================================
    // 🛡️ PUENTE ASÍNCRONO BLINDADO (NUEVO)
    // =========================================================================
    // 1. Extraemos de forma segura la Serie real de la factura
    let realSerie = 'A'; // fallback por defecto
    if (selectedSaleDetail.register_serie) {
        realSerie = selectedSaleDetail.register_serie;
    } else if (selectedSaleDetail.serie) {
        realSerie = selectedSaleDetail.serie;
    } else if (selectedSaleDetail.fiscal_control_number) {
        const match = selectedSaleDetail.fiscal_control_number.match(/^[a-zA-Z]+/);
        if (match) realSerie = match[0].toUpperCase();
    }

    // 2. Función Inteligente de Impresión (Da 3 segundos al PDF para leer la Serie)
    const handleSmartPrint = () => {
        // Inyectamos la serie correcta
        localStorage.setItem('bms_print_serie', realSerie);
        
        // Llamamos a tu generador de PDF
        handlePrintTicket(selectedSaleDetail);
        
        // Borramos la variable a los 3 segundos para que no interfiera en futuras impresiones
        setTimeout(() => {
            localStorage.removeItem('bms_print_serie');
        }, 3000);
    };
    // =========================================================================


    // 🎨 Lógica de Colores Semánticos y Títulos
    const getHeaderTheme = () => {
        if (isCreditNote) {
            return {
                bg: 'bg-gradient-to-br from-rose-700 via-red-800 to-rose-950 shadow-rose-900/30',
                title: 'Nota de Crédito Fiscal (SENIAT)'
            };
        }
        if (isAnulado && !isFiscalDoc) {
            return {
                bg: 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 shadow-slate-900/20',
                title: 'Documento Interno Anulado'
            };
        }
        if (isFiscalDoc) {
            return {
                bg: 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 shadow-indigo-900/20',
                title: 'Factura Fiscal'
            };
        }
        if (isDeuda) {
            return {
                bg: 'bg-gradient-to-br from-orange-500 via-orange-600 to-red-700 shadow-orange-900/20',
                title: 'Cuenta por Cobrar (Interno)'
            };
        }
        return {
            bg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-800 shadow-emerald-900/20',
            title: 'Nota de Entrega (Uso Interno)'
        };
    };

    const theme = getHeaderTheme();

    // 🚀 LÓGICA DE UX: Proceso de Formalización de Nota de Entrega (BLINDADO FULL UI/UX)
    const handleFormalizeDocument = async () => {
        const { value: selectedType } = await Swal.fire({
            title: '<h3 class="text-2xl font-black text-slate-800 tracking-tight">Formalizar a Factura</h3>',
            html: `
                <div class="text-left font-sans mt-4">
                    
                    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex gap-4 shadow-inner">
                        <div class="text-amber-500 text-3xl animate-pulse drop-shadow-sm">⚠️</div>
                        <div class="flex-1">
                            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Aviso Fiscal (Prov. 00071)</p>
                            <p class="text-xs text-amber-700 font-medium leading-relaxed">
                                La Nota de Entrega <b>#${numDocLegacy}</b> se formalizará legalmente.<br/>
                                <span class="font-bold underline decoration-amber-400 decoration-2">No descontará inventario</span> y tomará la <b>Fecha Fiscal de HOY</b> para mantener la correlatividad del Libro de Ventas.
                            </p>
                        </div>
                    </div>

                    <label class="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Seleccione la modalidad</label>
                    
                    <div class="flex flex-col gap-3">
                        
                        <label class="relative flex items-center justify-between p-4 border-2 border-slate-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all [&:has(input:checked)]:border-blue-600 [&:has(input:checked)]:bg-blue-50 [&:has(input:checked)]:shadow-md group">
                            <div class="flex items-center gap-4">
                                <div class="text-2xl group-has-[:checked]:scale-110 transition-transform bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">📄</div>
                                <div class="flex flex-col">
                                    <span class="text-sm font-black text-slate-700 group-has-[:checked]:text-blue-700 transition-colors">Facturar en Forma Libre</span>
                                    <span class="text-[10px] font-bold text-slate-400 mt-0.5">Papel pre-impreso (Providencia 0071)</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-center w-6 h-6 rounded-full border-2 border-slate-300 bg-white group-has-[:checked]:border-blue-600 group-has-[:checked]:bg-blue-600 transition-all">
                                <svg class="w-3.5 h-3.5 text-white opacity-0 group-has-[:checked]:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <input type="radio" name="fiscal_type" value="FORMA_LIBRE" class="hidden" checked>
                        </label>

                        <label class="relative flex items-center justify-between p-4 border-2 border-slate-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all [&:has(input:checked)]:border-blue-600 [&:has(input:checked)]:bg-blue-50 [&:has(input:checked)]:shadow-md group">
                            <div class="flex items-center gap-4">
                                <div class="text-2xl group-has-[:checked]:scale-110 transition-transform bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">🖨️</div>
                                <div class="flex flex-col">
                                    <span class="text-sm font-black text-slate-700 group-has-[:checked]:text-blue-700 transition-colors">Enviar a Impresora Fiscal</span>
                                    <span class="text-[10px] font-bold text-slate-400 mt-0.5">Emisión por hardware físico</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-center w-6 h-6 rounded-full border-2 border-slate-300 bg-white group-has-[:checked]:border-blue-600 group-has-[:checked]:bg-blue-600 transition-all">
                                <svg class="w-3.5 h-3.5 text-white opacity-0 group-has-[:checked]:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <input type="radio" name="fiscal_type" value="TICKET" class="hidden">
                        </label>

                        <label class="relative flex items-center justify-between p-4 border-2 border-slate-100 rounded-2xl cursor-not-allowed opacity-60 bg-slate-50 group">
                            <div class="flex items-center gap-4">
                                <div class="text-2xl bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex items-center justify-center grayscale">🌐</div>
                                <div class="flex flex-col">
                                    <span class="text-sm font-black text-slate-500">Facturación Electrónica</span>
                                    <span class="text-[10px] font-bold text-slate-400 mt-0.5">Portal SENIAT (Próximamente)</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-center w-6 h-6 rounded-full border-2 border-slate-200 bg-slate-100">
                                <span class="text-[10px]">🔒</span>
                            </div>
                            <input type="radio" name="fiscal_type" value="ELECTRONIC_BILLING" disabled class="hidden">
                        </label>

                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Formalizar',
            cancelButtonText: '<span style="color:#475569">Cancelar</span>',
            customClass: { 
                popup: 'rounded-3xl shadow-2xl border border-slate-100 pb-2', 
                htmlContainer: '!m-0 !px-6',
                confirmButton: 'bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-95 outline-none w-full md:w-auto',
                cancelButton: 'bg-[#E2E8F0] text-slate-600 hover:bg-slate-300 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-95 outline-none w-full md:w-auto',
                actions: 'flex gap-3 px-6 mt-8 mb-4 w-full'
            },
            buttonsStyling: false,
            preConfirm: () => {
                const selected = document.querySelector('input[name="fiscal_type"]:checked');
                if (!selected) {
                    Swal.showValidationMessage('⚠️ Debe seleccionar una modalidad fiscal');
                    return false;
                }
                return selected.value; // Retorna 'FORMA_LIBRE', 'TICKET', etc.
            }
        });

        if (selectedType) {
            // 🚨 ESCUDO 1 (FRONT-END): Bloqueo de Consumidor Final en Forma Libre
            if (selectedType === 'FORMA_LIBRE') {
                const idNum = selectedSaleDetail.id_number || '';
                // Si no hay cédula, o dice "S/I", o son puros ceros (Consumidor Final)
                if (!idNum || idNum === 'S/I' || idNum.includes('00000000')) {
                    return Swal.fire({
                        icon: 'error',
                        title: 'Operación Denegada (SENIAT)',
                        html: '<p class="text-sm text-slate-600 mt-2">No se puede formalizar en <b>Forma Libre</b> un documento a "Consumidor Final".<br/><br/>Esta Nota de Entrega fue generada sin RIF. Solo puede fiscalizarla usando <b>Impresora Fiscal</b>.</p>',
                        customClass: { popup: 'rounded-3xl', confirmButton: 'bg-slate-900 text-white font-bold rounded-xl px-6 py-3 shadow-md' },
                        buttonsStyling: false
                    });
                }
            }

            // 👇 CÓDIGO 100% CERTIFICADO Y ELEGANTE 👇
            try {
                let payload = { invoice_type: selectedType };

                if (selectedType === 'TICKET') {
                    // Mensaje claro para manejar la ansiedad del usuario durante los 2-3 seg de la impresora
                    Swal.fire({ title: 'Imprimiendo Factura...', text: 'Esperando respuesta de la impresora...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
                } else {
                    Swal.fire({ title: 'Generando Correlativo...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
                }

                // 1. Llamamos al Backend para formalizar la factura
                const response = await SystemService.billDeliveryNote(selectedSaleDetail.id, payload);

                if (response.data?.success) {
                    Swal.fire({ 
                        icon: 'success', 
                        title: '¡Factura Emitida!', 
                        text: 'Se ha registrado legalmente en el Libro de Ventas.', 
                        timer: 2000, 
                        showConfirmButton: false, 
                        customClass: { popup: 'rounded-3xl' } 
                    });
                    
                    // ✨ 2. LA MAGIA ELEGANTE (Mutación de Estado en Vivo) ✨
                    // Extraemos los datos frescos que devuelve el backend (si existen) o forzamos los locales
                    const updatedDoc = response.data.data || {};
                    
                    setSelectedSaleDetail(prev => ({
                        ...prev,
                        invoice_type: updatedDoc.invoice_type || selectedType, // Cambia el tipo visualmente
                        fiscal_invoice_number: updatedDoc.fiscal_invoice_number || prev.fiscal_invoice_number,
                        fiscal_control_number: updatedDoc.fiscal_control_number || prev.fiscal_control_number,
                        fiscal_machine_serial: updatedDoc.fiscal_machine_serial || prev.fiscal_machine_serial,
                        status: updatedDoc.status || 'PAGADO'
                    }));

                    // 3. Avisamos silenciosamente a la tabla de fondo para que se actualice
                    if (typeof onSuccess === 'function') {
                        onSuccess(); 
                    }
                    
                    // 🚨 Ya NO cerramos el modal. Permanecerá abierto mostrando los nuevos datos fiscales.
                }
            } catch (error) {
                Swal.fire('Error', error.response?.data?.error || 'No se pudo formalizar el documento.', 'error');
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[90] bg-[#020617]/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in font-sans antialiased">
            {/* CARD PRINCIPAL */}
            <div className="bg-[#F8FAFC] rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl shadow-black/40 relative animate-scale-up flex flex-col max-h-[92vh] ring-1 ring-white/10">

                {/* 1. HEADER HERO DINÁMICO */}
                <div className={`relative px-8 pt-10 pb-8 shrink-0 text-white overflow-hidden transition-all duration-700 shadow-lg ${theme.bg}`}>
                    <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                    <button
                        onClick={() => setSelectedSaleDetail(null)}
                        className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 hover:rotate-90 border border-white/10 backdrop-blur-md text-white rounded-full w-9 h-9 flex items-center justify-center transition-all duration-300 z-20 shadow-lg"
                    >
                        ✕
                    </button>

                    <div className="relative z-10 text-center flex flex-col items-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10 shadow-lg mb-2">
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] ${
                                selectedSaleDetail.status === 'PAGADO' ? 'bg-emerald-300 text-emerald-300' :
                                isAnulado ? 'bg-rose-400 text-rose-400' : 'bg-white text-white animate-pulse'
                            }`}></div>
                            <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/90">
                                {selectedSaleDetail.status}
                            </span>
                        </div>

                        <h3 className="font-bold text-base tracking-widest uppercase text-white/80 mb-2">
                            {theme.title}
                        </h3>

                        <div className="flex flex-col items-center">
                            <div className="flex items-baseline justify-center gap-1 drop-shadow-xl">
                                <span className="text-2xl font-medium text-white/70 translate-y-[-2px]">Bs</span>
                                <span className="text-5xl md:text-6xl font-black tracking-tighter text-white leading-none">
                                    {parseFloat(selectedSaleDetail.total_ves).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="mt-2 bg-white/10 px-4 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-inner">
                                <p className="text-xs font-bold font-mono tracking-wider text-white">
                                    Ref ${parseFloat(selectedSaleDetail.total_usd).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. CUERPO (DATOS ORGANIZADOS) */}
                <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-5 bg-[#F8FAFC]">
                    {/* --- BLOQUE DE METADATOS UNIFICADO --- */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="grid grid-cols-2 border-b border-slate-50">
                            <div className="p-3 flex flex-col items-center justify-center border-r border-slate-50">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Fecha de Emisión</span>
                                <span className="text-xs font-bold text-slate-700">
                                    {new Date(selectedSaleDetail.created_at || new Date()).toLocaleDateString('es-VE')}
                                </span>
                            </div>

                            <div className="p-3 flex flex-col items-center justify-center text-center">
                                {isCreditNote ? (
                                    <>
                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-0.5">Nro. Nota Crédito</span>
                                        <span className="font-black text-rose-700 font-mono text-sm leading-tight">{finalCreditNoteNum}</span>
                                        {(finalCreditNoteCtrl && finalCreditNoteCtrl !== 'S/A') && (
                                            <span className="text-[8px] font-bold text-slate-500 font-mono mt-0.5 uppercase">Ctrl: {finalCreditNoteCtrl}</span>
                                        )}
                                        {selectedSaleDetail.fiscal_invoice_number && (
                                            <div className="mt-1.5 px-2 py-0.5 bg-rose-50 rounded border border-rose-100 text-[8px] font-bold text-rose-600 uppercase tracking-wider">
                                                Afecta Fact: {selectedSaleDetail.fiscal_invoice_number}
                                            </div>
                                        )}
                                    </>
                                ) : isFiscalDoc ? (
                                    <>
                                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-0.5">Nro. Factura Fiscal</span>
                                        <span className="font-black text-blue-700 font-mono text-sm leading-tight">{finalFiscalNum}</span>
                                        <span className="text-[8px] font-bold text-slate-500 font-mono mt-0.5 uppercase">Ctrl: {finalFiscalCtrl}</span>
                                        {selectedSaleDetail.fiscal_machine_serial && (
                                            <span className="text-[8px] font-bold text-slate-400 font-mono uppercase bg-slate-50 px-1 mt-1 rounded">
                                                Maq: {selectedSaleDetail.fiscal_machine_serial}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Nro. Control Interno</span>
                                        <span className="font-black text-slate-800 font-mono text-sm leading-tight">#{numDocLegacy}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-slate-50">
                            <div className="p-3 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Formato</span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border text-center ${
                                    isCreditNote ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                    isFiscalDoc ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                    {(selectedSaleDetail.invoice_type || 'TICKET').replace('_', ' ')}
                                </span>
                            </div>
                            <div className="p-3 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Condición</span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                    isDeuda ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                    {isDeuda ? 'CRÉDITO' : 'CONTADO'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* --- CLIENTE CARD --- */}
                    <div className={`p-4 rounded-2xl shadow-sm border flex items-center gap-4 relative overflow-hidden group transition-colors ${
                        isCreditNote ? 'bg-rose-50/30 border-rose-100' :
                        isDeuda ? 'bg-orange-50/30 border-orange-100' : 'bg-white border-slate-100'
                    }`}>
                        <div className={`relative z-10 h-12 w-12 rounded-2xl flex items-center justify-center shadow-md transform group-hover:scale-105 transition-transform duration-300 ${
                            isCreditNote ? 'bg-gradient-to-br from-rose-500 to-red-600' :
                            isFiscalDoc ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                            isDeuda ? 'bg-gradient-to-br from-orange-400 to-orange-600' : 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                        }`}>
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0 relative z-10">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Datos del Cliente</p>
                            <p className="text-sm font-bold text-slate-800 truncate leading-tight">{selectedSaleDetail.full_name || 'Consumidor Final'}</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">RIF/CI: {selectedSaleDetail.id_number || 'No registrado'}</p>
                        </div>
                    </div>

                    {/* --- LISTA DE ÍTEMS --- */}
                    <div>
                        <div className="flex justify-between items-end px-2 mb-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detalle de Ítems</p>
                            <span className="text-[9px] font-bold text-slate-400">{selectedSaleDetail.items.length} Ítems</span>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            {selectedSaleDetail.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className={`text-[10px] font-black h-7 w-7 flex items-center justify-center rounded-lg shadow-sm ${
                                            isCreditNote ? 'bg-rose-50 text-rose-600' :
                                            isFiscalDoc ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {item.quantity}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs text-slate-700 truncate">{item.name}</p>
                                            <p className="text-[9px] text-slate-400 font-medium">Ref {parseFloat(item.price_at_moment_usd || item.price_usd).toFixed(2)} c/u</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-xs text-slate-800 whitespace-nowrap pl-2">
                                        Ref {(parseFloat(item.price_at_moment_usd || item.price_usd) * item.quantity).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- INFO FINANCIERA --- */}
                    <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-3 border border-slate-100">
                        {(selectedSaleDetail.discount_usd > 0) && (
                            <div className="flex justify-between items-center text-sm font-bold text-amber-600 bg-amber-50 p-2 rounded-lg mb-2">
                                <span>(-) Descuento Global</span>
                                <span>- Ref {selectedSaleDetail.discount_usd.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-start gap-4">
                            <span className="font-semibold text-slate-500 whitespace-nowrap mt-1">Métodos Registrados</span>
                            <div className="flex flex-wrap justify-end gap-1.5">
                                {String(selectedSaleDetail.payment_method || 'NO REGISTRADO').split(',').map((method, idx) => (
                                    <span key={idx} className="font-bold text-[9px] text-slate-700 uppercase bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                        {method.trim().replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {(selectedSaleDetail.igtf_usd > 0) && (
                            <div className="flex justify-between items-center font-bold text-slate-600 pt-2 border-t border-slate-200/50">
                                <span>(+) IGTF Percibido</span>
                                <span>Ref {selectedSaleDetail.igtf_usd.toFixed(2)}</span>
                            </div>
                        )}
                        {selectedSaleDetail.taxBreakdown && selectedSaleDetail.taxBreakdown.ivaUSD > 0 && (
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
                                <span className="font-semibold text-blue-500">Impuesto (IVA 16%)</span>
                                <span className="font-bold text-blue-600">Ref {selectedSaleDetail.taxBreakdown.ivaUSD.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. FOOTER ACCIONES */}
                <div className="p-5 bg-white border-t border-slate-100 flex flex-col gap-3 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.05)] z-10">

                    {/* 🚨 BOTÓN ESTRELLA: Formalizar Nota de Entrega */}
                    {isNotaEntrega && !isAnulado && (
                        <button
                            onClick={handleFormalizeDocument}
                            className="w-full relative overflow-hidden text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95 bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center gap-2 mb-1 border border-emerald-400"
                        >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="tracking-widest uppercase text-xs">Convertir a Factura Fiscal</span>
                        </button>
                    )}

                    {/* 🚨 CAMBIO APLICADO: Botón Imprimir usa handleSmartPrint */}
                    <button
                        onClick={handleSmartPrint}
                        className={`w-full relative overflow-hidden text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95 group flex items-center justify-center gap-2 ${
                            isCreditNote ? 'bg-rose-700 hover:bg-rose-600' :
                            isFiscalDoc ? 'bg-slate-900 hover:bg-slate-800' :
                            isDeuda ? 'bg-orange-600 hover:bg-orange-500' : 'bg-slate-500 hover:bg-slate-400'
                        }`}
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        <span className="tracking-wide uppercase text-xs">
                            {isCreditNote ? 'Reimprimir Nota de Crédito' : isFiscalDoc ? 'Reimprimir Factura Fiscal' : 'Imprimir Ticket Interno'}
                        </span>
                    </button>

                    {/* Botón Anular / Emitir N/C */}
                    {!isAnulado ? (
                        <button
                            onClick={() => handleVoidSale(selectedSaleDetail)}
                            disabled={selectedSaleDetail.status === 'PARCIAL'}
                            className={`w-full py-3 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest border transition-all duration-300 flex items-center justify-center gap-2 ${
                                selectedSaleDetail.status === 'PARCIAL'
                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-white border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200'
                            }`}
                        >
                            {selectedSaleDetail.status === 'PARCIAL' ? '🔒 Bloqueado (Tiene Pagos)' : (isFiscalDoc ? '📄 Emitir Nota de Crédito' : '❌ Anular Documento Interno')}
                        </button>
                    ) : (
                        <div className="w-full py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] text-center select-none flex items-center justify-center gap-2">
                            <span>⛔ {isFiscalDoc ? 'FACTURA ANULADA (N/C EMITIDA)' : 'DOCUMENTO ANULADO'}</span>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};