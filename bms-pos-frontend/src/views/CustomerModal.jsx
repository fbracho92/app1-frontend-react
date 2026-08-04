import React from 'react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

// --- FUNCI車N DE RENDERIZADO VISUAL ---
const CustomerModal = ({
    paymentMethod,
    paymentShares,
    handleClear,
    dueDays,
    setDueDays,
    customerData,
    handleNameChange,
    isSearchingCustomer,
    customerSearchResults,
    handleListSelect,
    handleIdChange,
    handleChange,
    setIsCustomerModalOpen,
    setIsPaymentModalOpen,
    isFormReadyToSubmit,
    handleConfirm,

    // PROPS DE DELIVERY INYECTADOS
    isDelivery,
    deliveryInfo,
    setDeliveryInfo,
    drivers = [] 
}) => {
    // [AJUSTE ROBUSTO Y SEGURO] Detectar modalidad activa (Soporta acentos y sin acentos)
    const currentMethodName = (typeof paymentMethod !== 'undefined' && paymentMethod) ? paymentMethod.toUpperCase() : '';
    const isDonationTab = currentMethodName.includes('DONACI');
    const isDonationSplit = (parseFloat(paymentShares['Donaci\u00F3n']) || parseFloat(paymentShares['Donacion']) || 0) > 0;

    const isDonationUsed = isDonationTab || isDonationSplit;
    const isCreditUsed = (parseFloat(paymentShares['Cr\u00E9dito']) || parseFloat(paymentShares['Credito']) || 0) > 0;

    // VALIDACI車N BLINDADA PARA DELIVERY
    const canSubmit = isDelivery 
        ? (isFormReadyToSubmit && deliveryInfo?.driver_id && deliveryInfo?.address?.trim() !== '')
        : isFormReadyToSubmit;

    // --- L車GICA DE TEMATIZACI車N DIN芍MICA (UX PREMIUM) ---
    let themeConfig = {
        icon: '\uD83D\uDCC4', // Icono Papel
        title: 'Datos para Factura Fiscal',
        subtitle: 'Ingrese los datos del cliente para la factura',
        bgGradient: 'from-blue-50/50 to-white',
        iconClass: 'bg-blue-50 text-blue-600 border-blue-100',
        btnClass: '!bg-slate-800 hover:!bg-slate-900 !shadow-slate-800/20 text-white',
        confirmText: 'Guardar Datos Fiscales'
    };

    if (isDelivery) {
        themeConfig = {
            icon: '\uD83D\uDEF5', // Icono Moto
            title: 'Despacho y Facturaci\u00F3n',
            subtitle: 'Datos del cliente y direcci\u00F3n de entrega',
            bgGradient: 'from-indigo-50/50 to-white',
            iconClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
            btnClass: '!bg-indigo-600 hover:!bg-indigo-700 !shadow-indigo-500/30 text-white',
            confirmText: 'Confirmar Delivery'
        };
    } else if (isDonationUsed) {
        themeConfig = {
            icon: '\uD83C\uDF81', // Icono Regalo
            title: 'Registro de Donaci\u00F3n',
            subtitle: 'Datos del beneficiario de la donaci\u00F3n',
            bgGradient: 'from-amber-50/50 to-white',
            iconClass: 'bg-amber-50 text-amber-600 border-amber-100',
            btnClass: '!bg-amber-500 hover:!bg-amber-600 !shadow-amber-500/30 text-white',
            confirmText: 'Confirmar Donaci\u00F3n'
        };
    } else if (isCreditUsed) {
        themeConfig = {
            icon: '\uD83D\uDCB3', // Icono Tarjeta
            title: 'Registro de Cr\u00E9dito',
            subtitle: 'Esta venta quedar\u00E1 PENDIENTE de pago',
            bgGradient: 'from-rose-50/50 to-white',
            iconClass: 'bg-rose-50 text-rose-600 border-rose-100',
            btnClass: '!bg-rose-600 hover:!bg-rose-700 !shadow-rose-500/30 text-white',
            confirmText: 'Confirmar Cr\u00E9dito'
        };
    }

    // Clases maestras para inputs Neum車rficos
    const inputUXClasses = "!space-y-0 [&_label]:!text-slate-400 [&_label]:!text-[10px] [&_label]:!uppercase [&_label]:!tracking-widest [&_label]:!font-bold [&_label]:!block [&_label]:!mb-1.5 [&_input]:!bg-slate-50 [&_input]:!border-slate-200 focus-within:[&_input]:!border-slate-400 focus-within:[&_input]:!bg-white [&_input]:!p-3.5 [&_input]:!text-sm [&_input]:!font-bold [&_input]:!text-slate-700 [&_input]:!rounded-xl [&_input]:!shadow-inner transition-colors";

    return (
        <div className="fixed inset-0 z-[65] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-scale-up border border-slate-100 flex flex-col max-h-[95vh] transform-gpu">

                {/* HEADER PREMIUM DIN芍MICO */}
                <div className={`p-6 border-b border-slate-100 flex justify-between items-start bg-gradient-to-b ${themeConfig.bgGradient} relative shrink-0`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm border shrink-0 ${themeConfig.iconClass}`}>
                            {themeConfig.icon}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{themeConfig.title}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{themeConfig.subtitle}</p>
                        </div>
                    </div>

                    {/* BOT車N LIMPIAR */}
                    <button
                        onClick={handleClear}
                        className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-all outline-none shadow-sm active:scale-95"
                        title="Limpiar Formulario"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>

                {/* BODY SCROLLABLE */}
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar bg-white flex-1">

                    {/* SELECTOR D赤AS DE CR谷DITO */}
                    {isCreditUsed && !isDonationUsed && (
                        <div className="flex justify-between items-center bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                            <span className="font-black text-rose-800 text-[11px] uppercase tracking-widest">Plazo de Pago</span>
                            <div className="flex gap-2 bg-white p-1 rounded-xl shadow-inner border border-rose-100">
                                <button onClick={(e) => { e.preventDefault(); setDueDays(15); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all outline-none ${dueDays === 15 ? 'bg-rose-500 text-white shadow-sm' : 'bg-transparent text-rose-400 hover:bg-rose-50'}`}>{'15 D\u00EDas'}</button>
                                <button onClick={(e) => { e.preventDefault(); setDueDays(30); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all outline-none ${dueDays === 30 ? 'bg-rose-500 text-white shadow-sm' : 'bg-transparent text-rose-400 hover:bg-rose-50'}`}>{'30 D\u00EDas'}</button>
                            </div>
                        </div>
                    )}

                    {/* BUSCADOR / NOMBRE */}
                    <div className="relative">
                        <Input
                            label={isDonationUsed ? 'Nombre del Beneficiario *' : 'Raz\u00F3n Social / Nombre *'}
                            name="full_name"
                            placeholder={isDonationUsed ? "Buscar beneficiario..." : "Escribe para buscar cliente..."}
                            onChange={handleNameChange}
                            value={customerData.full_name}
                            autoFocus={true}
                            className={inputUXClasses}
                        />

                        {/* SPINNER */}
                        {isSearchingCustomer && <div className="absolute right-4 top-9 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}

                        {/* DROPDOWN RESULTADOS */}
                        {customerSearchResults.length > 0 && (
                            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto custom-scrollbar p-2 animate-fade-in">
                                {customerSearchResults.map(customer => (
                                    <div
                                        key={customer.id}
                                        onClick={() => handleListSelect(customer)}
                                        className="p-3 rounded-xl hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors group"
                                    >
                                        <div className="flex flex-col min-w-0 pr-3">
                                            <span className="font-black text-slate-800 text-sm truncate group-hover:text-blue-700">{customer.full_name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 truncate">{customer.institution || 'Sin direcci\u00F3n'}</span>
                                        </div>
                                        <span className="text-[9px] font-black text-blue-600 bg-blue-100/50 px-2 py-1 rounded-md border border-blue-200 uppercase tracking-widest shrink-0">
                                            {customer.id_number}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* C谷DULA */}
                    <Input
                        label={isDonationUsed ? 'C\u00E9dula del Beneficiario *' : 'C\u00E9dula / RIF *'}
                        name="id_number"
                        placeholder="V-12345678"
                        onChange={handleIdChange}
                        value={customerData.id_number}
                        className={`${inputUXClasses} [&_input]:!font-mono`}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={'Tel\u00E9fono'}
                            type="tel"
                            name="phone"
                            placeholder="0414-1234567"
                            onChange={handleChange}
                            value={customerData.phone}
                            className={inputUXClasses}
                        />
                        <Input
                            label={'Direcci\u00F3n Fiscal'}
                            name="institution"
                            placeholder="Ciudad, Zona..."
                            onChange={handleChange}
                            value={customerData.institution}
                            className={inputUXClasses}
                        />
                    </div>

                    {/* SECCI車N DELIVERY */}
                    {isDelivery && (
                        <div className="mt-2 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-fade-in">
                            <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Detalles del Despacho
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                        Motorizado Asignado <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={deliveryInfo?.driver_id || ''}
                                        onChange={(e) => {
                                            const selectedDriver = drivers.find(d => d.id === parseInt(e.target.value));
                                            setDeliveryInfo(prev => ({
                                                ...prev,
                                                driver_id: e.target.value,
                                                driver_name: selectedDriver ? selectedDriver.name : ''
                                            }));
                                        }}
                                        className={`w-full bg-slate-50 border-2 rounded-xl p-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400 shadow-inner transition-all cursor-pointer ${!deliveryInfo?.driver_id ? 'border-red-200 focus:border-red-400' : 'border-slate-200'}`}
                                    >
                                        <option value="" disabled>Seleccione un repartidor...</option>
                                        {drivers.map(driver => (
                                            <option key={driver.id} value={driver.id}>{driver.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                        {'Direcci\u00F3n de Entrega'} <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        rows="2"
                                        value={deliveryInfo?.address || ''}
                                        onChange={(e) => setDeliveryInfo(prev => ({...prev, address: e.target.value}))}
                                        placeholder="Ej: Urb. Las Mercedes, Casa #4..."
                                        className={`w-full bg-slate-50 border-2 rounded-xl p-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400 shadow-inner transition-all resize-none ${!deliveryInfo?.address ? 'border-red-200 focus:border-red-400' : 'border-slate-200'}`}
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-5 md:p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3 shrink-0 rounded-b-[2rem]">
                    <Button
                        variant="ghost"
                        onClick={() => { setIsCustomerModalOpen(false); setIsPaymentModalOpen(true); }}
                        className="w-1/3 !py-4 !bg-white border border-slate-200 !text-slate-600 hover:!bg-slate-50 text-xs font-bold uppercase tracking-wide rounded-xl transition-colors shadow-sm"
                    >
                        Volver
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        disabled={!canSubmit}
                        className={`w-2/3 !py-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${!canSubmit ? '!bg-slate-200 !text-slate-400 !shadow-none cursor-not-allowed border-0' : themeConfig.btnClass}`}
                    >
                        {themeConfig.confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CustomerModal;