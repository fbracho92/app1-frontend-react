import React from 'react';

// Componente Reutilizable para la entrada de Pago (UX Táctil Premium)
const PaymentInput = React.memo(({ 
    name, 
    currency, 
    value,
    currentMethod,
    isNumpadOpen,
    paymentReferences,
    setCurrentMethod,
    setCurrentInputValue,
    setCurrentReference,
    setIsNumpadOpen
}) => {
    const isSelected = currentMethod === name && isNumpadOpen;
    const displayValue = parseFloat(value) > 0 ? value : '0.00';
    const currencySymbol = currency === 'Ref' ? 'Ref ' : 'Bs ';

    // Detectar si tiene valor
    const hasValue = parseFloat(value) > 0;

    const openNumpad = () => {
        setCurrentMethod(name);
        setCurrentInputValue(parseFloat(value) > 0 ? value.toString() : '');
        setCurrentReference(paymentReferences[name] || '');
        setIsNumpadOpen(true);
    };

    const isCreditActive = name === 'Crédito' && hasValue;

    return (
        <div
            onClick={openNumpad}
            className={`flex justify-between items-center p-4 rounded-2xl shadow-sm cursor-pointer transition-all duration-200 border-2 ${
                isCreditActive 
                    ? 'bg-rose-50 border-rose-200' 
                    : (isSelected 
                        ? 'bg-blue-50 border-blue-400' 
                        : (hasValue 
                            ? 'bg-white border-slate-300' 
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300')
                    )
            }`}
        >
            {/* Texto del nombre */}
            <span className={`font-black uppercase tracking-widest text-[10px] ${hasValue ? 'text-slate-800' : 'text-slate-400'}`}>
                {name} <span className="opacity-60">({currency})</span>
            </span>

            {/* Monto */}
            <span className={`font-black text-xl transition-all duration-200 ${
                isCreditActive ? 'text-rose-600' :
                (hasValue ? 'text-slate-800 scale-105' : 'text-slate-300')
            }`}>
                {currencySymbol}{displayValue}
            </span>
        </div>
    );
});

export default PaymentInput;