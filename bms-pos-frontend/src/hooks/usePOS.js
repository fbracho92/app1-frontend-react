// src/hooks/usePOS.js
import { useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { SaleService, CustomerService, HeldOrderService } from '../api/services'; 
import { capitalizeWords, validateIdNumber, validatePhone, debounce } from '../utils/formatters';
import { IVA_RATE } from '../constants/appConstants';
import { tenantConfig } from '../config/tenantConfig';
import { buildFiscalPayload } from '../utils/fiscalFormatters';

export const usePOS = ({ bcvRate, onRequireCashOpen, onGlobalUpdate, generateReceiptHTML, cashShift }) => {
    // --- ESTADOS ORIGINALES PRESERVADOS ---
    const [cart, setCart] = useState([]);
    const [isFiscalInvoice, setIsFiscalInvoice] = useState(false);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [showSaleDetailModal, setShowSaleDetailModal] = useState(false);
    const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

    // --- ESTADOS DE PAGO Y CLIENTE ---
    const [paymentShares, setPaymentShares] = useState({});
    const [isNumpadOpen, setIsNumpadOpen] = useState(false);
    const [currentMethod, setCurrentMethod] = useState('');
    const [currentInputValue, setCurrentInputValue] = useState('');
    const [paymentReferences, setPaymentReferences] = useState({});
    const [currentReference, setCurrentReference] = useState('');
    const [dueDays, setDueDays] = useState(15);
    const [customerData, setCustomerData] = useState({ full_name: '', id_number: '', phone: '', institution: '' });

    // --- NUEVAS ADAPTACIONES (INTEGRADAS) ---
    const [globalDiscount, setGlobalDiscount] = useState({ type: 'NONE', value: 0 });
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [customerSearchResults, setCustomerSearchResults] = useState([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [posSearchQuery, setPosSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    // ?? ESTADO NUEVO PARA AUDITORÍA DE VUELTOS (Fase 2)
    const [pendingChangeNote, setPendingChangeNote] = useState('');

    // --- ESTADOS DEL MODULO DE DELIVERY (PRESERVADOS) ---
    const [isDelivery, setIsDelivery] = useState(false);
    const [deliveryInfo, setDeliveryInfo] = useState({
        driver_id: '',
        driver_name: '',
        address: '',
        status: 'PENDIENTE' 
    });

    const paymentMethods = [
        { name: 'Efectivo Ref', currency: 'Ref' },
        { name: 'Efectivo Bs', currency: 'Bs' },
        { name: 'Zelle', currency: 'Ref' },
        { name: 'Donacion', currency: 'Ref' }, 
        { name: 'Credito', currency: 'Ref' },
        { name: 'Pago Movil', currency: 'Bs' },
        { name: 'Punto de Venta', currency: 'Bs' },
    ];

    const methodsRequiringReference = ['Pago Movil', 'Punto de Venta', 'Zelle'];

    // --- LOGICA DE CARRITO (BLINDAJE FASE 2 INTEGRADO) ---
    const addToCart = useCallback((product) => {
        const existing = cart.find((item) => item.id === product.id);
        const qty = existing ? existing.quantity : 0;

        // Se ignora el stock si es un servicio (ej. Delivery)
        if (!product.is_service && (qty + 1 > product.stock)) {
            Swal.fire({
                icon: 'info',
                title: 'Sin disponibilidad',
                text: `No hay mas unidades de ${product.name} en inventario.`,
                confirmButtonColor: '#2563EB',
                customClass: { popup: 'rounded-[2rem]' }
            });
            return;
        }
        
        setCart(prev => {
            const prevExisting = prev.find(i => i?.id === product.id); // Busca en el estado real
            if (prevExisting) {
            return prev.map(i => (i?.id === product.id) ? { ...i, quantity: i.quantity + 1 } : i);
        }
    return [...prev, { ...product, quantity: 1, is_taxable: product.is_taxable }];
});
    }, [cart]); 

    const removeFromCart = (id) => {
    setCart(prev => {
        const existing = prev.find(i => i?.id === id);
        
        if (!existing) return prev; // ??? BLINDAJE: Si ya no existe, aborta silenciosamente
        
        if (existing.quantity > 1) {
            return prev.map(i => (i?.id === id) ? { ...i, quantity: i.quantity - 1 } : i);
        }
        return prev.filter(i => i?.id !== id);
    });
};

    // --- LOGICA DE CALCULOS (CON DESCUENTO GLOBAL INTEGRADO) ---
    const calculateTotals = () => {
        let rawSubtotalTaxableUSD = 0;
        let rawSubtotalExemptUSD = 0;

        cart.forEach(item => {
    if (!item) return; // ??? BLINDAJE: Si el ítem no existe en la memoria, lo ignora y no crashea
    
    const itemTotalBase = parseFloat(item.price_usd || 0) * (item.quantity || 0);
    
    if (item.is_taxable) {
        rawSubtotalTaxableUSD += itemTotalBase;
    } else {
        rawSubtotalExemptUSD += itemTotalBase;
    }
});

        const rawTotal = rawSubtotalTaxableUSD + rawSubtotalExemptUSD;

        let discountUSD = 0;
        if (globalDiscount.type === 'PERCENTAGE' && globalDiscount.value > 0) {
            discountUSD = rawTotal * (globalDiscount.value / 100);
        } else if (globalDiscount.type === 'FIXED' && globalDiscount.value > 0) {
            discountUSD = globalDiscount.value;
        }

        if (discountUSD > rawTotal) discountUSD = rawTotal;

        const proportionTaxable = rawTotal > 0 ? rawSubtotalTaxableUSD / rawTotal : 0;
        const proportionExempt = rawTotal > 0 ? rawSubtotalExemptUSD / rawTotal : 0;

        const subtotalTaxableUSD = rawSubtotalTaxableUSD - (discountUSD * proportionTaxable);
        const subtotalExemptUSD = rawSubtotalExemptUSD - (discountUSD * proportionExempt);

        const ivaUSD = subtotalTaxableUSD * IVA_RATE;
        const finalTotalUSD = subtotalTaxableUSD + subtotalExemptUSD + ivaUSD;
        const totalVES = finalTotalUSD * bcvRate;

        return { subtotalTaxableUSD, subtotalExemptUSD, ivaUSD, finalTotalUSD, totalVES, discountUSD };
    };

    const { subtotalTaxableUSD, subtotalExemptUSD, ivaUSD, finalTotalUSD, totalVES, discountUSD } = calculateTotals();

    const handleApplyDiscount = (type, value) => {
        setGlobalDiscount({ type, value: parseFloat(value) || 0 });
        setPaymentShares({});
        setCurrentInputValue('');
        setCurrentReference('');
    };

    const updatePaymentShare = useCallback((method, value) => {
        setPaymentShares(prev => ({ ...prev, [method]: value }));
    }, []);

    const handleOpenPayment = () => {
        if (bcvRate <= 0) return Swal.fire('Aviso', 'Espere a que el sistema sincronice la tasa BCV.', 'warning');
        if (onRequireCashOpen && !onRequireCashOpen()) return; 
        if (cart.length === 0) return Swal.fire({title: 'Carrito Vacio', text: 'Agrega productos a la orden.', icon: 'info', customClass: {popup: 'rounded-2xl'}});

        setPaymentShares({});
        setPaymentReferences({});
        setCurrentReference('');
        setCustomerSearchResults([]);
        //setCustomerData({ full_name: '', id_number: '', phone: '', institution: '' });
        setIsPaymentModalOpen(true);
    };

    // --- CALCULO DE PAGOS E IGTF (PRESERVADO) ---
    const calculatePaymentTotals = () => {
        let paidUSD = 0;
        let igtfGeneratedUSD = 0; 

        Object.entries(paymentShares).forEach(([method, amountStr]) => {
            const amount = parseFloat(amountStr) || 0;
            const methodData = paymentMethods.find(m => m.name === method);

            if (methodData && methodData.currency === 'Ref') {
                if (tenantConfig.isSpecialTaxpayer && !method.toUpperCase().includes('CREDITO') && !method.toUpperCase().includes('DONACION')) {
                    const igtfPortion = amount * (tenantConfig.igtfRate / (1 + tenantConfig.igtfRate)); 
                    igtfGeneratedUSD += igtfPortion;
                    paidUSD += (amount - igtfPortion); 
                } else {
                    paidUSD += amount;
                }
            } else {
                paidUSD += (amount / bcvRate);
            }
        });
        
        const targetTotalUSD = finalTotalUSD + igtfGeneratedUSD;
        const remainingUSD = finalTotalUSD - paidUSD; 
        return { paidUSD, remainingUSD, igtfGeneratedUSD, targetTotalUSD };
    };

    const { remainingUSD, igtfGeneratedUSD, targetTotalUSD } = calculatePaymentTotals();
    const isInsufficient = remainingUSD > 0.05;
    const remainingVES = remainingUSD * bcvRate;

    // --- LOGICA DE CLIENTES (INTEGRADA) ---
    const calculateRemainingAmount = (targetMethod) => {
        let paidByOthersUSD = 0;
        Object.entries(paymentShares).forEach(([method, amountStr]) => {
            if (method === targetMethod) return;
            const amount = parseFloat(amountStr) || 0;
            const methodData = paymentMethods.find(m => m.name === method);
            if (methodData && methodData.currency === 'Ref') {
                 if (tenantConfig.isSpecialTaxpayer && !method.toUpperCase().includes('CREDITO') && !method.toUpperCase().includes('DONACION')) {
                    const igtfPortion = amount * (tenantConfig.igtfRate / (1 + tenantConfig.igtfRate)); 
                    paidByOthersUSD += (amount - igtfPortion);
                } else {
                    paidByOthersUSD += amount;
                }
            } else {
                paidByOthersUSD += (amount / bcvRate);
            }
        });

        let remainingToCoverUSD = finalTotalUSD - paidByOthersUSD;
        if (remainingToCoverUSD < 0) remainingToCoverUSD = 0;

        const methodData = paymentMethods.find(m => m.name === targetMethod);
        if (methodData.currency === 'Ref') {
             if (tenantConfig.isSpecialTaxpayer && !targetMethod.toUpperCase().includes('CREDITO') && !targetMethod.toUpperCase().includes('DONACION')) {
                 return (remainingToCoverUSD + (remainingToCoverUSD * tenantConfig.igtfRate)).toFixed(2);
             }
             return remainingToCoverUSD.toFixed(2);
        } else {
            return (remainingToCoverUSD * bcvRate).toFixed(2);
        }
    };

    const handlePayRemaining = () => {
        const remainingAmount = calculateRemainingAmount(currentMethod);
        const finalValue = parseFloat(currentInputValue) > 0 ? parseFloat(currentInputValue) : parseFloat(remainingAmount);
        const reference = currentReference.trim();

        if (methodsRequiringReference.includes(currentMethod) && finalValue > 0 && !reference) {
            Swal.fire({title: 'Referencia Requerida', text: 'Ingrese la referencia para registrar el pago.', icon: 'warning', customClass: {popup: 'rounded-2xl'}});
            return;
        }

        updatePaymentShare(currentMethod, finalValue);
        setPaymentReferences(prev => ({ ...prev, [currentMethod]: reference }));
        setIsNumpadOpen(false);
        setCurrentInputValue('');
        setCurrentReference('');
    };

    const handleExactPayment = (method) => {
        const remainingAmount = calculateRemainingAmount(method);
        updatePaymentShare(method, remainingAmount);
        if (methodsRequiringReference.includes(method)) {
            setPaymentReferences(prev => ({ ...prev, [method]: 'REF-RAPIDA' }));
        }
    }

    const searchCustomers = async (query) => {
        if (query.length < 3) return setCustomerSearchResults([]);
        setIsSearchingCustomer(true);
        try {
            const res = await CustomerService.search(query);
            setCustomerSearchResults(res.data);
        } catch (error) { setCustomerSearchResults([]); }
        finally { setIsSearchingCustomer(false); }
    };

    const selectCustomer = (customer) => {
        setCustomerData({ full_name: customer.full_name, id_number: customer.id_number, phone: customer.phone || '', institution: customer.institution || '' });
        setSelectedCustomerId(customer.id);
        setCustomerSearchResults([]);
    };

    const debouncedSearch = useCallback(debounce((query) => searchCustomers(query), 300), []);

    const handleClear = () => {
        setCustomerData({ full_name: '', id_number: '', phone: '', institution: '' });
        setSelectedCustomerId(null);
        setCustomerSearchResults([]);
    };

    const handleNameChange = (e) => {
        const value = capitalizeWords(e.target.value);
        setCustomerData(prev => ({ ...prev, full_name: value }));
        if (value.length > 2) debouncedSearch(value); else setCustomerSearchResults([]);
        setSelectedCustomerId(null);
    };

    const handleIdChange = (e) => {
        const value = validateIdNumber(e.target.value);
        setCustomerData(prev => ({ ...prev, id_number: value }));
    };

    const handleListSelect = (customer) => selectCustomer(customer);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;
        if (name === 'phone') newValue = validatePhone(value);
        if (name === 'institution') newValue = capitalizeWords(value);
        setCustomerData(prev => ({ ...prev, [name]: newValue }));
    };

    // --- PROCESO DE VENTA (INTEGRACION QUIRURGICA Y BLINDADA 200%) ---
    const processSale = async (isCreditFlow = false, inlineChangeNote = '') => {
        const activeMethods = Object.keys(paymentShares).filter(k => (parseFloat(paymentShares[k]) || 0) > 0);
        let currentMethodName = activeMethods.length === 1 ? activeMethods[0].toUpperCase() : activeMethods.length > 1 ? 'MIXTO' : '';

        const isDonationSale = currentMethodName.includes('DONACI') || (isCreditFlow && (parseFloat(paymentShares['Donacion']) || 0) > 0);
        const isCreditSale = isCreditFlow && (parseFloat(paymentShares['Credito']) || 0) > 0;

        // 1. Validaciones de pago incompleto
        if (!isCreditSale && !isDonationSale) {
            let totalPaidCalculated = 0;
            Object.keys(paymentShares).forEach(key => {
                const amount = parseFloat(paymentShares[key]) || 0;
                if (amount > 0) {
                    const methodInfo = paymentMethods.find(m => m.name === key);
                    totalPaidCalculated += (methodInfo?.currency === 'Ref') ? amount : (amount / bcvRate);
                }
            });

            if (Math.abs(totalPaidCalculated - targetTotalUSD) > 0.10 && totalPaidCalculated < targetTotalUSD) {
                return Swal.fire({
                    icon: 'warning', title: 'Pago Incompleto',
                    text: `Monto ingresado: $${totalPaidCalculated.toFixed(2)}. Faltan: $${(targetTotalUSD - totalPaidCalculated).toFixed(2)}.`,
                    confirmButtonText: 'Corregir',
                    customClass: { popup: 'rounded-2xl', confirmButton: 'bg-blue-600 rounded-lg px-4 py-2 text-white font-medium' },
                    buttonsStyling: false
                });
            }
        }

        let payloadCustomerData = { ...customerData };
        const isFiscalPrinterMode = tenantConfig.invoiceMode === 'FISCAL_PRINTER';
        const isFormaLibreMode = tenantConfig.invoiceMode === 'FORMA_LIBRE';

        // =========================================================================
        // BLINDAJE UX 200% - LÓGICA DE CLIENTES Y FACTURACIÓN (CUMPLIMIENTO SENIAT)
        // =========================================================================
        
        if (!payloadCustomerData.full_name || !payloadCustomerData.id_number) {
            
            // CASO A: FORMA LIBRE (SENIAT EXIGE DATOS OBLIGATORIOS)
            if (isFiscalInvoice && isFormaLibreMode && !isCreditSale && !isDonationSale && !isDelivery) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Datos Requeridos (SENIAT)',
                    html: '<p class="text-sm text-slate-600 mt-2">Por normativas, la <b>Forma Libre</b> exige obligatoriamente registrar la C&eacute;dula/RIF y Nombre del cliente para generar el correlativo.</p>',
                    confirmButtonText: 'Ingresar Datos',
                    customClass: { popup: 'rounded-2xl', confirmButton: 'bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all' },
                    buttonsStyling: false
                }).then(() => {
                    setIsPaymentModalOpen(false);
                    setIsCustomerModalOpen(true);
                });
            }

            // CASO B: IMPRESORA FISCAL (Permite Consumidor Final internamente)
            if (isFiscalInvoice && isFiscalPrinterMode && !isCreditSale && !isDonationSale && !isDelivery) {
                const result = await Swal.fire({
                    title: '¿Cliente Gen&eacute;rico?',
                    html: '<p class="text-sm text-slate-600">No ha ingresado los datos. ¿Desea facturar a nombre de <b>CONSUMIDOR FINAL</b> en la m&aacute;quina fiscal?</p>',
                    showCancelButton: true, showDenyButton: true, confirmButtonText: 'S&iacute;, Facturar', denyButtonText: 'Ingresar Datos', cancelButtonText: 'Cancelar',
                    customClass: { 
                        popup: 'rounded-2xl p-4', 
                        actions: 'flex gap-2 w-full mt-4', 
                        confirmButton: 'flex-1 bg-slate-800 text-white rounded-xl py-2.5 font-bold transition-colors hover:bg-slate-900 shadow-md', 
                        denyButton: 'flex-1 bg-blue-50 text-blue-600 rounded-xl py-2.5 font-bold border border-blue-200 transition-colors hover:bg-blue-100', 
                        cancelButton: 'flex-1 bg-slate-100 text-slate-400 rounded-xl py-2.5 font-bold transition-colors hover:bg-slate-200' 
                    },
                    buttonsStyling: false
                });

                if (result.isConfirmed) {
                    payloadCustomerData = { full_name: 'CONSUMIDOR FINAL', id_number: 'V000000000', institution: 'S/D' };
                } else if (result.isDenied) { 
                    setIsPaymentModalOpen(false); setIsCustomerModalOpen(true); return; 
                } else { return; }
            }

            // CASO C: NOTA DE ENTREGA / TICKET INTERNO (No es fiscal, uso interno)
            if (!isFiscalInvoice && !isCreditSale && !isDonationSale && !isDelivery) {
                const result = await Swal.fire({
                    title: '', 
                    html: `
                        <div class="text-left mt-1 font-sans select-none">
                            <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 border border-indigo-100 shadow-inner">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                            <h3 class="text-2xl font-black text-slate-800 tracking-tight">Nota de Entrega</h3>
                            <p class="text-sm text-slate-500 mt-2 leading-relaxed font-medium">
                                Operaci&oacute;n interna <b>no fiscal</b>. &iquest;C&oacute;mo deseas registrar la informaci&oacute;n del cliente para este ticket?
                            </p>
                            
                            <div class="flex flex-col gap-3 mt-6">
                                <!-- ? BOTÓN GIGANTE 1: VENTA RÁPIDA (CON ID EN VEZ DE ONCLICK) -->
                                <button id="btn-venta-rapida" class="w-full text-left bg-white hover:bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 hover:border-slate-400 transition-all duration-300 active:scale-95 group shadow-sm hover:shadow-md outline-none flex items-center gap-4">
                                    <div class="bg-slate-100 group-hover:bg-white border border-slate-200 rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-sm transition-colors">
                                        <span class="text-xl">&#9889;</span>
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="text-sm font-black text-slate-700 uppercase tracking-widest group-hover:text-slate-900">Venta R&aacute;pida</span>
                                        <span class="text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">Cliente Casual. Ideal para agilizar la cola en caja.</span>
                                    </div>
                                </button>
                                
                                <!-- ?? BOTÓN GIGANTE 2: BUSCAR CLIENTE (CON ID EN VEZ DE ONCLICK) -->
                                <button id="btn-buscar-cliente" class="w-full text-left bg-blue-50/50 hover:bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 active:scale-95 group shadow-sm hover:shadow-md outline-none flex items-center gap-4">
                                    <div class="bg-white border border-blue-200 rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-sm">
                                        <span class="text-xl">&#128269;</span>
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="text-sm font-black text-blue-800 uppercase tracking-widest group-hover:text-blue-900">Buscar / Registrar</span>
                                        <span class="text-[11px] text-blue-600 mt-0.5 font-medium leading-tight">Asocia la venta al historial de un cliente espec&iacute;fico.</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    `,
                    showCancelButton: true, 
                    showConfirmButton: false, 
                    showDenyButton: false,    
                    showCloseButton: true,
                    cancelButtonText: 'Cancelar',
                    customClass: { 
                        popup: 'rounded-[2rem] p-6 shadow-2xl border border-slate-100 animate-scale-up', 
                        htmlContainer: '!m-0', 
                        actions: 'flex justify-center w-full mt-4 px-1', 
                        cancelButton: 'w-full sm:w-auto bg-transparent text-slate-400 hover:text-slate-600 rounded-xl py-3 px-4 text-sm font-bold transition-all underline decoration-slate-300 underline-offset-4 active:scale-95 outline-none',
                        closeButton: 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all focus:outline-none'
                    },
                    buttonsStyling: false,
                    allowOutsideClick: false,
                    // ?? LA MAGIA: Escuchamos los clics de forma segura una vez que el modal se renderiza
                    didOpen: () => {
                        const btnRapida = document.getElementById('btn-venta-rapida');
                        const btnBuscar = document.getElementById('btn-buscar-cliente');
                        
                        if (btnRapida) {
                            btnRapida.addEventListener('click', () => Swal.clickConfirm());
                        }
                        if (btnBuscar) {
                            btnBuscar.addEventListener('click', () => Swal.clickDeny());
                        }
                    }
                });

                if (result.isConfirmed) {
                    payloadCustomerData = { full_name: 'CLIENTE CASUAL', id_number: 'S/I', institution: 'S/D' };
                } else if (result.isDenied) { 
                    setIsPaymentModalOpen(false); setIsCustomerModalOpen(true); return; 
                } else { 
                    return; 
                }
            }
        }

        // CASO D: Obligatoriedad absoluta para CrÃ©dito, Delivery o DonaciÃ³n
        if ((isCreditSale || isDonationSale || isDelivery) && (!payloadCustomerData.full_name || !payloadCustomerData.id_number || payloadCustomerData.full_name.includes('CASUAL') || payloadCustomerData.full_name.includes('FINAL'))) {
            return Swal.fire({ 
                icon: 'warning', title: 'Datos Obligatorios', 
                text: 'Las operaciones de Cr\u00E9dito, Delivery o Donaci\u00F3n exigen el registro exacto del cliente (C\u00E9dula y Nombre).', 
                confirmButtonText: 'Completar Datos', 
                customClass: { popup: 'rounded-2xl', confirmButton: 'bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-blue-700' }, buttonsStyling: false 
            }).then(() => {
                setIsPaymentModalOpen(false); setIsCustomerModalOpen(true);
            });
        }
        
        if (isDelivery && (!deliveryInfo.driver_name || !deliveryInfo.address)) {
            return Swal.fire({ icon: 'warning', title: 'Informaci\u00F3n de Despacho', text: 'Seleccione Motorizado e indique Direcci\u00F3n.', confirmButtonColor: '#3b82f6', customClass: { popup: 'rounded-2xl' } });
        }

        // =========================================================================
        // 3. Preparaci\u00F3n de Datos y Guardado
        // =========================================================================
        let currentStatus = isCreditSale ? 'PENDIENTE' : isDonationSale ? 'DONADO' : 'PAGADO';
        
        let paymentDescription = isDonationSale ? 'DONACION (Salida de Inventario)' : activeMethods.map(m => {
            const amt = parseFloat(paymentShares[m]);
            const sym = paymentMethods.find(pm => pm.name === m)?.currency === 'Ref' ? 'Ref' : 'Bs';
            return `${m}: ${sym}${amt}`;
        }).join(' + ') || `${currentMethodName || 'PAGO DIRECTO'}: Ref ${targetTotalUSD.toFixed(2)}`;

        // ?? FASE 2: INYECCIÓN DEL VUELTO EN LA FACTURA Y BASE DE DATOS
        const finalChangeNote = inlineChangeNote || pendingChangeNote;
        if (finalChangeNote) {
            paymentDescription += finalChangeNote;
        }

        let initialCashPayment = 0;
        if (isCreditSale) {
            activeMethods.forEach(m => {
                if (m !== 'Credito' && m !== 'Donacion') {
                    const amt = parseFloat(paymentShares[m]);
                    initialCashPayment += (paymentMethods.find(pm => pm.name === m)?.currency === 'Ref') ? amt : (amt / bcvRate);
                }
            });
        }

        try {
            Swal.fire({ title: `Procesando...`, didOpen: () => Swal.showLoading(), customClass: { popup: 'rounded-2xl' } });
            
            let fiscalData = { invoice: null, control: null, serial: null };
            let finalInvoiceType = 'TICKET';

            // --- FASE 5: Ruteo Inteligente Multimodal ---
            if (isFiscalInvoice) {
                if (tenantConfig.invoiceMode === 'FISCAL_PRINTER') {
                    try {
                        const payload = buildFiscalPayload(cart, paymentDescription, payloadCustomerData, globalDiscount, igtfGeneratedUSD);
                        const printRes = await fetch(`${tenantConfig.fiscalPrinterIP}/imprimirFactura`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (!printRes.ok) throw new Error();
                        
                        const printData = await printRes.json();
                        fiscalData.invoice = printData.numero_factura || printData.invoice_number || null;
                        fiscalData.control = printData.numero_control || printData.control_number || null;
                        fiscalData.serial = printData.serial_maquina || printData.machine_serial || null;
                        finalInvoiceType = 'FISCAL';
                    } catch { 
                        Swal.fire({ title: 'Error de Impresora', text: 'No se pudo registrar la venta para evitar descuadres. Revisa la impresora fiscal.', icon: 'error', customClass: { popup: 'rounded-2xl' }}); 
                        return; 
                    }
                } else if (tenantConfig.invoiceMode === 'FORMA_LIBRE') {
                    finalInvoiceType = 'FORMA_LIBRE';
                } else if (tenantConfig.invoiceMode === 'ELECTRONIC_BILLING' || tenantConfig.invoiceMode === 'ELECTRONIC') {
                    finalInvoiceType = 'ELECTRONIC';
                }
            }

            const saleData = {
                payment_method: paymentDescription,
                items: cart.map(i => ({ product_id: i.id, name: i.name, quantity: i.quantity, price_usd: i.price_usd, is_taxable: i.is_taxable, is_service: i.is_service })),
                is_credit: isCreditSale, amount_paid: isCreditSale ? initialCashPayment.toFixed(2) : null,
                
                // CÓDIGO CERTIFICADO 100%: Envía al cliente si existe en cualquier modalidad
                customer_data: payloadCustomerData.full_name ? payloadCustomerData : null, 
                
                due_days: isCreditSale ? dueDays : null, 
                invoice_type: finalInvoiceType,
                bcv_rate_snapshot: bcvRate, total_usd: finalTotalUSD, total_ves: totalVES,
                discount: discountUSD, discount_usd: discountUSD, status: currentStatus, is_delivery: isDelivery, delivery_info: isDelivery ? deliveryInfo : null,
                fiscal_invoice_number: fiscalData.invoice,
                fiscal_control_number: fiscalData.control,
                fiscal_machine_serial: fiscalData.serial,
                igtf_usd: igtfGeneratedUSD,
                register_id: (() => {
                    try {
                        const storedRegister = localStorage.getItem('bms_active_register');
                        if (storedRegister) {
                            const parsed = JSON.parse(storedRegister);
                            if (parsed && parsed.id) return parseInt(parsed.id);
                        }
                    } catch (e) {
                        console.error("Error al recuperar el register_id de la estación:", e);
                    }
                    return cashShift?.register_id || cashShift?.cash_register_id || null;
                })()
            };

            const res = await SaleService.create(saleData);
            Swal.fire({ icon: 'success', title: isDonationSale ? '\u00A1Donaci\u00F3n Exitosa!' : '\u00A1Venta Procesada!', text: `Operaci\u00F3n generada.`, customClass: { popup: 'rounded-2xl', confirmButton: 'bg-blue-600 text-white rounded-lg px-6 py-2 font-medium' }, buttonsStyling: false });

            // Generar el visualizador PDF / Ticket térmico si es Forma Libre o Ticket común
            if (generateReceiptHTML) {
                if (finalInvoiceType === 'FORMA_LIBRE' || finalInvoiceType === 'TICKET') {
                   // CORRECCIÓN FASE 5: Usar el correlativo legal si existe, sino el ID interno
                   const invoiceNumberToPrint = res.data.fiscal_invoice_number || res.data.saleId || '000';
                   
                   setReceiptPreview(generateReceiptHTML(invoiceNumberToPrint, payloadCustomerData, cart, finalInvoiceType, 'PAGADO', new Date(), finalTotalUSD, bcvRate, paymentDescription, igtfGeneratedUSD, discountUSD, res.data.fiscal_control_number));
                }
            }

            // Reset de estados
            setCart([]); setIsCustomerModalOpen(false); setIsPaymentModalOpen(false);
            setCustomerData({ full_name: '', id_number: '', phone: '', institution: '' });
            setIsFiscalInvoice(false); setGlobalDiscount({ type: 'NONE', value: 0 }); 
            setIsDelivery(false); setDeliveryInfo({ driver_id: '', driver_name: '', address: '', status: 'PENDIENTE' });
            setPendingChangeNote(''); // ?? LIMPIEZA DE VUELTO
            if (onGlobalUpdate) onGlobalUpdate();
        } catch (error) { 
            Swal.fire({icon: 'error', title: 'Fallo al guardar', text: error.response?.data?.message || "Error", customClass: {popup: 'rounded-2xl'}}); 
        }
    };

    const handleCreditProcess = async () => {
        const creditAmount = parseFloat(paymentShares['Credito']) || 0;
        const donationAmount = parseFloat(paymentShares['Donacion']) || 0; 
        
        if (remainingUSD > 0.05 && creditAmount < remainingUSD && donationAmount < remainingUSD) {
            return Swal.fire({title: 'Monto Insuficiente', text: `Faltan Ref ${remainingUSD.toFixed(2)}`, icon: 'warning', customClass: {popup: 'rounded-2xl'}});
        }

        let changeNote = '';

        // BLINDAJE UX: FLUJO DE VUELTO (EXCESO DE PAGO)
        if (remainingUSD < -0.05) {
            const absChangeUSD = Math.abs(remainingUSD);
            const absChangeVES = Math.abs(remainingVES);

            // Filtramos solo los m\u00E9todos viables para dar vuelto (Efectivo o Pago M\u00F3vil)
            const changeMethods = paymentMethods.filter(m => 
                m.name.includes('Efectivo') || m.name.includes('Pago Movil')
            );
            const changeOptionsHtml = changeMethods.map(m => 
                `<option value="${m.name}">${m.name} (${m.currency})</option>`
            ).join('');

            const result = await Swal.fire({
                title: '',
                html: `
                    <div class="text-left font-sans cursor-default select-none">
                        
                        <!-- CABECERA -->
                        <div class="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
                            <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner border border-emerald-100 shrink-0">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <div class="flex flex-col">
                                <h3 class="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">
                                    Vuelto a Entregar
                                </h3>
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Saldo a favor del cliente
                                </span>
                            </div>
                        </div>

                        <!-- MONTO A DEVOLVER -->
                        <div class="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6 shadow-inner relative overflow-hidden">
                            <div class="absolute inset-0 bg-emerald-500/5"></div>
                            <p class="text-5xl md:text-6xl font-black text-emerald-600 tracking-tighter drop-shadow-sm relative z-10">
                                <span class="text-2xl text-emerald-400 mr-1 align-top relative top-3">Ref</span>${absChangeUSD.toFixed(2)}
                            </p>
                            <p class="text-sm font-bold text-slate-500 mt-2 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm relative z-10">
                                Bs ${absChangeVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                        </div>

                        <!-- SELECTOR DE GAVETA DE SALIDA -->
                        <div class="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm relative overflow-hidden group">
                            <div class="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div class="relative z-10">
                                <label class="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                    Entregar dinero v&iacute;a
                                </label>
                                <div class="relative">
                                    <select id="swal-change-method" class="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 text-sm font-black text-slate-700 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 outline-none cursor-pointer shadow-sm transition-all appearance-none pr-10 hover:border-slate-300">
                                        ${changeOptionsHtml}
                                    </select>
                                    <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-black">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                                <p class="text-[9px] font-bold text-slate-400 mt-2.5 leading-tight pl-1">Se imprimir&aacute; una nota de salida en el ticket para el auditor.</p>
                            </div>
                        </div>
                    </div>
                `,
                showCancelButton: true, confirmButtonText: 'Confirmar y Facturar', cancelButtonText: 'Volver',
                customClass: { 
                    popup: 'rounded-[2rem] p-5 sm:p-6 shadow-2xl border border-slate-100', 
                    htmlContainer: '!m-0 !text-left',
                    // BLINDAJE M\u00D3VIL: Fuerza flexbox para apilar o alinear los botones sin que se aplasten
                    actions: '!flex !flex-col-reverse sm:!flex-row !gap-3 !w-full !mt-6 !px-0', 
                    confirmButton: '!m-0 !w-full sm:!w-auto !flex-1 bg-emerald-600 text-white rounded-xl py-3.5 px-4 text-sm font-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 active:scale-95 transition-all outline-none border-0', 
                    cancelButton: '!m-0 !w-full sm:!w-auto !flex-1 bg-slate-100 text-slate-500 rounded-xl py-3.5 px-4 text-sm font-bold hover:bg-slate-200 active:scale-95 transition-all outline-none border-0' 
                },
                buttonsStyling: false,
                preConfirm: () => {
                    const method = document.getElementById('swal-change-method').value;
                    return method;
                }
            });

            if (!result.isConfirmed) return; 
            
            // Construir la nota de vuelto oficial para la BD
            changeNote = ` [VUELTO: ${result.value} - Ref ${absChangeUSD.toFixed(2)}]`;
            setPendingChangeNote(changeNote); // Lo guardamos por si la venta pide datos del cliente y se pausa un momento
        }

        if (creditAmount > 0 || donationAmount > 0 || isDelivery) { 
            setIsCustomerModalOpen(true); 
            setIsPaymentModalOpen(false); 
        }
        else {
            processSale(false, changeNote);
        }
    };

    const handleConfirm = () => (parseFloat(paymentShares['Credito']) > 0 || parseFloat(paymentShares['Donacion']) > 0 || isDelivery) ? processSale(true) : (setIsCustomerModalOpen(false), setIsPaymentModalOpen(true));

    const showSaleDetail = async (sale) => {
        const saleId = sale.id || sale["Nro Factura"] || sale.sale_id;
        if (!saleId) return;
        try {
            Swal.fire({ title: 'Cargando...', didOpen: () => Swal.showLoading(), customClass: { popup: 'rounded-2xl' } });
            const res = await SaleService.getOne(saleId);
            const d = res.data;
            const parse = (v) => isNaN(parseFloat(v)) ? 0 : parseFloat(v);
            
            setSelectedSaleDetail({
                id: saleId, 
                items: d.items || [], 
                payment_method: sale.payment_method || d.payment_method || 'Desconocido',
                total_usd: parse(d.total_usd), 
                total_ves: parse(d.total_ves), 
                status: sale.status || d.status || 'PAGADO',
                full_name: sale.full_name || d.full_name || 'Cliente Casual', 
                id_number: sale.id_number || d.id_number || '',
                bcv_rate_snapshot: parse(d.bcv_rate_snapshot), 
                invoice_type: sale.invoice_type || d.invoice_type || 'TICKET',
                discount_usd: parse(sale.discount_usd || d.discount_usd || 0), 
                igtf_usd: parse(sale.igtf_usd || d.igtf_usd || 0),
                taxBreakdown: { subtotalTaxableUSD: parse(d.subtotal_taxable_usd || 0), subtotalExemptUSD: parse(d.subtotal_exempt_usd || 0), ivaUSD: parse(d.iva_usd || 0), ivaRate: parse(d.iva_rate || 0.16) },
                
                // ?? EL MENSAJERO AHORA S¨ª LLEVA ESTOS DATOS AL MODAL
                fiscal_invoice_number: d.fiscal_invoice_number || sale.fiscal_invoice_number || null,
                fiscal_control_number: d.fiscal_control_number || sale.fiscal_control_number || null,
                credit_note_number: d.credit_note_number || sale.credit_note_number || null,
                credit_note_control: d.credit_note_control || sale.credit_note_control || null,
                control_number: d.control_number || sale.control_number || null,
                
                created_at: d.created_at || sale.created_at || new Date()
            });
            setShowSaleDetailModal(true); Swal.close();
        } catch { Swal.fire({title: 'Error', icon: 'error', customClass: {popup: 'rounded-2xl'}}); }
    };

    const handlePrintTicket = (sale) => {
    const customer = { full_name: sale.full_name || 'Consumidor Final', id_number: sale.id_number || 'V-00000000', institution: sale.institution || '', phone: sale.phone || '' };
    
    // ðŸš¨ FASE 5: RUTEO INTELIGENTE DEL NÃšMERO A IMPRIMIR
    // Si tiene un nÃºmero legal (Forma Libre o MÃ¡quina), lo usa. Si no, usa el ID interno (Ticket).
    const invoiceNumberToPrint = sale.fiscal_invoice_number || sale.id;

    if(generateReceiptHTML) {
        setReceiptPreview(generateReceiptHTML(
            invoiceNumberToPrint, 
            customer, 
            sale.items, 
            sale.invoice_type, 
            sale.status, 
            sale.created_at, // <-- Le pasamos la fecha exacta en la que se generÃ³ la venta
            parseFloat(sale.total_usd), 
            parseFloat(sale.bcv_rate_snapshot), 
            sale.payment_method, 
            parseFloat(sale.igtf_usd || 0), 
            parseFloat(sale.discount_usd || 0),
            sale.fiscal_control_number // ðŸš¨ PASADO COMO ÃšLTIMO PARÃMETRO
        ));
    }
};

    const handleVoidSale = async (sale) => {
        if (sale.status === 'ANULADO') return;
        
        // Evaluamos en qu\u00E9 modo de facturaci\u00F3n se registr\u00F3 la venta original
        const isFiscalPrinter = sale.invoice_type === 'FISCAL' && tenantConfig.invoiceMode === 'FISCAL_PRINTER';
        const isFormaLibre = sale.invoice_type === 'FORMA_LIBRE' || tenantConfig.invoiceMode === 'FORMA_LIBRE';
        const isInternalDoc = !isFiscalPrinter && !isFormaLibre;

        // BLINDAJE 1 (SENIAT): BLOQUEO DE CONSUMIDOR FINAL PARA NOTAS DE CR\u00C9DITO
        if ((isFiscalPrinter || isFormaLibre) && (!sale.id_number || sale.id_number.includes('00000000') || sale.id_number === 'S/I')) {
            return Swal.fire({
                icon: 'error',
                title: 'Operaci\u00F3n Denegada (SENIAT)',
                html: '<p class="text-sm text-slate-600 mt-2">La Providencia 0071 proh&iacute;be emitir Notas de Cr&eacute;dito a <b>"Consumidor Final"</b> o sin RIF v&aacute;lido.<br/><br/>Debe registrar al cliente real para procesar la devoluci&oacute;n.</p>',
                customClass: { popup: 'rounded-2xl', confirmButton: 'bg-slate-900 text-white rounded-lg px-6 py-2.5 font-bold' },
                buttonsStyling: false
            });
        }

        // AUTODETECCI\u00D3N DEL M\u00C9TODO DE PAGO ORIGINAL
        let detectedMethod = '';
        if (sale.payment_method) {
            const saleMethodsUp = sale.payment_method.toUpperCase();
            for (let pm of paymentMethods) {
                if (saleMethodsUp.includes(pm.name.toUpperCase())) {
                    detectedMethod = pm.name;
                    break; 
                }
            }
        }
        if (!detectedMethod) detectedMethod = 'Efectivo Bs'; // Fallback por seguridad

        const refundOptionsHtml = paymentMethods.map(m => 
            `<option value="${m.name}" ${m.name === detectedMethod ? 'selected' : ''}>${m.name} (${m.currency})</option>`
        ).join('');
        
        // BLINDAJE 2: MODAL UX PREMIUM 100% NATIVO Y RESPONSIVO
        const { value: formValues } = await Swal.fire({
            title: '', 
            html: `
                <div class="text-left font-sans cursor-default select-none">
                    
                    <!-- CABECERA CUSTOM -->
                    <div class="flex items-center gap-4 mb-6 pb-5 border-b border-slate-100">
                        <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner border border-rose-100 shrink-0">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div class="flex flex-col">
                            <h3 class="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">
                                ${isInternalDoc ? 'Anular Documento' : 'Emitir Nota de Cr&eacute;dito'}
                            </h3>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Reversi&oacute;n de Orden #${sale.id || sale.sale_id}
                            </span>
                        </div>
                    </div>

                    <!-- AVISOS DIN\u00C1MICOS -->
                    ${isFiscalPrinter ? `
                        <div class="bg-red-50/50 border border-red-100 p-3 rounded-xl flex gap-3 mb-5 shadow-sm">
                            <span class="text-red-500 text-lg">&#9888;&#65039;</span>
                            <p class="text-[11px] text-red-700 font-bold leading-tight mt-0.5">Acci&oacute;n irreversible. Emitir&aacute; una <b>Nota de Cr&eacute;dito</b> en la m&aacute;quina fiscal de inmediato.</p>
                        </div>
                    ` : isFormaLibre ? `
                        <div class="bg-blue-50/50 border border-blue-100 p-4 rounded-xl mb-5 shadow-sm">
                            <label class="block text-[10px] font-black text-blue-700 mb-1.5 uppercase tracking-widest flex items-center gap-1.5"><span class="text-sm">&#128196;</span> Nro. Control de la Hoja F&iacute;sica</label>
                            <input id="swal-nc-control" class="w-full bg-white border-2 border-blue-200 rounded-xl p-3 text-sm font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-inner placeholder:text-slate-300" placeholder="Ej: 00-00123456" autocomplete="off"/>
                            <p class="text-[9px] font-bold text-blue-500 mt-2 leading-tight">Obligatorio por el SENIAT para asociar el papel pre-impreso.</p>
                        </div>
                    ` : `
                        <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl flex gap-3 mb-5 shadow-sm">
                            <span class="text-slate-400 text-lg">&#8505;&#65039;</span>
                            <p class="text-[11px] text-slate-600 font-bold leading-tight mt-0.5">La anulaci&oacute;n devolver&aacute; los productos al inventario autom&aacute;ticamente.</p>
                        </div>
                    `}
                    
                    <!-- MOTIVO -->
                    <div class="mb-5">
                        <label class="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-widest pl-1">Motivo de la Devoluci&oacute;n *</label>
                        <textarea id="swal-nc-reason" rows="2" class="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 focus:bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-50 outline-none resize-none transition-all shadow-inner placeholder:text-slate-300" placeholder="Describa por qu&eacute; se anula la venta..."></textarea>
                    </div>
                    
                    <!-- M\u00C9TODO DE REINTEGRO -->
                    <div class="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm relative overflow-hidden group">
                        <div class="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="relative z-10">
                            <label class="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                Reintegrar dinero v&iacute;a
                            </label>
                            <div class="relative">
                                <select id="swal-nc-refund-method" class="w-full bg-white border-2 border-slate-200 rounded-xl p-3.5 text-sm font-black text-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none cursor-pointer shadow-sm transition-all appearance-none pr-10 hover:border-slate-300">
                                    ${refundOptionsHtml}
                                </select>
                                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-black">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                            <p class="text-[9px] font-bold text-slate-400 mt-2.5 leading-tight pl-1">Se registrar&aacute; una salida de caja para justificar este movimiento.</p>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true, 
            confirmButtonText: isInternalDoc ? 'Confirmar Anulaci\u00F3n' : 'Emitir N/C', 
            cancelButtonText: 'Cancelar',
            customClass: { 
                popup: 'rounded-[2rem] p-5 sm:p-6 shadow-2xl border border-slate-100', 
                htmlContainer: '!m-0 !text-left',
                // ?? UX MÓVIL BLINDADA: Flexbox forzado con !important para anular a Swal
                actions: '!flex !flex-col-reverse sm:!flex-row !gap-3 !w-full !mt-6 !px-0', 
                // ?? BOTONES BLINDADOS: Márgenes en 0, padding adaptativo y flex-1
                confirmButton: '!m-0 !w-full sm:!w-auto !flex-1 bg-rose-600 text-white rounded-xl py-3.5 px-4 text-sm font-black shadow-lg shadow-rose-500/30 hover:bg-rose-700 active:scale-95 transition-all outline-none border-0', 
                cancelButton: '!m-0 !w-full sm:!w-auto !flex-1 bg-slate-100 text-slate-500 rounded-xl py-3.5 px-4 text-sm font-bold hover:bg-slate-200 active:scale-95 transition-all outline-none border-0' 
            },
            buttonsStyling: false,
            preConfirm: () => {
                const reasonInput = document.getElementById('swal-nc-reason').value.trim();
                const refundMethod = document.getElementById('swal-nc-refund-method').value;

                if (!reasonInput) {
                    Swal.showValidationMessage('Debe especificar un motivo v\u00E1lido.');
                    return false;
                }
                if (!refundMethod) {
                    Swal.showValidationMessage('Debe seleccionar el m\u00E9todo de reintegro.');
                    return false;
                }

                const finalReason = `${reasonInput} [REINTEGRO: ${refundMethod}]`;

                let controlNumber = null;
                if (isFormaLibre) {
                    controlNumber = document.getElementById('swal-nc-control').value.trim();
                    if (!controlNumber) {
                        Swal.showValidationMessage('El Nro. de Control f\u00EDsico es obligatorio.');
                        return false;
                    }
                }
                
                return { reason: finalReason, controlNumber };
            }
        });
        
        if (formValues) {
            try {
                let creditNoteData = {};
                const { reason, controlNumber } = formValues; 
                
                if (isFiscalPrinter) {
                    Swal.fire({ title: 'Imprimiendo Nota de Cr\u00E9dito...', didOpen: () => Swal.showLoading(), customClass: { popup: 'rounded-[2rem]' }, allowOutsideClick: false });
                    
                    const payload = { 
                        original_invoice: sale.fiscal_invoice_number || sale.id, 
                        original_date: sale.created_at, 
                        original_printer_serial: sale.fiscal_machine_serial || null,
                        reason: reason, 
                        customer: sale.full_name, 
                        id_number: sale.id_number 
                    };
                    
                    try {
                        const ncRes = await fetch(`${tenantConfig.fiscalPrinterIP}/imprimirNotaCredito`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (!ncRes.ok) throw new Error("Fallo de comunicaci\u00F3n con el spooler");
                        
                        const ncData = await ncRes.json();
                        
                        let ncNum = ncData.numero_nc || ncData.numero_documento || ncData.numero_factura || ncData.invoice_number;
                        let ncCtrl = ncData.numero_control || ncData.control_number || 'S/A';
                        
                        if (!ncNum) {
                            const manualInput = await Swal.fire({
                                icon: 'info', title: 'Verifique el Papel',
                                text: 'El spooler no report\u00F3 el n\u00FAmero. Ingrese el Nro de Nota de Cr\u00E9dito impreso en el papel:',
                                input: 'text', allowOutsideClick: false,
                                customClass: { popup: 'rounded-[2rem]', confirmButton: 'bg-blue-600 text-white rounded-xl py-3 px-6 font-bold shadow-md' },
                                inputValidator: (v) => !v && 'Dato obligatorio'
                            });
                            
                            if (!manualInput.isConfirmed || !manualInput.value) {
                                throw new Error("Operaci\u00F3n cancelada");
                            }
                            ncNum = manualInput.value;
                        }
                        
                        creditNoteData = { credit_note_number: ncNum, credit_note_control: ncCtrl };
                    } catch (err) {
                        Swal.fire({title: 'Error Fiscal', text: 'No se pudo procesar la Nota de Cr\u00E9dito. Verifique la impresora.', icon: 'error', customClass: {popup: 'rounded-[2rem]'} });
                        return; 
                    }
                } 
                else if (isFormaLibre) {
                    Swal.fire({ title: 'Generando N/C Electr\u00F3nica...', didOpen: () => Swal.showLoading(), customClass: { popup: 'rounded-[2rem]' }, allowOutsideClick: false });
                    creditNoteData = { credit_note_control: controlNumber };
                }

                await SaleService.void(sale.id || sale.sale_id, { reason: reason, ...creditNoteData });
                
                Swal.fire({ icon: 'success', title: isFiscalPrinter || isFormaLibre ? 'Nota de Cr\u00E9dito Emitida' : 'Anulada Exitosamente', timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
                setShowSaleDetailModal(false); 
                if (onGlobalUpdate) onGlobalUpdate('VOID');
            } catch (error) { 
                Swal.fire({title: 'Error al anular', text: 'Ocurri\u00F3 un problema de comunicaci\u00F3n.', icon: 'error', customClass: { popup: 'rounded-[2rem]' }}); 
            }
        }
    };

    // --- ORDENES EN ESPERA ---
    const [heldOrders, setHeldOrders] = useState([]);
    const fetchHeldOrders = useCallback(async () => { try { const res = await HeldOrderService.getAll(); setHeldOrders(res.data || []); } catch {} }, []);

    const handlePauseOrder = async () => {
        if (!cart?.length) return Swal.fire({ title: 'Carrito Vacio', text: 'No hay productos para pausar.', icon: 'info', customClass: { popup: 'rounded-[2rem]' }, confirmButtonColor: '#3b82f6' });
        if (heldOrders.length >= 10) return Swal.fire({ title: 'Limite Alcanzado', text: 'Ya tienes 10 ordenes en espera. Debes despachar o eliminar alguna.', icon: 'error', customClass: { popup: 'rounded-[2rem]' }, confirmButtonColor: '#3b82f6' });

        // UX: Si ya hay un nombre de cliente real (no "Casual"), lo usamos como sugerencia.
        const defaultName = customerData?.full_name && !customerData.full_name.includes('CASUAL') && !customerData.full_name.includes('FINAL') ? customerData.full_name : '';

        const result = await Swal.fire({
            title: '<h3 class="text-2xl font-black text-slate-800 tracking-tight mt-2">Pausar Orden</h3>',
            html: `
                <div class="text-left font-sans mt-2 px-1">
                    <p class="text-sm text-slate-500 mb-4 font-medium leading-relaxed">Asigna una referencia rapida para identificar esta cuenta mas tarde.</p>
                    <input id="pause-ref-input" class="w-full border-2 border-slate-200 rounded-xl p-4 text-lg font-bold text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none shadow-inner transition-all placeholder:text-slate-300" placeholder="Ej: Mesa 4, Juan Perez..." value="${defaultName}" autocomplete="off" />
                    
                    <div class="mt-5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block">Etiquetas Rapidas</span>
                        <div class="flex flex-wrap gap-2">
                            <button type="button" class="quick-tag-btn px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-indigo-300 shadow-sm active:scale-95">Mesa 1</button>
                            <button type="button" class="quick-tag-btn px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-indigo-300 shadow-sm active:scale-95">Mostrador</button>
                            <button type="button" class="quick-tag-btn px-3 py-1.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-indigo-300 shadow-sm active:scale-95">Buscando Pago</button>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Pausar y Guardar',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'rounded-[2.5rem] p-6 shadow-2xl border border-white/80 backdrop-blur-xl bg-white/90',
                htmlContainer: '!m-0',
                actions: 'flex flex-col-reverse sm:flex-row gap-3 w-full mt-6 px-1',
                confirmButton: 'flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/30 active:scale-95 outline-none',
                cancelButton: 'flex-1 bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-95 outline-none'
            },
            buttonsStyling: false,
            didOpen: () => {
                const input = document.getElementById('pause-ref-input');
                input.focus();
                if(input.value) input.select();

                // Logica para que las etiquetas rapidas llenen el input
                document.querySelectorAll('.quick-tag-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        input.value = e.target.innerText;
                        input.focus();
                    });
                });
            },
            preConfirm: () => {
                const val = document.getElementById('pause-ref-input').value.trim();
                if (!val) {
                    Swal.showValidationMessage('Debes asignar un nombre o referencia a la orden');
                    return false;
                }
                return val.charAt(0).toUpperCase() + val.slice(1); // Capitaliza la primera letra
            }
        });

        if (result.isConfirmed) {
            try {
                Swal.fire({ title: 'Pausando Orden...', didOpen: () => Swal.showLoading(), customClass: { popup: 'rounded-2xl' }, allowOutsideClick: false });
                
                await HeldOrderService.save({ referenceName: result.value, cartData: cart });
                
                // Limpieza total de la estacion para el siguiente cliente
                setCart([]); 
                handleApplyDiscount('NONE', 0); 
                setIsDelivery(false);
                setDeliveryInfo({ driver_id: '', driver_name: '', address: '', status: 'PENDIENTE' });
                setCustomerData({ full_name: '', id_number: '', phone: '', institution: '' });
                setSelectedCustomerId(null);
                
                await fetchHeldOrders();
                
                Swal.fire({ icon: 'success', title: 'Orden Pausada', text: `Guardada como "${result.value}"`, timer: 1500, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error de Sistema', text: 'No se pudo pausar la orden. Intente nuevamente.', customClass: { popup: 'rounded-[2rem]' }, confirmButtonColor: '#3b82f6' });
            }
        }
    };

    const handleResumeOrder = async (order) => {
        if (cart.length > 0) {
            const confirm = await Swal.fire({ title: '?Reemplazar Carrito?', icon: 'warning', showCancelButton: true });
            if (!confirm.isConfirmed) return;
        }
        setCart(order.cart_data); await HeldOrderService.delete(order.id); await fetchHeldOrders();
    };

    const handleDeleteHeldOrder = async (id) => { await HeldOrderService.delete(id); await fetchHeldOrders(); };

    const isFormReadyToSubmit = customerData.full_name.trim() && customerData.id_number.trim();

    return {
        cart, setCart, addToCart, removeFromCart, isFiscalInvoice, setIsFiscalInvoice, receiptPreview, setReceiptPreview,
        isMobileCartOpen, setIsMobileCartOpen, isPaymentModalOpen, setIsPaymentModalOpen, showSaleDetailModal, setShowSaleDetailModal, selectedSaleDetail, setSelectedSaleDetail,
        isCustomerModalOpen, setIsCustomerModalOpen, paymentShares, setPaymentShares, isNumpadOpen, setIsNumpadOpen, currentMethod, setCurrentMethod,
        currentInputValue, setCurrentInputValue, paymentReferences, setPaymentReferences, currentReference, setCurrentReference, customerData, setCustomerData,
        dueDays, setDueDays, selectedCustomerId, setSelectedCustomerId, customerSearchResults, setCustomerSearchResults, isSearchingCustomer, setIsSearchingCustomer,
        posSearchQuery, setPosSearchQuery, currentPage, setCurrentPage,
        paymentMethods, methodsRequiringReference, subtotalTaxableUSD, subtotalExemptUSD, ivaUSD, finalTotalUSD, totalVES,
        remainingUSD, remainingVES, isInsufficient, igtfGeneratedUSD, targetTotalUSD, globalDiscount, handleApplyDiscount, discountUSD,
        isDelivery, setIsDelivery, deliveryInfo, setDeliveryInfo, heldOrders, fetchHeldOrders, handlePauseOrder, handleResumeOrder, handleDeleteHeldOrder,
        updatePaymentShare, handleOpenPayment, handlePayRemaining, handleExactPayment, searchCustomers, selectCustomer, handleClear, handleNameChange, handleIdChange, handleListSelect, handleChange,
        handleConfirm, handleCreditProcess, showSaleDetail, handlePrintTicket, handleVoidSale, processSale, isFormReadyToSubmit
    };
};