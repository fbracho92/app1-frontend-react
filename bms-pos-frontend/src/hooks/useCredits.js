import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { CreditService, SaleService } from '../api/services';

export const useCredits = ({ bcvRate, onGlobalUpdate }) => {
    // --- ESTADOS PARA MÓDULO CRÉDITO ---
    const [pendingCredits, setPendingCredits] = useState([]);
    const [groupedCredits, setGroupedCredits] = useState([]);
    const [selectedCreditCustomer, setSelectedCreditCustomer] = useState(null); 
    const [customerCreditsDetails, setCustomerCreditsDetails] = useState([]); 
    const [overdueCount, setOverdueCount] = useState(0);
    const [creditSearchQuery, setCreditSearchQuery] = useState('');
    const [filteredCredits, setFilteredCredits] = useState([]);
    const [creditCurrentPage, setCreditCurrentPage] = useState(1);
    const [detailsCurrentPage, setDetailsCurrentPage] = useState(1);

    // Efecto para resetear a la página 1 cada vez que abres un cliente nuevo
    useEffect(() => {
        if (selectedCreditCustomer) {
            setDetailsCurrentPage(1);
        }
    }, [selectedCreditCustomer]);

    // 💡 LÓGICA DE FILTRO PARA CRÉDITOS
    useEffect(() => {
        if (creditSearchQuery) {
            const lower = creditSearchQuery.toLowerCase();
            const results = groupedCredits.filter(c =>
                c.full_name.toLowerCase().includes(lower) ||
                c.id_number.toLowerCase().includes(lower)
            );
            setFilteredCredits(results);
        } else {
            setFilteredCredits(groupedCredits);
        }
        setCreditCurrentPage(1); 
    }, [creditSearchQuery, groupedCredits]);

    // --- FUNCIONES PARA CRÉDITO AGRUPADO ---
    const openCustomerCredits = async (customer) => {
        try {
            Swal.fire({ title: 'Cargando...', didOpen: () => Swal.showLoading() });
            const res = await CreditService.getByCustomer(customer.customer_id);
            setCustomerCreditsDetails(res.data);
            setSelectedCreditCustomer(customer);
            Swal.close();
        } catch (error) {
            Swal.fire('Error', 'No se pudieron cargar los detalles', 'error');
        }
    };

    // =========================================================================
    // 🚀 NUEVO: HELPER DE REACTIVIDAD (Elimina la necesidad de F5)
    // =========================================================================
    const refreshCustomerState = async (customerId) => {
        try {
            // Traemos las facturas frescas
            const res = await CreditService.getByCustomer(customerId);
            
            // Calculamos matemáticamente si aún queda deuda
            const currentRemaining = res.data.reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0);
            
            if (currentRemaining <= 0.005) {
                // ¡Magia! Si el cliente pagó todo, cerramos la vista y lo sacamos al listado principal
                setSelectedCreditCustomer(null);
            } else {
                // Si aún debe, actualizamos la tabla y el número rojo gigante de la cabecera
                setCustomerCreditsDetails(res.data);
                setSelectedCreditCustomer(prev => ({ 
                    ...prev, 
                    remaining_balance: currentRemaining 
                }));
            }

            // Avisamos al sistema global que recargue el directorio de fondo
            if (onGlobalUpdate) onGlobalUpdate();
        } catch (error) {
            console.error("Error refrescando estado del cliente:", error);
        }
    };

    // =========================================================================
    // 🛡️ MODAL 1: ABONAR FACTURA (DISEÑO FINTECH COMPACTO)
    // =========================================================================
    const handlePaymentProcess = async (saleId, totalDebt, currentPaid) => {
        const remaining = totalDebt - currentPaid;
        const currentRate = typeof bcvRate !== 'undefined' ? bcvRate : 0;

        const paymentMethods = [
            { id: 'PAGO_MOVIL', label: 'Pago M&oacute;vil', icon: '&#128241;', style: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' },
            { id: 'PUNTO_VENTA', label: 'Punto Venta', icon: '&#128179;', style: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100' },
            { id: 'EFECTIVO_USD', label: 'Efectivo Ref', icon: '&#128181;', style: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
            { id: 'EFECTIVO_BS', label: 'Efectivo Bs', icon: '&#127483;&#127466;', style: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' },
            { id: 'ZELLE', label: 'Zelle', icon: '&#127482;&#127480;', style: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100' },
            { id: 'TRANSFERENCIA', label: 'Transf.', icon: '&#127974;', style: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' },
        ];

        const { value: formValues } = await Swal.fire({
            title: '', 
            padding: 0,
            width: 380,
            html: `
            <div class="font-sans text-left mt-0 p-5 pb-0 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <span class="text-base font-black text-slate-800 tracking-tight">Factura #${saleId}</span>
                    <span class="text-[9px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md uppercase tracking-widest">Abono Parcial</span>
                </div>
                
                <div class="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-100 mb-5">
                    <div class="flex flex-col">
                        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Total</span>
                        <span class="font-bold text-slate-700 text-xs">Ref ${totalDebt.toFixed(2)}</span>
                    </div>
                    <div class="w-px h-6 bg-slate-200"></div>
                    <div class="flex flex-col">
                        <span class="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mb-0.5">Abonado</span>
                        <span class="font-bold text-emerald-600 text-xs">Ref ${currentPaid.toFixed(2)}</span>
                    </div>
                    <div class="w-px h-6 bg-slate-200"></div>
                    <div class="flex flex-col text-right">
                        <span class="text-[9px] text-rose-500 font-black uppercase tracking-widest mb-0.5">Por Pagar</span>
                        <span class="font-black text-rose-600 text-sm leading-none">Ref ${remaining.toFixed(2)}</span>
                    </div>
                </div>

                <div class="relative mb-5">
                    <div class="flex justify-between items-center mb-1.5">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Monto a abonar</label>
                        <div id="conversion-helper" class="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 transition-all">
                            Bs ${(remaining * currentRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div class="relative group">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-lg">Ref</span>
                        <input id="swal-amount" type="number" step="0.01" 
                            class="w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl font-black text-slate-800 text-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-200 shadow-sm" 
                            value="${remaining.toFixed(2)}" placeholder="0.00">
                        <button type="button" id="btn-max" class="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 text-[9px] font-black text-slate-500 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors uppercase tracking-widest border border-slate-200 outline-none">
                            Max
                        </button>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">M&eacute;todo de Pago</label>
                    <div class="grid grid-cols-3 gap-2">
                        ${paymentMethods.map(m => `
                            <button type="button" class="method-card flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all duration-200 active:scale-95 group outline-none ${m.style}" 
                                data-value="${m.id}"
                                data-active-class="ring-2 ring-offset-1 ring-indigo-500 border-transparent shadow-md">
                                <span class="text-xl filter drop-shadow-sm mb-1 group-hover:scale-110 transition-transform">${m.icon}</span>
                                <span class="text-[8px] font-black uppercase tracking-widest leading-none">${m.label}</span>
                            </button>
                        `).join('')}
                    </div>
                    <input type="hidden" id="swal-method" value="PAGO_MOVIL">
                </div>

                <div class="flex gap-2 mb-4">
                    <input id="swal-ref" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 text-xs focus:outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400" placeholder="Referencia (Opcional)...">
                    
                    <label class="flex items-center justify-center px-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group" title="Generar Factura Fiscal">
                        <input type="checkbox" id="swal-is-fiscal" class="peer sr-only">
                        <span class="text-slate-300 peer-checked:text-blue-600 text-xl transition-colors group-hover:text-blue-400 opacity-50 peer-checked:opacity-100 filter peer-checked:drop-shadow-sm">&#128436;</span>
                    </label>
                </div>
            </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'CONFIRMAR PAGO',
            cancelButtonText: 'CANCELAR',
            reverseButtons: true,
            buttonsStyling: false,
            customClass: {
                popup: 'rounded-[1.5rem] shadow-2xl border border-slate-100 !pb-0 overflow-hidden',
                htmlContainer: '!m-0 !p-0',
                actions: '!w-full !flex !flex-col !m-0 !p-6 bg-slate-50 border-t border-slate-100 gap-3 box-border',
                confirmButton: '!w-full !m-0 !flex !justify-center !items-center bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl py-3.5 text-[11px] md:text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all outline-none',
                cancelButton: '!w-full !m-0 !flex !justify-center !items-center bg-white hover:bg-slate-100 text-slate-400 font-bold rounded-xl py-3.5 text-[11px] md:text-xs uppercase tracking-widest border border-slate-200 active:scale-[0.98] transition-all outline-none'
            },
            didOpen: () => {
                const popup = Swal.getPopup();
                const inputAmount = popup.querySelector('#swal-amount');
                const helper = popup.querySelector('#conversion-helper');
                const methodInput = popup.querySelector('#swal-method');
                const cards = popup.querySelectorAll('.method-card');
                const btnMax = popup.querySelector('#btn-max');

                const updateBs = (val) => {
                    const bsVal = (parseFloat(val) || 0) * currentRate;
                    helper.innerHTML = `Bs ${bsVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                };

                inputAmount.addEventListener('input', (e) => updateBs(e.target.value));

                btnMax.addEventListener('click', () => {
                    inputAmount.value = remaining.toFixed(2);
                    updateBs(remaining);
                    inputAmount.focus();
                    inputAmount.classList.add('ring-2', 'ring-indigo-500/30');
                    setTimeout(() => inputAmount.classList.remove('ring-2', 'ring-indigo-500/30'), 300);
                });

                const selectMethod = (card) => {
                    cards.forEach(c => {
                        c.className = `method-card flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all duration-200 active:scale-95 group outline-none ${paymentMethods.find(m => m.id === c.dataset.value).style}`;
                        c.querySelector('span:first-child').classList.add('grayscale', 'opacity-60');
                        c.querySelector('span:first-child').classList.remove('scale-110');
                    });

                    const activeClasses = card.getAttribute('data-active-class');
                    card.className = `method-card flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all duration-200 active:scale-95 group outline-none ${paymentMethods.find(m => m.id === card.dataset.value).style} ${activeClasses}`;
                    card.querySelector('span:first-child').classList.remove('grayscale', 'opacity-60');
                    card.querySelector('span:first-child').classList.add('scale-110');

                    methodInput.value = card.getAttribute('data-value');
                };

                cards.forEach(card => {
                    card.addEventListener('click', () => selectMethod(card));
                    if (card.querySelector('span:first-child')) card.querySelector('span:first-child').classList.add('grayscale', 'opacity-60');
                    if (card.getAttribute('data-value') === 'PAGO_MOVIL') selectMethod(card);
                });
            },
            preConfirm: () => {
                const amount = document.getElementById('swal-amount').value;
                const method = document.getElementById('swal-method').value;
                const ref = document.getElementById('swal-ref').value;
                const isFiscal = document.getElementById('swal-is-fiscal').checked;

                if (!amount || parseFloat(amount) <= 0) return Swal.showValidationMessage('<span class="text-[10px] font-black uppercase text-rose-500 tracking-widest">Ingrese un monto v&aacute;lido</span>');
                if (parseFloat(amount) > remaining + 0.05) return Swal.showValidationMessage('<span class="text-[10px] font-black uppercase text-rose-500 tracking-widest">El monto excede la deuda</span>');

                if (isFiscal && (!selectedCreditCustomer || !selectedCreditCustomer.id_number)) {
                    return Swal.showValidationMessage('<span class="text-[10px] font-black uppercase text-rose-500 tracking-widest">Se requiere RIF/C&eacute;dula para fiscal</span>');
                }

                return { amount, method, ref, isFiscal };
            }
        });

        if (formValues) {
            try {
                Swal.fire({ title: 'Procesando...', html: '<p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Registrando pago en servidor</p>', didOpen: () => Swal.showLoading(), customClass: {popup: 'rounded-[1.5rem] p-6'} });

                const paymentDetails = `${formValues.method}${formValues.ref ? ` [Ref: ${formValues.ref}]` : ''}`;

                await SaleService.payCredit(saleId, {
                    paymentDetails,
                    amountUSD: formValues.amount,
                    invoice_type: formValues.isFiscal ? 'FISCAL' : 'TICKET'
                });

                await Swal.fire({
                    icon: 'success',
                    title: '&#161;Abono Exitoso!',
                    html: `<span class="text-sm font-medium text-slate-600">Se han abonado <b class="text-emerald-600 font-black">Ref ${formValues.amount}</b> correctamente.</span>`,
                    confirmButtonColor: '#10B981',
                    customClass: { popup: 'rounded-[1.5rem] p-6', confirmButton: 'rounded-xl font-black uppercase tracking-widest text-xs px-8 py-3 outline-none' }
                });

                // 🚀 ACTUALIZACIÓN INVISIBLE (REACTIVIDAD)
                if (selectedCreditCustomer) {
                    await refreshCustomerState(selectedCreditCustomer.customer_id);
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'Error en el proceso', customClass: {popup: 'rounded-[1.5rem] p-6'} });
            }
        }
    };

    // =========================================================================
    // 🛡️ MODAL 2: SALDAR TOTALIDAD O ABONO GLOBAL (DISEÑO DE ALTO IMPACTO)
    // =========================================================================
    const handlePayAll = async (customer) => {
        const totalDebt = parseFloat(customer.remaining_balance);
        const currentRate = typeof bcvRate !== 'undefined' ? bcvRate : 0;

        if (totalDebt <= 0) return Swal.fire({ icon: 'success', title: 'Solvente', text: 'El cliente no tiene deuda pendiente.', customClass: {popup: 'rounded-[1.5rem]'} });

        const paymentMethods = [
            { id: 'PAGO_MOVIL', label: 'Pago M&oacute;vil', icon: '&#128241;' },
            { id: 'PUNTO_VENTA', label: 'Punto Venta', icon: '&#128179;' },
            { id: 'EFECTIVO_USD', label: 'Efectivo Ref', icon: '&#128181;' },
            { id: 'EFECTIVO_BS', label: 'Efectivo Bs', icon: '&#127483;&#127466;' },
            { id: 'ZELLE', label: 'Zelle', icon: '&#127482;&#127480;' },
            { id: 'TRANSFERENCIA', label: 'Transf.', icon: '&#127974;' },
        ];

        const { value: formValues } = await Swal.fire({
            title: '', 
            padding: 0, 
            width: 380, 
            html: `
                <div class="font-sans text-left overflow-hidden rounded-t-[1.5rem]">
                    <div class="bg-gradient-to-br from-rose-600 to-rose-700 p-6 text-white relative shadow-md">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div class="relative z-10 flex justify-between items-end">
                            <div class="flex-1 pr-4">
                                <h3 class="text-[10px] font-black text-rose-200 uppercase tracking-widest mb-1 opacity-90">Monto a Abonar</h3>
                                <div class="relative mt-1">
                                    <span class="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-medium text-rose-200">Ref</span>
                                    <input id="swal-payall-amount" type="number" step="0.01" value="${totalDebt.toFixed(2)}"
                                        class="w-full pl-10 bg-transparent border-b-2 border-white/30 focus:border-white text-4xl font-black tracking-tight text-white placeholder-rose-300/50 outline-none transition-all" >
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <div class="bg-black/20 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl shadow-inner">
                                    <p class="text-[8px] text-rose-200 font-black uppercase tracking-widest mb-0.5">Deuda Total</p>
                                    <p class="text-xs font-black text-white leading-none">Ref ${totalDebt.toFixed(2)}</p>
                                    <p id="conversion-helper" class="text-[8px] font-bold text-rose-300 mt-1 uppercase tracking-widest">
                                        Bs ${(totalDebt * currentRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="p-6 bg-white space-y-5">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">M&eacute;todo Principal</label>
                            <div class="grid grid-cols-3 gap-2">
                                ${paymentMethods.map(m => `
                                    <button type="button" class="pay-all-method relative group flex flex-col items-center justify-center py-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-rose-200 transition-all duration-200 outline-none" 
                                        data-value="${m.id}">
                                        <div class="absolute inset-0 bg-rose-50/50 rounded-xl opacity-0 transition-opacity duration-200 group-[.selected]:opacity-100 pointer-events-none"></div>
                                        <span class="relative z-10 text-xl mb-1 filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-[.selected]:grayscale-0 group-[.selected]:opacity-100 transition-all scale-90 group-[.selected]:scale-110 duration-200">${m.icon}</span>
                                        <span class="relative z-10 text-[8px] font-black text-slate-400 group-hover:text-rose-500 group-[.selected]:text-rose-600 uppercase tracking-widest leading-none">${m.label}</span>
                                    </button>
                                `).join('')}
                            </div>
                            <input type="hidden" id="swal-payall-method" value="PAGO_MOVIL">
                        </div>
                        <div class="relative group mb-1">
                            <input id="swal-payall-ref" 
                                class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400 shadow-sm" 
                                placeholder="Referencia bancaria o nota...">
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'PROCESAR ABONO',
            cancelButtonText: 'CANCELAR',
            focusConfirm: false,
            buttonsStyling: false,
            customClass: {
                popup: 'rounded-[1.5rem] shadow-2xl border border-slate-100 !pb-0 overflow-hidden',
                htmlContainer: '!m-0 !p-0',
                actions: '!w-full !flex !flex-col !m-0 !p-6 bg-slate-50 border-t border-slate-100 gap-3 box-border',
                confirmButton: '!w-full !m-0 !flex !justify-center !items-center bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 font-black py-3.5 rounded-xl text-[11px] md:text-xs uppercase tracking-widest active:scale-[0.98] transition-all outline-none',
                cancelButton: '!w-full !m-0 !flex !justify-center !items-center bg-white hover:bg-slate-100 text-slate-400 border border-slate-200 font-bold py-3.5 rounded-xl text-[11px] md:text-xs uppercase tracking-widest hover:text-slate-600 active:scale-[0.98] transition-all outline-none'
            },
            didOpen: () => {
                const popup = Swal.getPopup();
                const methodInput = popup.querySelector('#swal-payall-method');
                const cards = popup.querySelectorAll('.pay-all-method');
                const inputAmount = popup.querySelector('#swal-payall-amount');
                const helper = popup.querySelector('#conversion-helper');

                inputAmount.addEventListener('input', (e) => {
                    const bsVal = (parseFloat(e.target.value) || 0) * currentRate;
                    helper.innerHTML = `Bs ${bsVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                });

                const selectMethod = (card) => {
                    cards.forEach(c => c.classList.remove('selected', 'ring-2', 'ring-rose-500', 'border-transparent', 'shadow-md'));
                    card.classList.add('selected', 'ring-2', 'ring-rose-500', 'border-transparent', 'shadow-md');
                    card.animate([{ transform: 'scale(0.97)' }, { transform: 'scale(1)' }], { duration: 150 });
                    methodInput.value = card.dataset.value;
                };

                cards.forEach(card => card.addEventListener('click', () => selectMethod(card)));
                if (cards[0]) selectMethod(cards[0]);
            },
            preConfirm: () => {
                const amount = document.getElementById('swal-payall-amount').value;
                if (!amount || parseFloat(amount) <= 0 || parseFloat(amount) > totalDebt + 0.05) {
                    Swal.showValidationMessage('<span class="text-[10px] font-black uppercase text-rose-500 tracking-widest">Ingrese un monto v&aacute;lido</span>');
                    return false;
                }
                return {
                    amount: amount,
                    method: document.getElementById('swal-payall-method').value,
                    ref: document.getElementById('swal-payall-ref').value
                };
            }
        });

        if (formValues) {
            try {
                Swal.fire({
                    title: '',
                    html: '<div class="mt-4 mb-2"><div class="text-rose-600 font-black text-xs uppercase tracking-widest animate-pulse">Distribuyendo Abono...</div></div>',
                    width: 300,
                    padding: '2rem',
                    showConfirmButton: false,
                    didOpen: () => Swal.showLoading(),
                    customClass: { popup: 'rounded-[1.5rem]' }
                });

                const paymentDetails = `${formValues.method} ${formValues.ref ? `[Ref: ${formValues.ref}]` : ''}`;

                await CreditService.payAll(customer.customer_id, {
                    payment_details: paymentDetails,
                    amountUSD: formValues.amount
                });

                await Swal.fire({
                    icon: 'success',
                    title: '&#161;Abono Exitoso!',
                    html: `<span class="text-sm font-medium text-slate-600">Se proces&oacute; el pago de <b class="text-emerald-600 font-black">Ref ${formValues.amount}</b>.</span>`,
                    confirmButtonColor: '#e11d48',
                    confirmButtonText: 'ENTENDIDO',
                    customClass: { popup: 'rounded-[1.5rem]', confirmButton: 'rounded-xl font-black text-xs uppercase tracking-widest px-8 py-3 outline-none' }
                });

                // 🚀 ACTUALIZACIÓN INVISIBLE (REACTIVIDAD)
                await refreshCustomerState(customer.customer_id);

            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.response?.data?.error || 'Fall\u00f3 el proceso.',
                    confirmButtonColor: '#334155',
                    customClass: { popup: 'rounded-[1.5rem]' }
                });
            }
        }
    };

    // --- Funciones Adicionales Intactas ---
    const markAsPaid = async (saleId) => {
        let paymentMethod = '';
        let paymentReference = '';

        const { value: formValues } = await Swal.fire({
            title: 'Saldar Cuenta',
            html:
                '<h4 class="text-sm font-bold text-slate-600 mb-4 uppercase tracking-widest">Confirmar M&eacute;todo</h4>' +
                '<select id="swal-payment-method" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-sm font-bold text-slate-700 outline-none">' +
                '<option value="EFECTIVO_USD">Efectivo Ref</option>' +
                '<option value="ZELLE">Zelle</option>' +
                '<option value="PAGO_MOVIL">Pago M&oacute;vil (Bs)</option>' +
                '<option value="PUNTO_VENTA">Punto de Venta (Bs)</option>' +
                '<option value="TRANSFERENCIA">Transferencia (Bs)</option>' +
                '</select>' +
                '<input id="swal-payment-ref" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 outline-none" placeholder="Referencia bancaria...">',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'SALDAR',
            cancelButtonText: 'CANCELAR',
            confirmButtonColor: '#4f46e5',
            customClass: { popup: 'rounded-[1.5rem] p-6', confirmButton: 'rounded-xl font-black text-xs px-6 py-2.5', cancelButton: 'rounded-xl font-bold text-xs px-6 py-2.5' },
            preConfirm: () => {
                paymentMethod = document.getElementById('swal-payment-method').value;
                paymentReference = document.getElementById('swal-payment-ref').value;

                if (!paymentMethod) {
                    Swal.showValidationMessage('Debe seleccionar un m&eacute;todo');
                    return false;
                }
                if (paymentMethod !== 'EFECTIVO_USD' && !paymentReference.trim()) {
                    Swal.showValidationMessage('La referencia es obligatoria');
                    return false;
                }
                return { paymentMethod, paymentReference };
            }
        });

        if (formValues) {
            try {
                const paymentDetails = `${formValues.paymentMethod}${formValues.paymentReference ? ` [Ref: ${formValues.paymentReference}]` : ''}`;
                await SaleService.payCredit(saleId, { paymentDetails });

                Swal.fire({icon: 'success', title: '&#161;Saldado!', text: 'M\u00e9todo registrado.', customClass: {popup: 'rounded-[1.5rem]'}});
                
                // 🚀 ACTUALIZACIÓN INVISIBLE (REACTIVIDAD)
                if (selectedCreditCustomer) {
                    await refreshCustomerState(selectedCreditCustomer.customer_id);
                } else if (onGlobalUpdate) {
                    onGlobalUpdate();
                }
            } catch (error) {
                Swal.fire({icon: 'error', title: 'Error', text: 'No se pudo saldar el cr\u00e9dito.', customClass: {popup: 'rounded-[1.5rem]'}});
            }
        }
    };

    return {
        pendingCredits, setPendingCredits,
        groupedCredits, setGroupedCredits,
        selectedCreditCustomer, setSelectedCreditCustomer,
        customerCreditsDetails, setCustomerCreditsDetails,
        overdueCount, setOverdueCount,
        creditSearchQuery, setCreditSearchQuery,
        filteredCredits, setFilteredCredits,
        creditCurrentPage, setCreditCurrentPage,
        detailsCurrentPage, setDetailsCurrentPage,
        openCustomerCredits, handlePaymentProcess, handlePayAll, markAsPaid
    };
};