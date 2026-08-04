import React, { memo } from 'react';

// 🚀 OPTIMIZACIÓN: Fila de movimiento memoizada para renderizado ultra rápido
const MovementRow = memo(({ mov, idx }) => {
    const isEntry = mov.type === 'IN';
    
    return (
        <div className="relative pl-24 pr-6 py-4 group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
            {/* Indicador de estado */}
            <div className={`absolute left-[50px] top-5 w-4 h-4 rounded-full border-[3px] border-slate-50 shadow-md z-10 transition-transform group-hover:scale-125 ${isEntry ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

            {/* Timestamp vertical */}
            <div className="absolute left-1 top-5 w-[45px] text-right flex flex-col items-end">
                <p className="text-[10px] font-black text-slate-500 leading-tight">
                    {new Date(mov.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })}
                </p>
                <p className="text-[8px] font-medium text-slate-300 mt-0.5">
                    {new Date(mov.created_at).getFullYear()}
                </p>
            </div>

            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white uppercase tracking-wider shadow-sm ${isEntry ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                            {isEntry ? 'ENTRADA' : 'SALIDA'}
                        </span>
                        <span className="text-[10px] font-mono font-medium text-slate-400">
                            {new Date(mov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 leading-snug truncate" title={mov.reason}>
                        {mov.reason.replace(/_/g, ' ')}
                    </p>
                    
                    {/* Información adicional */}
                    {(mov.document_ref || (isEntry && mov.cost_usd)) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {mov.document_ref && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm truncate">
                                    📄 {mov.document_ref}
                                </span>
                            )}
                            {isEntry && mov.cost_usd && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 shadow-sm">
                                    Ref {parseFloat(mov.cost_usd).toFixed(2)}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Cantidades */}
                <div className="text-right flex flex-col items-end shrink-0">
                    <span className={`text-2xl font-black tracking-tighter tabular-nums ${isEntry ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isEntry ? '+' : '-'}{mov.quantity}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Saldo</span>
                        <span className="text-xs font-black text-slate-700 bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-200">
                            {mov.new_stock}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const KardexModal = memo(({ isKardexOpen, setIsKardexOpen, kardexProduct, kardexHistory, printKardexReport }) => {
    if (!isKardexOpen || !kardexProduct) return null;

    return (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg h-[85vh] flex flex-col shadow-2xl overflow-hidden relative ring-1 ring-white/20 transform-gpu">

                {/* HEADER */}
                <div className="relative p-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white shrink-0 overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl transform translate-x-10 -translate-y-10 rotate-12 select-none pointer-events-none">
                        {kardexProduct.icon_emoji}
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em] mb-2">Auditoría de Inventario</p>
                            <h3 className="text-2xl font-black tracking-tight leading-none mb-3 w-4/5 text-white">{kardexProduct.name}</h3>
                            <div className="inline-flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-sm shadow-sm">
                                <span className="text-xs text-slate-300 font-medium uppercase tracking-wide">Stock Actual</span>
                                <div className="h-4 w-px bg-white/20"></div>
                                <span className="text-xl font-black text-white tracking-tight">{kardexProduct.stock}</span>
                                <span className="text-[10px] text-slate-400 font-bold">UND</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={printKardexReport} className="bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-300 rounded-full p-2.5 transition-all active:scale-90 border border-emerald-500/30" title="Descargar PDF">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                            <button onClick={() => setIsKardexOpen(false)} className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-all active:scale-90 border border-white/5">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* CUERPO: TIMELINE */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-0 custom-scrollbar">
                    {kardexHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <span className="text-6xl mb-4 grayscale opacity-50">📊</span>
                            <p className="font-bold text-sm uppercase tracking-wide">Sin movimientos registrados</p>
                        </div>
                    ) : (
                        <div className="relative pb-10 pt-4">
                            <div className="absolute left-[58px] top-0 bottom-0 w-0.5 bg-slate-200"></div>
                            {kardexHistory.map((mov, idx) => (
                                <MovementRow key={idx} mov={mov} idx={idx} />
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-3 bg-white border-t border-slate-100 flex justify-center items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Registro inmutable de seguridad
                </div>
            </div>
        </div>
    );
});

export default KardexModal;