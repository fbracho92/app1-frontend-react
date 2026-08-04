// src/components/ui/ProductAvatar.jsx
import React, { memo } from 'react';

// 🚀 OPTIMIZADO: Memoizado para asegurar que las listas largas de inventario o POS sean ultra rápidas
const ProductAvatar = memo(({ icon, size = "w-12 h-12 text-4xl" }) => {
    // FALLBACK: Si no hay icono, mantiene el diseño exacto de tu bloque original
    if (!icon) return (
        <div className={`${size} flex items-center justify-center bg-slate-100 rounded-lg`}>
            📦
        </div>
    );

    // LÓGICA DE DETECCIÓN: Idéntica a la que tenías
    const isImage = icon.startsWith('data:image') || icon.startsWith('http');

    return (
        <div className={`${size} shrink-0 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden flex items-center justify-center relative`}>
            {isImage ? (
                <img 
                    src={icon} 
                    alt="Item" 
                    className="w-full h-full object-cover" 
                    loading="lazy" 
                />
            ) : (
                <span className="leading-none">{icon}</span>
            )}
        </div>
    );
});

export default ProductAvatar;