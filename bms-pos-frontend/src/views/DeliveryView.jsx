import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';

// 🚀 1. COMPONENTE MODAL DE HISTORIAL (UX PRO - ENTERPRISE CON PAGINACIÓN Y REDESPACHO)
const DeliveryHistoryModal = ({ isOpen, onClose, historyData, printDeliveryGuide, isLoading, changeStatus }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('TODOS'); 
    
    // 🛡️ ESTADOS PARA FILTRO DE FECHAS (Por defecto: Últimos 30 días hasta Hoy)
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // 🛡️ ESTADOS PARA PAGINACIÓN MÚLTIPLE
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Resetear a la página 1 cada vez que cambie un filtro para evitar pantallas vacías
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeFilter, startDate, endDate, itemsPerPage]);

    if (!isOpen) return null;

    // Métricas Puras (Totales sin filtrar para las píldoras superiores)
    const countEntregados = historyData.filter(d => d.delivery_info?.status === 'ENTREGADO').length;
    const countDevueltos = historyData.filter(d => d.delivery_info?.status === 'DEVUELTO').length;
    const countCancelados = historyData.filter(d => d.delivery_info?.status === 'CANCELADO').length;

    // Filtro Múltiple Combinado: Texto + Estatus + Fechas
    const filteredHistory = historyData.filter(order => {
        const term = searchTerm.toLowerCase();
        const safeId = order.sale_id || order.id || '';
        const safeName = order.customer_name || order.full_name || '';
        const safeDriver = order.delivery_info?.driver_name || '';
        const status = order.delivery_info?.status || 'ENTREGADO';
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        
        const matchesText = safeId.toString().includes(term) || safeName.toLowerCase().includes(term) || safeDriver.toLowerCase().includes(term);
        const matchesFilter = activeFilter === 'TODOS' || status === activeFilter;
        const matchesStartDate = startDate ? orderDate >= startDate : true;
        const matchesEndDate = endDate ? orderDate <= endDate : true;

        return matchesText && matchesFilter && matchesStartDate && matchesEndDate;
    });

    // Cálculos Matemáticos de Paginación
    const totalItems = filteredHistory.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-6 transition-all font-sans">
                <motion.div 
                    initial={{ opacity: 0, y: "100%" }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="bg-slate-50 w-full sm:max-w-5xl flex flex-col h-[92vh] sm:h-[85vh] sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl overflow-hidden relative"
                >
                    {/* 📱 HANDLE NATIVO MÓVIL */}
                    <div className="w-full flex justify-center pt-3 pb-1 sm:hidden absolute top-0 left-0 z-50">
                        <div className="w-12 h-1.5 bg-slate-300/50 rounded-full"></div>
                    </div>

                    {/* 🎩 CABECERA MINIMALISTA */}
                    <div className="bg-white px-6 pt-8 pb-5 sm:p-7 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 border-b border-slate-100 z-10">
                        <div className="flex flex-col">
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                Archivo Logístico
                            </h2>
                            <p className="text-slate-400 text-[10px] sm:text-xs font-bold tracking-widest uppercase mt-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Cumplimiento Providencia 0071
                            </p>
                        </div>
                        
                        <button onClick={onClose} className="absolute top-6 right-6 sm:relative sm:top-auto sm:right-auto w-9 h-9 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors outline-none active:scale-95">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    {/* 📊 BARRA DE HERRAMIENTAS MÚLTIPLE */}
                    <div className="px-6 py-4 bg-white shrink-0 flex flex-col gap-4 shadow-sm z-10 border-b border-slate-100">
                        
                        {/* Fila 1: Píldoras y Buscador */}
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                            <div className="flex w-full lg:w-auto bg-slate-100 p-1 rounded-full overflow-x-auto no-scrollbar">
                                <button onClick={() => setActiveFilter('TODOS')} className={`flex-1 lg:flex-none px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap outline-none ${activeFilter === 'TODOS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Todos</button>
                                <button onClick={() => setActiveFilter('ENTREGADO')} className={`flex-1 lg:flex-none px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap outline-none flex items-center justify-center gap-1.5 ${activeFilter === 'ENTREGADO' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}>
                                    <span className="hidden sm:inline">✅</span> Entregados ({countEntregados})
                                </button>
                                <button onClick={() => setActiveFilter('DEVUELTO')} className={`flex-1 lg:flex-none px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap outline-none flex items-center justify-center gap-1.5 ${activeFilter === 'DEVUELTO' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-amber-600'}`}>
                                    <span className="hidden sm:inline">🔄</span> Devueltos ({countDevueltos})
                                </button>
                                <button onClick={() => setActiveFilter('CANCELADO')} className={`flex-1 lg:flex-none px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap outline-none flex items-center justify-center gap-1.5 ${activeFilter === 'CANCELADO' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-rose-600'}`}>
                                    <span className="hidden sm:inline">🚫</span> Cancelados ({countCancelados})
                                </button>
                            </div>

                            <div className="relative w-full lg:w-80 group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </span>
                                <input 
                                    type="text"
                                    placeholder="Buscar orden..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border border-transparent rounded-full py-2.5 pl-10 pr-4 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all"
                                />
                                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                            </div>
                        </div>

                        {/* Fila 2: Filtro de Fechas (Responsivo) */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Rango de Fecha:</span>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                    className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 transition-all cursor-pointer"
                                />
                                <span className="text-slate-300 font-bold">➜</span>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    min={startDate}
                                    onChange={(e) => setEndDate(e.target.value)} 
                                    className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 transition-all cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 📋 ÁREA DE TARJETAS NATIVAS */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-50/50">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4"></div>
                                <p className="font-black text-[10px] uppercase tracking-widest text-slate-500">Sincronizando Archivo...</p>
                            </div>
                        ) : currentItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <span className="text-6xl mb-3 grayscale">📭</span>
                                <p className="font-black text-sm uppercase tracking-widest text-slate-500">No hay registros</p>
                                <p className="text-[10px] mt-1 text-slate-400 font-bold">Ajuste las fechas o filtros de búsqueda.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {currentItems.map((order, i) => {
                                    const safeSaleId = order.sale_id || order.id || 'S/N';
                                    const safeName = order.customer_name || order.full_name || 'Consumidor Final';
                                    const status = order.delivery_info?.status || 'ENTREGADO';
                                    
                                    const statusBadge = status === 'CANCELADO' 
                                        ? 'bg-rose-100 text-rose-700 border-rose-200' 
                                        : status === 'DEVUELTO' 
                                        ? 'bg-amber-100 text-amber-700 border-amber-200' 
                                        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

                                    const sideBarColor = status === 'CANCELADO' ? 'bg-rose-500' : status === 'DEVUELTO' ? 'bg-amber-500' : 'bg-emerald-500';

                                    return (
                                        <div key={i} className="flex flex-col bg-white border border-slate-100 rounded-3xl p-4 sm:p-5 hover:shadow-xl transition-all shadow-sm group relative overflow-hidden">
                                            
                                            {/* Barra Lateral Dinámica */}
                                            <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${sideBarColor}`}></div>

                                            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3 pl-2">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-800 font-black text-sm tracking-tight">TICKET #{safeSaleId}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">{new Date(order.created_at).toLocaleDateString('es-VE')} • {new Date(order.created_at).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <span className={`text-[8px] sm:text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-widest ${statusBadge}`}>
                                                    {status}
                                                </span>
                                            </div>
                                            
                                            <div className="flex-1 mb-4 pl-2">
                                                <p className="font-black text-slate-700 text-sm truncate mb-1" title={safeName}>{safeName}</p>
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                    <span className="text-xs font-bold truncate">{order.delivery_info?.driver_name || 'Desconocido'}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center pt-2 mb-4 border-t border-slate-50 pl-2">
                                                <span className="font-black text-slate-800 text-base">
                                                    <span className="text-[10px] text-slate-400 mr-1">Ref</span>
                                                    {parseFloat(order.total_usd || 0).toFixed(2)}
                                                </span>
                                                <button 
                                                    onClick={() => printDeliveryGuide && printDeliveryGuide(order)}
                                                    className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-800 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 outline-none"
                                                    title="Reimprimir Guía Legal"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                </button>
                                            </div>

                                            {/* 🚀 ACCIONES UX PRO: REDESPACHO O ALERTA */}
                                            <div className="pl-2 mt-auto">
                                                {status === 'DEVUELTO' && changeStatus && (
                                                    <Button 
                                                        variant="primary"
                                                        onClick={async () => {
                                                            // 🛡️ CORRECCIÓN: Volvemos al estatus 'PENDIENTE' para que vuelva a la columna "Preparando"
                                                            await changeStatus(order.sale_id || order.id, 'PENDIENTE');
                                                            onClose(); // Cierra el modal instantáneamente para seguir trabajando
                                                        }}
                                                        className="w-full !py-2.5 !text-[9px] !bg-emerald-500 hover:!bg-emerald-600 text-white font-black uppercase tracking-widest shadow-sm hover:shadow-md flex justify-center items-center gap-1.5 rounded-xl transition-all active:scale-95 border-0 outline-none"
                                                    >
                                                        <span>🚀</span> Re-Despachar
                                                    </Button>
                                                )}

                                                {status === 'CANCELADO' && (
                                                    <div className="bg-rose-50 border border-rose-100 p-2 rounded-xl text-center w-full shadow-inner">
                                                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest block leading-tight">
                                                            ⚠️ Requiere anulación<br/>en Panel de Ventas
                                                        </span>
                                                    </div>
                                                )}
                                                
                                                {status === 'ENTREGADO' && (
                                                    <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-center w-full">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-tight">
                                                            Archivado Legalmente
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 📄 PAGINADOR INFERIOR (FOOTER NATIVO) */}
                    {totalItems > 0 && (
                        <div className="bg-white p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 rounded-b-[2rem] z-20">
                            
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <select 
                                    value={itemsPerPage} 
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                    className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm w-full sm:w-auto"
                                >
                                    <option value={25}>Mostrar 25</option>
                                    <option value={50}>Mostrar 50</option>
                                    <option value={100}>Mostrar 100</option>
                                </select>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                    Total: {totalItems}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 w-full sm:w-auto justify-center">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent transition-all outline-none"
                                >
                                    Anterior
                                </button>
                                <div className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {currentPage} <span className="text-slate-300 mx-1">/</span> {totalPages}
                                </div>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent transition-all outline-none"
                                >
                                    Siguiente
                                </button>
                            </div>

                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// 🚀 2. COMPONENTE COLUMNA KANBAN ESTANDARIZADO (MINIMALISTA)
const KanbanCol = ({ title, emoji, items, color, bgHeader, onMove, nextStatus, printDeliveryGuide }) => (
    <div className="w-[85vw] sm:w-[340px] lg:flex-1 shrink-0 snap-center bg-white/60 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/50 p-4 sm:p-5 flex flex-col h-full max-h-full">
        
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100 shrink-0 px-1">
            <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${color}`}>
                <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-lg ${bgHeader}`}>
                    {emoji}
                </span> 
                {title}
            </h3>
            <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-black text-xs shadow-inner border border-slate-200/50">
                {items.length}
            </span>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-1 pb-2">
            {items.map((order, index) => (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    transition={{ duration: 0.2 }}
                    key={`delivery-${order.sale_id || 'new'}-${index}`}
                    className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all group flex flex-col shrink-0 relative overflow-hidden"
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center rounded-r-md"></div>
                    
                    <div className="flex justify-between items-center mb-3 pl-1">
                        <span className="text-[10px] font-black text-slate-800 tracking-wider">
                            #{order.sale_id}
                        </span>
                        <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                            order.sale_status === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                            {order.sale_status === 'PENDIENTE' ? 'C.O.D' : 'PRE-PAGADO'}
                        </span>
                    </div>
                    
                    <div className="mb-4 pl-1">
                        <p className="font-black text-slate-700 text-sm line-clamp-1 mb-1">
                            {order.customer_name || 'Cliente Genérico'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 line-clamp-2 leading-snug flex items-start gap-1">
                            <span className="text-slate-300 mt-0.5">📍</span> {order.delivery_info?.address || 'Sin dirección'}
                        </p>
                    </div>
                    
                    <div className="flex justify-between items-end pt-3 border-t border-slate-50 mb-4 pl-1">
                        <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 truncate pr-2">
                            <span className="text-sm">🛵</span> <span className="truncate">{order.delivery_info?.driver_name || 'POR ASIGNAR'}</span>
                        </div>
                        <span className="font-black text-slate-800 text-sm shrink-0">
                            Ref {parseFloat(order.total_usd).toFixed(2)}
                        </span>
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-auto pl-1">
                        {nextStatus === 'EN_RUTA' && printDeliveryGuide && (
                            <button 
                                onClick={() => printDeliveryGuide(order)} 
                                className="w-full py-2.5 text-[10px] font-black text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl uppercase tracking-widest transition-colors flex justify-center items-center gap-1.5 outline-none"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                Imprimir Guía
                            </button>
                        )}

                        {nextStatus && (
                            <button 
                                onClick={() => onMove(order.sale_id, nextStatus)} 
                                className="w-full py-3 text-[10px] font-black text-white bg-slate-800 hover:bg-black rounded-xl uppercase tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95 outline-none"
                            >
                                {nextStatus === 'EN_RUTA' ? 'Enviar a Ruta' : 'Marcar Entregado'}
                            </button>
                        )}

                        {nextStatus === 'ENTREGADO' && (
                             <div className="grid grid-cols-2 gap-2 mt-1">
                                 <button 
                                     onClick={(e) => { e.stopPropagation(); onMove(order.sale_id, 'DEVUELTO'); }} 
                                     className="py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors outline-none"
                                 >
                                     Devolver
                                 </button>
                                 <button 
                                     onClick={(e) => { e.stopPropagation(); onMove(order.sale_id, 'CANCELADO'); }} 
                                     className="py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors outline-none"
                                 >
                                     Cancelar
                                 </button>
                             </div>
                        )}
                    </div>
                </motion.div>
            ))}
            
            {items.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center opacity-40 min-h-[200px]">
                    <span className="text-4xl mb-2 grayscale">📭</span>
                    <p className="font-black text-xs uppercase tracking-widest text-slate-500">Columna Vacía</p>
                </div>
            )}
        </div>
    </div>
);

// 🚀 3. VISTA PRINCIPAL (Con Fetch Asíncrono al Endpoint Dedicado)
export const DeliveryView = ({ deliveries, fetchDeliveries, changeStatus, printDeliveryGuide, printDailyManifest, fetchDeliveryHistory }) => {
    
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

    const pendientes = deliveries.filter(d => d.delivery_info?.status === 'PENDIENTE');
    const enRuta = deliveries.filter(d => d.delivery_info?.status === 'EN_RUTA');

    const handleOpenHistory = async () => {
        setIsHistoryOpen(true);
        setIsLoadingHistory(true);
        try {
            if (fetchDeliveryHistory) {
                const data = await fetchDeliveryHistory();
                
                const formattedData = data.map(sale => {
                    let info = sale.delivery_info;
                    if (typeof info === 'string') {
                        try { info = JSON.parse(info); } catch(e) { info = null; }
                    }
                    return { ...sale, delivery_info: info };
                });
                
                setHistoryData(formattedData);
            }
        } catch (error) {
            console.error("Error al cargar auditoría logística:", error);
            setHistoryData([]);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 overflow-hidden flex-1 min-h-0 w-full relative bg-slate-50/50 font-sans flex flex-col">
            
            {/* Cabecera Clean y Minimalista */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 shrink-0 px-2">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                        Despachos
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Logística de Última Milla
                    </p>
                </div>
                
                {/* Botonera de Acción */}
                <div className="flex w-full xl:w-auto gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button 
                        onClick={handleOpenHistory} 
                        className="flex-1 xl:flex-none px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-sm transition-all outline-none flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        <span>🗄️</span> Historial
                    </button>

                    <button 
                        onClick={() => printDailyManifest && printDailyManifest(deliveries)} 
                        className="flex-1 xl:flex-none px-4 sm:px-5 py-2.5 sm:py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-md transition-all outline-none flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        <span>🖨️</span> Manifiesto
                    </button>

                    <button 
                        onClick={fetchDeliveries} 
                        className="flex-1 xl:flex-none px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-800 hover:text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-sm transition-all outline-none flex items-center justify-center gap-2 whitespace-nowrap group"
                    >
                        <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <span>Actualizar</span>
                    </button>
                </div>
            </motion.div>

            {/* Tablero Kanban */}
            <div className="flex-1 flex gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2 snap-x snap-mandatory items-stretch h-full px-2">
                <KanbanCol 
                    title="Preparando" 
                    emoji="📦" 
                    color="text-amber-600" 
                    bgHeader="bg-amber-100/50" 
                    items={pendientes} 
                    onMove={changeStatus} 
                    nextStatus="EN_RUTA" 
                    printDeliveryGuide={printDeliveryGuide}
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

            {/* Modal Seguro (Pasamos changeStatus) */}
            <DeliveryHistoryModal 
                isOpen={isHistoryOpen} 
                onClose={() => setIsHistoryOpen(false)} 
                historyData={historyData}
                printDeliveryGuide={printDeliveryGuide}
                isLoading={isLoadingHistory}
                changeStatus={changeStatus}
            />
            
        </div>
    );
};