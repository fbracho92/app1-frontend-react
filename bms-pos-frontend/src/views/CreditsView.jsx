import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

// 🛡️ FORMATEADOR FISCAL VENEZOLANO (Cumplimiento SENIAT)
const formatVES = (amount) => {
    return Number(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatUSD = (amount) => {
    return Number(amount || 0).toFixed(2);
};

const CreditsView = ({
    selectedCreditCustomer,
    setSelectedCreditCustomer,
    creditSearchQuery,
    setCreditSearchQuery,
    filteredCredits,
    creditCurrentPage,
    setCreditCurrentPage,
    customerCreditsDetails,
    detailsCurrentPage,
    setDetailsCurrentPage,
    showSaleDetail,
    openCustomerCredits,
    handlePayAll,
    handlePaymentProcess,
    printLegalDebtReport
}) => {

    // --- ⚙️ ESTADOS PARA PAGINACIÓN DINÁMICA ---
    const [creditsPerPage, setCreditsPerPage] = useState(25);
    const [detailsPerPage, setDetailsPerPage] = useState(25);

    // --- 🎬 ANIMACIONES UX (Framer Motion) ---
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } },
        exit: { opacity: 0, transition: { duration: 0.2 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    return (
        /* 🛡️ CONTENEDOR PRINCIPAL: flex-1 min-h-0 respeta el Footer Global */
        <div className="p-4 md:p-8 overflow-y-auto flex-1 min-h-0 w-full relative bg-slate-50/30 font-sans flex flex-col">

            <AnimatePresence mode="wait">
                {/* --- VISTA 1: LISTADO GENERAL DE CLIENTES DEUDORES --- */}
                {!selectedCreditCustomer ? (
                    <motion.div 
                        key="list-view"
                        variants={containerVariants} initial="hidden" animate="show" exit="exit"
                        className="flex flex-col flex-1 h-full gap-6"
                    >
                        {/* HEADER RESPONSIVE DE IMPACTO (Estandarizado) */}
                        <motion.div variants={itemVariants} className="flex flex-col mb-2 md:mb-6 gap-4 shrink-0 px-1 md:px-0 mt-2 md:mt-0">
                            {/* Fila 1: Título y Botón Principal */}
                            <div className="flex justify-between items-start w-full gap-4">
                                <div className="flex-1">
                                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-none">Cartera de Crédito</h2>
                                    <p className="text-[10px] md:text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 md:mt-2 leading-tight">Gestión consolidada de cuentas por cobrar</p>
                                </div>
                                {/* BOTÓN ESTANDARIZADO: bg-slate-800 sin sombras de neón */}
                                <Button 
                                    onClick={printLegalDebtReport} 
                                    className="!bg-slate-800 !text-white hover:!bg-slate-900 h-10 md:h-12 px-4 md:px-6 flex items-center justify-center rounded-xl font-black !shadow-sm hover:!shadow-md transform hover:-translate-y-0.5 transition-all active:scale-95 gap-2 border-0"
                                >
                                    <span className="text-lg leading-none mt-[-2px]">⚖️</span> 
                                    <span className="hidden sm:inline">Reporte</span>
                                </Button>
                            </div>

                            {/* Fila 2: Buscador */}
                            <div className="flex w-full items-center">
                                <Input 
                                    placeholder="Buscar deudor..." 
                                    value={creditSearchQuery} 
                                    onChange={(e) => setCreditSearchQuery(e.target.value)} 
                                    className="w-full md:w-96 !h-12 !rounded-xl shadow-sm focus:ring-2 focus:ring-slate-200 transition-shadow" 
                                    icon={() => <span className="text-slate-400">🔍</span>} 
                                />
                            </div>
                        </motion.div>

                        {/* CONTENEDOR DE LA LISTA */}
                        <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden flex-1 flex flex-col">

                            {/* ENCABEZADO TABLA (SOLO PC) */}
                            <div className="hidden md:grid grid-cols-12 bg-slate-50/80 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/60 sticky top-0 z-10 shrink-0">
                                <div className="col-span-4 pl-2">Cliente / Deudor</div>
                                <div className="col-span-2">Identificación</div>
                                <div className="col-span-1 text-center">Facturas</div>
                                <div className="col-span-2 text-right">Deuda Total</div>
                                <div className="col-span-2 text-right text-rose-500">Restante</div>
                                <div className="col-span-1 text-center">Acción</div>
                            </div>

                            {/* LISTADO DE DATOS */}
                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                {(() => {
                                    const indexOfLastCredit = creditCurrentPage * creditsPerPage;
                                    const indexOfFirstCredit = indexOfLastCredit - creditsPerPage;
                                    const currentCredits = filteredCredits.slice(indexOfFirstCredit, indexOfLastCredit);
                                    
                                    if (filteredCredits.length === 0) {
                                        return (
                                            <div className="h-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
                                                    <span className="text-4xl opacity-50 grayscale">🎉</span>
                                                </div>
                                                <h3 className="text-lg font-black text-slate-700 tracking-tight">¡Todo al día!</h3>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">No hay deudas pendientes registradas.</p>
                                            </div>
                                        );
                                    }

                                    return currentCredits.map((client) => (
                                        <motion.div
                                            variants={itemVariants}
                                            key={client?.customer_id || Math.random()}
                                            onClick={() => openCustomerCredits(client)}
                                            /* 🚀 FIX UX: border-b-2 sólido para separar cada cliente y hover sutil */
                                            className="p-3.5 hover:bg-slate-50/80 transition-all cursor-pointer group relative overflow-hidden border-b-2 border-slate-100/80 last:border-b-0"
                                        >
                                            {/* 🚀 FIX UX: Indicador Visual Hover AZUL corporativo */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>

                                            {/* VISTA DESKTOP */}
                                            <div className="hidden md:grid grid-cols-12 items-center gap-4">
                                                <div className="col-span-4 flex items-center gap-4 pl-2">
                                                    <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-black shadow-sm group-hover:shadow-md transition-all group-hover:scale-110 shrink-0">
                                                        {(client?.full_name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="font-bold text-slate-700 text-sm truncate" title={client?.full_name}>{client?.full_name || 'Desconocido'}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Cliente con Crédito</p>
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-md text-[10px] font-mono font-bold border border-slate-200 shadow-sm">
                                                        {client?.id_number || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="col-span-1 text-center">
                                                    <span className="bg-orange-50 text-orange-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border border-orange-200/50">
                                                        {client?.total_bills || 0} DOCS
                                                    </span>
                                                </div>
                                                <div className="col-span-2 text-right text-slate-400 text-xs font-bold">
                                                    Ref {formatUSD(client?.total_debt)}
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <span className="text-rose-600 font-black text-sm bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg shadow-sm ring-1 ring-rose-100">
                                                        Ref {formatUSD(client?.remaining_balance)}
                                                    </span>
                                                </div>
                                                <div className="col-span-1 flex justify-center opacity-40 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                                    <div className="bg-white border border-slate-200 p-2 rounded-xl shadow-sm hover:border-slate-300 hover:text-slate-600 transition-colors">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 🚀 FIX UX: VISTA MÓVIL HORIZONTAL COMPACTA */}
                                            <div className="md:hidden flex justify-between items-center pl-2">
                                                {/* Sección Izquierda: Avatar y Datos */}
                                                <div className="flex items-center gap-3 pr-2 flex-1 overflow-hidden">
                                                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                                                        {(client?.full_name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col flex-1 overflow-hidden">
                                                        <p className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate">{client?.full_name || 'Desconocido'}</p>
                                                        <span className="text-[9px] bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded text-slate-500 font-bold shadow-sm uppercase tracking-wider w-max">
                                                            {client?.total_bills || 0} Docs
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Sección Derecha: Montos */}
                                                <div className="text-right shrink-0">
                                                    <p className="text-[8px] text-rose-500 uppercase font-black tracking-widest mb-0.5">Pendiente</p>
                                                    <p className="font-black text-rose-600 text-base tracking-tight leading-none">Ref {formatUSD(client?.remaining_balance)}</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ));
                                })()}
                            </div>

                            {/* CONTROLES DE PAGINACIÓN DINÁMICA */}
                            {filteredCredits.length > 0 && (
                                <div className="p-3 border-t border-slate-200/60 flex justify-between items-center gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
                                    <select 
                                        value={creditsPerPage} 
                                        onChange={(e) => { 
                                            setCreditsPerPage(Number(e.target.value)); 
                                            setCreditCurrentPage(1); 
                                        }} 
                                        className="bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1.5 px-3 outline-none cursor-pointer text-slate-600 shadow-sm focus:ring-2 focus:ring-slate-100 transition-all"
                                    >
                                        <option value={25}>25 / pág</option>
                                        <option value={50}>50 / pág</option>
                                        <option value={100}>100 / pág</option>
                                    </select>
                                    <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                                        <Button variant="ghost" onClick={() => setCreditCurrentPage(prev => Math.max(1, prev - 1))} disabled={creditCurrentPage === 1} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Ant</Button>
                                        <span className="text-[10px] font-black text-slate-500 tracking-wider">
                                            {creditCurrentPage} <span className="text-slate-300 font-medium">/</span> {Math.max(1, Math.ceil(filteredCredits.length / creditsPerPage))}
                                        </span>
                                        <Button variant="ghost" onClick={() => setCreditCurrentPage(prev => Math.min(Math.ceil(filteredCredits.length / creditsPerPage), prev + 1))} disabled={creditCurrentPage === Math.ceil(filteredCredits.length / creditsPerPage) || Math.ceil(filteredCredits.length / creditsPerPage) === 0} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Sig</Button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                ) : (
                    /* --- VISTA 2: DETALLE DEL CLIENTE (FACTURAS & PAGOS) --- */
                    <motion.div 
                        key="detail-view"
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden flex flex-col flex-1 h-full"
                    >
                        {/* CABECERA FIJA DEL CLIENTE (STICKY) */}
                        <div className="p-4 md:p-6 border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">

                            {/* Info Cliente */}
                            <div className="w-full md:w-auto">
                                <button
                                    onClick={() => setSelectedCreditCustomer(null)}
                                    className="group flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mb-3 outline-none"
                                >
                                    <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg group-hover:bg-slate-200 transition-colors shadow-sm">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Volver a la Cartera</span>
                                </button>

                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight leading-none truncate max-w-[250px] md:max-w-md">
                                        {selectedCreditCustomer?.full_name || 'Desconocido'}
                                    </h3>
                                    {/* Badges Info */}
                                    <div className="hidden md:flex gap-2">
                                        <span className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-500 font-mono shadow-sm">
                                            ID: {selectedCreditCustomer?.id_number || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* --- BOTÓN DE IMPACTO: SALDAR TODO --- */}
                            <button
                                onClick={() => handlePayAll(selectedCreditCustomer)}
                                className="w-full md:w-auto group relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-3 md:p-4 rounded-xl md:rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 active:scale-95 outline-none flex items-center justify-between gap-6 border border-slate-700 shrink-0"
                            >
                                {/* Brillo decorativo sutil (Blanco transparente, no neón) */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-white/20 transition-all"></div>

                                <div className="text-left relative z-10">
                                    <p className="text-[9px] text-slate-300 uppercase font-black tracking-widest mb-0.5 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Saldar Totalidad
                                    </p>
                                    <p className="text-xl md:text-3xl font-black text-white tracking-tight drop-shadow-sm leading-none">
                                        Ref {formatUSD(selectedCreditCustomer?.remaining_balance)}
                                    </p>
                                </div>

                                <div className="bg-white/10 p-2.5 md:p-3 rounded-lg md:rounded-xl backdrop-blur-md border border-white/10 group-hover:bg-white group-hover:text-slate-900 text-white transition-all duration-300 relative z-10 shrink-0">
                                    <svg className="w-5 h-5 md:w-6 md:h-6 transform group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                            </button>
                        </div>

                        {/* CONTENEDOR DE LISTA CON SCROLL INDEPENDIENTE */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 flex flex-col">

                            {/* LÓGICA DE PAGINACIÓN */}
                            {(() => {
                                const indexOfLastItem = detailsCurrentPage * detailsPerPage;
                                const indexOfFirstItem = indexOfLastItem - detailsPerPage;
                                const currentInvoices = customerCreditsDetails.slice(indexOfFirstItem, indexOfLastItem);
                                const totalPages = Math.max(1, Math.ceil(customerCreditsDetails.length / detailsPerPage));

                                return (
                                    <div className="p-3 md:p-6 flex-1 flex flex-col">
                                        {/* --- VERSIÓN ESCRITORIO (TABLA MODERNA) --- */}
                                        <div className="hidden md:block bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm flex-1">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50/80 text-slate-400 uppercase font-black tracking-widest text-[10px] border-b border-slate-200/60 sticky top-0 z-10 backdrop-blur-sm">
                                                    <tr>
                                                        <th className="px-6 py-4"># Venta</th>
                                                        <th className="px-6 py-4">Fechas</th>
                                                        <th className="px-6 py-4 text-right">Total Orig.</th>
                                                        <th className="px-6 py-4 text-right">Abonado</th>
                                                        <th className="px-6 py-4 text-right">Restante</th>
                                                        <th className="px-6 py-4 text-center">Estado</th>
                                                        <th className="px-6 py-4 text-center">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100/50 text-sm">
                                                    {currentInvoices.map((sale) => (
                                                        <tr
                                                            key={sale?.id || Math.random()}
                                                            onClick={() => showSaleDetail(sale)}
                                                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${sale?.is_overdue ? 'bg-rose-50/20' : ''}`}
                                                        >
                                                            <td className="px-6 py-4">
                                                                <span className="font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-xs shadow-sm">#{sale?.id || 'N/A'}</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="text-xs text-slate-500 font-medium">
                                                                        {sale?.created_at ? new Date(sale.created_at).toLocaleDateString('es-VE') : 'N/A'}
                                                                    </div>
                                                                    {sale?.is_overdue && (
                                                                        <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded w-fit border border-rose-100 uppercase tracking-widest">
                                                                            Vencida
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-bold text-slate-400">Ref {formatUSD(sale?.total_usd)}</td>
                                                            <td className="px-6 py-4 text-right font-bold text-slate-500">Ref {formatUSD(sale?.amount_paid_usd)}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="font-black text-slate-700 text-base">Ref {formatUSD(sale?.remaining_amount)}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${sale?.status === 'PARCIAL'
                                                                    ? 'bg-orange-50 text-orange-600 border-orange-200/50'
                                                                    : 'bg-yellow-50 text-yellow-600 border-yellow-200/50'
                                                                    }`}>
                                                                    {sale?.status || 'PENDIENTE'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                    <Button
                                                                        variant="ghost"
                                                                        onClick={(e) => { e.stopPropagation(); showSaleDetail(sale); }}
                                                                        className="!p-2 !text-slate-400 hover:!text-slate-600 hover:!bg-white hover:!shadow-md hover:-translate-y-0.5 !bg-slate-50 !border !border-slate-200 !rounded-xl transition-all"
                                                                        title="Ver Detalle"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                    </Button>
                                                                    <Button
                                                                        variant="primary"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handlePaymentProcess(sale?.id, Number(sale?.total_usd || 0), Number(sale?.amount_paid_usd || 0));
                                                                        }}
                                                                        className="!px-3 !py-2 !gap-1 text-xs !bg-slate-800 hover:!bg-slate-900 !text-white !shadow-sm hover:!shadow-md hover:-translate-y-0.5 transition-all outline-none border-0"
                                                                    >
                                                                        <span>$</span> Abonar
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* --- VERSIÓN MÓVIL (TARJETAS COMPACTAS) --- */}
                                        <div className="md:hidden space-y-3 flex-1">
                                            {currentInvoices.map((sale) => (
                                                <div key={sale?.id || Math.random()} className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                                                    {/* Indicador lateral */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${sale?.is_overdue ? 'bg-rose-500' : 'bg-slate-300'}`}></div>

                                                    <div className="pl-1.5">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <span className="font-black text-lg text-slate-800 tracking-tight leading-none">#{sale?.id || 'N/A'}</span>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                                                                    {sale?.created_at ? new Date(sale.created_at).toLocaleDateString('es-VE') : 'N/A'}
                                                                </p>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end">
                                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${sale?.status === 'PARCIAL' ? 'bg-orange-50 text-orange-600 border-orange-200/50' : 'bg-yellow-50 text-yellow-600 border-yellow-200/50'}`}>
                                                                    {sale?.status || 'PENDIENTE'}
                                                                </span>
                                                                {sale?.is_overdue && <span className="text-[8px] font-black text-rose-500 mt-1.5 animate-pulse uppercase tracking-widest bg-rose-50 px-1 rounded border border-rose-100">VENCIDA</span>}
                                                            </div>
                                                        </div>

                                                        {/* Fila de montos compacta */}
                                                        <div className="flex justify-between items-end border-t border-slate-100 pt-2 mb-3">
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Total Factura</p>
                                                                <p className="text-xs font-bold text-slate-500">Ref {formatUSD(sale?.total_usd)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Saldo Deudor</p>
                                                                <p className="text-lg font-black text-slate-800 tracking-tight leading-none">Ref {formatUSD(sale?.remaining_amount)}</p>
                                                            </div>
                                                        </div>

                                                        {/* Botones de acción móvil */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button
                                                                onClick={() => showSaleDetail(sale)}
                                                                className="py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 transition-colors shadow-sm outline-none"
                                                            >
                                                                Detalles
                                                            </button>
                                                            <button
                                                                onClick={() => handlePaymentProcess(sale?.id, Number(sale?.total_usd || 0), Number(sale?.amount_paid_usd || 0))}
                                                                className="py-2.5 text-[11px] font-black uppercase tracking-widest text-white bg-slate-800 rounded-xl shadow-sm hover:bg-slate-900 active:scale-95 transition-all outline-none flex items-center justify-center gap-1 border-0"
                                                            >
                                                                <span>$</span> Abonar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* --- PAGINACIÓN DETALLES DINÁMICA --- */}
                                        {customerCreditsDetails.length > 0 && (
                                            <div className="mt-3 md:mt-4 p-3 border border-slate-200/60 rounded-xl flex justify-between items-center gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
                                                <select 
                                                    value={detailsPerPage} 
                                                    onChange={(e) => { 
                                                        setDetailsPerPage(Number(e.target.value)); 
                                                        setDetailsCurrentPage(1); 
                                                    }} 
                                                    className="bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1.5 px-3 outline-none cursor-pointer text-slate-600 shadow-sm focus:ring-2 focus:ring-slate-100 transition-all"
                                                >
                                                    <option value={25}>25 / pág</option>
                                                    <option value={50}>50 / pág</option>
                                                    <option value={100}>100 / pág</option>
                                                </select>
                                                <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                                                    <Button variant="ghost" onClick={() => setDetailsCurrentPage(prev => Math.max(1, prev - 1))} disabled={detailsCurrentPage === 1} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Ant</Button>
                                                    <span className="text-[10px] font-black text-slate-500 tracking-wider">
                                                        {detailsCurrentPage} <span className="text-slate-300 font-medium">/</span> {totalPages}
                                                    </span>
                                                    <Button variant="ghost" onClick={() => setDetailsCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={detailsCurrentPage === totalPages || totalPages === 0} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Sig</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CreditsView;