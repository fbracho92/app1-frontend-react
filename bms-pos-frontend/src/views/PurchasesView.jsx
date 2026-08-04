import React, { useRef, memo, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

// 🛡️ FORMATEADOR FISCAL VENEZOLANO (Cumplimiento SENIAT)
const formatVES = (amount) => {
    return Number(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatUSDLocal = (amount) => {
    return Number(amount || 0).toFixed(2);
};

// 🚀 OPTIMIZACIÓN: Memoizado estricto para evitar re-renderizados innecesarios en la lista de compras
export const PurchasesView = memo(({
    // Estados y funciones de Compras/Proveedores
    purchaseForm, setPurchaseForm,
    providerFilter, setProviderFilter,
    purchaseCart, setPurchaseCart,
    providers,
    showProviderModal, setShowProviderModal,
    setSearchTerm, debouncedSearchTerm,
    filteredPurchaseProducts,
    addToPurchaseCart, handleProcessPurchase, handleSaveProvider,
    
    // Utilidades globales
    bcvRate, formatUSD, formatBs,
    
    // Componentes de UI que viven en App.jsx
    Button, Input, ProductAvatar, ProviderModal
}) => {

    // --- Lógica exclusiva de la vista móvil de compras ---
    const itemsSectionRef = useRef(null);
    const scrollToItems = () => {
        itemsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 🛡️ SEGURIDAD Y RENDIMIENTO: Paginación Dinámica para el Catálogo
    const [productsPerPage, setProductsPerPage] = useState(25);
    const [productCurrentPage, setProductCurrentPage] = useState(1);
    
    const indexOfLastProduct = productCurrentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    const safeFilteredProducts = Array.isArray(filteredPurchaseProducts) ? filteredPurchaseProducts : [];
    const currentProducts = safeFilteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
    const productTotalPages = Math.max(1, Math.ceil(safeFilteredProducts.length / productsPerPage));

    // 🚀 OPTIMIZACIÓN DE CÁLCULO: Los totales solo se procesan si el carrito cambia
    const { totalCartUSD, totalCartVES } = useMemo(() => {
        const safeCart = Array.isArray(purchaseCart) ? purchaseCart : [];
        const usd = safeCart.reduce((acc, el) => acc + ((Number(el?.quantity) || 0) * (Number(el?.cost_usd) || 0)), 0);
        return {
            totalCartUSD: usd,
            totalCartVES: usd * (Number(bcvRate) || 1)
        };
    }, [purchaseCart, bcvRate]);

    return (
        /* 🛡️ CONTENEDOR PRINCIPAL: Estandarizado al fondo corporativo */
        <div className="flex flex-col h-full bg-slate-50/30 p-4 md:p-8 overflow-hidden animate-fade-in">

            {/* HEADER RESPONSIVE DE IMPACTO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 md:mb-6 shrink-0 mt-2 md:mt-0">
                <div className="flex-1">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-none flex items-center gap-3">
                        <span>📦</span> Recepción de Mercancía
                    </h2>
                    <p className="text-[10px] md:text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 md:mt-2 leading-tight">
                        Gestión de compras y proveedores
                    </p>
                </div>

                <Button
                    variant="secondary"
                    onClick={() => {
                        setPurchaseForm({
                            provider_id: '',
                            invoice_number: '',
                            control_number: '',
                            date: new Date().toISOString().split('T')[0]
                        });
                        setProviderFilter('');
                        setPurchaseCart([]);
                        setProductCurrentPage(1);
                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
                        Toast.fire({ icon: 'info', title: 'Formulario limpio' });
                    }}
                    className="w-full md:w-auto h-10 md:h-12 px-4 md:px-6 flex items-center justify-center rounded-xl font-black bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95 gap-2 outline-none"
                >
                    <span className="text-lg leading-none mt-[-2px]">🗑️</span> 
                    <span className="hidden sm:inline">Limpiar Todo</span>
                </Button>
            </div>

            {/* 1. CABECERA DE FACTURA (GRID ALINEADO PIXEL-PERFECT) */}
            <div className="bg-white/80 backdrop-blur-xl p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-200/60 mb-6 shrink-0 relative z-30">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-end">

                    {/* --- BUSCADOR DE PROVEEDOR --- */}
                    <div className="flex items-end gap-2 relative group sm:col-span-2 lg:col-span-1">
                        <div className="flex-1 relative">
                            <Input
                                label="Buscar Proveedor"
                                placeholder="Nombre, RIF..."
                                value={providerFilter}
                                onChange={(e) => {
                                    setProviderFilter(e.target.value);
                                    if (purchaseForm?.provider_id) setPurchaseForm({ ...purchaseForm, provider_id: '' });
                                }}
                                onFocus={() => {
                                    if (purchaseForm?.provider_id) setProviderFilter('');
                                }}
                                icon={() => <span className="text-slate-400">🔍</span>}
                                /* 🚀 FIX UX: Eliminado !h-12 para evitar el aplastamiento (Squish) */
                                className={`!rounded-xl shadow-sm transition-shadow focus:!ring-slate-300 ${purchaseForm?.provider_id ? "border-slate-400 bg-slate-50/50" : "border-slate-200"}`}
                            />

                            {/* LISTADO DESPLEGABLE PROVEEDORES */}
                            {providerFilter && !purchaseForm?.provider_id && Array.isArray(providers) && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white rounded-2xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-50 custom-scrollbar animate-fade-in-down">
                                    {providers.filter(p => (p?.name || '').toLowerCase().includes(providerFilter.toLowerCase()) || (p?.rif || '').toLowerCase().includes(providerFilter.toLowerCase())).length > 0 ? (
                                        providers.filter(p => (p?.name || '').toLowerCase().includes(providerFilter.toLowerCase()) || (p?.rif || '').toLowerCase().includes(providerFilter.toLowerCase())).map(p => (
                                            <div key={p?.id || Math.random()} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100/60 last:border-0 transition-colors flex flex-col gap-1 group/item" onClick={() => { setPurchaseForm({ ...purchaseForm, provider_id: p.id }); setProviderFilter(p.name); }}>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-slate-700 text-sm group-hover/item:text-slate-900 truncate">{p?.name || 'Sin Nombre'}</span>
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono shrink-0 border border-slate-200/50">{p?.rif || 'S/N'}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                    <span>📍</span><span className="truncate">{p?.address || 'Sin dirección'}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sin resultados</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 🚀 BOTÓN NUEVO PROVEEDOR: Alineación Pixel-Perfect (h-[46px]) para encajar con el input */}
                        <button
                            onClick={() => setShowProviderModal(true)}
                            className="bg-slate-800 hover:bg-slate-900 text-white w-[46px] h-[46px] rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-all active:scale-95 border-0 shrink-0"
                            title="Nuevo Proveedor"
                        >
                            <span className="text-2xl font-light leading-none mt-[-2px]">+</span>
                        </button>
                    </div>

                    <Input
                        label="Nro Factura"
                        placeholder="Ej: 0000458"
                        maxLength={10}
                        value={purchaseForm?.invoice_number || ''}
                        onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setPurchaseForm({ ...purchaseForm, invoice_number: val });
                        }}
                        className="!rounded-xl shadow-sm border-slate-200 focus:!ring-slate-300"
                    />

                    <Input
                        label="Nro Control"
                        placeholder="00-00000000"
                        maxLength={11}
                        value={purchaseForm?.control_number || ''}
                        onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                            let formatted = '';
                            if (raw.length > 0) {
                                const stripped = raw.replace(/^00/, '');
                                formatted = `00-${stripped}`;
                            }
                            setPurchaseForm({ ...purchaseForm, control_number: formatted });
                        }}
                        className="!rounded-xl shadow-sm border-slate-200 focus:!ring-slate-300 font-mono"
                    />

                    <Input
                        label="Fecha Emisión"
                        type="date"
                        value={purchaseForm?.date || ''}
                        onChange={e => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                        className="!rounded-xl shadow-sm border-slate-200 focus:!ring-slate-300"
                    />
                </div>
            </div>

            {/* 2. CONTENEDOR FLEXIBLE (BUSCADOR E ITEMS) */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                
                {/* --- LADO IZQUIERDO: CATÁLOGO DE PRODUCTOS E INSUMOS --- */}
                <div className="w-full lg:w-1/2 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 flex flex-col h-full relative z-10 min-h-[300px] lg:min-h-0 overflow-hidden">
                    <div className="p-4 md:p-5 pb-0 shrink-0">
                        <div className="flex justify-between items-center mb-4">
                            {/* 🚀 FIX SEMÁNTICO: Título inclusivo */}
                            <h3 className="font-black text-slate-800 tracking-tight">Catálogo de Productos e Insumos</h3>
                            <Button variant="secondary" onClick={scrollToItems} className="lg:hidden !text-[10px] font-black uppercase tracking-widest !py-2 px-3 border border-slate-200 shadow-sm">
                                Ver Carrito ({purchaseCart?.length || 0}) ⬇
                            </Button>
                        </div>

                        {/* Buscador de catálogo SIN LABEL, aquí SÍ aplica el !h-12 para altura perfecta */}
                        <Input
                            placeholder="Buscar Producto o Insumo..."
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setProductCurrentPage(1);
                            }}
                            className="mb-4 !h-12 !rounded-xl shadow-sm border-slate-200 focus:!ring-slate-300"
                            icon={() => <span className="text-slate-400">🔍</span>}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 md:px-5 pb-2 custom-scrollbar">
                        {currentProducts.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center opacity-50 h-full">
                                <span className="text-3xl mb-2">🔍</span>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Producto no encontrado</p>
                            </div>
                        ) : (
                            currentProducts.map(product => (
                                <div 
                                    key={product?.id || Math.random()} 
                                    className="flex justify-between items-center p-3.5 hover:bg-slate-50/80 border-b border-slate-100 last:border-b-0 cursor-pointer group relative overflow-hidden transition-all duration-200"
                                    onClick={() => {
                                        const modalImage = product?.image ? `<img src="${product.image}" class="w-24 h-24 object-cover rounded-2xl shadow-sm border border-slate-100 mb-2 mx-auto">` : `<div class="w-20 h-20 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-2">${product?.icon_emoji || '📦'}</div>`;
                                        Swal.fire({
                                            title: `<div class="text-xl font-bold text-slate-700 flex flex-col items-center">${modalImage}<span>${product?.name || 'Producto'}</span><span class="text-xs font-normal text-slate-400">Stock Actual: ${product?.stock || 0}</span></div>`,
                                            html: `<div class="flex flex-col gap-4 mt-2 px-4"><div class="text-left"><label class="block text-xs font-bold text-slate-600 uppercase mb-1">Cantidad Recibida</label><input id="swal-qty" type="number" class="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-2xl text-center text-slate-800 focus:border-slate-400 focus:outline-none" placeholder="0"></div><div class="text-left"><label class="block text-xs font-bold text-slate-400 uppercase mb-1">Costo Unitario ($)</label><input id="swal-cost" type="number" class="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-xl text-center text-slate-600 focus:border-slate-400 focus:outline-none" value="${product?.price_usd || ''}"></div></div>`,
                                            showCancelButton: true, confirmButtonColor: '#1e293b', cancelButtonColor: '#94a3b8', confirmButtonText: 'Agregar a Lista', focusConfirm: false,
                                            preConfirm: () => {
                                                const qty = document.getElementById('swal-qty')?.value;
                                                const cost = document.getElementById('swal-cost')?.value;
                                                if (!qty || parseFloat(qty) <= 0) { Swal.showValidationMessage('⚠️ Cantidad inválida'); return false; }
                                                if (cost === '' || parseFloat(cost) < 0) { Swal.showValidationMessage('⚠️ Costo inválido'); return false; }
                                                return [qty, cost];
                                            }
                                        }).then((result) => { if (result.isConfirmed) { addToPurchaseCart(product, result.value[0], result.value[1]); } });
                                    }}
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>

                                    <div className="flex items-center gap-3 pl-1">
                                        <ProductAvatar icon={product?.icon_emoji || product?.image || (product?.is_raw_material ? '🏭' : '📦')} size="w-10 h-10 md:w-12 md:h-12 shadow-sm border border-slate-100" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-700 text-sm md:text-base group-hover:text-slate-900 transition-colors line-clamp-1">{product?.name || 'Desconocido'}</p>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md mt-1 inline-block tracking-widest uppercase shadow-sm ${product?.is_raw_material ? 'bg-orange-50 text-orange-600 border border-orange-100/50' : 'bg-blue-50 text-blue-600 border border-blue-100/50'}`}>
                                                {product?.is_raw_material ? 'MATERIA PRIMA' : 'PRODUCTO'}
                                            </span>
                                        </div>
                                    </div>
                                    <Button variant="secondary" className="!w-8 !h-8 !p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-all !bg-slate-800 !text-white border-0 shadow-sm active:scale-95">+</Button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* PAGINACIÓN DE CATÁLOGO */}
                    {safeFilteredProducts.length > 0 && (
                        <div className="p-3 border-t border-slate-200/60 flex justify-between items-center gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
                            <select 
                                value={productsPerPage} 
                                onChange={(e) => { 
                                    setProductsPerPage(Number(e.target.value)); 
                                    setProductCurrentPage(1); 
                                }} 
                                className="bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1.5 px-3 outline-none cursor-pointer text-slate-600 shadow-sm focus:ring-2 focus:ring-slate-100 transition-all"
                            >
                                <option value={25}>25 / pág</option>
                                <option value={50}>50 / pág</option>
                                <option value={100}>100 / pág</option>
                            </select>
                            <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                                <Button variant="ghost" onClick={() => setProductCurrentPage(prev => Math.max(1, prev - 1))} disabled={productCurrentPage === 1} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Ant</Button>
                                <span className="text-[10px] font-black text-slate-500 tracking-wider">
                                    {productCurrentPage} <span className="text-slate-300 font-medium">/</span> {productTotalPages}
                                </span>
                                <Button variant="ghost" onClick={() => setProductCurrentPage(prev => Math.min(productTotalPages, prev + 1))} disabled={productCurrentPage === productTotalPages} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Sig</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- LADO DERECHO: CARRITO Y TOTALES --- */}
                <div ref={itemsSectionRef} className="w-full lg:w-1/2 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 p-4 md:p-5 flex flex-col h-full relative z-10 min-h-[300px] lg:min-h-0 scroll-mt-4">
                    
                    <h3 className="font-black text-slate-800 tracking-tight mb-4 flex justify-between items-end shrink-0">
                        <span>Ítems a Recibir</span>
                        <span className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60">Tasa: {bcvRate || 1} Bs/$</span>
                    </h3>

                    <div className="flex-1 overflow-y-auto mb-4 pr-1 custom-scrollbar">
                        {(!purchaseCart || purchaseCart.length === 0) ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <span className="text-5xl mb-3 grayscale">🛒</span>
                                <p className="text-sm font-bold uppercase tracking-widest">Lista vacía</p>
                            </div>
                        ) : (
                            <div className="relative overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/80 text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200/60">
                                        <tr>
                                            <th className="p-3">Desc.</th>
                                            <th className="p-3 text-center">Cant.</th>
                                            <th className="p-3 text-right">Costo $</th>
                                            <th className="p-3 text-right">Total $</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchaseCart.map((item, idx) => (
                                            <tr 
                                                key={idx} 
                                                className="border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-rose-50/80 group transition-colors" 
                                                onClick={() => {
                                                    Swal.fire({ title: '¿Quitar ítem?', text: `¿Eliminar "${item?.name || 'Producto'}"?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', cancelButtonColor: '#94a3b8', confirmButtonText: 'Sí, quitar', focusCancel: true }).then((result) => { 
                                                        if (result.isConfirmed) setPurchaseCart(prev => prev.filter((_, i) => i !== idx)); 
                                                    });
                                                }}
                                            >
                                                <td className="p-3 font-bold text-slate-700 group-hover:text-rose-600 truncate max-w-[120px]" title={item?.name}>{item?.name || 'N/A'}</td>
                                                <td className="p-3 text-center font-mono font-bold text-slate-600">{item?.quantity || 0}</td>
                                                <td className="p-3 text-right text-slate-500">{formatUSDLocal(item?.cost_usd)}</td>
                                                <td className="p-3 text-right font-black text-slate-800">{formatUSDLocal((item?.quantity || 0) * (item?.cost_usd || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* TOTALES */}
                    <div className="bg-slate-800 text-white p-5 md:p-6 rounded-[1.5rem] shrink-0 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

                        <div className="flex justify-between items-end mb-3 relative z-10">
                            <span className="text-slate-300 text-[10px] md:text-xs font-bold uppercase tracking-widest">Total Operación ($)</span>
                            <span className="text-3xl md:text-4xl font-black tracking-tight leading-none">{formatUSDLocal(totalCartUSD)}</span>
                        </div>
                        <div className="flex justify-between items-end border-t border-slate-700/60 pt-3 relative z-10">
                            <span className="text-slate-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Total Equivalente (Bs)</span>
                            <span className="text-lg md:text-xl font-bold text-slate-300 font-mono">Bs. {formatVES(totalCartVES)}</span>
                        </div>
                        
                        <Button 
                            variant="primary" 
                            onClick={handleProcessPurchase} 
                            className="w-full mt-5 text-sm md:text-base !bg-white !text-slate-900 hover:!bg-slate-100 !rounded-xl font-black uppercase tracking-widest shadow-md active:scale-95 transition-all outline-none border-0"
                        >
                            PROCESAR RECEPCIÓN
                        </Button>
                    </div>
                </div>
            </div>

            <ProviderModal show={showProviderModal} onClose={() => setShowProviderModal(false)} onSave={handleSaveProvider} />
        </div>
    );
});

export default PurchasesView;