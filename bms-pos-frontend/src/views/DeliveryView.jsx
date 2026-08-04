import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';

// 🚀 COMPONENTE COLUMNA KANBAN ESTANDARIZADO (NATIVO & RESPONSIVE)
const KanbanCol = ({ title, emoji, items, color, bgHeader, onMove, nextStatus }) => (
    // En móvil ocupa 85% de la pantalla para invitar al "Swipe". En PC ocupa flex-1.
    <div className="w-[85vw] sm:w-[340px] lg:flex-1 shrink-0 snap-center bg-white/80 backdrop-blur-xl rounded-3xl sm:rounded-[2rem] shadow-sm border border-slate-200/60 p-4 sm:p-5 flex flex-col h-full max-h-full">
        
        {/* Cabecera de la Columna */}
        <div className="flex justify-between items-center mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-2 sm:gap-3 ${color}`}>
                <span className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg sm:rounded-xl text-base sm:text-lg ${bgHeader}`}>
                    {emoji}
                </span> 
                {title}
            </h3>
            <span className="bg-slate-100 px-2 sm:px-2.5 py-1 rounded-lg text-slate-600 font-bold text-[10px] sm:text-xs shadow-inner border border-slate-200/60">
                {items.length}
            </span>
        </div>
        
        {/* Cuerpo Scrollable con Tarjetas */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-1 pb-2">
            {items.map(order => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    key={order.sale_id} 
                    className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[1.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col shrink-0"
                >
                    {/* Borde UX Hover Interactivo */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                    
                    <div className="flex justify-between items-start mb-3 gap-2">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
                            TICKET #{order.sale_id}
                        </span>
                        <span className={`text-[8px] sm:text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider shadow-sm border text-right ${
                            order.sale_status === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-200/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200/50'
                        }`}>
                            {order.sale_status === 'PENDIENTE' ? '💰 PAGO PENDIENTE' : '✅ PRE-PAGADO'}
                        </span>
                    </div>
                    
                    <p className="font-black text-slate-800 text-xs sm:text-sm mb-1 line-clamp-1 flex items-center gap-1.5">
                        <span className="text-slate-400">👤</span> {order.customer_name || 'Cliente Genérico'}
                    </p>
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 mb-4 line-clamp-2 leading-snug flex items-start gap-1.5 flex-1">
                        <span className="text-slate-400 mt-0.5">📍</span> {order.delivery_info?.address || 'Sin dirección especificada'}
                    </p>
                    
                    <div className="flex justify-between items-center pt-3 mt-auto border-t border-slate-100/60">
                        <div className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 truncate pr-2">
                            <span className="text-sm">🛵</span> <span className="truncate">{order.delivery_info?.driver_name || 'POR ASIGNAR'}</span>
                        </div>
                        <span className="font-black text-blue-600 text-xs sm:text-sm bg-blue-50 px-2 py-0.5 rounded border border-blue-100/50 shadow-sm shrink-0">
                            ${parseFloat(order.total_usd).toFixed(2)}
                        </span>
                    </div>
                    
                    {nextStatus && (
                        <Button 
                            variant="primary" 
                            onClick={() => onMove(order.sale_id, nextStatus)} 
                            className="w-full !py-3 sm:!py-2.5 mt-4 !text-[9px] sm:!text-[10px] font-black uppercase tracking-widest !rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-sm hover:shadow-md transition-all border-0 outline-none active:scale-95 flex justify-center items-center gap-1.5"
                        >
                            {nextStatus === 'EN_RUTA' ? '🚀 Despachar (En Ruta)' : '🏁 Marcar Entregado'}
                        </Button>
                    )}
                </motion.div>
            ))}
            
            {/* Estado Vacío Estilizado */}
            {items.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center opacity-60 min-h-[200px]">
                    <span className="text-4xl sm:text-5xl mb-3 grayscale">📭</span>
                    <p className="text-slate-500 font-black text-xs sm:text-sm uppercase tracking-widest">Sin Órdenes</p>
                    <p className="text-slate-400 font-medium text-[10px] mt-1">Columna despejada</p>
                </div>
            )}
        </div>
    </div>
);

// 🚀 VISTA PRINCIPAL
export const DeliveryView = ({ deliveries, fetchDeliveries, changeStatus }) => {
    useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

    const pendientes = deliveries.filter(d => d.delivery_info?.status === 'PENDIENTE');
    const enRuta = deliveries.filter(d => d.delivery_info?.status === 'EN_RUTA');

    return (
        <div className="p-4 sm:p-6 lg:p-8 overflow-hidden flex-1 min-h-0 w-full relative bg-slate-50/30 font-sans flex flex-col">
            
            {/* Cabecera Estándar del Sistema */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 shrink-0">
                <div className="w-full sm:w-auto">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-none flex items-center gap-2">
                        <span>🛵</span> Central de Despachos
                    </h2>
                    <p className="text-[10px] md:text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 md:mt-2 leading-tight">
                        Monitor Logístico y Motorizados
                    </p>
                </div>
                
                {/* 🚀 BOTÓN ACTUALIZAR FULL UX BLINDADO */}
                <Button 
                    onClick={fetchDeliveries} 
                    title="Sincronizar y buscar nuevas órdenes"
                    className="w-full sm:w-auto group !bg-white border border-slate-200 text-slate-600 hover:!bg-slate-800 hover:!border-slate-800 hover:text-white h-10 md:h-12 px-4 md:px-5 flex items-center justify-center rounded-xl font-black shadow-sm hover:shadow-md transition-all duration-300 active:scale-95 gap-2 text-[10px] md:text-[11px] uppercase tracking-widest outline-none"
                >
                    {/* Icono SVG que gira 180 grados al hacer hover */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 group-hover:rotate-180 transition-transform duration-500 ease-in-out shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="flex items-center gap-1.5">
                        Actualizar <span className="hidden md:inline text-slate-400 group-hover:text-slate-300 transition-colors">Tablero</span>
                    </span>
                </Button>
            </motion.div>

            {/* Tablero Kanban (Swipe Horizontal Magnético en Móviles) */}
            <div className="flex-1 flex gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2 snap-x snap-mandatory items-stretch h-full">
                <KanbanCol 
                    title="Preparando" 
                    emoji="📦" 
                    color="text-amber-600" 
                    bgHeader="bg-amber-100/50" 
                    items={pendientes} 
                    onMove={changeStatus} 
                    nextStatus="EN_RUTA" 
                />
                <KanbanCol 
                    title="En Ruta" 
                    emoji="🛵" 
                    color="text-blue-600" 
                    bgHeader="bg-blue-100/50" 
                    items={enRuta} 
                    onMove={changeStatus} 
                    nextStatus="ENTREGADO" 
                />
            </div>
            
            {/* Pequeño hint para usuarios móviles (solo visible en móviles) */}
            <div className="md:hidden text-center mt-2 shrink-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    ← Desliza para ver columnas →
                </p>
            </div>
            
        </div>
    );
};