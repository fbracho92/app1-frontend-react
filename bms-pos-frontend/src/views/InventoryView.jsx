import React, { memo, useState, useMemo } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ProductAvatar from '../components/ui/ProductAvatar';

// 🛡️ FORMATEADOR FISCAL VENEZOLANO (Cumplimiento SENIAT)
const formatVES = (amount) => {
    return Number(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatUSD = (amount) => {
    return Number(amount || 0).toFixed(2);
};

// 🚀 Fila de inventario memoizada: Renderizado ultra-rápido y seguro
const ProductRow = memo(({ p, onEdit, onMovement, onKardex }) => {
    // Validación de seguridad para evitar caídas si el stock es undefined
    const currentStock = Number(p?.stock || 0);
    const isLowStock = currentStock <= 5;
    
    return (
        <div 
            onClick={() => onEdit(p)} 
            /* 🚀 FIX UX: border-b simple de 1px para evitar choque de grosores */
            className="p-3.5 hover:bg-slate-50/80 transition-all cursor-pointer group relative overflow-hidden border-b border-slate-100 last:border-b-0"
        >
            {/* 🚀 ESTÁNDAR UX: Indicador Visual Hover AZUL corporativo */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>

            {/* DESKTOP VIEW */}
            <div className="hidden md:grid grid-cols-12 items-center gap-4">
                <div className="col-span-1 font-black text-slate-300 text-xs group-hover:text-slate-400 transition-colors pl-1">
                    #{p?.id || 'N/A'}
                </div>
                <div className="col-span-4 font-medium text-slate-800 flex items-center gap-3">
                    <div className={`transition-all duration-300 ${p?.status === 'INACTIVE' ? 'grayscale opacity-40' : 'group-hover:scale-105'}`}>
                        <ProductAvatar icon={p?.icon_emoji || '📦'} size="h-10 w-10 text-xl shadow-sm" />
                    </div>
                    <div className="truncate">
                        <p className="leading-tight font-black text-slate-800 tracking-tight truncate" title={p?.name}>{p?.name || 'Producto sin nombre'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
                            {p?.last_stock_update ? new Date(p.last_stock_update).toLocaleDateString('es-VE') : 'Sin movimientos'}
                        </p>
                    </div>
                </div>
                <div className="col-span-2 text-slate-500 text-xs font-bold truncate">{p?.category || 'Sin categoría'}</div>
                <div className="col-span-2 text-right">
                    <div className="font-black text-slate-800 text-sm">Bs. {formatVES(p?.price_ves)}</div>
                    <div className="text-[10px] font-bold text-slate-400 bg-slate-100 inline-block px-1.5 py-0.5 rounded shadow-sm">
                        Ref {formatUSD(p?.price_usd)}
                    </div>
                </div>
                <div className="col-span-1 text-center">
                    <span className={`font-black px-2.5 py-1 rounded-md text-xs shadow-sm transition-colors ${
                        isLowStock 
                            ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-200 animate-pulse' 
                            : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                    }`}>
                        {currentStock}
                    </span>
                </div>
                {/* 🚀 ESTÁNDAR UX: Botones de Acción Sobrios (Sin sombras fluorescentes) */}
                <div className="col-span-2 flex justify-end pr-2 gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onMovement(p, 'IN'); }} className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100/50 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center font-bold active:scale-95 shadow-sm" title="Entrada">✚</button>
                    <button onClick={(e) => { e.stopPropagation(); onMovement(p, 'OUT'); }} className="w-8 h-8 rounded-md bg-rose-50 text-rose-600 border border-rose-100/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center font-bold active:scale-95 shadow-sm" title="Salida">➖</button>
                    <button onClick={(e) => { e.stopPropagation(); onKardex(p); }} className="w-8 h-8 rounded-md bg-slate-50 text-slate-600 border border-slate-200/60 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center font-bold active:scale-95 shadow-sm" title="Kardex">📊</button>
                </div>
            </div>
            
            {/* 🚀 ESTÁNDAR UX MÓVIL: VISTA HORIZONTAL COMPACTA */}
            <div className="md:hidden flex justify-between items-center pl-1">
                {/* Sección Izquierda: Avatar y Datos Principales */}
                <div className="flex items-center gap-3 pr-2 flex-1 overflow-hidden">
                    <div className={`shrink-0 ${p?.status === 'INACTIVE' ? 'grayscale opacity-40' : ''}`}>
                        <ProductAvatar icon={p?.icon_emoji || '📦'} size="h-10 w-10 text-xl shadow-sm" />
                    </div>
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <p className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate">{p?.name || 'Producto sin nombre'}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100/80 border border-slate-200/60 px-1.5 py-0.5 rounded shadow-sm shrink-0">
                                Ref {formatUSD(p?.price_usd)}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">Bs. {formatVES(p?.price_ves)}</span>
                        </div>
                    </div>
                </div>

                {/* Sección Derecha: Stock y Acciones Rápidas */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                        isLowStock ? 'bg-rose-50 text-rose-600 border-rose-200/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200/50'
                    }`}>
                        {currentStock} Und
                    </span>
                    <div className="flex gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); onMovement(p, 'IN'); }} className="h-7 w-7 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100/50 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center font-bold active:scale-95 shadow-sm">✚</button>
                        <button onClick={(e) => { e.stopPropagation(); onMovement(p, 'OUT'); }} className="h-7 w-7 rounded-md bg-rose-50 text-rose-600 border border-rose-100/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center font-bold active:scale-95 shadow-sm">➖</button>
                    </div>
                </div>
            </div>
        </div>
    );
});

// 🚀 EXPORT MEMOIZADO: Certificado para producción
const InventoryView = memo(({
    productSearchQuery, setProductSearchQuery, filterExpiration, setFilterExpiration,
    setProductForm, setIsProductFormOpen, filteredInventory, inventoryCurrentPage,
    setInventoryCurrentPage, openMovementModal, viewKardexHistory
}) => {
    const [inventoryPerPage, setInventoryPerPage] = useState(25);
    
    // ORDENAMIENTO ALFABÉTICO SEGURO
    const sortedInventory = useMemo(() => {
        if (!Array.isArray(filteredInventory)) return [];
        return [...filteredInventory].sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
    }, [filteredInventory]);

    const indexOfLastInventory = inventoryCurrentPage * inventoryPerPage;
    const indexOfFirstInventory = indexOfLastInventory - inventoryPerPage;
    const currentInventory = sortedInventory.slice(indexOfFirstInventory, indexOfLastInventory);
    const inventoryTotalPages = Math.max(1, Math.ceil(sortedInventory.length / inventoryPerPage));

    const handleNewProduct = () => {
        setProductForm({ 
            id: null, name: '', category: '', price_usd: 0.00, 
            stock: 0, is_taxable: true, icon_emoji: '📦', 
            barcode: '', status: 'ACTIVE', expiration_date: '',
            unit_measure: 'UND'
        });
        setIsProductFormOpen(true);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50/30">
            {/* HEADER RESPONSIVE DE IMPACTO */}
            <div className="flex flex-col mb-4 md:mb-6 gap-4 shrink-0 px-1 md:px-0 mt-2 md:mt-0">
                {/* Fila 1: Título y Botón Principal */}
                <div className="flex justify-between items-start w-full gap-4">
                    <div className="flex-1">
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-none">Inventario</h2>
                        <p className="text-[10px] md:text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 md:mt-2 leading-tight">Gestión de existencias y precios</p>
                    </div>
                    {/* 🚀 BOTÓN ESTANDARIZADO: bg-slate-800 estricto */}
                    <Button 
                        onClick={handleNewProduct} 
                        className="!bg-slate-800 !text-white hover:!bg-slate-900 h-10 md:h-12 px-4 md:px-6 flex items-center justify-center rounded-xl font-black !shadow-sm hover:!shadow-md transform hover:-translate-y-0.5 transition-all active:scale-95 gap-2 border-0"
                    >
                        <span className="text-lg leading-none mt-[-2px]">+</span> 
                        <span className="hidden sm:inline">Nuevo</span>
                    </Button>
                </div>

                {/* Fila 2: Buscador y Filtros */}
                <div className="flex flex-col sm:flex-row w-full gap-3 items-center">
                    <Input 
                        placeholder="Buscar producto o ID..." 
                        value={productSearchQuery} 
                        onChange={(e) => setProductSearchQuery(e.target.value)} 
                        className="w-full flex-1 !h-12 !rounded-xl shadow-sm focus:ring-2 focus:ring-slate-200 transition-shadow" 
                        icon={() => <span className="text-slate-400">🔍</span>} 
                    />
                    <Button 
                        variant="secondary" 
                        onClick={() => setFilterExpiration(!filterExpiration)} 
                        className={`w-full sm:w-auto !h-12 !px-5 text-[11px] font-black uppercase tracking-wider flex items-center justify-center rounded-xl transition-all shadow-sm border ${
                            filterExpiration 
                                ? '!bg-amber-50 !text-amber-600 !border-amber-200' 
                                : 'bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50'
                        }`}
                    >
                        {filterExpiration ? '🔥 Riesgos' : '📅 Vencimiento'}
                    </Button>
                </div>
            </div>

            {/* TABLA PRINCIPAL CON DISEÑO NEUMORPHISM LIMPIO */}
            <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden flex flex-col relative">
                <div className="hidden md:grid grid-cols-12 bg-slate-50/80 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/60 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                    <div className="col-span-1 pl-1">ID</div>
                    <div className="col-span-4">PRODUCTO</div>
                    <div className="col-span-2">CATEGORÍA</div>
                    <div className="col-span-2 text-right">PRECIO</div>
                    <div className="col-span-1 text-center">STOCK</div>
                    <div className="col-span-2 text-right pr-2">GESTIÓN</div>
                </div>
                
                {/* 🚀 FIX UX: Eliminado "divide-y" para evitar apilamiento de bordes */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {sortedInventory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
                                <span className="text-4xl opacity-50 grayscale">📦</span>
                            </div>
                            <p className="text-slate-500 font-black text-lg">No se encontraron productos</p>
                            <p className="text-slate-400 text-xs font-medium mt-1">Ajusta los filtros de búsqueda o crea uno nuevo.</p>
                        </div>
                    ) : (
                        currentInventory.map((p) => (
                            <ProductRow 
                                key={p?.id || Math.random()} 
                                p={p} 
                                onEdit={(prod) => { 
                                    setProductForm({...prod, price_usd: Number(prod?.price_usd || 0)}); 
                                    setIsProductFormOpen(true); 
                                }} 
                                onMovement={openMovementModal} 
                                onKardex={viewKardexHistory} 
                            />
                        ))
                    )}
                </div>

                {/* PAGINACIÓN ELEGANTE (Estandarizada) */}
                {sortedInventory.length > 0 && (
                    <div className="p-3 border-t border-slate-200/60 flex justify-between items-center gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
                        <select 
                            value={inventoryPerPage} 
                            onChange={(e) => { setInventoryPerPage(Number(e.target.value)); setInventoryCurrentPage(1); }} 
                            className="bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1.5 px-3 outline-none cursor-pointer text-slate-600 shadow-sm focus:ring-2 focus:ring-slate-100 transition-all"
                        >
                            <option value={25}>25 / pág</option>
                            <option value={50}>50 / pág</option>
                            <option value={100}>100 / pág</option>
                        </select>
                        <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                            <Button variant="ghost" onClick={() => setInventoryCurrentPage(prev => Math.max(1, prev - 1))} disabled={inventoryCurrentPage === 1} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Ant</Button>
                            <span className="text-[10px] font-black text-slate-500 tracking-wider">
                                {inventoryCurrentPage} <span className="text-slate-300 font-medium">/</span> {inventoryTotalPages}
                            </span>
                            <Button variant="ghost" onClick={() => setInventoryCurrentPage(prev => Math.min(inventoryTotalPages, prev + 1))} disabled={inventoryCurrentPage === inventoryTotalPages} className="!text-[10px] !py-1 !px-2 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30">Sig</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default InventoryView;