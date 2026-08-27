import React from 'react';
import Swal from 'sweetalert2'; 
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ProductAvatar from '../components/ui/ProductAvatar';
import { tenantConfig } from '../config/tenantConfig';
import { DeliveryService, ProductService } from '../api/services'; 

// 🚀 OPTIMIZACIÓN GLOBAL: Extraemos las variantes fuera del componente para no saturar la RAM
const gridVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const cardVariants = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } } };

// 🎵 SINTETIZADOR DE AUDIO NATIVO MEJORADO (Audible en Teléfonos y Libre de Bloqueos)
let audioCtx = null; // Instancia global para no ser bloqueada por Android/iOS

const playBeep = (type = 'success') => {
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            audioCtx = new AudioContext();
        }
        
        // "Despertar" el audio si el teléfono lo puso a dormir por inactividad
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'success') {
            // Tono tipo "Caja Registradora" (Más brillante para teléfonos)
            osc.type = 'square'; 
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Volumen al 30%
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15); 
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
        } else {
            // Tono grave de error (Buzz)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3); 
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) {
        console.warn("El navegador bloqueó el sonido del escáner:", e);
    }
};

// 🎨 ANIMACIÓN: Item del Carrito fluido y optimizado
export const CartItem = React.memo(({ item, removeFromCart, isAuditMode }) => (
    <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.9, x: -10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: 10 }}
        whileHover={!isAuditMode ? { scale: 1.02 } : {}}
        whileTap={!isAuditMode ? { scale: 0.98 } : {}}
        onClick={() => !isAuditMode && removeFromCart(item.id)} 
        className={`flex justify-between items-center py-3 px-3 mb-2 rounded-2xl bg-white/80 backdrop-blur-sm border shadow-[0_4px_12px_rgba(0,0,0,0.03)] select-none group relative overflow-hidden ${isAuditMode ? 'border-amber-200 cursor-not-allowed opacity-80' : 'border-slate-100 cursor-pointer active:scale-95'}`}
    >
        {!isAuditMode && <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/5 transition-colors duration-300"></div>}
        <div className="flex items-center gap-3 relative z-10">
            <div className="relative">
                <ProductAvatar icon={item.icon_emoji} size="w-12 h-12 text-2xl drop-shadow-sm" />
                <motion.span 
                    key={item.quantity}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shadow-md border border-white"
                >
                    {item.quantity}
                </motion.span>
            </div>
            <div className="flex flex-col">
                <span className={`font-bold text-sm leading-tight line-clamp-1 transition-colors ${isAuditMode ? 'text-amber-800' : 'text-slate-700 group-hover:text-red-500'}`}>
                    {item.name} {item.is_service && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded ml-1 border border-purple-200 shadow-sm uppercase tracking-widest font-black">Servicio</span>}
                </span>
                <span className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">Ref {parseFloat(item.price_usd).toFixed(2)}</span>
            </div>
        </div>
        <div className="flex flex-col items-end relative z-10">
            <span className="font-black text-slate-800 text-sm">Ref {(item.price_usd * item.quantity).toFixed(2)}</span>
            {!isAuditMode && (
                <span className="text-red-500 opacity-0 group-hover:opacity-100 text-[10px] font-black uppercase tracking-widest transition-opacity mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> Quitar
                </span>
            )}
        </div>
    </motion.div>
));

// 🚀 REFACTORIZACIÓN UOM: Tarjeta Multi-Medidas (Kilos, Litros, Metros, Blister, Unidades)
const ProductCard = React.memo(({ prod, addToCart, isAuditMode, isZombieShift }) => {
    const isOutOfStock = !prod.is_service && !prod.is_raw_material && (prod.stock || 0) <= 0;
    const isLowStock = !prod.is_service && !prod.is_raw_material && (prod.stock || 0) > 0 && (prod.stock || 0) <= 10;
    const isRawMaterial = prod.is_raw_material === true;
    
    // 📏 CORE UOM: Normalizamos el string para evitar fallos de BD y errores de compilacion
    const rawUnit = (prod.unit_measure || 'UND').toUpperCase().trim();
    const unit = rawUnit.replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E').replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O').replace(/[ÚÙÜÛ]/g,'U');
    
    // Si la unidad es UND o UNIDAD, se va directo al carrito. Si es cualquier otra, abre la calculadora.
    const isFractionable = !['UND', 'UNIDAD'].includes(unit);

    // 🎨 MEGA-DICCIONARIO VISUAL UX PRO
    const unitStyles = {
        'KG':  { icon: '⚖️', label: 'POR KILO', color: 'bg-sky-50 text-sky-600 border-sky-200', dot: 'bg-sky-500' },
        'GR':  { icon: '⚖️', label: 'GRAMOS', color: 'bg-teal-50 text-teal-600 border-teal-200', dot: 'bg-teal-500' },
        'LT':  { icon: '💧', label: 'LITROS', color: 'bg-cyan-50 text-cyan-600 border-cyan-200', dot: 'bg-cyan-500' },
        'MTS': { icon: '📏', label: 'METROS', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', dot: 'bg-indigo-500' },
        'BLS': { icon: '💊', label: 'BLISTER', color: 'bg-pink-50 text-pink-600 border-pink-200', dot: 'bg-pink-500' },
        'BLISTER': { icon: '💊', label: 'BLISTER', color: 'bg-pink-50 text-pink-600 border-pink-200', dot: 'bg-pink-500' },
        'UND': { icon: '📦', label: (prod.stock || 0) + ' Und', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500' },
        'UNIDAD': { icon: '📦', label: (prod.stock || 0) + ' Und', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500' },
        '1/4 GALON': { icon: '🛢️', label: '1/4 GALON', color: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
        'ATOMIZADOR': { icon: '🧴', label: 'ATOMIZ.', color: 'bg-teal-50 text-teal-600 border-teal-200', dot: 'bg-teal-500' },
        'BOLSA': { icon: '🛍️', label: 'BOLSA', color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500' },
        'BOTELLA': { icon: '🍾', label: 'BOTELLA', color: 'bg-blue-50 text-blue-600 border-blue-200', dot: 'bg-blue-500' },
        'BULTO': { icon: '📦', label: 'BULTO', color: 'bg-stone-50 text-stone-600 border-stone-200', dot: 'bg-stone-500' },
        'CAJAS': { icon: '📦', label: 'CAJA', color: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
        'CAPSULAS': { icon: '💊', label: 'CAPSULA', color: 'bg-rose-50 text-rose-600 border-rose-200', dot: 'bg-rose-500' },
        'CENTIMETRO': { icon: '📏', label: 'CM', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', dot: 'bg-indigo-500' },
        'COMPRIMIDOS': { icon: '💊', label: 'COMPRIM.', color: 'bg-pink-50 text-pink-600 border-pink-200', dot: 'bg-pink-500' },
        'CREMA': { icon: '🧴', label: 'CREMA', color: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200', dot: 'bg-fuchsia-500' },
        'DOCENA': { icon: '🥚', label: 'DOCENA', color: 'bg-yellow-50 text-yellow-600 border-yellow-200', dot: 'bg-yellow-500' },
        'FRASCO AMPOLLA': { icon: '💉', label: 'AMPOLLA', color: 'bg-cyan-50 text-cyan-600 border-cyan-200', dot: 'bg-cyan-500' },
        'GALON': { icon: '🛢️', label: 'GALON', color: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
        'GOTAS': { icon: '💧', label: 'GOTAS', color: 'bg-sky-50 text-sky-600 border-sky-200', dot: 'bg-sky-500' },
        'GRANULADOS': { icon: '🧂', label: 'GRANUL.', color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500' },
        'JARABE': { icon: '🥄', label: 'JARABE', color: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' },
        'MT2': { icon: '📐', label: 'MT2', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', dot: 'bg-indigo-500' },
        'MT3': { icon: '🧊', label: 'MT3', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', dot: 'bg-indigo-500' },
        'ONZA': { icon: '⚖️', label: 'ONZA', color: 'bg-teal-50 text-teal-600 border-teal-200', dot: 'bg-teal-500' },
        'OVULOS': { icon: '💊', label: 'OVULO', color: 'bg-rose-50 text-rose-600 border-rose-200', dot: 'bg-rose-500' },
        'PAILA': { icon: '🪣', label: 'PAILA', color: 'bg-stone-50 text-stone-600 border-stone-200', dot: 'bg-stone-500' },
        'PIEZA': { icon: '🧩', label: 'PIEZA', color: 'bg-violet-50 text-violet-600 border-violet-200', dot: 'bg-violet-500' },
        'PORCION': { icon: '🍰', label: 'PORCION', color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-500' },
        'SACO': { icon: '🥔', label: 'SACO', color: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
        'SOLUCIONES': { icon: '🧪', label: 'SOLUCION', color: 'bg-cyan-50 text-cyan-600 border-cyan-200', dot: 'bg-cyan-500' },
        'SUPOSITORIOS': { icon: '💊', label: 'SUPOSIT.', color: 'bg-rose-50 text-rose-600 border-rose-200', dot: 'bg-rose-500' },
        'SUSPENSION': { icon: '🧪', label: 'SUSPENS.', color: 'bg-sky-50 text-sky-600 border-sky-200', dot: 'bg-sky-500' },
        'TABLETAS': { icon: '💊', label: 'TABLETA', color: 'bg-pink-50 text-pink-600 border-pink-200', dot: 'bg-pink-500' },
        'TABLETAS MASTICABLES': { icon: '🍬', label: 'MASTIC.', color: 'bg-pink-50 text-pink-600 border-pink-200', dot: 'bg-pink-500' },
        'TAMBOR': { icon: '🛢️', label: 'TAMBOR', color: 'bg-stone-50 text-stone-600 border-stone-200', dot: 'bg-stone-500' },
        'UNGUENTO': { icon: '🧴', label: 'UNGUENTO', color: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200', dot: 'bg-fuchsia-500' }
    };
    
    const currentStyle = unitStyles[unit] || { icon: '🏷️', label: rawUnit, color: 'bg-slate-100 text-slate-600 border-slate-300', dot: 'bg-slate-500' };

    // 🛡️ Lógica combinada de bloqueos
    const isActionBlocked = isAuditMode || isZombieShift;
    const isDisabled = isOutOfStock || isActionBlocked;

    const handleCardClick = async () => {
        if (isAuditMode) {
            return Swal.fire({
                icon: 'warning',
                title: 'Modo Auditoria Activo',
                text: 'No puedes agregar productos ni facturar mientras auditas.',
                confirmButtonColor: '#f59e0b',
                customClass: { popup: 'rounded-3xl' }
            });
        }
        
        if (isZombieShift) {
            return Swal.fire({
                icon: 'error',
                title: 'Turno Vencido',
                text: 'Debes realizar el Cierre Z antes de procesar ventas.',
                confirmButtonColor: '#e11d48',
                customClass: { popup: 'rounded-3xl' }
            });
        }
        
        if (isOutOfStock) return;

        // 🧮 CALCULADORA UOM (100% Libre de Template Literals y Unicode para proteger Vite)
        if (isFractionable) {
            const basePrice = parseFloat(prod.price_usd) || 0;
            const basePriceStr = basePrice.toFixed(2);

            const { value: measureData } = await Swal.fire({
                title: '<h3 class="text-2xl font-black text-slate-800 mt-2">' + currentStyle.icon + ' Calculadora de Medida</h3>',
                html: 
                    '<div class="flex flex-col gap-4 text-left mt-4 font-sans px-2">' +
                        '<div class="bg-blue-50/80 border border-blue-100 rounded-xl p-4 flex justify-between items-center shadow-inner backdrop-blur-sm">' +
                            '<span class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Precio Base</span>' +
                            '<span class="text-xl font-black text-blue-800">Ref ' + basePriceStr + ' / ' + rawUnit + '</span>' +
                        '</div>' +
                        '<div>' +
                            '<label class="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Cantidad a despachar (' + rawUnit + ')</label>' +
                            '<div class="relative">' +
                                '<input id="measure-val" type="number" step="0.001" min="0.001" class="w-full bg-white border-2 border-slate-200 rounded-xl p-4 pl-14 text-3xl font-black text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder-slate-300" placeholder="0.000" autocomplete="off"/>' +
                                '<span class="absolute left-5 top-1/2 -translate-y-1/2 text-xl opacity-60 select-none">' + currentStyle.icon + '</span>' +
                            '</div>' +
                            '<p class="text-[10px] text-slate-400 font-bold mt-2 tracking-widest uppercase">Ej: 1.5, 0.250, 3...</p>' +
                        '</div>' +
                        '<div class="mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">' +
                            '<span class="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Calculado</span>' +
                            '<span class="text-2xl font-black text-emerald-700 tracking-tighter" id="measure-total">Ref 0.00</span>' +
                        '</div>' +
                    '</div>',
                showCancelButton: true,
                confirmButtonText: 'Procesar Venta',
                cancelButtonText: 'Cancelar',
                customClass: {
                    popup: 'rounded-[2.5rem] p-6 shadow-2xl border border-white/80 backdrop-blur-xl bg-white/90',
                    htmlContainer: '!mx-2 !mt-0',
                    actions: 'flex flex-wrap gap-3 w-full justify-center px-4 pb-2 mt-6',
                    confirmButton: 'flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/30 active:scale-95 outline-none',
                    cancelButton: 'w-full md:w-auto bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-95 outline-none'
                },
                buttonsStyling: false,
                didOpen: () => {
                    const input = document.getElementById('measure-val');
                    const totalDisplay = document.getElementById('measure-total');

                    input.addEventListener('input', (e) => {
                        const amount = parseFloat(e.target.value) || 0;
                        const calculated = amount * basePrice;
                        totalDisplay.innerText = 'Ref ' + calculated.toFixed(2);
                    });
                    input.focus();
                },
                preConfirm: () => {
                    const valInput = document.getElementById('measure-val').value;
                    if (!valInput || valInput.trim() === '') {
                        Swal.showValidationMessage('Ingresa la cantidad');
                        return false;
                    }
                    const amount = parseFloat(valInput);
                    if (isNaN(amount) || amount <= 0) {
                        Swal.showValidationMessage('La cantidad debe ser mayor a 0');
                        return false;
                    }

                    const calculatedPrice = amount * basePrice;
                    return { amount, calculatedPrice };
                }
            });

            if (measureData) {
                // Empaquetado legal usando solo concatenacion tradicional
                const fractionedProduct = {
                    ...prod,
                    id: prod.id + '-UOM-' + Date.now(),
                    name: prod.name + ' (' + measureData.amount + ' ' + rawUnit + ')',
                    price_usd: measureData.calculatedPrice,
                    is_fractioned: true,
                    original_amount: measureData.amount,
                    unit_measure: rawUnit
                };

                if (typeof window !== 'undefined' && typeof playBeep === 'function') {
                    playBeep('success');
                } else if (typeof window !== 'undefined' && window.playBeep) {
                    window.playBeep('success');
                }
                
                addToCart(fractionedProduct);
            }
            return;
        }

        // Si es unidad tradicional
        addToCart(prod);
    };

    return (
        <motion.div
            variants={cardVariants}
            whileHover={!isDisabled ? { y: -2, scale: 1.01 } : {}}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
            onClick={handleCardClick}
            className={`group relative bg-white rounded-[1.5rem] p-5 border transition-all duration-200 flex flex-col h-full select-none shadow-sm
                ${isOutOfStock ? 'border-slate-100 opacity-60 grayscale cursor-not-allowed' : 
                  isActionBlocked ? 'border-amber-100 opacity-80 cursor-not-allowed' : 
                  'border-slate-100 hover:border-blue-300 hover:shadow-lg cursor-pointer'}`}
        >
            <div className="flex justify-between items-start mb-3">
                <div className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1.5 border shadow-sm ${
                        prod.is_service ? 'bg-purple-50 text-purple-600 border-purple-200' :
                        isRawMaterial ? 'bg-orange-50 text-orange-600 border-orange-200' :
                        isOutOfStock ? 'bg-slate-100 text-slate-400 border-slate-200' :
                        isLowStock ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' :
                        currentStyle.color
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prod.is_service ? 'bg-purple-500' : isRawMaterial ? 'bg-orange-500' : isOutOfStock ? 'bg-slate-400' : isLowStock ? 'bg-amber-500' : currentStyle.dot}`}></span>
                    {prod.is_service ? 'SERVICIO' : isRawMaterial ? 'INSUMO' : isOutOfStock ? 'AGOTADO' : currentStyle.label}
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center text-center gap-3 mb-4 mt-1">
                <div className="transition-transform duration-300 group-hover:scale-105">
                    <ProductAvatar icon={prod.icon_emoji} size="h-14 w-14 text-4xl" />
                </div>
                <h3 className={`font-black text-sm leading-snug line-clamp-2 tracking-tight ${isOutOfStock ? 'text-slate-400' : 'text-slate-800'}`}>
                    {prod.name || 'Producto'}
                </h3>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-50 w-full relative">
                <div className="flex flex-col items-center gap-1">
                    <div className={`flex items-baseline gap-1 ${isOutOfStock ? 'text-slate-400' : 'text-slate-800'}`}>
                        <span className="text-xs font-bold opacity-60">Bs</span>
                        <span className="text-xl font-black tracking-tighter">{(prod.price_ves || 0).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-100 tracking-widest">
                        Ref ${(prod.price_usd || 0).toFixed(2)} {isFractionable ? ('/ ' + rawUnit) : ''}
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

const PosView = ({
    tenantBrand,
    isFallbackActive, bcvRate, posSearchQuery, setPosSearchQuery, scrollCategories,
    categoryScrollRef, categories, selectedCategory, setSelectedCategory, currentProducts,
    addToCart, totalPages, currentPage, paginate, cashShift, promptOpenCash, cart,
    removeFromCart, subtotalExemptUSD, subtotalTaxableUSD, IVA_RATE, ivaUSD, totalVES,
    finalTotalUSD, handleOpenPayment, setCart, globalDiscount, handleApplyDiscount, discountUSD,
    heldOrders, handlePauseOrder, handleResumeOrder, handleDeleteHeldOrder,
    isDelivery, setIsDelivery, deliveryInfo, setDeliveryInfo,
    dailySalesUSD = 0, dailySalesVES = 0,
    handleOpenDailySales, 
    lowStockCount = 0,    
    handleOpenStockAlerts,
    productsPerPage = 12,
    setProductsPerPage,
    products
}) => {

    const [isMobileCartOpen, setIsMobileCartOpen] = React.useState(false);

    // 🛡️ ESCUDO: Verificamos si el usuario actual es el Administrador
    const storedUser = JSON.parse(localStorage.getItem('bms_user') || '{}');
    const isAuditMode = storedUser.role === 'ADMINISTRADOR' || storedUser.role_name === 'ADMINISTRADOR';

    // 🧟 ESCUDO ANTI-ZOMBIS: Verificamos si el turno abierto es de un día anterior
    const isZombieShift = cashShift && new Date(cashShift.opened_at).toLocaleDateString('es-VE') !== new Date().toLocaleDateString('es-VE');
    
    // Unificamos el bloqueo: Está bloqueado si es Auditor o si el turno está vencido
    const isActionBlocked = isAuditMode || isZombieShift;

    // 🔥 EL CADENERO: Verifica si hay bloqueo antes de hacer cualquier acción
    const blockIfLocked = () => {
        if (isActionBlocked) {
            Swal.fire({
                icon: isZombieShift ? 'error' : 'warning',
                title: isZombieShift ? 'Turno Vencido' : 'Modo Auditoria Activo',
                text: isZombieShift 
                    ? 'Debes ir a la seccion de Cierres y liquidar la jornada anterior antes de registrar movimientos.' 
                    : 'Acceso de Solo Lectura. No puedes alterar el carrito ni facturar mientras auditas.',
                confirmButtonColor: isZombieShift ? '#e11d48' : '#f59e0b',
                customClass: { popup: 'rounded-[2rem]' }
            });
            return true; // Retorna true si hay un bloqueo
        }
        return false; // Retorna false si tiene vía libre
    };

    // 🛡️ Proxies seguros que reemplazan las llamadas directas
    const safeAddToCart = (prod) => { if (!blockIfLocked()) addToCart(prod); };
    const safeRemoveFromCart = (id) => { if (!blockIfLocked()) removeFromCart(id); }

    const promptDeliveryInfo = async () => {
        if (isAuditMode) return; // 🛡️ Bloqueo de Auditoría
        let driversList = [];
        let deliveryServices = [];
        try {
            Swal.fire({ title: 'Sincronizando Rutas...', didOpen: () => Swal.showLoading(), allowOutsideClick: false, customClass: { popup: 'rounded-[2rem]' } });
            const [resDrivers, resProducts] = await Promise.all([
                DeliveryService.getDrivers(),
                ProductService.getAll()
            ]);
            
            driversList = (resDrivers.data || []).filter(d => d.status === 'ACTIVO');
            
            deliveryServices = (resProducts.data || []).filter(p => 
                p.is_service === true && 
                (p.name.toLowerCase().includes('delivery') || p.name.toLowerCase().includes('despacho') || p.name.toLowerCase().includes('flete'))
            );
            Swal.close();
        } catch (e) {
            Swal.close();
            console.error("Error cargando datos:", e);
            return Swal.fire({ icon: 'error', title: 'Error', text: 'Fallo al cargar datos de despacho.', customClass: { popup: 'rounded-[2rem]' } });
        }

        const driverOptions = driversList.map(d => `<option value="${d.name}" ${deliveryInfo?.driver_name === d.name ? 'selected' : ''}>🛵 ${d.name} ${d.id_number ? `(${d.id_number})` : ''}</option>`).join('');
        const serviceOptions = deliveryServices.map(s => `<option value="${s.id}">📍 ${s.name} - Ref ${parseFloat(s.price_usd).toFixed(2)}</option>`).join('');

        const { value: formValues, isDismissed } = await Swal.fire({
            title: '<h3 class="text-2xl font-black text-slate-800 mt-2">📦 Datos de Despacho</h3>',
            html: `
                <div class="flex flex-col gap-4 text-left mt-2 font-sans px-2">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zona / Tarifa de Delivery *</label>
                        <select id="del-service-id" class="w-full mt-2 p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none font-bold text-slate-700 shadow-inner cursor-pointer transition-all">
                            ${serviceOptions || '<option value="">⚠️ No hay servicios de Delivery creados</option>'}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motorizado Asignado *</label>
                        <select id="del-driver" class="w-full mt-2 p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none font-bold text-slate-700 shadow-inner cursor-pointer transition-all">
                            <option value="">-- Seleccione un Motorizado --</option>
                            ${driverOptions}
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direcci\u00F3n Exacta *</label>
                        <textarea id="del-address" class="w-full mt-2 p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none resize-none font-medium text-sm text-slate-700 shadow-inner transition-all" rows="2" placeholder="Ej: Urb. El Este, Calle 4...">${deliveryInfo?.address || ''}</textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar y A\u00F1adir',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'rounded-[2.5rem] p-6 shadow-2xl border border-white/80 backdrop-blur-xl bg-white/90',
                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 active:scale-95 outline-none',
                cancelButton: 'bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-95 outline-none'
            },
            buttonsStyling: false,
            preConfirm: () => {
                const address = document.getElementById('del-address').value.trim();
                const driver = document.getElementById('del-driver').value.trim();
                const serviceId = document.getElementById('del-service-id').value;
                if (!serviceId) { Swal.showValidationMessage('⚠️ Debe crear un servicio de Delivery en el inventario primero'); return false; }
                if (!driver) { Swal.showValidationMessage('⚠️ Seleccione un motorizado'); return false; }
                if (!address) { Swal.showValidationMessage('⚠️ Indique la direcci\u00F3n de entrega'); return false; }
                return { address, driver_name: driver, status: 'PENDIENTE', serviceId: parseInt(serviceId) };
            }
        });

        if (formValues) {
            setDeliveryInfo({ address: formValues.address, driver_name: formValues.driver_name, status: formValues.status });
            setIsDelivery(true);
            const selectedDeliveryProduct = deliveryServices.find(p => p.id === formValues.serviceId);
            if (selectedDeliveryProduct) {
                setCart(prev => {
                    const cleanCart = prev.filter(i => !(i.is_service === true && (i.name.toLowerCase().includes('delivery') || i.name.toLowerCase().includes('despacho') || i.name.toLowerCase().includes('flete'))));
                    return [...cleanCart, { ...selectedDeliveryProduct, quantity: 1 }];
                });
                Swal.fire({ icon: 'success', title: 'Ruta Asignada', text: `Se a\u00F1adi\u00F3 la tarifa: ${selectedDeliveryProduct.name}`, timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
            }
        } else if (isDismissed && !isDelivery) {
            setIsDelivery(false);
        }
    };

    const handleDeliveryCheckout = () => {
        if (isAuditMode) return; // 🛡️ Bloqueo de Auditoría

        if (isDelivery) {
            const hasDeliveryService = cart.some(item => 
                item.is_service === true || 
                item.name.toLowerCase().includes('delivery') || 
                item.name.toLowerCase().includes('despacho') ||
                item.name.toLowerCase().includes('flete')
            );
            if (!hasDeliveryService) {
                return Swal.fire({
                    icon: 'warning',
                    title: 'Falta el Renglón de Delivery',
                    html: '<p class="text-sm text-slate-600">Por normativas del SENIAT, el cobro del envío no puede estar oculto. <b>Debe agregar el ítem de "Servicio de Delivery" al ticket</b> antes de proceder con el cobro.</p>',
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#3b82f6',
                    customClass: { popup: 'rounded-[2.5rem]' }
                });
            }
        }
        
        if (isMobileCartOpen) setIsMobileCartOpen(false);
        handleOpenPayment();
    };

    const promptDiscount = async () => {
        if (isAuditMode) return; // 🛡️ Bloqueo de Auditoría

        let rawTotal = 0;
        cart.forEach(i => rawTotal += (parseFloat(i.price_usd) * i.quantity));
        
        if (rawTotal <= 0) {
            return Swal.fire({
                icon: 'warning', 
                title: 'Carrito Vacio', 
                text: 'Debes agregar productos antes de aplicar un descuento.',
                confirmButtonColor: '#3b82f6', 
                customClass: { popup: 'rounded-[2.5rem]' }
            });
        }
        
        const currentType = globalDiscount?.type && globalDiscount.type !== 'NONE' ? globalDiscount.type : 'PERCENTAGE';
        const currentVal = globalDiscount?.value > 0 ? globalDiscount.value : '';
        const hasActiveDiscount = globalDiscount?.value > 0;

        const result = await Swal.fire({
            title: '<h3 class="text-2xl font-black text-slate-800 mt-2">Descuento Global</h3>',
            html: `
                <div class="flex flex-col gap-5 text-left mt-4 font-sans px-2">
                    <div class="bg-blue-50/80 border border-blue-100 rounded-xl p-4 flex justify-between items-center shadow-inner backdrop-blur-sm">
                        <span class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Monto Bruto</span>
                        <span class="text-xl font-black text-blue-800">Ref ${rawTotal.toFixed(2)}</span>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Tipo de Descuento</label>
                        <select id="discount-type" class="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all cursor-pointer outline-none appearance-none">
                            <option value="PERCENTAGE" ${currentType === 'PERCENTAGE' ? 'selected' : ''}>Porcentaje (%)</option>
                            <option value="FIXED" ${currentType === 'FIXED' ? 'selected' : ''}>Monto Fijo (Ref)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Valor</label>
                        <div class="relative">
                            <input id="discount-val" type="number" step="0.01" min="0" value="${currentVal}" class="w-full bg-white border-2 border-slate-200 rounded-xl p-4 pl-14 text-3xl font-black text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder-slate-300" placeholder="0.00" autocomplete="off"/>
                            <span class="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-blue-500 select-none" id="discount-icon">${currentType === 'PERCENTAGE' ? '%' : '$'}</span>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true, 
            showDenyButton: hasActiveDiscount,
            confirmButtonText: hasActiveDiscount ? '✓ Actualizar' : '✓ Aplicar', 
            cancelButtonText: 'Cancelar', 
            denyButtonText: '🗑️ Borrar',
            customClass: {
                popup: 'rounded-[2.5rem] p-6 shadow-2xl border border-white/80 backdrop-blur-xl bg-white/90', 
                htmlContainer: '!mx-2 !mt-0', 
                actions: 'flex flex-wrap gap-3 w-full justify-center px-4 pb-2 mt-8',
                confirmButton: 'flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/30 active:scale-95 outline-none',
                denyButton: 'flex-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 font-bold py-3.5 px-4 rounded-xl transition-all active:scale-95 outline-none',
                cancelButton: 'w-full md:w-auto bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-95 outline-none'
            },
            buttonsStyling: false,
            didOpen: () => {
                const typeSelect = document.getElementById('discount-type');
                const iconSpan = document.getElementById('discount-icon');
                typeSelect.addEventListener('change', (e) => { 
                    iconSpan.innerText = e.target.value === 'PERCENTAGE' ? '%' : '$'; 
                    document.getElementById('discount-val').focus(); 
                });
                const input = document.getElementById('discount-val');
                input.focus(); if(input.value) input.select();
            },
            preConfirm: () => {
                const type = document.getElementById('discount-type').value;
                const valInput = document.getElementById('discount-val').value;
                if (!valInput || valInput.trim() === '') { Swal.showValidationMessage('⚠️ Por favor ingresa un valor'); return false; }
                const val = parseFloat(valInput);
                if (isNaN(val) || val < 0) { Swal.showValidationMessage('⚠️ El descuento debe ser mayor o igual a 0'); return false; }
                if (type === 'PERCENTAGE' && val > 100) { Swal.showValidationMessage('⚠️ El porcentaje no puede superar el 100%'); return false; }
                if (type === 'FIXED' && val > rawTotal) { Swal.showValidationMessage(`⚠️ El descuento no puede superar el monto bruto`); return false; }
                return { type, val };
            }
        });

        if (result.isConfirmed) {
            handleApplyDiscount(result.value.type, result.value.val);
        } else if (result.isDenied) {
            handleApplyDiscount('NONE', 0);
        }
    };

    return (
        <div className="flex flex-1 min-h-0 w-full flex-col md:flex-row bg-slate-50 font-sans relative">
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                
                {/* --- HEADER DEL POS: ADAPTATIVO IPAD / DESKTOP (SIN DESBORDAMIENTOS) --- */}
                <header className="bg-white border-b border-slate-100 px-3 sm:px-6 py-2.5 sm:py-3.5 flex justify-between items-center z-20 shrink-0 gap-2">
                    
                    {/* BLOQUE IZQUIERDO: Identidad de la Empresa */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 max-w-[140px] sm:max-w-[220px] md:max-w-[280px] lg:max-w-[400px]">
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                            {tenantBrand?.logoUrl ? (
                                <img src={tenantBrand.logoUrl} alt="Logo" className="h-full w-full object-contain p-0.5" />
                            ) : (
                                <span className="font-black text-blue-600 text-xs sm:text-sm">
                                    {tenantBrand?.tradeName ? tenantBrand.tradeName.charAt(0).toUpperCase() : 'B'}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-800 leading-none tracking-tight uppercase truncate cursor-help" title={tenantBrand?.companyName || tenantBrand?.tradeName}>
                                {tenantBrand?.tradeName || tenantBrand?.companyName || 'SISTEMA POS'}
                            </h1>
                            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 tracking-wider mt-0.5 truncate">
                                RIF: {tenantBrand?.companyDocument || 'J-00000000-0'}
                            </span>
                        </div>
                    </div>

                    {/* BLOQUE DERECHO: Widgets de Estado Comprimidos en Tablet */}
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0"> 
                        
                        {/* 1. CAJA OPERATIVA (SIEMPRE VISIBLE EN PC Y MÓVIL) */}
<motion.div 
    whileHover={{ scale: 1.02 }} 
    onClick={!cashShift ? () => {
        // 🛡️ ESCUDO UX PRO: Intercepta el clic si es administrador
        if (isAuditMode) {
            Swal.fire({
                icon: 'error',
                title: 'Restricci\u00F3n de Rol',
                html: `
                    <div class="text-left font-sans mt-2">
                        <p class="text-sm text-slate-600 mb-4">El rol <b>Administrador Maestro</b> tiene bloqueada la apertura de turnos por pol\u00EDticas de control interno.</p>
                        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-3 shadow-sm">
                            <svg class="w-6 h-6 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                            <div>
                                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Normativa Vigente</p>
                                <p class="text-xs text-slate-600 font-medium leading-relaxed">Usted solo est\u00E1 autorizado para auditar cajas, no para aperturar nuevas jornadas a su nombre.</p>
                            </div>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#0f172a',
                customClass: { 
                    popup: 'rounded-[2rem] w-[90%] sm:w-auto',
                    confirmButton: 'w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md mt-2 outline-none'
                }
            });
        } else {
            // Si es un cajero normal, procede a abrir la caja
            promptOpenCash();
        }
    } : undefined}
    className={`flex items-center gap-1.5 sm:gap-2.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border transition-all duration-300 ${!cashShift && 'cursor-pointer hover:shadow-md'} ${isAuditMode ? 'bg-amber-50 border-amber-200' : cashShift ? 'bg-[#ECFDF5] border-[#A7F3D0]' : 'bg-rose-50 border-rose-200'}`}
>
    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${isAuditMode ? 'bg-amber-100 text-amber-600' : cashShift ? 'bg-[#D1FAE5] text-[#059669]' : 'bg-rose-100 text-rose-600'}`}>
        {isAuditMode ? (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        ) : (
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        )}
    </div>
    {/* 🛡️ Modificación del Header "Caja Abierta" / "Modo Auditoría" */}
    <div className="hidden xl:flex flex-col text-left">
        <span className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${isAuditMode ? 'text-amber-800' : cashShift ? 'text-[#047857]' : 'text-rose-700'}`}>
            {isAuditMode ? 'MODO AUDITOR\u00CDA' : cashShift ? 'Caja Abierta' : 'Caja Cerrada'}
        </span>
        <span className={`text-[10px] font-bold leading-none ${isAuditMode ? 'text-amber-600' : 'text-slate-600'}`}>
            {isAuditMode ? 'Ventas Bloqueadas' : cashShift ? new Date(cashShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Click para abrir'}
        </span>
    </div>
</motion.div>

                        {/* 2. VENTAS DEL DÍA (Oculto en móvil, visible en PC) */}
                        <motion.button 
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={handleOpenDailySales} 
                            className="hidden xl:flex items-center gap-1.5 sm:gap-2.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-slate-50 rounded-2xl border border-blue-100 hover:border-blue-200 transition-all outline-none"
                        >
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm border border-blue-50">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Ventas del Día</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-xs font-black text-slate-800 leading-none">Ref {parseFloat(dailySalesUSD).toFixed(2)}</span>
                                </div>
                            </div>
                        </motion.button>

                        {/* 3. ALERTA DE STOCK (Oculto en móvil, visible en PC) */}
                        <motion.button 
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={handleOpenStockAlerts} 
                            className={`hidden xl:flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white rounded-2xl border transition-all outline-none ${lowStockCount > 0 ? 'border-amber-300 hover:border-amber-400 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                            <div className="relative flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7">
                                <span className={`text-base sm:text-lg ${lowStockCount > 0 ? 'grayscale-0' : 'grayscale opacity-50'}`}>🔔</span>
                                {lowStockCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full text-[9px] font-black shadow-sm border border-white">
                                        {lowStockCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col text-left pr-1">
                                <span className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${lowStockCount > 0 ? 'text-[#D97706]' : 'text-slate-400'}`}>Stock</span>
                                <span className={`text-[10px] font-bold leading-none ${lowStockCount > 0 ? 'text-[#F59E0B]' : 'text-slate-400'}`}>Alertas</span>
                            </div>
                        </motion.button>

                        {/* 4. ÓRDENES EN ESPERA (Oculto en móvil, visible en PC) */}
                        <motion.button 
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                if (!heldOrders || heldOrders.length === 0) {
                                    return Swal.fire({ icon: 'info', title: 'Sin Ordenes', text: 'No hay ordenes pausadas en este momento.', customClass: { popup: 'rounded-[2.5rem]' }, confirmButtonColor: '#4f46e5' });
                                }
                                
                                let htmlRows = heldOrders.map(o => `
                                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all mb-3 group gap-3 sm:gap-0">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg sm:text-xl font-black shadow-inner shrink-0 border border-indigo-100">
                                                ${o.reference_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div class="text-left">
                                                <p class="font-black text-slate-800 text-sm sm:text-base line-clamp-1">${o.reference_name}</p>
                                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
                                                    <span class="mr-1">🕒</span> ${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                        <div class="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                            <button class="resume-btn flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 outline-none" data-id="${o.id}">
                                                Retomar
                                            </button>
                                            <button class="delete-btn flex-none bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center outline-none" data-id="${o.id}">
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                `).join('');

                                Swal.fire({
                                    title: '<h3 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Ordenes Pausadas</h3>',
                                    html: `<div class="max-h-[50vh] overflow-y-auto px-1 py-2 custom-scrollbar text-left">${htmlRows}</div>`,
                                    showConfirmButton: false, showCloseButton: true, width: '600px',
                                    customClass: { popup: 'rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-white/80 bg-slate-50/90 backdrop-blur-xl' },
                                    didOpen: () => {
                                        document.querySelectorAll('.resume-btn').forEach(btn => {
                                            btn.addEventListener('click', (e) => {
                                                if (isAuditMode) return; // 🛡️ Bloqueo
                                                e.preventDefault();
                                                e.stopPropagation();
                                                
                                                const order = heldOrders.find(o => o.id == btn.dataset.id);
                                                if (order) handleResumeOrder(order, products);
                                            });
                                        });

                                        document.querySelectorAll('.delete-btn').forEach(btn => {
                                            btn.addEventListener('click', (e) => {
                                                if (isAuditMode) return; // 🛡️ Bloqueo
                                                e.preventDefault();
                                                e.stopPropagation();
                                                
                                                Swal.fire({
                                                    title: '<h3 class="text-xl font-black text-slate-800 mt-2">Eliminando orden...</h3>',
                                                    html: '<p class="text-sm text-slate-500 font-medium">Actualizando base de datos</p>',
                                                    allowOutsideClick: false,
                                                    showConfirmButton: false,
                                                    customClass: { popup: 'rounded-[2.5rem]' },
                                                    didOpen: () => Swal.showLoading()
                                                });
                                                
                                                handleDeleteHeldOrder(btn.dataset.id);
                                            });
                                        });
                                    }
                                });
                            }} 
                            className={`hidden xl:flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white rounded-2xl border transition-all outline-none ${heldOrders?.length > 0 ? 'border-indigo-400 bg-indigo-50/60 shadow-sm' : 'border-slate-200 hover:border-indigo-200'}`}
                        >
                            <div className="relative flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7">
                                <span className="text-base sm:text-lg">⏳</span>
                                {heldOrders?.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-indigo-600 text-white min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full text-[9px] font-black shadow-sm border border-white animate-pulse">
                                        {heldOrders.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col text-left pr-1">
                                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest leading-none mb-1">Ordenes</span>
                                <span className="text-[10px] font-bold text-indigo-500 leading-none">En Espera</span>
                            </div>
                        </motion.button>

                        {/* 5. TASA BCV (SIEMPRE VISIBLE EN PC Y MÓVIL) */}
                        <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white rounded-2xl border border-slate-200 cursor-default">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hidden xl:flex">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="hidden xl:block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Oficial BCV</span>
                                <span className="text-[10px] sm:text-xs font-black text-slate-800 leading-none font-mono">{(bcvRate || 0).toFixed(2)} Bs</span>
                            </div>
                            <div className="h-4 w-px bg-slate-200 mx-0.5 hidden xl:block"></div>
                            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-sm ${isFallbackActive || bcvRate === 0 ? 'bg-amber-500 shadow-amber-200' : 'bg-emerald-500 shadow-emerald-200'}`}></div>
                        </motion.div>

                    </div>
                </header>

                {/* ========================================================================= */}
                {/* 📱 🚀 SMART ACTION BAR (EXCLUSIVA PARA MÓVIL Y IPAD < 1280px) */}
                {/* ========================================================================= */}
                <div className="xl:hidden w-full bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.03)] z-10">
                    
                    {/* 1. 🚨 BOTÓN "VER ORDEN" CON TRANSICIÓN NATIVA ULTRA-FLUIDA */}
                    <AnimatePresence mode="popLayout">
                        {(cart || []).length > 0 && (
                            <motion.button 
                                layout
                                initial={{ opacity: 0, scale: 0.88, x: -12 }} 
                                animate={{ opacity: 1, scale: 1, x: 0 }} 
                                exit={{ opacity: 0, scale: 0.88, x: -12 }}
                                transition={{ 
                                    type: 'spring', 
                                    stiffness: 500, 
                                    damping: 32, 
                                    opacity: { duration: 0.18 } 
                                }}
                                onClick={() => setIsMobileCartOpen(true)}
                                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl shadow-md bg-blue-600 text-white hover:bg-blue-700 border border-blue-500 outline-none active:scale-95"
                            >
                                <div className="relative">
                                    <span className="text-lg sm:text-xl">🛒</span>
                                    <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-blue-600 shadow-sm">
                                        {(cart || []).reduce((a,c)=>a+c.quantity,0)}
                                    </span>
                                </div>
                                <div className="flex flex-col text-left leading-none">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-100 mb-0.5">Ver Orden</span>
                                    <span className="text-[11px] sm:text-xs font-black">Bs {(totalVES || 0).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                                </div>
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* 2. ÓRDENES EN ESPERA (SIEMPRE VISIBLE EN MÓVIL) */}
                    <button 
                        onClick={() => {
                            if (!heldOrders || heldOrders.length === 0) {
                                return Swal.fire({ icon: 'info', title: 'Sin Ordenes', text: 'No hay ordenes pausadas en este momento.', customClass: { popup: 'rounded-[2.5rem]' }, confirmButtonColor: '#4f46e5' });
                            }
                            
                            let htmlRows = heldOrders.map(o => `
                                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all mb-3 group gap-3 sm:gap-0">
                                    <div class="flex items-center gap-4">
                                        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg sm:text-xl font-black shadow-inner shrink-0 border border-indigo-100">
                                            ${o.reference_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div class="text-left">
                                            <p class="font-black text-slate-800 text-sm sm:text-base line-clamp-1">${o.reference_name}</p>
                                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
                                                <span class="mr-1">🕒</span> ${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                        <button class="resume-btn flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 outline-none" data-id="${o.id}">
                                            Retomar
                                        </button>
                                        <button class="delete-btn flex-none bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center outline-none" data-id="${o.id}">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            `).join('');

                            Swal.fire({
                                title: '<h3 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Ordenes Pausadas</h3>',
                                html: `<div class="max-h-[50vh] overflow-y-auto px-1 py-2 custom-scrollbar text-left">${htmlRows}</div>`,
                                showConfirmButton: false, showCloseButton: true, width: '600px',
                                customClass: { popup: 'rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-white/80 bg-slate-50/90 backdrop-blur-xl' },
                                didOpen: () => {
                                        document.querySelectorAll('.resume-btn').forEach(btn => {
                                            btn.addEventListener('click', (e) => {
                                                if (isAuditMode) return; // 🛡️ Bloqueo
                                                e.preventDefault();
                                                e.stopPropagation();
                                                
                                                const order = heldOrders.find(o => o.id == btn.dataset.id);
                                                if (order) handleResumeOrder(order, products);
                                            });
                                        });

                                        document.querySelectorAll('.delete-btn').forEach(btn => {
                                            btn.addEventListener('click', (e) => {
                                                if (isAuditMode) return; // 🛡️ Bloqueo
                                                e.preventDefault();
                                                e.stopPropagation();
                                                
                                                Swal.fire({
                                                    title: '<h3 class="text-xl font-black text-slate-800 mt-2">Eliminando orden...</h3>',
                                                    html: '<p class="text-sm text-slate-500 font-medium">Actualizando base de datos</p>',
                                                    allowOutsideClick: false,
                                                    showConfirmButton: false,
                                                    customClass: { popup: 'rounded-[2.5rem]' },
                                                    didOpen: () => Swal.showLoading()
                                                });
                                                
                                                handleDeleteHeldOrder(btn.dataset.id);
                                            });
                                        });
                                    }
                            });
                        }} 
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border transition-all outline-none active:scale-95 shadow-sm ${heldOrders?.length > 0 ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 hover:border-indigo-200'}`}
                    >
                        <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6">
                            <span className="text-sm sm:text-base">⏳</span>
                            {heldOrders?.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full text-[8px] font-black shadow-sm border border-white animate-pulse">
                                    {heldOrders.length}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] sm:text-xs font-black text-indigo-700 uppercase tracking-widest">En Espera</span>
                    </button>

                    {/* 3. VENTAS DEL DÍA (MÓVIL) */}
                    <button 
                        onClick={handleOpenDailySales} 
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 transition-all outline-none active:scale-95 shadow-sm hover:bg-slate-100"
                    >
                        <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-blue-600 bg-white rounded-full border border-blue-100 shadow-sm">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                        </div>
                        <span className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest">Ventas</span>
                    </button>

                    {/* 4. ALERTA DE STOCK (Visible en móvil si hay stock bajo) */}
                    {lowStockCount > 0 && (
                        <button 
                            onClick={handleOpenStockAlerts} 
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-50 rounded-xl border border-amber-300 transition-all outline-none shadow-sm active:scale-95`}
                        >
                            <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6">
                                <span className={`text-sm sm:text-base grayscale-0`}>🔔</span>
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-white min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full text-[8px] font-black shadow-sm border border-white">
                                    {lowStockCount}
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-black text-amber-700 uppercase tracking-widest">Alertas</span>
                        </button>
                    )}

                </div>

                {/* 📱 🛵 PANEL DE INFORMACIÓN DE DELIVERY (Visible en Móvil/Tablet si está activo) */}
                <AnimatePresence>
                    {isDelivery && deliveryInfo?.address && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="xl:hidden w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-4 sm:px-6 py-3 shrink-0 z-10 shadow-inner">
                            <div className="flex items-start gap-3 cursor-pointer group" onClick={promptDeliveryInfo} title="Editar datos de envío">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm border border-blue-100 group-hover:scale-110 transition-transform">📍</div>
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-blue-800 uppercase tracking-widest">Destino Delivery (Tocar para editar)</p>
                                    <p className="text-xs sm:text-sm text-slate-700 font-bold leading-tight mt-0.5 line-clamp-2">{deliveryInfo.address}</p>
                                    <p className="text-[10px] text-blue-600 font-black mt-1.5 tracking-widest uppercase flex items-center gap-1">
                                        <span>🏍️</span> {deliveryInfo.driver_name}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* ========================================================================= */}

                {/* --- BARRA DE BÚSQUEDA --- */}
                <div className="px-5 py-4 bg-white/60 backdrop-blur-md border-b border-white shrink-0 z-10 relative">
                    <div className="relative group">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-blue-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </span>
                        {/* 🛡️ BLINDAJE LECTORA DE BARRAS: Atrapamos el Enter directamente */}
                        <Input 
                            key="pos-search-input-fix" 
                            placeholder="🔍 Buscar artículo o escanear código..." 
                            value={posSearchQuery || ''} 
                            disabled={isAuditMode}
                            onChange={(e) => setPosSearchQuery(e.target.value)} 
                            onKeyDown={(e) => {
                                if (isAuditMode) return; // 🛡️ Bloqueo de Auditoría
                                if (e.key === 'Enter') {
                                    const query = e.target.value.trim();
                                    if (!query) return;
                                    
                                    // Buscar coincidencia exacta por código de barra (Ignorando mayúsculas/minúsculas por si acaso)
                                    const scannedProduct = currentProducts.find(p => p.barcode && p.barcode.toLowerCase() === query.toLowerCase());
                                    
                                    if (scannedProduct) {
                                        const isOutOfStock = !scannedProduct.is_service && !scannedProduct.is_raw_material && (scannedProduct.stock || 0) <= 0;
                                        
                                        if (!isOutOfStock) {
                                            playBeep('success');
                                            addToCart(scannedProduct);
                                            setPosSearchQuery(''); // Limpia el buscador al encontrarlo
                                            
                                            // Feedback sutil
                                            Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1500 }).fire({
                                                icon: 'success',
                                                title: `+1 ${scannedProduct.name}`
                                            });
                                        } else {
                                            playBeep('error');
                                            Swal.fire({ icon: 'error', title: 'Sin Stock', text: `El producto "${scannedProduct.name}" está agotado.`, timer: 2000, showConfirmButton: false });
                                        }
                                    } else {
                                        playBeep('error');
                                    }
                                }
                            }}
                            autoFocus={!isAuditMode} 
                            className={`w-full !pl-12 !border-slate-200 focus:!border-blue-400 focus:!ring-4 focus:!ring-blue-500/10 !rounded-[1.25rem] py-3.5 text-sm font-bold text-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all ${isAuditMode ? '!bg-slate-100 opacity-60 cursor-not-allowed' : '!bg-white'}`}
                        />
                    </div>
                </div>

                {/* --- CARRUSEL DE CATEGORÍAS --- */}
                <div className="w-full bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 h-16 shadow-inner z-10 flex items-center px-3 gap-2 shrink-0">
                    
                    {/* Flecha Izquierda */}
                    <button onClick={() => scrollCategories('left')} className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm hover:text-blue-600 hover:border-blue-300 transition-all active:scale-95 outline-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    {/* Contenedor Scrollable */}
                    <div ref={categoryScrollRef} className="flex-1 flex overflow-x-auto gap-3 h-full items-center no-scrollbar scroll-smooth snap-x px-1">
                        {(categories || []).map((cat) => {
                            const isActive = selectedCategory === cat;
                            return (
                                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`snap-start shrink-0 whitespace-nowrap px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border select-none outline-none ${isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-lg shadow-blue-500/20' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-md shadow-sm'}`}>
                                    {cat === 'Todos' && <span className="text-sm mr-1">⚡</span>}{cat}
                                </button>
                            );
                        })}
                    </div>

                    {/* Flecha Derecha */}
                    <button onClick={() => scrollCategories('right')} className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm hover:text-blue-600 hover:border-blue-300 transition-all active:scale-95 outline-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                    
                </div>

                {/* 🚀 GRID DE PRODUCTOS MEMOIZADO (Aceleración de Hardware) */}
                <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar relative">
                    <motion.div variants={gridVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {(currentProducts || []).map((prod) => (
                            <ProductCard key={prod.id} prod={prod} addToCart={safeAddToCart} isAuditMode={isAuditMode} isZombieShift={isZombieShift} />
                        ))}
                    </motion.div>
                </div>

                {/* 🚀 PAGINACIÓN DINÁMICA ESTILO INVENTORY VIEW */}
                {(currentProducts.length > 0 || totalPages > 1) && (
                    <div className="p-3 border-t border-slate-200/60 flex justify-between items-center gap-4 bg-slate-50/80 backdrop-blur-sm sticky bottom-0 shrink-0 z-20">
                        
                        {/* Selector Dinámico de Cantidad */}
                        <select 
                            value={productsPerPage} 
                            onChange={(e) => { 
                                if(setProductsPerPage) {
                                    setProductsPerPage(Number(e.target.value)); 
                                    paginate(1); // Forzamos ir a la página 1 para evitar errores de offset
                                }
                            }} 
                            className="bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1.5 px-3 outline-none cursor-pointer text-slate-600 shadow-sm focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            <option value={12}>12 / pág</option>
                            <option value={25}>25 / pág</option>
                            <option value={50}>50 / pág</option>
                            <option value={100}>100 / pág</option>
                        </select>
                        
                        {/* Controles de Paginación Mejorados (ANT y SIG) */}
                        <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                            <Button 
                                variant="ghost" 
                                onClick={() => paginate(currentPage - 1)} 
                                disabled={currentPage === 1} 
                                className="!text-[10px] !py-1 !px-3 font-black uppercase hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30"
                            >
                                ANT
                            </Button>
                            
                            <span className="text-[10px] font-black text-slate-500 tracking-wider">
                                {currentPage} <span className="text-slate-300 font-medium">/</span> {totalPages || 1}
                            </span>
                            
                            <Button 
                                variant="ghost" 
                                onClick={() => paginate(currentPage + 1)} 
                                disabled={currentPage === totalPages || totalPages === 0} 
                                className="!text-[10px] !py-1 !px-3 font-black uppercase hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30"
                            >
                                SIG
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* 3️⃣ Paso 3: Convertir el <aside> en un Cajón Táctil Móvil */}
            {/* 🚨 MAGIA RESPONSIVE: En PC es un sidebar normal (xl:relative xl:w-[380px]). En Móvil/Tablet es un Modal Full Screen (fixed inset-0) */}
            <aside className={`
                ${isMobileCartOpen ? 'fixed inset-0 w-full h-[100dvh] z-[100] flex animate-in slide-in-from-bottom-10 fade-in duration-300' : 'hidden'} 
                xl:relative xl:inset-auto xl:w-[360px] 2xl:w-[380px] xl:h-auto xl:flex xl:flex-col xl:z-30 xl:animate-none xl:transform-none
                bg-white/95 backdrop-blur-2xl xl:border-l xl:border-white flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.05)] transition-all xl:border-t-[6px] ${isDelivery ? 'xl:border-t-blue-500' : 'xl:border-t-slate-800'}
            `}>
                
                {/* 📱 ENCABEZADO DEL CARRITO MÓVIL (Solo visible cuando el modal se abre en móvil) */}
                {isMobileCartOpen && (
                    <div className="xl:hidden flex justify-between items-center px-5 py-4 bg-slate-800 text-white shrink-0 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">🛒</div>
                            <div className="flex flex-col">
                                <span className="font-black text-base uppercase tracking-widest">Orden Actual</span>
                                <span className="text-[10px] font-bold text-slate-300">{(cart || []).reduce((a,c)=>a+c.quantity,0)} Artículos</span>
                            </div>
                        </div>
                        <button onClick={() => setIsMobileCartOpen(false)} className="w-10 h-10 bg-white/10 hover:bg-red-500 text-white rounded-full flex items-center justify-center font-black text-xl transition-all active:scale-95 outline-none">
                            ✕
                        </button>
                    </div>
                )}

                <div className="p-5 border-b border-slate-100 bg-white/50 shrink-0">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center justify-between w-full shadow-inner relative border border-slate-200/50">
                        <button
                            onClick={() => {
                                setIsDelivery(false);
                                setDeliveryInfo({ driver_id: '', driver_name: '', address: '', status: 'PENDIENTE' });
                                setCart(prev => prev.filter(i => !(i.is_service === true && (i.name.toLowerCase().includes('delivery') || i.name.toLowerCase().includes('despacho') || i.name.toLowerCase().includes('flete')))));
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 outline-none ${!isDelivery ? 'bg-white text-slate-800 shadow-md shadow-slate-200/50 scale-100 border border-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 scale-95'}`}
                        >
                            <span className="text-sm">🏪</span> Tienda
                        </button>
                        <button
                            onClick={() => { if (!isDelivery) promptDeliveryInfo(); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 outline-none ${isDelivery ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 scale-95'}`}
                        >
                            <span className="text-sm">🛵</span> Delivery
                        </button>
                    </div>

                    {/* EN PC: Muestra el destino del delivery aquí arriba */}
                    <AnimatePresence>
                        {isDelivery && deliveryInfo?.address && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden hidden xl:block">
                                <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-4 text-left flex items-start gap-3 cursor-pointer hover:shadow-md transition-all group" onClick={promptDeliveryInfo} title="Editar datos de envío">
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm border border-blue-100 group-hover:scale-110 transition-transform">📍</div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-blue-800 uppercase tracking-widest">Destino</p>
                                        <p className="text-xs text-slate-700 font-bold leading-tight mt-1 line-clamp-2">{deliveryInfo.address}</p>
                                        <p className="text-[10px] text-blue-600 font-black mt-2 tracking-widest uppercase flex items-center gap-1">
                                            <span>🏍️</span> {deliveryInfo.driver_name}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar bg-slate-50/50">
                    {/* ZONA DE CARRITO VACÍO (PROTEGIDA) */}
                    <AnimatePresence mode="popLayout">
                        {(cart || []).length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-slate-300 space-y-3">
                                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                <p className="text-[10px] font-black uppercase tracking-widest">Carrito Vacío</p>
                            </motion.div>
                        ) : (
                            (cart || []).map(item => <CartItem key={item.id} item={item} removeFromCart={removeFromCart} isAuditMode={isAuditMode} />)
                        )}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {(cart || []).length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-5 pt-5 pb-3 border-t border-slate-100 bg-white shrink-0">
                            <div className="flex justify-end mb-4">
                                <button onClick={promptDiscount} disabled={isAuditMode} className={`text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm border outline-none active:scale-95 ${isAuditMode ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : discountUSD > 0 ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200' : 'bg-slate-50 text-blue-600 hover:bg-blue-50 border-slate-200 hover:border-blue-200 hover:shadow-md'}`}>
                                    <span className="text-sm">{discountUSD > 0 ? '🏷️' : '🎁'}</span>
                                    {discountUSD > 0 ? 'Modificar Descuento' : 'Aplicar Descuento'}
                                </button>
                            </div>

                            <div className="space-y-1.5 px-1 text-sm font-medium text-slate-500">
                                {discountUSD > 0 && (
                                    <div className="flex justify-between items-center text-sm mb-3 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200/50 shadow-inner">
                                        <span className='font-black text-emerald-700 text-[10px] uppercase tracking-widest flex items-center gap-1.5'><span className="text-emerald-500">▼</span> Desc. Global</span>
                                        <span className='font-black text-emerald-600'>- Ref {(discountUSD || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {(subtotalExemptUSD || 0) > 0 && <div className="flex justify-between"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal Exento</span><span className='font-black text-slate-700'>Ref {(subtotalExemptUSD || 0).toFixed(2)}</span></div>}
                                <div className="flex justify-between"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Imponible</span><span className='font-black text-slate-700'>Ref {(subtotalTaxableUSD || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-[10px] font-black text-red-400 uppercase tracking-widest">IVA ({IVA_RATE * 100}%)</span><span className='font-black text-red-500'>Ref {(ivaUSD || 0).toFixed(2)}</span></div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-5 bg-slate-50 border-t border-slate-200 shadow-inner z-30 shrink-0">
                    <div className="flex justify-between mb-5 items-end px-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</span>
                        <div className="flex flex-col items-end">
                            <span className="text-4xl font-black text-slate-800 leading-none tracking-tighter">Bs {(totalVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-xs font-black text-blue-600 mt-1.5 bg-blue-100/50 px-2.5 py-0.5 rounded-md border border-blue-200/50 uppercase tracking-widest">Ref {(finalTotalUSD || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <motion.div whileHover={!isAuditMode ? { scale: 1.01 } : {}} whileTap={!isAuditMode ? { scale: 0.98 } : {}}>
                        <Button 
    variant={isDelivery ? "primary" : "danger"} 
    onClick={handleDeliveryCheckout} 
    disabled={(cart || []).length === 0 || isActionBlocked}
    className={`w-full !rounded-[1.25rem] !py-4 text-sm font-black uppercase tracking-widest shadow-lg border-0 transition-all duration-300
        ${isActionBlocked ? '!bg-amber-100 !text-amber-600 !shadow-none !cursor-not-allowed' : 
        isDelivery ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30 text-white' : 
        'bg-slate-800 hover:bg-slate-900 shadow-slate-800/20 text-white'}`}
>
    <span className="flex items-center justify-center">
        {isActionBlocked ? (
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
        ) : isDelivery ? (
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h8l1 4h3l2 4v4h-2a2 2 0 01-4 0H9a2 2 0 01-4 0H3v-6l2-6z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a2 2 0 100-4 2 2 0 000 4zM17 16a2 2 0 100-4 2 2 0 000 4z"></path></svg>
        ) : (
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
        )}
        {isZombieShift ? 'TURNO VENCIDO (CIERRE CAJA)' : isAuditMode ? 'BLOQUEADO (AUDITOR\u00CDA)' : isDelivery ? 'COBRAR DELIVERY' : 'COBRAR TICKET'}
    </span>
</Button>
                    </motion.div>
                    
                    <AnimatePresence>
                        {(cart || []).length > 0 && !isAuditMode && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex gap-3 mt-3 overflow-hidden">
                                <Button variant="cancel" onClick={() => { setCart([]); handleApplyDiscount('NONE', 0); setIsDelivery(false); setDeliveryInfo({ driver_id: '', driver_name: '', address: '', status: 'PENDIENTE' }); setIsMobileCartOpen(false); }} className="flex-1 !py-3 !rounded-xl text-[9px] font-black uppercase tracking-widest !bg-white !text-red-500 border-2 !border-red-100 hover:!bg-red-50 hover:!border-red-200 flex items-center justify-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    CANCELAR
                                </Button>
                                <Button variant="warning" onClick={() => { handlePauseOrder(); setIsMobileCartOpen(false); }} className="flex-1 !py-3 !rounded-xl text-[9px] font-black uppercase tracking-widest !bg-amber-50 !text-amber-600 border-2 !border-amber-100 hover:!bg-amber-100 hover:!border-amber-200 flex items-center justify-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    PAUSAR
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </aside>
        </div>
    );
};

export default PosView;