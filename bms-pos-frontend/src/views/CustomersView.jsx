import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const CustomersView = ({
    customerSearchQuery,
    setCustomerSearchQuery,
    customerForm,
    setCustomerForm,
    isCustomerFormOpen,
    setIsCustomerFormOpen,
    filteredCustomers,
    customerCurrentPage,
    setCustomerCurrentPage,
    editCustomer,
    addInitialBalance,
    saveCustomer,
    handleCustomerFormChange
}) => {

    // --- ⚙️ ESTADOS UX: Paginación y Filtro de Tipo ---
    const [customersPerPage, setCustomersPerPage] = useState(25);
    const [contactFilter, setContactFilter] = useState('ALL'); // ALL, CLIENTE, PROVEEDOR
    
    // --- 🛡️ FILTRO AVANZADO (Tipos de Contacto) ---
    const safeFilteredCustomers = Array.isArray(filteredCustomers) ? filteredCustomers : [];
    
    const processedContacts = useMemo(() => {
        if (contactFilter === 'ALL') return safeFilteredCustomers;
        return safeFilteredCustomers.filter(c => {
            // Si no tiene tipo asignado, asumimos de forma segura que es CLIENTE (retrocompatibilidad)
            const type = (c?.type || 'CLIENTE').toUpperCase();
            return type === contactFilter;
        });
    }, [safeFilteredCustomers, contactFilter]);

    // --- LÓGICA DE PAGINACIÓN ---
    const indexOfLastCustomer = customerCurrentPage * customersPerPage;
    const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
    const currentCustomers = processedContacts.slice(indexOfFirstCustomer, indexOfLastCustomer);
    const customerTotalPages = Math.max(1, Math.ceil(processedContacts.length / customersPerPage));

    // --- 🎬 ANIMACIONES UX (Framer Motion) ---
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    return (
        /* 🛡️ CONTENEDOR PRINCIPAL: Estandarizado al fondo corporativo */
        <div className="p-4 md:p-8 overflow-y-auto flex-1 min-h-0 w-full relative bg-slate-50/30 font-sans flex flex-col">

            {/* HEADER RESPONSIVE DE IMPACTO */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col mb-4 md:mb-6 gap-4 shrink-0 px-1 md:px-0 mt-2 md:mt-0"
            >
                {/* Fila 1: Título y Botón Principal */}
                <div className="flex justify-between items-start w-full gap-4">
                    <div className="flex-1">
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-none">Directorio General</h2>
                        <p className="text-[10px] md:text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 md:mt-2 leading-tight">Gestión de Clientes y Proveedores</p>
                    </div>
                    {/* 🚀 BOTÓN ESTANDARIZADO: bg-slate-800 */}
                    <Button 
                        onClick={() => {
                            // Inicializamos con type: 'CLIENTE' por defecto para el selector
                            setCustomerForm({ id: null, full_name: '', id_number: '', phone: '', institution: '', status: 'ACTIVO', type: 'CLIENTE' });
                            setIsCustomerFormOpen(true);
                        }} 
                        className="!bg-slate-800 !text-white hover:!bg-slate-900 h-10 md:h-12 px-4 md:px-6 flex items-center justify-center rounded-xl font-black !shadow-sm hover:!shadow-md transform hover:-translate-y-0.5 transition-all active:scale-95 gap-2 border-0"
                    >
                        <span className="text-lg leading-none mt-[-2px]">+</span> 
                        <span className="hidden sm:inline">Nuevo</span>
                    </Button>
                </div>

                {/* Fila 2: Pestañas de Filtro y Buscador */}
                <div className="flex flex-col sm:flex-row w-full gap-3 items-center">
                    
                    {/* TABS DE FILTRO (Súper UX) */}
                    <div className="flex p-1 bg-white rounded-xl shadow-sm border border-slate-200/60 w-full sm:w-auto shrink-0">
                        {[
                            { id: 'ALL', label: 'Todos', icon: '📋' },
                            { id: 'CLIENTE', label: 'Clientes', icon: '👤' },
                            { id: 'PROVEEDOR', label: 'Proveedores', icon: '🏢' },
                            { id: 'TRANSPORTE', label: 'Transporte', icon: '🛵' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setContactFilter(tab.id); setCustomerCurrentPage(1); }}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-3 md:px-4 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 outline-none ${
                                    contactFilter === tab.id
                                        ? 'bg-slate-800 text-white shadow-sm'
                                        : 'bg-transparent text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                <span className="text-xs md:text-sm">{tab.icon}</span>
                                <span className={contactFilter !== tab.id ? 'hidden md:inline' : ''}>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    <Input
                        placeholder="Buscar por Nombre, Cédula/RIF..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full flex-1 !h-12 !rounded-xl shadow-sm focus:ring-2 focus:ring-slate-200 transition-shadow"
                        icon={() => <span className="text-slate-400">🔍</span>}
                    />
                </div>
            </motion.div>

            {/* TABLA DE CONTACTOS (Diseño Neumorphism Limpio) */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden flex-1 flex flex-col relative">
                
                {/* ENCABEZADO TABLA (SOLO PC) */}
                <div className="hidden md:grid grid-cols-12 bg-slate-50/80 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/60 sticky top-0 z-10 backdrop-blur-sm shrink-0">
                    <div className="col-span-1 pl-1">ID</div>
                    <div className="col-span-4 pl-2">Contacto / Razón Social</div>
                    <div className="col-span-2">Cédula / RIF</div>
                    <div className="col-span-2">Teléfono</div>
                    <div className="col-span-1 text-center">Estatus</div>
                    <div className="col-span-2 text-right pr-2">Acciones</div>
                </div>

                {/* LISTADO DE DATOS ANIMADO */}
                <motion.div variants={containerVariants} initial="hidden" animate="show" className="overflow-y-auto custom-scrollbar flex-1">
                    {processedContacts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
                                <span className="text-4xl opacity-50 grayscale">📭</span>
                            </div>
                            <p className="text-slate-500 font-black text-lg">No se encontraron registros</p>
                            <p className="text-slate-400 text-xs font-medium mt-1">Ajusta tu búsqueda o registra uno nuevo.</p>
                        </div>
                    ) : (
                        currentCustomers.map((customer) => {
                            // Definir si es proveedor para colores visuales
                            const isProvider = (customer?.type || '').toUpperCase() === 'PROVEEDOR';

                            return (
                                <motion.div
                                    variants={itemVariants}
                                    key={customer?.id || Math.random()}
                                    onClick={() => {
                                        editCustomer(customer);
                                        setIsCustomerFormOpen(true);
                                    }}
                                    className="p-3.5 hover:bg-slate-50/80 transition-all cursor-pointer group relative overflow-hidden border-b border-slate-100 last:border-b-0"
                                >
                                    {/* Indicador Visual Hover AZUL corporativo */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>

                                    {/* VISTA DESKTOP */}
                                    <div className="hidden md:grid grid-cols-12 items-center gap-2">
                                        <div className="col-span-1 font-black text-slate-300 text-xs group-hover:text-slate-400 transition-colors pl-1">
                                            #{customer?.id || 'N/A'}
                                        </div>
                                        <div className="col-span-4 flex items-center gap-2 pl-2 overflow-hidden">
                                            <div className="flex flex-col min-w-0">
                                                <p className="font-black text-slate-800 text-sm truncate leading-tight" title={customer?.full_name}>
                                                    {customer?.full_name || 'Sin Nombre'}
                                                </p>
                                                {/* BADGE DE TIPO DE CONTACTO */}
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm w-max mt-0.5 border ${
                                                    isProvider ? 'bg-orange-50 text-orange-600 border-orange-100/50' : 'bg-blue-50 text-blue-600 border-blue-100/50'
                                                }`}>
                                                    {isProvider ? '🏢 PROVEEDOR' : '👤 CLIENTE'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 inline-block px-1.5 py-0.5 rounded shadow-sm">
                                                {customer?.id_number || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="col-span-2 text-[10px] font-bold text-slate-400 truncate">
                                            {customer?.phone || 'No registrado'}
                                        </div>
                                        <div className="col-span-1 text-center">
                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                                                (customer?.status || 'ACTIVO') === 'ACTIVO' 
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' 
                                                : 'bg-rose-50 text-rose-500 border-rose-200/50'
                                            }`}>
                                                {customer?.status || 'ACTIVO'}
                                            </span>
                                        </div>

                                        {/* Botones de Acciones Rápidas PC */}
                                        <div className="col-span-2 flex justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity pr-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); addInitialBalance(customer); }}
                                                className="h-8 px-3 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-xs font-bold active:scale-95 border border-emerald-100/50 shadow-sm"
                                                title="Saldos / Deuda"
                                            >
                                                💰 Saldos
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); editCustomer(customer); setIsCustomerFormOpen(true); }}
                                                className="w-8 h-8 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center font-bold active:scale-95 border border-slate-200/60 shadow-sm"
                                                title="Editar"
                                            >
                                                ✎
                                            </button>
                                        </div>
                                    </div>

                                    {/* VISTA MÓVIL: Horizontal Compacta */}
                                    <div className="md:hidden flex flex-col gap-3 pl-1">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col flex-1 overflow-hidden pr-2">
                                                <p className="font-black text-slate-800 text-sm leading-tight mb-1 truncate">{customer?.full_name || 'Sin Nombre'}</p>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border ${
                                                        isProvider ? 'bg-orange-50 text-orange-600 border-orange-100/50' : 'bg-blue-50 text-blue-600 border-blue-100/50'
                                                    }`}>
                                                        {isProvider ? 'PROVEEDOR' : 'CLIENTE'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded shadow-sm shrink-0">{customer?.id_number || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm shrink-0 ${
                                                (customer?.status || 'ACTIVO') === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 'bg-rose-50 text-rose-500 border-rose-200/50'
                                            }`}>
                                                {customer?.status || 'ACTIVO'}
                                            </span>
                                        </div>
                                        
                                        {/* Barra Inferior Móvil */}
                                        <div className="flex justify-between items-center pt-2.5 border-t border-slate-100/60">
                                            <p className="text-[10px] font-bold text-slate-400 truncate">{customer?.phone || 'Sin teléfono'}</p>
                                            <div className="flex gap-1.5">
                                                <button onClick={(e) => { e.stopPropagation(); addInitialBalance(customer); }} className="h-7 px-2 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100/50 hover:bg-emerald-500 hover:text-white transition-all text-[11px] font-bold active:scale-95 shadow-sm flex items-center justify-center">💰</button>
                                                <button onClick={(e) => { e.stopPropagation(); editCustomer(customer); setIsCustomerFormOpen(true); }} className="h-7 w-7 rounded-md bg-slate-50 text-slate-600 border border-slate-200/60 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center font-bold active:scale-95 shadow-sm">✎</button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </motion.div>

                {/* CONTROLES DE PAGINACIÓN DINÁMICA */}
                {processedContacts.length > 0 && (
                    <div className="p-3 border-t border-slate-200/60 flex justify-between items-center gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
                        <select 
                            value={customersPerPage} 
                            onChange={(e) => { 
                                setCustomersPerPage(Number(e.target.value)); 
                                setCustomerCurrentPage(1); 
                            }} 
                            className="bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1.5 px-3 outline-none cursor-pointer text-slate-600 shadow-sm focus:ring-2 focus:ring-slate-100 transition-all"
                        >
                            <option value={25}>25 / pág</option>
                            <option value={50}>50 / pág</option>
                            <option value={100}>100 / pág</option>
                        </select>
                        <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                            <Button variant="ghost" onClick={() => setCustomerCurrentPage(prev => Math.max(1, prev - 1))} disabled={customerCurrentPage === 1} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Ant</Button>
                            <span className="text-[10px] font-black text-slate-500 tracking-wider">
                                {customerCurrentPage} <span className="text-slate-300 font-medium">/</span> {customerTotalPages}
                            </span>
                            <Button variant="ghost" onClick={() => setCustomerCurrentPage(prev => Math.min(customerTotalPages, prev + 1))} disabled={customerCurrentPage === customerTotalPages} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Sig</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL FORMULARIO DE CONTACTO UNIFICADO */}
            <AnimatePresence>
                {isCustomerFormOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden"
                        >
                            <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-b from-slate-50 to-white relative shrink-0">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                        {customerForm.id ? 'Editar Perfil' : 'Alta de Contacto'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        Cumplimiento Providencia 0071
                                    </p>
                                </div>
                                <button onClick={() => setIsCustomerFormOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-all shadow-inner outline-none active:scale-90">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-5 md:p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <form onSubmit={(e) => saveCustomer(e).then(() => setIsCustomerFormOpen(false))}>
                                    <div className="space-y-4 md:space-y-5">
                                        
                                        {/* 🚀 SELECTOR DE TIPO TRI-ENTIDAD (CON CANDADO UX) */}
                                        <div className="bg-slate-50/80 p-4 rounded-xl md:rounded-2xl border border-slate-200/60 shadow-sm">
                                            <label className="text-[10px] font-black text-slate-500 block mb-2.5 uppercase tracking-widest">Tipo de Registro (*)</label>
                                            <div className="flex gap-2 p-1 bg-white rounded-xl shadow-inner border border-slate-100 overflow-x-auto custom-scrollbar">
                                                {['CLIENTE', 'PROVEEDOR', 'TRANSPORTE'].map(type => (
                                                    <button
                                                        key={type} type="button"
                                                        disabled={!!customerForm.id} // 🔒 CANDADO: Bloquea si estamos editando
                                                        onClick={() => setCustomerForm(prev => ({ ...prev, type: type }))}
                                                        className={`flex-1 min-w-[100px] py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-300 outline-none ${
                                                            (customerForm.type || 'CLIENTE') === type
                                                                ? 'bg-slate-800 text-white shadow-md'
                                                                : 'bg-transparent text-slate-400 hover:bg-slate-50'
                                                        } ${!!customerForm.id && (customerForm.type || 'CLIENTE') !== type ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                    >
                                                        {type === 'CLIENTE' ? '👤 CLIENTE' : type === 'PROVEEDOR' ? '🏢 PROVEEDOR' : '🛵 TRANSPORTE'}
                                                    </button>
                                                ))}
                                            </div>
                                            {/* ⚠️ Advertencia de seguridad al editar */}
                                            {!!customerForm.id && (
                                                <p className="text-[9px] text-rose-500 font-bold mt-2.5 leading-tight text-center uppercase tracking-wider">
                                                    ⚠️ El tipo de registro no se puede modificar tras su creación.
                                                </p>
                                            )}
                                        </div>

                                        <Input
                                            label={customerForm.type === 'TRANSPORTE' ? "Nombre del Transportista (*)" : "Nombre / Razón Social (*)"}
                                            placeholder={customerForm.type === 'TRANSPORTE' ? "Ej: Carlos Pérez" : "Ej: Inversiones Globales C.A."}
                                            name="full_name"
                                            value={customerForm.full_name}
                                            onChange={handleCustomerFormChange}
                                            className="!rounded-xl border-slate-200 focus:!ring-slate-300 shadow-sm"
                                            required autoFocus
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Cédula / RIF (*)"
                                                placeholder="J-12345678-9"
                                                name="id_number"
                                                value={customerForm.id_number}
                                                onChange={handleCustomerFormChange}
                                                className="!rounded-xl border-slate-200 font-mono uppercase focus:!ring-slate-300 shadow-sm"
                                                required
                                            />
                                            <Input
                                                label="Teléfono Móvil"
                                                type="tel"
                                                placeholder="0414-1234567"
                                                name="phone"
                                                value={customerForm.phone}
                                                onChange={handleCustomerFormChange}
                                                className="!rounded-xl border-slate-200 focus:!ring-slate-300 shadow-sm"
                                            />
                                        </div>

                                        {/* ZONA LEGAL / INFO DE VEHÍCULO */}
                                        <div className="bg-slate-50/80 p-4 rounded-xl md:rounded-2xl border border-slate-200/60 shadow-sm">
                                            <Input
                                                label={customerForm.type === 'TRANSPORTE' ? "Info del Vehículo / Placa" : "Dirección / Domicilio Fiscal"}
                                                placeholder={customerForm.type === 'TRANSPORTE' ? "Ej: Moto Bera SBR Placa AA11BB" : "EJ: AV. 20 ENTRE CALLES 30 Y 31"}
                                                value={customerForm.institution || ''}
                                                onChange={(e) => setCustomerForm({ ...customerForm, institution: e.target.value.toUpperCase() })}
                                                className="!rounded-xl !bg-white border-slate-200 focus:!ring-slate-300"
                                                icon={() => (
                                                    customerForm.type === 'TRANSPORTE' ? (
                                                        <span className="text-slate-400 text-lg leading-none">🏍️</span>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    )
                                                )}
                                            />
                                            <p className="text-[9px] font-black text-slate-400 mt-2.5 leading-tight uppercase tracking-wide flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                                                {customerForm.type === 'TRANSPORTE' 
                                                    ? "Para control de despachos y auditoría." 
                                                    : "Obligatorio para Facturación Legal (Forma Libre o Impresora Fiscal)."}
                                            </p>
                                        </div>

                                        {/* BOTONES STATUS */}
                                        <div className="bg-slate-50/80 p-4 rounded-xl md:rounded-2xl border border-slate-200/60 shadow-sm">
                                            <label className="text-[10px] font-black text-slate-500 block mb-2.5 uppercase tracking-widest">Estatus Operativo</label>
                                            <div className="flex gap-2 p-1 bg-white rounded-xl shadow-inner border border-slate-100">
                                                {['ACTIVO', 'INACTIVO'].map(st => (
                                                    <button
                                                        key={st} type="button"
                                                        onClick={() => setCustomerForm(prev => ({ ...prev, status: st }))}
                                                        className={`flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-300 outline-none ${
                                                            customerForm.status === st
                                                                ? (st === 'ACTIVO' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-rose-500 text-white shadow-sm')
                                                                : 'bg-transparent text-slate-400 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {st}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 md:mt-8 pt-4 border-t border-slate-100">
                                        <Button type="submit" className="w-full !bg-slate-800 hover:!bg-slate-900 !text-white !py-4 !rounded-xl text-sm md:text-base font-black tracking-widest !shadow-sm hover:!shadow-md active:scale-95 transition-all outline-none border-0">
                                            {customerForm.id ? '💾 GUARDAR CAMBIOS' : '🚀 REGISTRAR CONTACTO'}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomersView;