import React, { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Swal from 'sweetalert2';

// --- COMPONENTE INTERNO: MODAL DE PROVEEDOR (ESTANDARIZADO CORPORATIVO) ---
const ProviderModal = ({ show, onClose, onSave }) => {
    const [localForm, setLocalForm] = useState({ rif: '', name: '', address: '', phone: '' });

    useEffect(() => {
        if (show) setLocalForm({ rif: '', name: '', address: '', phone: '' });
    }, [show]);

    if (!show) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(localForm);
    };

    return (
        /* 🛡️ Fondo del Modal: Backdrop corporativo oscuro */
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in z-[70]">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/60">

                {/* Header Estilizado y Sobrio (Estilo Modal de Clientes) */}
                <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-b from-slate-50 to-white relative shrink-0">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <span>🏢</span> Nuevo Proveedor
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Cumplimiento Providencia SENIAT
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-all shadow-inner outline-none active:scale-90">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="overflow-y-auto p-5 md:p-6 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 🚀 RIF MASK FULL UX: Validación estricta SENIAT */}
                            <Input
                                label="RIF (*)"
                                placeholder="J-12345678-9"
                                value={localForm.rif}
                                onChange={e => {
                                    let val = e.target.value.toUpperCase();
                                    
                                    // 1. Si el usuario empieza con un número, auto-completamos con 'J' (Jurídico por defecto en proveedores)
                                    if (/^[0-9]/.test(val)) {
                                        val = 'J' + val;
                                    }

                                    // 2. Limpiamos cualquier caracter que NO sea J, V, E, G, C, P o números
                                    val = val.replace(/[^JVEGCP0-9]/g, '');

                                    // 3. Forzamos a que el primer caracter siempre sea una de las letras legales
                                    if (val.length > 0 && !/^[JVEGCP]/.test(val[0])) {
                                        val = val.replace(/^[^JVEGCP]+/, '');
                                    }

                                    // 4. Estructuramos la máscara exacta: L-12345678-9
                                    if (val.length > 1) {
                                        const letter = val[0];
                                        const numbers = val.substring(1).replace(/[^0-9]/g, ''); // Solo números después de la letra
                                        
                                        if (numbers.length > 8) {
                                            // Formato completo superando los 8 dígitos base
                                            val = `${letter}-${numbers.substring(0, 8)}-${numbers.substring(8, 9)}`;
                                        } else if (numbers.length > 0) {
                                            // Mientras escribe los números del medio
                                            val = `${letter}-${numbers}`;
                                        } else {
                                            // Solo la letra inicial
                                            val = letter;
                                        }
                                    }

                                    setLocalForm({ ...localForm, rif: val });
                                }}
                                required
                                className="!rounded-xl border-slate-200 font-mono uppercase focus:!ring-slate-300 shadow-sm font-black text-slate-700"
                            />

                            {/* Teléfono con guión automático */}
                            <Input
                                label="Teléfono"
                                type="tel"
                                placeholder="0414-1234567"
                                value={localForm.phone}
                                onChange={e => {
                                    let val = e.target.value.replace(/\D/g, '');
                                    if (val.length > 4) val = val.substring(0, 4) + '-' + val.substring(4, 11);
                                    setLocalForm({ ...localForm, phone: val });
                                }}
                                className="!rounded-xl border-slate-200 focus:!ring-slate-300 shadow-sm"
                            />
                        </div>

                        {/* Razón Social con capitalización automática */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 block mb-1 uppercase tracking-widest ml-1">Razón Social / Nombre (*)</label>
                            <textarea
                                rows="2"
                                placeholder="Ej: DISTRIBUIDORA DE ALIMENTOS C.A."
                                className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-slate-300 outline-none uppercase resize-none transition-shadow shadow-sm"
                                value={localForm.name}
                                onChange={e => setLocalForm({ ...localForm, name: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>

                        {/* Dirección Fiscal */}
                        <div className="bg-slate-50/80 p-4 rounded-xl md:rounded-2xl border border-slate-200/60 shadow-sm space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 block mb-1 uppercase tracking-widest ml-1">Dirección Fiscal (*)</label>
                            <textarea
                                rows="3"
                                placeholder="Ej: Av. Principal, Local 1..."
                                className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-slate-300 outline-none uppercase resize-none transition-shadow shadow-sm text-sm"
                                value={localForm.address}
                                onChange={e => setLocalForm({ ...localForm, address: e.target.value.toUpperCase() })}
                                required
                            />
                            <p className="text-[9px] font-black text-slate-400 mt-2.5 leading-tight uppercase tracking-wide flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                                Requerido para el Libro de Compras.
                            </p>
                        </div>

                        {/* Botones Modulares */}
                        <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6 md:mt-8">
                            <Button
                                type="button"
                                variant="secondary"
                                className="w-1/3 !h-12 flex items-center justify-center rounded-xl font-black bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95 outline-none"
                                onClick={() => {
                                    setLocalForm({ rif: '', name: '', address: '', phone: '' });
                                    const Toast = Swal.mixin({ toast: true, position: 'bottom', showConfirmButton: false, timer: 1000 });
                                    Toast.fire({ icon: 'info', title: 'Limpiado' });
                                }}
                            >
                                LIMPIAR
                            </Button>

                            <Button
                                type="submit"
                                className="w-2/3 !h-12 !bg-slate-800 hover:!bg-slate-900 !text-white !rounded-xl text-sm md:text-base font-black tracking-widest !shadow-sm hover:!shadow-md active:scale-95 transition-all outline-none border-0"
                            >
                                💾 GUARDAR
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProviderModal;