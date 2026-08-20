import React from 'react';

export const DailySalesModal = ({
    showDailySalesModal,
    setShowDailySalesModal,
    dailySalesList,
    bcvRate,
    showSaleDetail,
    handleCashClose
}) => {
    if (!showDailySalesModal) return null;

    // Cálculos en tiempo real para los KPIs (Lógica original intacta)
    const validSales = dailySalesList.filter(s => s.status !== 'ANULADO');
    const totalBs = validSales.reduce((acc, curr) => {
        let net = curr.amount_paid_usd;
        if (curr.payment_method?.includes('[CAP:')) {
            const m = curr.payment_method.match(/\[CAP:([\d\.]+)\]/);
            if (m) net -= parseFloat(m[1]);
        }
        return acc + (net * (curr.bcv_rate_snapshot || bcvRate));
    }, 0);
    
    const totalRef = validSales.reduce((acc, curr) => {
        let net = curr.amount_paid_usd;
        if (curr.payment_method?.includes('[CAP:')) {
            const m = curr.payment_method.match(/\[CAP:([\d\.]+)\]/);
            if (m) net -= parseFloat(m[1]);
        }
        return acc + net;
    }, 0);

    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in font-sans">
            <div className="bg-[#F8FAFC] rounded-2xl sm:rounded-[2rem] w-full max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col shadow-2xl shadow-black/50 animate-scale-up overflow-hidden ring-1 ring-white/20 relative">
                
                {/* 1. HEADER PREMIUM (ADAPTATIVO) */}
                <div className="px-5 sm:px-8 py-4 sm:py-6 bg-white border-b border-slate-100 flex justify-between items-center shrink-0 z-20">
                    <div className="flex-1 min-w-0 pr-4">
                        <h3 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 sm:gap-3">
                            <span className="bg-indigo-600 text-white min-w-[28px] h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm sm:text-lg shadow-md shadow-indigo-200">📊</span>
                            <span className="truncate">Monitor de Operaciones</span>
                        </h3>
                        <p className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 ml-9 sm:ml-11 truncate">
                            Reporte X <span className="hidden sm:inline">(Preliminar)</span> • {new Date().toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                    </div>
                    {/* Botón Cerrar */}
                    <button
                        onClick={() => setShowDailySalesModal(false)}
                        className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center font-bold outline-none active:scale-95"
                    >
                        ✕
                    </button>
                </div>

                {/* 2. RESUMEN KPI (TARJETAS APILADAS EN MÓVIL, HORIZONTALES EN PC) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 px-4 sm:px-8 py-4 sm:py-6 bg-slate-50 border-b border-slate-200/50 shrink-0 overflow-y-auto max-h-[35vh] sm:max-h-none custom-scrollbar">
                    {/* KPI 1 */}
                    <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 sm:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">#</div>
                        <div className="min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Movimientos</p>
                            <p className="text-xl sm:text-2xl font-black text-slate-800">{validSales.length}</p>
                        </div>
                    </div>

                    {/* KPI 2 */}
                    <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 sm:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center font-bold text-xs">Bs</div>
                        <div className="min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Bolívares</p>
                            <p className="text-lg sm:text-xl font-black text-slate-700 truncate">Bs {totalBs.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* KPI 3 */}
                    <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-3 sm:gap-4 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 rounded-bl-full -mr-2 -mt-2 pointer-events-none"></div>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-md z-10">$</div>
                        <div className="relative z-10 min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-wider truncate">Total Divisas</p>
                            <p className="text-xl sm:text-2xl font-black text-indigo-700 truncate">Ref {totalRef.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                {/* 3. LISTADO DETALLADO (TABLA PRO CON SCROLL HORIZONTAL PROTEGIDO) */}
                <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar p-4 sm:p-6 pt-2">
                    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-sm min-w-[600px] sm:min-w-full">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] sm:text-[10px] font-bold tracking-wider border-b border-slate-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 sm:px-5 py-3 sm:py-4">Hora</th>
                                    <th className="px-3 sm:px-5 py-3 sm:py-4">ID / Cliente</th>
                                    <th className="px-3 sm:px-5 py-3 sm:py-4 text-center">Detalles Pago</th>
                                    <th className="px-3 sm:px-5 py-3 sm:py-4 text-right">Monto (Ref)</th>
                                    <th className="px-3 sm:px-5 py-3 sm:py-4 text-center">Estado</th>
                                    <th className="px-3 sm:px-5 py-3 sm:py-4 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {dailySalesList.map(sale => {
                                    const isVoid = sale.status === 'ANULADO';
                                    let displayAmount = parseFloat(sale.total_usd);
                                    if (sale.payment_method?.includes('[CAP:')) {
                                        const m = sale.payment_method.match(/\[CAP:([\d\.]+)\]/);
                                        if (m) displayAmount -= parseFloat(m[1]);
                                    }
                                    return (
                                        <tr
                                            key={sale.id}
                                            onClick={() => showSaleDetail(sale)}
                                            className={`group transition-all cursor-pointer ${isVoid ? 'bg-slate-50 opacity-60 grayscale' : 'hover:bg-indigo-50/30'}`}
                                        >
                                            <td className="px-3 sm:px-5 py-3 sm:py-4 font-mono text-[10px] sm:text-xs text-slate-500">
                                                {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-3 sm:px-5 py-3 sm:py-4">
                                                <div className="flex flex-col">
                                                    <span className={`font-bold text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px] ${isVoid ? 'text-slate-500 line-through' : 'text-slate-700 group-hover:text-indigo-700'}`} title={sale.full_name}>
                                                        {sale.full_name || 'Consumidor Final'}
                                                    </span>
                                                    {/* 🚀 FIX UX: SECUENCIA AISLADA DE VENTAS (UX PRO) */}
                                                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-400">
                                                        #{sale.correlativo_interno || sale.control_number || sale.id}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-center">
                                                <span className="inline-block px-2 sm:px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[9px] sm:text-[10px] font-bold border border-slate-200 max-w-[100px] sm:max-w-[150px] truncate">
                                                    {sale.payment_method}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-black font-mono text-xs sm:text-sm ${isVoid ? 'text-slate-400' : 'text-slate-800'}`}>
                                                        {displayAmount.toFixed(2)}
                                                    </span>
                                                    {parseFloat(sale.discount_usd) > 0 && !isVoid && (
                                                        <span className="text-[8px] sm:text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-1 border border-emerald-100 flex items-center gap-1 shadow-sm whitespace-nowrap">
                                                            -Ref {parseFloat(sale.discount_usd).toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-center">
                                                {isVoid ? (
                                                    <span className="px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black bg-slate-200 text-slate-500 uppercase">Anulado</span>
                                                ) : (
                                                    <span className="px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black bg-emerald-50 text-emerald-600 uppercase tracking-wide border border-emerald-100">
                                                        Procesado
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); showSaleDetail(sale); }}
                                                    className="w-6 h-6 sm:w-8 sm:h-8 mx-auto rounded-full bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-all shadow-sm group-hover:scale-105"
                                                >
                                                    👁️
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {dailySalesList.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-10 sm:py-20 text-center">
                                            <div className="inline-flex flex-col items-center opacity-40">
                                                <span className="text-3xl sm:text-4xl mb-2">🧾</span>
                                                <span className="font-bold text-slate-500 text-xs sm:text-sm">Sin operaciones en este turno</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. FOOTER FLOTANTE "GLASS" (ACCIONES ADAPTATIVAS) */}
                <div className="px-4 sm:px-8 py-4 sm:py-5 bg-white/90 backdrop-blur-lg border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 shrink-0 z-30">
                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium text-center sm:text-left order-2 sm:order-1">
                        * Los montos en divisas son referenciales según tasa BCV.
                    </div>
                    <div className="flex w-full sm:w-auto gap-2 sm:gap-4 order-1 sm:order-2">
                        <button
                            onClick={() => setShowDailySalesModal(false)}
                            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors text-xs sm:text-sm border border-slate-200 sm:border-transparent outline-none active:scale-95"
                        >
                            Volver
                        </button>
                        <button
                            onClick={handleCashClose}
                            className="flex-[2] sm:flex-none bg-slate-900 hover:bg-black text-white px-4 sm:px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 active:scale-95 outline-none"
                        >
                            <span>📠</span>
                            <span className="truncate">Auditar y Cerrar Caja (Z)</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};