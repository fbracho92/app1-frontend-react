import React from 'react';
import { motion } from 'framer-motion';

export const DashboardView = ({
    stats = {}, 
    lowStock = [],
    topDebtors = [],
    recentSales = [],
    openDailySalesDetail,
    showSaleDetail,
    setShowStockModal,
    setView
}) => {
    const safeFloat = (value) => parseFloat(value || 0);

    const currentRate = stats.current_rate || 0;
    const isContingency = stats.is_contingency;

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20, filter: 'blur(5px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 300, damping: 24 } }
    };

    return (
        /* 🛡️ CONTENEDOR PRINCIPAL */
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="p-4 md:p-8 overflow-y-auto flex-1 min-h-0 w-full font-sans text-slate-800 relative bg-slate-50 flex flex-col gap-5 md:gap-6"
        >
            {/* --- HEADER CON MONITOR DE TASA (ALINEACIÓN MÓVIL CORREGIDA) --- */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/60 p-4 md:p-5 rounded-[2rem] border border-slate-200/50 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] shrink-0">
                <div className="text-left w-full md:w-auto">
                    <h2 className="text-2xl font-black tracking-tight text-slate-800">Panel Gerencial</h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Indicadores de rendimiento en tiempo real</p>
                </div>
                
                {/* WIDGET BCV DARK PREMIUM (FULL WIDTH EN MÓVIL) */}
                {currentRate > 0 && (
                    <motion.div 
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`flex items-center justify-between md:justify-end gap-4 px-5 md:px-6 py-3 rounded-2xl border transition-all shadow-lg w-full md:w-auto ${
                            isContingency 
                            ? 'bg-gradient-to-r from-slate-900 to-slate-800 border-amber-500/30 shadow-amber-900/20' 
                            : 'bg-gradient-to-r from-slate-900 to-slate-800 border-emerald-500/30 shadow-emerald-900/20'
                        }`}
                    >
                        <div className="flex flex-col text-left md:text-right">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {isContingency ? '⚠️ Contingencia' : '🏛️ Oficial BCV'}
                            </span>
                            <span className="text-2xl font-black leading-none tracking-tight mt-0.5 text-white">
                                {safeFloat(currentRate).toFixed(2)} <span className="text-xs font-bold text-slate-500">Bs/$</span>
                            </span>
                        </div>
                        <div className="relative flex h-3 w-3 shrink-0">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isContingency ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                            <div className={`relative inline-flex rounded-full h-3 w-3 shadow-[0_0_8px_rgba(0,0,0,0.8)] ${isContingency ? 'bg-amber-400 shadow-amber-400/50' : 'bg-emerald-400 shadow-emerald-400/50'}`}></div>
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* --- TARJETAS KPI SUPERIORES --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 shrink-0">
                <motion.div
                    variants={itemVariants}
                    whileHover={{ y: -5, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={openDailySalesDetail}
                    className="bg-white/60 backdrop-blur-xl p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50 cursor-pointer transition-all group relative overflow-hidden flex flex-col justify-center"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-500 transition-colors">Ventas Hoy (Ref)</p>
                            <p className="text-3xl font-black text-indigo-600 mt-1 tracking-tight">Ref {safeFloat(stats.total_usd).toFixed(2)}</p>
                            <p className="text-[9px] font-bold text-indigo-500 mt-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-1 uppercase tracking-wider">
                                Ver Detalle <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </p>
                        </div>
                        <div className="bg-indigo-50 p-3 rounded-2xl group-hover:bg-indigo-500 group-hover:text-white text-indigo-500 transition-colors shadow-sm shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white/60 backdrop-blur-xl p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50 flex flex-col justify-center">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ventas Hoy (Bs)</p>
                    <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight">Bs {safeFloat(stats.total_ves).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</p>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white/60 backdrop-blur-xl p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50 flex flex-col justify-between relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-3 relative z-10">
                        <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${lowStock.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            Alertas Stock ({lowStock.length})
                        </p>
                        {lowStock.length > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); setShowStockModal(true); }} className="text-[9px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md shadow-sm transition-colors active:scale-95 outline-none uppercase tracking-wider border border-rose-100">
                                Revisar
                            </button>
                        )}
                    </div>
                    <div className="space-y-2 mb-2 relative z-10">
                        {lowStock.slice(0, 3).map((p, i) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-white/80 p-2 rounded-xl border border-slate-100 shadow-sm backdrop-blur-sm">
                                <span className="truncate w-3/4 font-bold text-slate-700 flex items-center gap-1.5">
                                    {(p.icon_emoji && (p.icon_emoji.startsWith('data:image') || p.icon_emoji.startsWith('http'))) ? (
                                        <img src={p.icon_emoji} alt="img" className="w-5 h-5 rounded-full object-cover border border-slate-100 flex-shrink-0" />
                                    ) : ( <span className="text-base">{p.icon_emoji || '📦'}</span> )}
                                    {p.name}
                                </span>
                                <span className="font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">{p.stock}</span>
                            </div>
                        ))}
                        {lowStock.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-2">
                                <span className="text-2xl mb-1">🎉</span>
                                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Inventario Sano</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white/60 backdrop-blur-xl p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50 flex flex-col justify-between">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${topDebtors.length > 0 ? 'text-orange-500' : 'text-slate-400'}`}>Top Deudores</p>
                    <div className="space-y-3">
                        {topDebtors.slice(0, 3).map((d, i) => (
                            <div key={i} className="flex justify-between items-center text-xs border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                <span className="truncate flex-1 font-bold text-slate-700 pr-2" title={d.full_name}>{d.full_name}</span>
                                <span className="font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 whitespace-nowrap">Ref {safeFloat(d.debt).toFixed(2)}</span>
                            </div>
                        ))}
                        {topDebtors.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-2">
                                <span className="text-2xl mb-1 opacity-50 grayscale">🧾</span>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cuentas al día</p>
                            </div>
                        )}
                        {topDebtors.length > 0 && (
                            <button onClick={() => setView('CREDIT_REPORT')} className="w-full mt-2 pt-2 border-t border-slate-100 text-[9px] font-bold text-orange-500 hover:text-orange-600 flex items-center justify-center gap-1 uppercase tracking-widest transition-colors outline-none">
                                Ir a Cobranzas →
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* --- TABLA DE TRANSACCIONES (MÓVIL ALINEADO) --- */}
            <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/50 overflow-hidden relative flex flex-col w-full shrink-0">
                
                {/* CABECERA DE LA TABLA (FULL WIDTH EN MÓVIL) */}
                <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                    <div className="flex flex-col w-full md:w-auto">
                        <h3 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                            Últimas Transacciones
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-100/50 text-emerald-600 text-[9px] font-black uppercase tracking-widest items-center gap-1 border border-emerald-200/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> En Vivo
                            </span>
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Visor de los 10 movimientos más recientes</span>
                    </div>

                    <button
                        onClick={openDailySalesDetail}
                        className="w-full md:w-auto group flex items-center justify-center gap-3 px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl transition-all duration-300 border border-indigo-100 hover:border-transparent shadow-sm active:scale-95 outline-none"
                    >
                        <div className="flex items-center justify-center w-7 h-7 bg-white group-hover:bg-white/20 rounded-lg shadow-sm transition-colors text-sm shrink-0">📋</div>
                        <div className="flex flex-col items-start leading-none pr-1">
                            <span className="text-[9px] font-black tracking-wide">MONITOR DIARIO</span>
                        </div>
                    </button>
                </div>

                <div className="overflow-x-auto custom-scrollbar w-full bg-white/40">
                    <table className="w-full text-left text-xs md:text-sm text-slate-600 whitespace-nowrap">
                        <thead className="bg-slate-50/90 backdrop-blur-md text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-4">ID</th>
                                <th className="px-5 py-4">Fecha</th>
                                <th className="px-5 py-4">Cliente</th>
                                <th className="px-5 py-4 text-center">Método</th>
                                <th className="px-5 py-4 text-center">Estatus</th>
                                <th className="px-5 py-4 text-right">Monto Ref</th>
                                <th className="px-5 py-4 text-right">Monto Bs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50 relative z-0">
                            {recentSales.map((sale) => {
                                const isFiscal = sale.invoice_type === 'FISCAL' || sale.invoice_type === 'FORMA_LIBRE';
                                const isDonationVisual = sale.status === 'DONADO' || 
                                    (sale.payment_method && sale.payment_method.toUpperCase().includes('DONACI'));

                                return (
                                    <motion.tr 
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        key={sale.id} 
                                        onClick={() => showSaleDetail(sale)} 
                                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                                    >
                                        {/* 🚀 FIX UX: SECUENCIA AISLADA DE VENTAS (UX PRO) */}
                                        <td className="px-5 py-3 align-middle">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="font-black text-slate-400 text-xs leading-none">
                                                    #{sale.correlativo_interno || sale.control_number || sale.id}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[4px] border backdrop-blur-sm transition-all ${
                                                    isFiscal ? 'bg-indigo-50/80 text-indigo-600 border-indigo-200/50' : 'bg-slate-100 text-slate-400 border-slate-200/50'
                                                }`}>
                                                    {isFiscal ? '🧾 FISCAL' : 'TICKET'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-slate-500 text-xs">{sale.full_date}</td>
                                        <td className="px-5 py-3 font-bold text-slate-700 truncate max-w-[200px]" title={sale.full_name}>
                                            {sale.full_name || 'Consumidor Final'}
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className="px-2 py-1 bg-white border border-slate-200 shadow-sm rounded-md text-[9px] font-bold text-slate-500 truncate max-w-[120px] inline-block uppercase tracking-widest">
                                                {sale.payment_method || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border backdrop-blur-sm ${
                                                sale.status === 'ANULADO' ? 'bg-rose-50/80 text-rose-500 border-rose-200/50 line-through' :
                                                sale.status === 'PENDIENTE' ? 'bg-amber-50/80 text-amber-600 border-amber-200/50' :
                                                sale.status === 'PARCIAL' ? 'bg-indigo-50/80 text-indigo-600 border-indigo-200/50' :
                                                isDonationVisual ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                'bg-emerald-50/80 text-emerald-600 border-emerald-200/50'
                                            }`}>
                                                {isDonationVisual ? '🎁 DONADO' : sale.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`font-black text-sm ${sale.status === 'ANULADO' ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                                    Ref {safeFloat(sale.total_usd).toFixed(2)}
                                                </span>
                                                {safeFloat(sale.discount_usd) > 0 && sale.status !== 'ANULADO' && (
                                                     <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-200/50 flex items-center gap-1 shadow-sm backdrop-blur-sm">
                                                         🎁 -Ref {safeFloat(sale.discount_usd).toFixed(2)}
                                                     </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-5 py-3 text-right font-bold ${sale.status === 'ANULADO' ? 'text-slate-300 line-through' : 'text-slate-500'}`}>
                                            Bs {safeFloat(sale.total_ves).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                                        </td>
                                    </motion.tr>
                                );
                            })}
                            {recentSales.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center opacity-50">
                                            <span className="text-4xl mb-3 grayscale">📊</span>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sin operaciones en este turno</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </motion.div>
    );
};