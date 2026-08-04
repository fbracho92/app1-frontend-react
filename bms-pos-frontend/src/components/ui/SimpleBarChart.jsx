import React, { memo } from 'react';

// 🚀 OPTIMIZADO: Memoizado para asegurar 0 latencia en reportes dinámicos
const SimpleBarChart = memo(({ data, labelKey, valueKey, colorClass, formatMoney }) => {
    
    if (!data || data.length === 0) return (
        <div className="flex flex-col items-center justify-center h-40 text-slate-300">
            <span className="text-4xl mb-2">📊</span>
            <p className="text-[10px] font-black uppercase tracking-widest">Sin datos</p>
        </div>
    );

    // Calculamos el máximo una sola vez durante el render
    const maxValue = Math.max(...data.map(d => parseFloat(d[valueKey])));

    return (
        <div className="space-y-4">
            {data.map((item, idx) => {
                const val = parseFloat(item[valueKey]);
                const percent = maxValue > 0 ? (val / maxValue) * 100 : 0;
                
                return (
                    <div key={idx} className="group transform-gpu">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <span className="text-slate-300 font-medium w-4">{idx + 1}.</span>
                                {item[labelKey]}
                            </span>
                            <span className="text-[10px] font-black text-slate-800">
                                {formatMoney ? `Ref ${val.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : val}
                            </span>
                        </div>

                        {/* Barra con fondo y animación de crecimiento */}
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden relative">
                            <div
                                className={`h-full rounded-full ${colorClass} transition-all duration-1000 ease-out relative group-hover:opacity-90`}
                                style={{ width: `${percent}%` }}
                            >
                                {/* Brillo sutil de diseño premium */}
                                <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

export default SimpleBarChart;