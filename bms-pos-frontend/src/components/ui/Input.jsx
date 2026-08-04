import React, { useEffect, useRef } from 'react';

// 🚀 OPTIMIZADO: Memoizado para evitar re-renders innecesarios y uso de ref para el autoFocus
const Input = React.memo(({ 
    label, 
    type = "text", 
    value, 
    onChange, 
    name,
    placeholder, 
    icon: Icon,
    required = false,
    autoFocus = false,
    className = "" 
}) => {
    const inputRef = useRef(null);

    // Refuerzo técnico: asegurar que el autoFocus funcione correctamente en cualquier ciclo de vida
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                    {label} {required && <span className="text-red-400">*</span>}
                </label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <Icon size={18} />
                    </div>
                )}
                <input
                    ref={inputRef}
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className={`w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 ${Icon ? 'pl-11' : 'px-4'} pr-4 focus:bg-white focus:border-emerald-500 outline-none transition-all text-slate-700 placeholder:text-slate-300 font-medium`}
                />
            </div>
        </div>
    );
});

export default Input;