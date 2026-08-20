import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { CashService } from '../api/services';
import { formatBs, formatUSD } from '../utils/formatters';
import { tenantConfig } from '../config/tenantConfig';

// 🚀 AÑADIMOS dailySalesList = [] PARA RECIBIR LOS TICKETS REALES DESDE APP.JSX
export const useCashRegister = ({ bcvRate, addToCart, onShiftClosed, dailySalesList = [] }) => {
    const [cashShift, setCashShift] = useState(null); // null = cargando, 'CERRADA' = no hay turno, Objeto = turno abierto
    const [isCashOpen, setIsCashOpen] = useState(false);
    
    // --- ESTADOS PARA AVANCE DE EFECTIVO ---
    const [isCashAdvanceOpen, setIsCashAdvanceOpen] = useState(false);
    const [advanceData, setAdvanceData] = useState({
        amountBs: '', // Cuánto efectivo quiere el cliente
        commission: 10 // Porcentaje de comisión por defecto (ej: 10%)
    });
    
    const checkCashStatus = async () => {
        try {
            const res = await CashService.getStatus();

            // CORRECCIÓN LÓGICA CRÍTICA:
            // Si el backend dice 'ABIERTA', guardamos la info del turno (shift_info).
            // Si dice 'CERRADA', ponemos null para bloquear el cobro.
            if (res.data.status === 'ABIERTA' && res.data.shift_info) {
                setCashShift(res.data.shift_info);
                setIsCashOpen(true); 
            } else {
                setCashShift(null); 
                setIsCashOpen(false);
            }

        } catch (error) {
            console.error(error);
            
            // 🚨 UX BLINDADA CORREGIDA: Bloqueo Silencioso
            // Si la caja está ocupada por otro usuario (403), NO lanzamos 
            // la alerta intrusiva en el Dashboard para evitar loops y pérdida de sesión.
            // Simplemente le bloqueamos la operatividad de la caja a este usuario.
            if (error.response && error.response.status === 403 && error.response.data && error.response.data.error === 'CAJA_OCUPADA') {
                 setCashShift(null);
                 setIsCashOpen(false);
                 return; // Detenemos la ejecución silenciosamente
            }

            // En caso de error de conexión, asumimos cerrada por seguridad
            setCashShift(null);
            setIsCashOpen(false);
        }
    };
    
    // 1. Carga inicial de datos al montar el componente
    useEffect(() => {
        checkCashStatus(); // <--- AGREGAR ESTO
    }, []);
    
    const promptOpenCash = async () => {
        const { value: formValues } = await Swal.fire({
            title: `<div class="flex items-center justify-center gap-2 pt-1 pb-1">
                    <span class="text-2xl animate-bounce-slow">☀️</span>
                    <h3 class="text-xl font-black text-slate-800 tracking-tight">Iniciar Jornada</h3>
                </div>`,
            html: `
            <div class="text-left font-sans px-1">
                <p class="text-center text-slate-500 text-[11px] mb-4 font-medium leading-relaxed">
                    Indica el efectivo base en gaveta (Sencillo) para comenzar.
                </p>
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 group focus-within:border-blue-300 focus-within:bg-blue-50/30 transition-all duration-300">
                        <label class="block text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1 ml-1">Bolivares</label>
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 font-black text-sm">Bs</span>
                            <input id="init-ves" type="number" step="0.01" min="0" class="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-lg font-black text-slate-700 text-base focus:outline-none focus:border-blue-400 transition-all placeholder:text-slate-300 shadow-sm" placeholder="0.00" autocomplete="off">
                        </div>
                    </div>
                    <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 group focus-within:border-emerald-300 focus-within:bg-emerald-50/30 transition-all duration-300">
                        <label class="block text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1 ml-1">Divisas</label>
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-xs uppercase tracking-wider">Ref</span>
                            <input id="init-usd" type="number" step="0.01" min="0" class="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-lg font-black text-slate-700 text-base focus:outline-none focus:border-emerald-400 transition-all placeholder:text-slate-300 shadow-sm" placeholder="0.00" autocomplete="off">
                        </div>
                    </div>
                </div>
            </div>
        `,
            showCancelButton: true,
            confirmButtonText: 'Abrir Caja',
            cancelButtonText: 'Cancelar',
            buttonsStyling: false,
            width: window.innerWidth < 768 ? '95%' : '380px', // Adaptativo
            padding: '1.25rem', // Menos padding general
            customClass: {
                popup: 'rounded-[2rem] shadow-2xl border border-white/80 backdrop-blur-xl bg-white/90',
                actions: 'flex flex-row gap-2 w-full mt-5 px-1', // Botones lado a lado en lugar de apilados
                confirmButton: 'flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-2 rounded-xl transition-all shadow-md shadow-blue-500/30 active:scale-95 outline-none text-sm',
                cancelButton: 'flex-1 bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold py-3 px-2 rounded-xl transition-all active:scale-95 outline-none text-sm'
            },
            didOpen: () => {
                setTimeout(() => {
                    const input = document.getElementById('init-ves');
                    if(input) input.focus();
                }, 100);
            },
            preConfirm: () => {
                const usd = document.getElementById('init-usd').value;
                const ves = document.getElementById('init-ves').value;
                return {
                    usd: usd ? parseFloat(usd) : 0,
                    ves: ves ? parseFloat(ves) : 0
                };
            }
        });

        if (formValues) {
            try {
                Swal.fire({
                    title: '',
                    html: '<span class="text-sm font-bold text-slate-500">Iniciando sistema...</span>',
                    timerProgressBar: true,
                    didOpen: () => Swal.showLoading(),
                    background: 'transparent',
                    backdrop: 'rgba(255,255,255,0.8)',
                    allowOutsideClick: false 
                });

                await CashService.open({
                    initial_cash_usd: formValues.usd,
                    initial_cash_ves: formValues.ves
                });

                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                    didOpen: (toast) => {
                        toast.addEventListener('mouseenter', Swal.stopTimer)
                        toast.addEventListener('mouseleave', Swal.resumeTimer)
                    }
                });

                Toast.fire({
                    icon: 'success',
                    title: 'Caja Abierta',
                    text: 'Listo para procesar ventas'
                });

                if (typeof checkCashStatus === 'function') {
                    checkCashStatus();
                }

            } catch (err) {
                if (err.response && err.response.data && err.response.data.error === 'CONFLICTO_TURNO_ABIERTO') {
                    Swal.fire({
                        title: '<h3 class="text-xl font-black text-slate-800 tracking-tight">ACCESO DENEGADO</h3>',
                        html: `
                        <div class="text-left font-sans mt-2">
                            <p class="mb-4 text-slate-600 text-sm font-medium">Por seguridad fiscal, no pueden existir dos turnos simultaneos.</p>
                            <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm">
                                <p class="font-black text-red-800 text-[10px] uppercase tracking-widest">ERROR CRITICO:</p>
                                <p class="text-red-700 text-xs font-mono mt-1 font-bold">${err.response.data.message}</p>
                            </div>
                            <p class="mt-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solucion: Realiza el cierre del turno anterior antes de iniciar uno nuevo.</p>
                        </div>
                    `,
                        icon: 'error',
                        confirmButtonText: 'Entendido, ir a cerrar',
                        buttonsStyling: false,
                        customClass: {
                            popup: 'rounded-[2.5rem] p-6 shadow-2xl border border-white/80 bg-white/90',
                            confirmButton: 'w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-red-500/30 active:scale-95 outline-none mt-4'
                        }
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de Sistema',
                        text: err.response?.data?.error || 'Error de conexion',
                        buttonsStyling: false,
                        customClass: {
                            popup: 'rounded-[2.5rem] shadow-2xl',
                            confirmButton: 'bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 outline-none'
                        }
                    });
                }
            }
        }
    };
    
    // -----------------------------------------------------------------------------
    // 🇻🇪 ARQUEO DE CAJA "PREMIUM DASHBOARD" (LAYOUT 2 COLUMNAS + AUDITORÍA)
    // -----------------------------------------------------------------------------
    const handleCashClose = async () => {

        // 1. PANTALLA DE CARGA (Feedback Inmediato)
        Swal.fire({
            title: 'Auditor\u00EDa en curso...',
            html: '<div class="text-sm text-slate-500 font-medium animate-pulse">Sincronizando contadores fiscales y donaciones...</div>',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            background: '#ffffff',
            showConfirmButton: false,
            width: 400,
            padding: '2em'
        });

        let statusData;
        try {
            const res = await CashService.getStatus();
            statusData = res.data;
            Swal.close();

            if (statusData.status === 'CERRADA') {
                return Swal.fire({ icon: 'info', title: 'Turno Cerrado', text: 'No hay caja abierta.', confirmButtonColor: '#3b82f6' });
            }
        } catch (e) {
            Swal.close();
            return Swal.fire('Error', 'Sin conexi\u00F3n al servidor.', 'error');
        }

        // --- CÁLCULOS (PREDICCIÓN DEL SISTEMA) ---
        const sys = statusData.system_totals;
        const initial = statusData.shift_info;

        // Fórmula: (Base + Ventas) - Salidas
        const expectedBs = (parseFloat(initial.initial_cash_ves) + sys.cash_ves) - (sys.cash_outflows_ves || 0);
        const expectedUsd = (parseFloat(initial.initial_cash_usd) + sys.cash_usd) - (sys.cash_outflows_usd || 0);

        // Lógica de Caja en Rojo (Matemática Negativa)
        const isNegativeBs = expectedBs < 0;
        const isNegativeUsd = expectedUsd < 0;

        // Auditoría de Donaciones (Inventario que salió sin dinero)
        const totalDonationsRef = sys.donations || 0;

        // 🚀 LÓGICA CERTIFICADA: Extraemos los montos exactos ticket por ticket
        // Ignoramos la suma corrupta del backend para evitar montos duplicados en pagos mixtos
        let expectedPm = 0;
        let expectedPunto = 0;
        let expectedZelle = 0;

        if (dailySalesList && dailySalesList.length > 0) {
            dailySalesList.forEach(sale => {
                if (sale.status === 'ANULADO') return; // Saltamos ventas anuladas
                const methodStr = sale.payment_method || '';
                
                // 1. Extrae el número exacto para Pago Móvil (Incluso si es pago mixto)
                const pmMatch = methodStr.match(/Pago Movil:\s*Bs\s*([0-9.]+)/i) || methodStr.match(/Pago Movil:\s*Bs([0-9.]+)/i);
                if (pmMatch) {
                    expectedPm += parseFloat(pmMatch[1]);
                } else if (methodStr.toUpperCase() === 'PAGO MOVIL') {
                    expectedPm += parseFloat(sale.total_ves);
                }

                // 2. Extrae el número exacto para Punto de Venta
                const puntoMatch = methodStr.match(/Punto de Venta:\s*Bs\s*([0-9.]+)/i) || methodStr.match(/Punto de Venta:\s*Bs([0-9.]+)/i);
                if (puntoMatch) {
                    expectedPunto += parseFloat(puntoMatch[1]);
                } else if (methodStr.toUpperCase() === 'PUNTO DE VENTA') {
                    expectedPunto += parseFloat(sale.total_ves);
                }

                // 3. Extrae el número exacto para Zelle
                const zelleMatch = methodStr.match(/Zelle:\s*Ref\s*([0-9.]+)/i) || methodStr.match(/Zelle:\s*Ref([0-9.]+)/i);
                if (zelleMatch) {
                    expectedZelle += parseFloat(zelleMatch[1]);
                } else if (methodStr.toUpperCase() === 'ZELLE') {
                    expectedZelle += parseFloat(sale.total_usd);
                }
            });
        } else {
            // Fallback de seguridad (En caso de recarga de página donde aún no bajen las ventas)
            expectedPm = sys.pm || 0;
            expectedPunto = sys.punto || 0;
            expectedZelle = sys.zelle || 0;
        }

        // --- UI/UX PREMIUM LAYOUT ---
        await Swal.fire({
            title: '',
            width: window.innerWidth < 768 ? '95%' : '1050px', 
            padding: 0,
            background: '#f8fafc', 
            showCancelButton: true,
            confirmButtonText: '<span class="flex items-center justify-center gap-2 sm:gap-3"><span>🔒</span> <span>CONFIRMAR CIERRE</span></span>',
            cancelButtonText: 'Cancelar Operaci\u00F3n',

            buttonsStyling: false,
            customClass: {
                popup: 'rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100',
                actions: 'p-4 sm:p-6 bg-white border-t border-slate-100 w-full flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end items-center z-10',
                confirmButton: 'w-full sm:w-auto bg-slate-900 text-white hover:bg-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm tracking-wide shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 transform outline-none',
                cancelButton: 'w-full sm:w-auto bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 px-6 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm border border-slate-200 sm:border-transparent hover:border-slate-200 transition-all duration-300 outline-none'
            },

            html: `
                <div class="bg-white px-4 sm:px-10 py-4 sm:py-6 border-b border-slate-100 flex justify-between items-center gap-2 sticky top-0 z-10 shadow-sm">
                    <div class="min-w-0 flex-1">
                        <h2 class="text-xl sm:text-3xl font-black text-slate-800 tracking-tighter text-left truncate">Cierre de Caja</h2>
                        <div class="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap sm:flex-nowrap">
                            <span class="bg-blue-100 text-blue-700 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded uppercase whitespace-nowrap">Turno #${initial.id}</span>
                            <span class="text-slate-400 text-[10px] sm:text-xs font-medium whitespace-nowrap">${new Date().toLocaleDateString('es-VE')}</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-[8px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1 whitespace-nowrap">Tasa Oficial</p>
                        <div class="text-sm sm:text-xl font-black text-emerald-600 bg-emerald-50 px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-emerald-100 shadow-sm inline-block whitespace-nowrap">
                            ${bcvRate.toFixed(2)} Bs
                        </div>
                    </div>
                </div>

                ${totalDonationsRef > 0 ? `
                <div class="mx-4 sm:mx-10 mt-4 sm:mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 rounded-r shadow-sm flex items-start gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2">
                    <div class="text-xl sm:text-2xl shrink-0">🎁</div>
                    <div class="flex-1 text-left min-w-0">
                        <h4 class="font-bold text-yellow-800 uppercase text-[10px] sm:text-xs tracking-widest truncate">Auditor&iacute;a de Donaciones</h4>
                        <p class="text-[10px] sm:text-xs text-yellow-700 mt-1 leading-tight">Salida de mercanc&iacute;a por donaci&oacute;n. Verifica los tickets firmados.</p>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="block text-[8px] sm:text-[10px] font-bold text-yellow-600 uppercase whitespace-nowrap">Total Ref</span>
                        <span class="text-base sm:text-xl font-black text-yellow-800 whitespace-nowrap">$${totalDonationsRef.toFixed(2)}</span>
                    </div>
                </div>
                ` : ''}

                <div class="grid grid-cols-1 md:grid-cols-12 gap-0 min-h-0 sm:min-h-[450px] mt-2 text-left">
                    
                    <div class="md:col-span-7 p-4 sm:p-8 space-y-4 sm:space-y-6 border-b sm:border-b-0 sm:border-r border-slate-100 bg-[#FAFAFA]">
                        <h3 class="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 sm:mb-4 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> Conteo de Efectivo
                        </h3>

                        <div class="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border border-slate-100 group focus-within:ring-4 focus-within:ring-blue-50 transition-all cursor-text relative overflow-hidden" onclick="document.getElementById('inp-bs').focus()">
                            <div class="absolute top-0 right-0 bg-slate-800 text-white text-[8px] sm:text-[9px] font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-bl-lg sm:rounded-bl-xl z-0 whitespace-nowrap">
                                MONEDA NACIONAL
                            </div>
                            
                            <label class="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1 sm:mb-2 truncate pr-20">En Gaveta (Bol&iacute;vares)</label>
                            <div class="flex items-center gap-2 sm:gap-3 relative z-10">
                                <span class="text-2xl sm:text-4xl shrink-0">🇻🇪</span>
                                <div class="flex-1 min-w-0">
                                    <input id="inp-bs" type="number" step="0.01" placeholder="0,00"
                                        class="w-full text-2xl sm:text-4xl font-black text-slate-800 bg-transparent outline-none placeholder-slate-200 tabular-nums">
                                </div>
                            </div>

                            <div class="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-50 flex justify-between items-center">
                                ${isNegativeBs
                    ? `<div class="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 w-full min-w-0">
                                     <span class="truncate">⚠️ Saldo Negativo:</span>
                                     <span class="ml-auto shrink-0 whitespace-nowrap">${formatBs(expectedBs)} Bs</span>
                                   </div>`
                    : `<span class="text-[10px] sm:text-xs text-slate-400 font-medium truncate">El sistema calcula: <b class="text-slate-600 whitespace-nowrap">${formatBs(expectedBs)} Bs</b></span>`
                }
                                
                                ${!isNegativeBs ? `<span id="badge-bs" class="text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 sm:px-2 py-1 rounded transition-all whitespace-nowrap ml-2 shrink-0">Esperando...</span>` : ''}
                            </div>
                            ${isNegativeBs ? `<span id="badge-bs" class="hidden"></span>` : ''} </div>

                        <div class="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 group focus-within:ring-4 focus-within:ring-emerald-50 transition-all cursor-text relative overflow-hidden" onclick="document.getElementById('inp-usd').focus()">
                            <label class="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-1 sm:mb-2 truncate">En Gaveta (Divisas)</label>
                            <div class="flex items-center gap-2 sm:gap-3 relative z-10">
                                <span class="text-2xl sm:text-4xl text-emerald-500 shrink-0">$</span>
                                <div class="flex-1 min-w-0">
                                    <input id="inp-usd" type="number" step="0.01" placeholder="0.00"
                                        class="w-full text-2xl sm:text-4xl font-black text-emerald-600 bg-transparent outline-none placeholder-emerald-100/50 tabular-nums">
                                </div>
                            </div>

                            <div class="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-50 flex justify-between items-center">
                                ${isNegativeUsd
                    ? `<div class="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 w-full min-w-0">
                                     <span class="truncate">⚠️ Saldo Negativo:</span>
                                     <span class="ml-auto shrink-0 whitespace-nowrap">$${formatUSD(expectedUsd)}</span>
                                   </div>`
                    : `<span class="text-[10px] sm:text-xs text-slate-400 font-medium truncate">El sistema calcula: <b class="text-slate-600 whitespace-nowrap">$${formatUSD(expectedUsd)}</b></span>`
                }
                                
                                ${!isNegativeUsd ? `<span id="badge-usd" class="text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 sm:px-2 py-1 rounded transition-all whitespace-nowrap ml-2 shrink-0">Esperando...</span>` : ''}
                            </div>
                            ${isNegativeUsd ? `<span id="badge-usd" class="hidden"></span>` : ''}
                        </div>
                    </div>

                    <div class="md:col-span-5 p-4 sm:p-8 bg-white flex flex-col h-full">
                        <h3 class="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 sm:mb-4 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-purple-50 shrink-0"></span> <span class="truncate">Verificaci&oacute;n Digital</span>
                        </h3>
                        
                        <div class="space-y-2 sm:space-y-3 flex-1">
                            
                            <!-- INPUT: PAGO MÓVIL -->
                            <div class="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white border border-slate-100 shadow-sm group focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                                <div class="flex flex-col min-w-0 pr-2">
                                    <span class="text-[11px] sm:text-xs font-black text-slate-700 truncate uppercase tracking-widest">Pago M&oacute;vil</span>
                                    <span class="text-[9px] sm:text-[10px] text-slate-400 truncate font-bold mt-0.5">Esp: ${formatBs(expectedPm)} Bs</span>
                                </div>
                                <div class="relative">
                                    <input id="inp-pm" type="number" step="0.01" value="${expectedPm > 0 ? parseFloat(expectedPm).toFixed(2) : ''}"
                                        class="w-24 sm:w-32 text-right font-black text-slate-800 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-blue-400 transition-all text-sm sm:text-base shadow-inner" placeholder="0.00">
                                </div>
                            </div>

                            <!-- INPUT: PUNTO DE VENTA -->
                            <div class="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white border border-slate-100 shadow-sm group focus-within:ring-4 focus-within:ring-indigo-50 transition-all mt-3">
                                <div class="flex flex-col min-w-0 pr-2">
                                    <span class="text-[11px] sm:text-xs font-black text-slate-700 truncate uppercase tracking-widest">Punto de Venta</span>
                                    <span class="text-[9px] sm:text-[10px] text-slate-400 truncate font-bold mt-0.5">Esp: ${formatBs(expectedPunto)} Bs</span>
                                </div>
                                <div class="relative">
                                    <input id="inp-punto" type="number" step="0.01" value="${expectedPunto > 0 ? parseFloat(expectedPunto).toFixed(2) : ''}"
                                        class="w-24 sm:w-32 text-right font-black text-slate-800 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-indigo-400 transition-all text-sm sm:text-base shadow-inner" placeholder="0.00">
                                </div>
                            </div>

                            <!-- INPUT: ZELLE -->
                            <div class="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white border border-slate-100 shadow-sm group focus-within:ring-4 focus-within:ring-purple-50 transition-all mt-3">
                                <div class="flex flex-col min-w-0 pr-2">
                                    <span class="text-[11px] sm:text-xs font-black text-purple-600 truncate uppercase tracking-widest">Zelle (Ref)</span>
                                    <span class="text-[9px] sm:text-[10px] text-slate-400 truncate font-bold mt-0.5">Esp: $${formatUSD(expectedZelle)}</span>
                                </div>
                                <div class="relative flex items-center">
                                    <span class="absolute left-3 text-slate-400 font-bold">$</span>
                                    <input id="inp-zelle" type="number" step="0.01" value="${expectedZelle > 0 ? parseFloat(expectedZelle).toFixed(2) : ''}"
                                        class="w-24 sm:w-32 text-right font-black text-purple-700 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 pr-3 pl-6 outline-none focus:bg-white focus:border-purple-400 transition-all text-sm sm:text-base shadow-inner" placeholder="0.00">
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100">
                            <label class="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-2">Observaciones / Incidencias</label>
                            <textarea id="inp-notes" rows="2" class="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-[10px] sm:text-xs font-medium text-slate-600 focus:bg-white focus:ring-2 focus:ring-slate-100 focus:border-slate-300 outline-none resize-none transition-all" placeholder="Escribe aqu&iacute; si hubo devoluciones, billetes rotos o diferencias justificadas..."></textarea>
                        </div>
                    </div>
                </div>
            `,
            didOpen: () => {
                const inpBs = document.getElementById('inp-bs');
                const inpUsd = document.getElementById('inp-usd');
                const badgeBs = document.getElementById('badge-bs');
                const badgeUsd = document.getElementById('badge-usd');

                const auditLive = () => {
                    const valBs = parseFloat(inpBs.value) || 0;
                    const diffBs = valBs - expectedBs;

                    if (badgeBs && !badgeBs.classList.contains('hidden')) {
                        if (inpBs.value === '') {
                            badgeBs.className = 'text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 sm:px-2 py-1 rounded transition-all whitespace-nowrap ml-2 shrink-0';
                            badgeBs.innerText = 'Esperando...';
                        } else if (Math.abs(diffBs) < 1) {
                            badgeBs.className = 'text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-600 px-1.5 sm:px-2 py-1 rounded border border-emerald-200 whitespace-nowrap ml-2 shrink-0';
                            badgeBs.innerHTML = '✨ EXACTO';
                        } else {
                            const color = diffBs > 0 ? 'blue' : 'rose';
                            const sign = diffBs > 0 ? '+' : '';
                            badgeBs.className = `text-[9px] sm:text-[10px] font-bold bg-${color}-50 text-${color}-600 px-1.5 sm:px-2 py-1 rounded border border-${color}-100 whitespace-nowrap ml-2 shrink-0`;
                            badgeBs.innerHTML = `${sign}${formatBs(diffBs)} Bs`;
                        }
                    }

                    const valUsd = parseFloat(inpUsd.value) || 0;
                    const diffUsd = valUsd - expectedUsd;

                    if (badgeUsd && !badgeUsd.classList.contains('hidden')) {
                        if (inpUsd.value === '') {
                            badgeUsd.className = 'text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 sm:px-2 py-1 rounded transition-all whitespace-nowrap ml-2 shrink-0';
                            badgeUsd.innerText = 'Esperando...';
                        } else if (Math.abs(diffUsd) < 0.1) {
                            badgeUsd.className = 'text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-600 px-1.5 sm:px-2 py-1 rounded border border-emerald-200 whitespace-nowrap ml-2 shrink-0';
                            badgeUsd.innerHTML = '✨ EXACTO';
                        } else {
                            const color = diffUsd > 0 ? 'blue' : 'rose';
                            const sign = diffUsd > 0 ? '+' : '';
                            badgeUsd.className = `text-[9px] sm:text-[10px] font-bold bg-${color}-50 text-${color}-600 px-1.5 sm:px-2 py-1 rounded border border-${color}-100 whitespace-nowrap ml-2 shrink-0`;
                            badgeUsd.innerHTML = `${sign}$${formatUSD(diffUsd)}`;
                        }
                    }
                };

                inpBs.addEventListener('input', auditLive);
                inpUsd.addEventListener('input', auditLive);
                setTimeout(() => inpBs.focus(), 150);
            },

            preConfirm: () => {
                return {
                    cash_ves: parseFloat(document.getElementById('inp-bs').value) || 0,
                    cash_usd: parseFloat(document.getElementById('inp-usd').value) || 0,
                    pm: parseFloat(document.getElementById('inp-pm').value) || 0,
                    punto: parseFloat(document.getElementById('inp-punto').value) || 0,
                    zelle: parseFloat(document.getElementById('inp-zelle').value) || 0,
                    notes: document.getElementById('inp-notes').value
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const declared = result.value;

                const finalDiffBs = declared.cash_ves - expectedBs;
                const finalDiffUsd = declared.cash_usd - expectedUsd;
                const isAlarming = Math.abs(finalDiffBs) > 20 || Math.abs(finalDiffUsd) > 1;

                if (isAlarming) {
                    const confirmMistake = await Swal.fire({
                        title: 'Diferencia Detectada',
                        text: 'Los montos ingresados no coinciden con el sistema. \u00BFDeseas continuar de todas formas?',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'S\u00ED, Registrar Faltante/Sobrante',
                        cancelButtonText: 'Recontar',
                        confirmButtonColor: '#f59e0b',
                        cancelButtonColor: '#1e293b'
                    });
                    if (!confirmMistake.isConfirmed) return handleCashClose(); 
                }

                try {
                    Swal.fire({ title: 'Imprimiendo Reporte Z...', html: 'No apague la impresora fiscal.', didOpen: () => Swal.showLoading(), showConfirmButton: false, background: '#fff' });
                    
                    let zReportNumber = null;

                    if (tenantConfig.invoiceMode === 'FISCAL_PRINTER') {
                        try {
                            const zRes = await fetch(`${tenantConfig.fiscalPrinterIP}/imprimirReporteZ`, { method: 'POST' });
                            if (!zRes.ok) throw new Error("Fallo de comunicaci\u00F3n con Spooler");
                            const zData = await zRes.json();
                            zReportNumber = zData.numero_z || zData.z_number || null;
                        } catch (printerErr) {
                            const forceClose = await Swal.fire({
                                title: 'Error de Impresora Fiscal',
                                text: 'No se pudo emitir el Reporte Z f\u00EDsico. \u00BFDeseas forzar el cierre del sistema inform\u00E1tico de todos modos?',
                                icon: 'error',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                confirmButtonText: 'Forzar Cierre en Sistema',
                                cancelButtonText: 'Abortar Cierre'
                            });
                            if (!forceClose.isConfirmed) return; 
                            Swal.fire({ title: 'Forzando Cierre Interno...', didOpen: () => Swal.showLoading(), showConfirmButton: false });
                        }
                    }

                    await CashService.close({ declared: declared, notes: declared.notes, fiscal_z_report: zReportNumber });

                    setCashShift(null); 
                    setIsCashOpen(false);

                    Swal.fire({
                        title: '\u00A1Cierre Exitoso!',
                        html: `<span class="text-slate-500">Turno finalizado. ${zReportNumber ? `<br><br><b>Reporte Z Registrado: #${zReportNumber}</b>` : ''}</span>`,
                        icon: 'success',
                        confirmButtonText: 'Entendido',
                        confirmButtonColor: '#10b981'
                    });

                    if (onShiftClosed) onShiftClosed();
                } catch (error) {
                    console.error(error);
                    Swal.fire('Error', 'No se pudo guardar el cierre en la base de datos.', 'error');
                }
            }
        });
    };
    
    // =========================================================================
    //  FUNCIÓN DE AVANCE (CORRECCIÓN: PRECISIÓN DECIMAL EXACTA)
    // =========================================================================
    const validateAndAddAdvance = async (e) => {
        e.preventDefault();

        // 1. VALIDACIONES INICIALES (UI Logic)
        if (!advanceData.amountBs || parseFloat(advanceData.amountBs) <= 0) {
            return Swal.fire('Error', 'Ingrese un monto válido', 'warning');
        }

        const requestedBs = parseFloat(advanceData.amountBs);

        try {
            Swal.fire({
                title: 'Verificando fondos...',
                didOpen: () => Swal.showLoading(),
                showConfirmButton: false
            });

            // 2. USO DE LA CAPA DE SERVICIOS (Fase 2)
            const res = await CashService.getStatus();
            Swal.close();

            const status = res.data;

            // 3. VALIDACIÓN DE ESTADO DE CAJA
            if (status.status !== 'ABIERTA') {
                return Swal.fire('Caja Cerrada', 'Debe realizar la apertura de caja primero.', 'warning');
            }

            // 4. CÁLCULO DE DISPONIBILIDAD
            const sys = status.system_totals;
            const initial = status.shift_info;
            const cashInBs = parseFloat(initial.initial_cash_ves) + (sys.cash_ves || 0);
            const cashOutBs = sys.cash_outflows_ves || 0;
            const availableBs = cashInBs - cashOutBs;

            if (requestedBs > availableBs) {
                return Swal.fire({
                    icon: 'error',
                    title: '🚫 Fondos Insuficientes',
                    text: `Disponible en caja: Bs ${availableBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
                    confirmButtonColor: '#ef4444'
                });
            }

            // 5. CÁLCULOS DE PRECISIÓN
            const commissionAmount = requestedBs * (parseFloat(advanceData.commission) / 100);
            const totalWithCommission = requestedBs + commissionAmount;

            const totalInUsd = totalWithCommission / bcvRate;
            const capitalInUsd = requestedBs / bcvRate;

            // 6. INTEGRACIÓN AL CARRITO
            addToCart({
                id: `ADV-${Date.now()}`,
                name: `🔴 AVANCE EFECTIVO [CAP:${capitalInUsd.toFixed(4)}] (Entregar: Bs ${formatBs(requestedBs)})`,
                price_usd: totalInUsd,
                price_bs: formatBs(totalWithCommission),
                is_advance: true,
                stock: 999,
                icon_emoji: "💸",
                is_taxable: false,
                quantity: 1,
                category: "Servicios"
            });

            // 7. LIMPIEZA Y ÉXITO
            setIsCashAdvanceOpen(false);
            setAdvanceData({ amountBs: '', commission: 10 });

            Swal.fire({
                icon: 'success',
                title: 'Listo',
                text: `Entregar Bs ${formatBs(requestedBs)} al cliente.`,
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("Error al procesar avance:", error);
            const errorMsg = error.response?.data?.message || error.message;
            Swal.fire('Error', `Fallo técnico: ${errorMsg}`, 'error');
        }
    };

    return {
        cashShift, setCashShift,
        isCashOpen, setIsCashOpen,
        isCashAdvanceOpen, setIsCashAdvanceOpen,
        advanceData, setAdvanceData,
        promptOpenCash,
        handleCashClose,
        validateAndAddAdvance
    };
};