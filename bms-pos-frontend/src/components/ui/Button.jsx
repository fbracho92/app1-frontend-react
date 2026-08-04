// src/components/ui/Button.jsx
import React, { memo } from 'react';

// 🚀 OPTIMIZADO: Memoizado para asegurar que no haya re-renders innecesarios en la UI
const Button = memo(({ 
    children, 
    onClick, 
    type = "button", 
    variant = "primary", // primary, danger, secondary, ghost, warning, cancel
    className = "",
    disabled = false
}) => {
    const baseStyles = "font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2";
    
    const variants = {
        primary: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30",
        danger: "bg-red-500 hover:bg-red-400 text-white shadow-red-500/30",
        secondary: "bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 shadow-none",
        ghost: "bg-transparent hover:bg-slate-50 text-slate-400 shadow-none",
        warning: "bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 shadow-sm",
        cancel: "bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-600 border border-slate-200 shadow-sm"
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${variants[variant] || variants.primary} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {children}
        </button>
    );
});

export default Button;