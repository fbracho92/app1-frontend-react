import React from 'react';

export const StockAlertModal = ({
    showStockModal,
    setShowStockModal,
    lowStock
}) => {
    if (!showStockModal) return null;

    return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg h-[85vh] sm:h-[80vh] flex flex-col shadow-2xl animate-scale-up overflow-hidden">
                
                {/* 1. HEADER ESTATICO */}
                <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-red-50 shrink-0 z-30 relative">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="bg-red-100 p-1.5 sm:p-2 rounded-full text-red-500 shrink-0 text-sm sm:text-base">⚠️</div>
                        <h3 className="font-bold text-red-900 text-base sm:text-lg truncate pr-2">Reporte de Stock Bajo</h3>
                    </div>
                    <button 
                        onClick={() => setShowStockModal(false)} 
                        className="bg-white w-8 h-8 shrink-0 rounded-full text-red-500 font-bold shadow-sm hover:bg-red-100 transition-colors flex items-center justify-center outline-none active:scale-95"
                    >
                        ✕
                    </button>
                </div>

                {/* 2. TABLA (SCROLL PERFECTO SIN ESPACIOS TRANSPARENTES) */}
                <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                        {/* Encabezado Sticky Edge-to-Edge */}
                        <thead className="bg-gray-50/95 backdrop-blur-sm text-gray-400 uppercase text-[9px] sm:text-[10px] font-bold tracking-wider sticky top-0 z-20 shadow-sm border-b border-gray-100">
                            <tr>
                                <th className="pl-4 sm:pl-5 pr-2 py-3">Producto</th>
                                <th className="px-2 sm:px-3 py-3 text-center">Cat</th>
                                <th className="pr-4 sm:pr-5 pl-2 py-3 text-right">Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lowStock.map(p => (
                                <tr key={p.id} className="hover:bg-red-50/50 transition-colors">
                                    <td className="pl-4 sm:pl-5 pr-2 py-3 font-bold text-gray-700">
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            {/* Detección de Imagen o Emoji */}
                                            <div className="shrink-0">
                                                {(p.icon_emoji && (p.icon_emoji.startsWith('data:image') || p.icon_emoji.startsWith('http'))) ? (
                                                    <img
                                                        src={p.icon_emoji}
                                                        alt={p.name}
                                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border border-gray-200"
                                                    />
                                                ) : (
                                                    <span className="text-lg sm:text-xl flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8">{p.icon_emoji || '📦'}</span>
                                                )}
                                            </div>
                                            
                                            <div className="flex flex-col min-w-0">
                                                <span className="leading-tight truncate max-w-[120px] sm:max-w-[180px]" title={p.name}>{p.name}</span>
                                                {/* Refuerzo Visual: Etiquetas de tipo de producto */}
                                                <div className="flex flex-wrap gap-1 mt-0.5 sm:mt-1">
                                                    {p.is_service && <span className="text-[8px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded border border-purple-200 uppercase font-black">Servicio</span>}
                                                    {p.is_raw_material && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 uppercase font-black">Insumo</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-2 sm:px-3 py-3 text-center">
                                        <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-50 rounded-lg px-1.5 sm:px-2 py-1 truncate max-w-[70px] sm:max-w-[100px] inline-block border border-gray-100">
                                            {p.category}
                                        </span>
                                    </td>
                                    
                                    <td className="pr-4 sm:pr-5 pl-2 py-3 text-right">
                                        {/* Lógica de Stock Blindada */}
                                        <span className={`font-black text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full whitespace-nowrap ${p.is_service ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-600 border border-red-200/50'}`}>
                                            {p.is_service ? 'N/A' : p.stock}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {lowStock.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="py-10 text-center">
                                        <span className="text-gray-400 font-bold text-xs sm:text-sm">Todo el stock está normal.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 3. FOOTER BOTÓN CERRAR */}
                <div className="p-3 sm:p-4 border-t bg-gray-50 shrink-0 z-30 relative">
                    <button 
                        onClick={() => setShowStockModal(false)} 
                        className="w-full bg-gray-200 text-gray-600 font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl hover:bg-gray-300 transition-all active:scale-95 outline-none shadow-sm"
                    >
                        Cerrar Reporte
                    </button>
                </div>
                
            </div>
        </div>
    );
};