import React from 'react';
import { formatBs } from '../utils/formatters';

// 🚀 OPTIMIZADO: Memoizado para asegurar 0 lag al abrirse o al calcular la comisión
export const CashAdvanceModal = React.memo(({
    isCashAdvanceOpen,
    setIsCashAdvanceOpen,
    advanceData,
    setAdvanceData,
    validateAndAddAdvance,
    bcvRate
}) => {
    if (!isCashAdvanceOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans">
            {/* Contenedor con Aceleración de Hardware (transform-gpu) */}
            <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl shadow-slate-900/20 overflow-hidden flex flex-col animate-scale-up border border-slate-100 transform-gpu">

                {/* Header Minimalista */}
                <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white z-20 sticky top-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span className="bg-emerald-50 text-emerald-600 p-2 rounded-xl text-lg">💸</span>
                            <span>Avance de Efectivo</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 ml-11">Servicio de retiro en caja</p>
                    </div>
                    <button 
                        onClick={() => setIsCashAdvanceOpen(false)} 
                        className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90 shadow-sm"
                    >
                        ✕
                    </button>
                </div>

                {/* Cuerpo del Formulario */}
                <div className="p-8 bg-slate-50/50">
                    <form onSubmit={validateAndAddAdvance}>

                        {/* GRUPO: DATOS DEL AVANCE */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
                            <div className="flex flex-col gap-6">

                                {/* Input Monto */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block pl-1">Monto a Entregar (Bs)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            autoFocus
                                            required
                                            value={advanceData.amountBs}
                                            onChange={(e) => setAdvanceData({ ...advanceData, amountBs: e.target.value })}
                                            className="w-full h-16 pl-12 pr-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-slate-400 outline-none font-black text-slate-700 text-3xl placeholder-slate-300 transition-all"
                                            placeholder="0.00"
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">Bs</span>
                                    </div>
                                </div>

                                {/* Input Comisión */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block pl-1">Comisión del Servicio (%)</label>
                                    <div className="flex gap-3">
                                        <div className="relative w-24 shrink-0">
                                            <input
                                                type="number"
                                                step="0.1"
                                                required
                                                value={advanceData.commission}
                                                onChange={(e) => setAdvanceData({ ...advanceData, commission: e.target.value })}
                                                className="w-full h-12 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:border-slate-400 outline-none text-center"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>

                                        {/* Botones de Comisión Rápida */}
                                        <div className="flex-1 flex gap-2">
                                            {[5, 10, 12, 15].map(pct => (
                                                <button
                                                    key={pct}
                                                    type="button"
                                                    onClick={() => setAdvanceData({ ...advanceData, commission: pct })}
                                                    className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${advanceData.commission == pct
                                                        ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                                                        : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {pct}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RESUMEN DE CÁLCULO */}
                        {advanceData.amountBs && (
                            <div className="bg-white border border-slate-100 p-5 rounded-[2rem] mb-6 space-y-3 shadow-sm">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>Efectivo:</span>
                                    <span className="text-slate-700">Bs {formatBs(parseFloat(advanceData.amountBs))}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                    <span>Comisión ({advanceData.commission}%):</span>
                                    <span>+ Bs {formatBs(parseFloat(advanceData.amountBs) * (parseFloat(advanceData.commission) / 100))}</span>
                                </div>

                                <div className="border-t border-slate-100 pt-3 mt-1">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Cobrar</span>
                                        <span className="text-2xl font-black text-slate-800 leading-none">
                                            Bs {formatBs(parseFloat(advanceData.amountBs) * (1 + parseFloat(advanceData.commission) / 100))}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-right text-blue-600 font-black mt-1 uppercase tracking-widest">
                                        Ref: $ {((parseFloat(advanceData.amountBs) * (1 + parseFloat(advanceData.commission) / 100)) / bcvRate).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Botón Acción */}
                        <button type="submit" className="w-full bg-slate-800 hover:bg-black text-white font-black py-4 rounded-2xl shadow-lg shadow-slate-800/20 active:scale-[0.98] transition-all flex justify-center items-center gap-3 text-sm uppercase tracking-widest group">
                            <span className="group-hover:animate-bounce">🛒</span>
                            <span>Agregar al Carrito</span>
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );
});