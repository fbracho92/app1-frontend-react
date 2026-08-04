import React from 'react';
import Swal from 'sweetalert2';
import Input from './Input';
import { tenantConfig } from '../../config/tenantConfig'; // <--- 1. IMPORTAMOS EL ADN DE LA EMPRESA

// ?? OPTIMIZADO Y MEMOIZADO: Teclado Num谷rico Custom para M車viles/T芍ctil (CERO LAG)
const NumpadModal = React.memo(({
    paymentMethods,
    currentMethod,
    methodsRequiringReference,
    totalRemainingUSD, // Pasado como prop en lugar de llamar a calculatePaymentTotals internamente
    bcvRate,
    currentInputValue,
    setCurrentInputValue,
    currentReference,
    setCurrentReference,
    updatePaymentShare,
    setPaymentReferences,
    setIsNumpadOpen,
    handlePayRemaining
}) => {
    const methodData = paymentMethods.find(m => m.name === currentMethod);
    const currencySymbol = methodData.currency === 'Ref' ? 'Ref' : 'Bs';
    const needsReference = methodsRequiringReference.includes(currentMethod);

    // --- ?? L車GICA INTELIGENTE IGTF 3% (VISUAL) ---
    // Evaluamos si aplica IGTF: Si la empresa es Especial Y el m谷todo es en Divisas sin banco nacional.
    const isIgtfApplicable = tenantConfig.isSpecialTaxpayer && 
                             currencySymbol === 'Ref' && 
                             !currentMethod.toUpperCase().includes('CR\u00C9DITO') &&
                             !currentMethod.toUpperCase().includes('DONACI\u00D3N');

    // Calculamos en vivo cu芍nto IGTF est芍 generando el monto que el cajero est芍 tipeando
    const currentInputNumber = parseFloat(currentInputValue) || 0;
    const igtfSurchargeUSD = isIgtfApplicable ? (currentInputNumber * tenantConfig.igtfRate) : 0;
    
    // Calculamos el saldo faltante "real" que debe cubrir (Base Faltante + IGTF sobre la base faltante)
    let dynamicRemainingUSD = totalRemainingUSD;
    if (isIgtfApplicable) {
        dynamicRemainingUSD = totalRemainingUSD + (totalRemainingUSD * tenantConfig.igtfRate);
    }
    const totalRemainingVES = dynamicRemainingUSD * bcvRate;
    // ---------------------------------------------

    const handleNumpadClick = (key) => {
        if (key === 'C') {
            setCurrentInputValue('');
            return;
        }
        if (key === 'DEL') {
            setCurrentInputValue(prev => prev.slice(0, -1));
            return;
        }
        if (key === '.') {
            if (currentInputValue.includes('.')) return;
            setCurrentInputValue(prev => prev + '.');
            return;
        }

        let newValue = currentInputValue + key;
        if (newValue.includes('.')) {
            const parts = newValue.split('.');
            if (parts[1].length > 2) return;
        }
        if (newValue.length > 1 && newValue.startsWith('0') && !newValue.includes('.')) {
            newValue = newValue.substring(1);
        }

        setCurrentInputValue(newValue);
    };

    const handleConfirm = () => {
        const finalValue = parseFloat(currentInputValue).toFixed(2) || '';
        const finalValueNum = parseFloat(finalValue) || 0;

        // ?? UX BLINDADA: Excepci車n Zelle menor a $5
        const isZelle = currentMethod.toUpperCase().includes('ZELLE');
        const isZelleExempt = isZelle && finalValueNum < 5;

        // Validar si requiere referencia (ignorando si cae en la excepci車n de Zelle)
        if (needsReference && finalValueNum > 0 && !isZelleExempt && !currentReference.trim()) {
            return Swal.fire({
                title: 'Referencia Requerida', 
                text: 'Por favor, ingrese la referencia bancaria para este monto.', 
                icon: 'warning',
                confirmButtonColor: '#1e293b', // slate-800 corporativo
                customClass: { popup: 'rounded-3xl' }
            });
        }

        updatePaymentShare(currentMethod, finalValue);
        setPaymentReferences(prev => ({ ...prev, [currentMethod]: currentReference.trim() }));

        setIsNumpadOpen(false);
        setCurrentInputValue('');
        setCurrentReference('');
    };

    const numpadKeys = [
        '7', '8', '9',
        '4', '5', '6',
        '1', '2', '3',
        'C', '0', '.',
    ];

    // L車gica din芍mica para la etiqueta del input (UX)
    const isZelle = currentMethod.toUpperCase().includes('ZELLE');
    let referenceLabel = 'Referencia Bancaria *';
    if (isZelle) {
        referenceLabel = currentInputNumber < 5 ? 'Referencia Bancaria (Opcional)' : 'Referencia Bancaria *';
    }

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-0 md:items-center md:p-8 animate-fade-in font-sans">
            {/* Contenedor Clean Premium (GPU Accelerated) */}
            <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-t border-slate-100 md:border-x animate-slide-up-numpad flex flex-col overflow-hidden transform-gpu">
                
                {/* ?? HEADER LIMPIO Y CERRAR */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-50 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                             <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <div>
                            <h4 className="font-black text-lg text-slate-800 tracking-tight leading-none">{currentMethod}</h4>
                            {/* UX: Etiqueta indicadora de IGTF */}
                            {isIgtfApplicable && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-widest mt-1.5 inline-block">
                                    + {tenantConfig.igtfRate * 100}% IGTF
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setIsNumpadOpen(false)} className="h-8 w-8 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-colors outline-none">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* DISPLAY DE MONTO PRINCIPAL Y SALDO FALTANTE (UX) */}
                <div className="p-6 text-center bg-gradient-to-b from-slate-50/50 to-white">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto Entregado</p>
                    <h2 className="text-5xl font-black text-slate-800 tracking-tighter">
                        <span className="text-2xl text-slate-400 mr-1 align-top relative top-1.5">{currencySymbol}</span>
                        {currentInputValue || '0.00'}
                    </h2>

                    {/* UX: INFO DIN芍MICA DE IGTF */}
                    {isIgtfApplicable && currentInputNumber > 0 && (
                        <div className="mt-3 animate-fade-in">
                            <span className="inline-block bg-white px-3 py-1 rounded-full border border-slate-200 text-[10px] text-amber-600 font-bold uppercase tracking-wider shadow-sm">
                                Incluye <span className="font-black">Ref {igtfSurchargeUSD.toFixed(2)}</span> de IGTF
                            </span>
                        </div>
                    )}

                    {/* INDICADOR DE SALDO FALTANTE (Recalculado con Impuesto) */}
                    {dynamicRemainingUSD > 0.05 && (
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Falta cubrir:</p>
                            <div className="bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100 flex items-center gap-1.5">
                                <span className="font-black text-rose-600 text-sm">Ref {dynamicRemainingUSD.toFixed(2)}</span>
                                <span className="text-rose-300 font-bold text-[10px]">|</span>
                                <span className="text-[10px] font-bold text-rose-500">Bs {totalRemainingVES.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* CAMPO DE REFERENCIA BANCARIA (Integrado al dise?o) */}
                {needsReference && (
                    <div className="px-6 pb-2">
                        <Input
                            label={referenceLabel}
                            value={currentReference}
                            onChange={(e) => setCurrentReference(e.target.value.toUpperCase())}
                            placeholder="Ej: A1234, 1234567"
                            autoFocus={true}
                            className="!space-y-0 [&_label]:!text-slate-400 [&_label]:!text-[10px] [&_label]:!uppercase [&_label]:!tracking-widest [&_label]:!font-bold [&_label]:!block [&_label]:!mb-1.5 [&_input]:!bg-slate-50 [&_input]:!border-slate-200 focus-within:[&_input]:!border-slate-400 focus-within:[&_input]:!bg-white [&_input]:!p-3.5 [&_input]:!text-sm [&_input]:!font-bold [&_input]:!text-slate-700 [&_input]:!rounded-xl [&_input]:!shadow-inner transition-colors"
                        />
                    </div>
                )}

                {/* NUMPAD GRID MODERNO */}
                <div className="px-6 pb-4 grid grid-cols-3 gap-3">
                    {numpadKeys.map(key => (
                        <button
                            key={key}
                            onClick={() => handleNumpadClick(key)}
                            onMouseDown={(e) => e.preventDefault()} 
                            className={`h-[3.25rem] rounded-xl text-2xl font-bold transition-all active:scale-95 shadow-sm ${
                                key === 'C' 
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100/50' 
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                            }`}
                        >
                            {key}
                        </button>
                    ))}
                    {/* Bot車n Borrar (Backspace) */}
                    <button
                        onClick={handleNumpadClick.bind(null, 'DEL')}
                        onMouseDown={(e) => e.preventDefault()} 
                        className="col-span-1 h-[3.25rem] rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm bg-white border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-500"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"></path></svg>
                    </button>
                </div>

                {/* ACCIONES R芍PIDAS (Footer Corporativo) */}
                <div className="px-6 pb-6 pt-2 flex gap-3">
                    <button
                        onClick={() => {
                            // ?? SOLUCI車N MATEM芍TICA: Detecta qu谷 moneda es el m谷todo para rellenar
                            const valToSet = currencySymbol === 'Bs' ? totalRemainingVES.toFixed(2) : dynamicRemainingUSD.toFixed(2);
                            setCurrentInputValue(valToSet);
                            handlePayRemaining();
                        }}
                        onMouseDown={(e) => e.preventDefault()} 
                        className="w-1/3 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-black py-4 rounded-xl transition-colors text-[10px] uppercase tracking-widest active:scale-95"
                    >
                        Monto Total
                    </button>
                    <button
                        onClick={handleConfirm}
                        onMouseDown={(e) => e.preventDefault()} 
                        className="w-2/3 bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg shadow-slate-800/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
});

export default NumpadModal;