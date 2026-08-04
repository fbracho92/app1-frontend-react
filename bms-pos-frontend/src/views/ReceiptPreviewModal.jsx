import React from 'react';

export const ReceiptPreviewModal = ({
    receiptPreview,
    setReceiptPreview
}) => {
    if (!receiptPreview) return null;

    // 🚨 DETECCIÓN INTELIGENTE: Analizamos el HTML para saber qué formato es
    const isFormaLibre = receiptPreview.includes('216mm') || receiptPreview.includes('Courier Prime');

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fade-in font-sans">
            
            {/* 🚨 CONTENEDOR DINÁMICO CLEAN PREMIUM */}
            <div className={`bg-white rounded-[2rem] w-full flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] relative animate-scale-up overflow-hidden border border-slate-100 transition-all duration-500 ${isFormaLibre ? 'max-w-4xl' : 'max-w-sm'}`}>

                {/* 🌟 Cabecera Limpia */}
                <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center shrink-0 bg-white z-20">
                    <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isFormaLibre ? 'bg-indigo-50 border border-indigo-100 text-indigo-600' : 'bg-blue-50 border border-blue-100 text-blue-600'}`}>
                            {isFormaLibre ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <h3 className="font-black text-lg text-slate-800 tracking-tight leading-none">
                                {isFormaLibre ? 'Factura Forma Libre' : 'Ticket de Caja'}
                            </h3>
                            {isFormaLibre && (
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    El espacio superior está reservado para el membrete legal
                                </span>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={() => setReceiptPreview(null)} 
                        className="h-8 w-8 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-colors outline-none"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* El Recibo (Renderizado en un Iframe) */}
                <div className="flex-1 bg-slate-100/50 p-6 flex justify-center overflow-y-auto max-h-[65vh] custom-scrollbar shadow-inner relative">
                    
                    {/* 🚨 PAPEL DINÁMICO: 80mm para ticket térmico, 216mm para Forma Libre */}
                    <div className={`bg-white shadow-lg relative overflow-hidden transition-all duration-500 rounded-sm ring-1 ring-slate-200/50 ${isFormaLibre ? 'w-full max-w-[216mm] min-h-[140mm]' : 'w-full max-w-[80mm] min-h-[300px]'}`}>
                        
                        {/* 🛡️ UX BLINDADO: Guía visual del membrete (Solo visible en pantalla, no en impresión) */}
                        {isFormaLibre && (
                            <div className="absolute top-0 left-0 w-full h-[45mm] bg-slate-50/90 border-b border-dashed border-slate-300 pointer-events-none flex items-center justify-center z-20 backdrop-blur-[1px]">
                                <div className="text-center opacity-60">
                                    <svg className="w-6 h-6 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" /></svg>
                                    <span className="text-slate-600 font-black text-[10px] uppercase tracking-widest">
                                        Área Pre-impresa SENIAT<br/>(El sistema saltará este espacio)
                                    </span>
                                </div>
                            </div>
                        )}

                        <iframe
                            srcDoc={receiptPreview}
                            className="w-full h-full min-h-[400px] border-none relative z-10 bg-transparent"
                            title="Receipt Preview"
                        />
                    </div>
                </div>

                {/* ⚡ FOOTER DE ACCIÓN */}
                <div className="p-5 md:p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3 shrink-0 z-20">
                    <button
                        onClick={() => setReceiptPreview(null)}
                        className="w-1/3 py-4 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold uppercase tracking-wide rounded-xl transition-colors shadow-sm"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={() => {
                            const iframe = document.querySelector('iframe[title="Receipt Preview"]');
                            if (iframe) {
                                iframe.contentWindow.print();
                            }
                        }}
                        className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.25)] active:scale-95 transition-all flex justify-center items-center gap-2 uppercase text-xs tracking-widest"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        {isFormaLibre ? 'IMPRIMIR FORMA LIBRE' : 'IMPRIMIR TICKET'}
                    </button>
                </div>
            </div>
        </div>
    );
};