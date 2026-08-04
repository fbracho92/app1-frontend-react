// src/views/MobileCartModal.jsx
import React from 'react';
import Button from '../components/ui/Button';
import { CartItem } from './PosView';

export const MobileCartModal = ({
    isMobileCartOpen,
    setIsMobileCartOpen,
    cart,
    removeFromCart,
    subtotalExemptUSD,
    subtotalTaxableUSD,
    IVA_RATE,
    ivaUSD,
    totalVES,
    finalTotalUSD,
    handleOpenPayment
}) => {
    if (!isMobileCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[55] bg-white md:hidden flex flex-col animate-slide-up font-sans">
            
            {/* --- HEADER --- */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0 flex justify-between items-center">
                <h2 className="font-black text-slate-800 text-lg uppercase tracking-tight">Tu Orden</h2>
                <button 
                    onClick={() => setIsMobileCartOpen(false)} 
                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 shadow-sm transition-all active:scale-95 outline-none"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            {/* --- LISTA DE PRODUCTOS --- */}
            <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar bg-slate-50/50">
                {(cart || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-3">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <p className="text-[10px] font-black uppercase tracking-widest">Carrito Vacío</p>
                    </div>
                ) : (
                    (cart || []).map(item => <CartItem key={item.id} item={item} removeFromCart={removeFromCart} />)
                )}
            </div>
            
            {/* --- DESGLOSE FISCAL --- */}
            {(cart || []).length > 0 && (
                <div className="px-5 pt-5 pb-3 border-t border-slate-100 bg-white shrink-0">
                    <div className="space-y-1.5 px-1 text-sm font-medium text-slate-500">
                        {(subtotalExemptUSD || 0) > 0 && (
                            <div className="flex justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal Exento</span>
                                <span className='font-black text-slate-700'>Ref {(subtotalExemptUSD || 0).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Imponible</span>
                            <span className='font-black text-slate-700'>Ref {(subtotalTaxableUSD || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">IVA ({IVA_RATE * 100}%)</span>
                            <span className='font-black text-rose-500'>Ref {(ivaUSD || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOTALES Y BOTÓN DE COBRO --- */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 shadow-inner z-30 shrink-0 pb-safe">
                <div className="flex justify-between mb-5 items-end px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</span>
                    <div className="flex flex-col items-end">
                        <span className="text-4xl font-black text-slate-800 leading-none tracking-tighter">
                            Bs {(totalVES || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-black text-blue-600 mt-1.5 bg-blue-100/50 px-2.5 py-0.5 rounded-md border border-blue-200/50 uppercase tracking-widest">
                            Ref {(finalTotalUSD || 0).toFixed(2)}
                        </span>
                    </div>
                </div>
                
                <Button 
                    variant="primary" 
                    onClick={handleOpenPayment} 
                    disabled={(cart || []).length === 0}
                    className="w-full !rounded-[1.25rem] !py-4 text-sm font-black uppercase tracking-widest shadow-lg border-0 bg-slate-800 hover:bg-slate-900 shadow-slate-800/20 text-white"
                >
                    <span className="mr-2 text-base">💳</span> COBRAR TICKET
                </Button>
            </div>
        </div>
    );
};