import React from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ProductAvatar from '../components/ui/ProductAvatar';
import { formatBs } from '../utils/formatters';
import { EMOJI_OPTIONS } from '../constants/appConstants';

export const ProductFormModal = ({
    isProductFormOpen,
    setIsProductFormOpen,
    productForm,
    setProductForm,
    saveProduct,
    handleImageRead,
    handleProductFormChange,
    uniqueCategories,
    bcvRate
}) => {
    if (!isProductFormOpen) return null;

    // Diccionario de unidades de medida (UOM)
    const UOM_OPTIONS = [
        { value: 'UND', label: '📦 Unidad (Por defecto)' },
        { value: 'KG', label: '⚖️ Kilo' },
        { value: 'GR', label: '⚖️ Gramos' },
        { value: 'LT', label: '💧 Litros' },
        { value: 'MTS', label: '📏 Metros' },
        { value: '1/4 GALON', label: '🛢️ 1/4 Galon' },
        { value: 'ATOMIZADOR', label: '🧴 Atomizador' },
        { value: 'BLISTER', label: '💊 Blister' },
        { value: 'BOLSA', label: '🛍️ Bolsa' },
        { value: 'BOTELLA', label: '🍾 Botella' },
        { value: 'BULTO', label: '📦 Bulto' },
        { value: 'CAJAS', label: '📦 Caja' },
        { value: 'CAPSULAS', label: '💊 Capsulas' },
        { value: 'CENTIMETRO', label: '📏 Centimetro' },
        { value: 'COMPRIMIDOS', label: '💊 Comprimidos' },
        { value: 'CREMA', label: '🧴 Crema' },
        { value: 'DOCENA', label: '🥚 Docena' },
        { value: 'FRASCO AMPOLLA', label: '💉 Frasco Ampolla' },
        { value: 'GALON', label: '🛢️ Galon' },
        { value: 'GOTAS', label: '💧 Gotas' },
        { value: 'GRANULADOS', label: '🧂 Granulados' },
        { value: 'JARABE', label: '🥄 Jarabe' },
        { value: 'MT2', label: '📐 Metros Cuadrados' },
        { value: 'MT3', label: '🧊 Metros Cubicos' },
        { value: 'ONZA', label: '⚖️ Onza' },
        { value: 'OVULOS', label: '💊 Ovulos' },
        { value: 'PAILA', label: '🪣 Paila' },
        { value: 'PIEZA', label: '🧩 Pieza' },
        { value: 'PORCION', label: '🍰 Porcion' },
        { value: 'SACO', label: '🥔 Saco' },
        { value: 'SOLUCIONES', label: '🧪 Soluciones' },
        { value: 'SUPOSITORIOS', label: '💊 Supositorios' },
        { value: 'SUSPENSION', label: '🧪 Suspension' },
        { value: 'TABLETAS', label: '💊 Tabletas' },
        { value: 'TABLETAS MASTICABLES', label: '🍬 Tabletas Masticables' },
        { value: 'TAMBOR', label: '🛢️ Tambor' },
        { value: 'UNGUENTO', label: '🧴 Unguento' }
    ];

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl shadow-slate-900/50 overflow-hidden flex flex-col max-h-[95vh] animate-scale-up border border-slate-100">

                {/* 1. Header Minimalista */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur-xl z-20 sticky top-0">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            {productForm.id ? (
                                <> <span className="bg-blue-100 text-blue-600 p-2 rounded-xl text-lg">✏️</span> <span>Editar Ficha Tecnica</span> </>
                            ) : (
                                <> <span className="bg-green-100 text-green-600 p-2 rounded-xl text-lg">✨</span> <span>Nuevo Producto</span> </>
                            )}
                        </h3>
                        <p className="text-sm text-slate-400 font-medium mt-1 ml-12">Gestion de activos y cumplimiento fiscal</p>
                    </div>
                    <button onClick={() => setIsProductFormOpen(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all transform hover:rotate-90 hover:scale-110 shadow-sm">✕</button>
                </div>

                {/* Cuerpo del Formulario */}
                <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/30">
                    <form onSubmit={(e) => { saveProduct(e).then(() => setIsProductFormOpen(false)); }}>

                        {/* GRUPO A: IDENTIDAD (IMAGEN Y DATOS BÁSICOS) */}
                        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 mb-8 relative">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                1. Identidad del Producto
                            </h4>

                            <div className="flex flex-col lg:flex-row gap-8">
                                {/* COLUMNA IZQUIERDA: FOTO */}
                                <div className="w-full lg:w-1/3 shrink-0 flex flex-col gap-4">
                                    <div
                                        className="aspect-square w-full rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 relative overflow-hidden group hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer shadow-inner flex items-center justify-center"
                                        onClick={() => document.getElementById('file-upload').click()}
                                    >
                                        <ProductAvatar icon={productForm.icon_emoji} size="w-full h-full text-[6rem]" className="border-none bg-transparent shadow-none" />

                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-sm">
                                            <span className="text-2xl mb-2">🔄</span>
                                            <span className="text-xs font-bold uppercase">Cambiar Foto / Icono</span>
                                        </div>
                                        <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageRead(e.target.files[0], (base64) => setProductForm({ ...productForm, icon_emoji: base64 }))} />
                                    </div>

                                    {productForm.icon_emoji?.startsWith('data:image') && (
                                        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setProductForm({ ...productForm, icon_emoji: '📦' }); }} className="text-red-500 hover:bg-red-50 !py-2">
                                            🗑️ Eliminar Foto
                                        </Button>
                                    )}

                                    {!productForm.icon_emoji?.startsWith('data:image') && (
                                        <div className="h-40 overflow-y-auto custom-scrollbar bg-slate-50 rounded-xl p-2 border border-slate-100 shadow-inner">
                                            <div className="grid grid-cols-5 gap-1.5 place-items-center">
                                                {EMOJI_OPTIONS.map((emoji, index) => (
                                                    <button key={index} type="button" onClick={() => setProductForm({ ...productForm, icon_emoji: emoji })} className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-all active:scale-95 ${productForm.icon_emoji === emoji ? 'bg-white shadow-md ring-2 ring-blue-400 scale-110' : 'hover:bg-white hover:shadow-sm opacity-80 hover:opacity-100'}`}>
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* COLUMNA DERECHA: TEXTOS (CON CAPITALIZACIÓN ACTIVA) */}
                                <div className="flex-1 flex flex-col gap-6">
                                    <Input
                                        label="Nombre Comercial (*)"
                                        placeholder="Ej: Harina P.A.N. 1kg"
                                        value={productForm.name}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const formatted = val.replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
                                            setProductForm({ ...productForm, name: formatted });
                                        }}
                                        required
                                        autoFocus
                                        className="[&_input]:h-14 [&_input]:text-lg [&_input]:font-bold"
                                    />
                                    <p className="text-[9px] text-slate-400 -mt-4 pl-2">Incluya marca, peso o medida (Ej: 1kg, 2L, 500g).</p>

                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Categoria</label>
                                            <input type="text" list="category-list" name="category" value={productForm.category} onChange={handleProductFormChange} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 focus:bg-white focus:border-emerald-500 outline-none transition-all text-slate-700 font-bold" placeholder="Seleccionar..." />
                                            <datalist id="category-list">{uniqueCategories.map(c => <option key={c} value={c} />)}</datalist>
                                        </div>
                                        <Input
                                            label="Codigo Barras"
                                            name="barcode"
                                            value={productForm.barcode}
                                            onChange={handleProductFormChange}
                                            placeholder="Escanee..."
                                            className="[&_input]:font-mono [&_input]:text-slate-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SELECTOR: NATURALEZA DEL ÍTEM (Sustituye al antiguo Switch) */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-8">
                            <div className="mb-3">
                                <span className="font-bold text-sm text-slate-700">Naturaleza del Item</span>
                                <p className="text-[10px] text-slate-500">Define el comportamiento logistico y fiscal en el sistema.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Opción 1: Producto Físico */}
                                <button 
                                    type="button"
                                    onClick={() => setProductForm(p => ({ ...p, is_raw_material: false, is_service: false }))}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${!productForm.is_raw_material && !productForm.is_service ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                >
                                    <div className="font-bold text-xs flex items-center gap-2"><span className="text-lg">📦</span> Producto Venta</div>
                                    <div className="text-[9px] text-slate-500 mt-1">Controla stock y aparece en el POS.</div>
                                </button>

                                {/* Opción 2: Servicio */}
                                <button 
                                    type="button"
                                    onClick={() => setProductForm(p => ({ ...p, is_raw_material: false, is_service: true, stock: 0, is_perishable: false }))}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${productForm.is_service ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                >
                                    <div className="font-bold text-xs flex items-center gap-2"><span className="text-lg">🛵</span> Servicio</div>
                                    <div className="text-[9px] text-slate-500 mt-1">Intangible (Delivery). No maneja stock.</div>
                                </button>

                                {/* Opción 3: Insumo Interno */}
                                <button 
                                    type="button"
                                    onClick={() => setProductForm(p => ({ ...p, is_raw_material: true, is_service: false }))}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${productForm.is_raw_material ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                >
                                    <div className="font-bold text-xs flex items-center gap-2"><span className="text-lg">⚙️</span> Insumo Interno</div>
                                    <div className="text-[9px] text-slate-500 mt-1">Materia prima. No aparece en el POS.</div>
                                </button>
                            </div>
                        </div>

                        {/* GRUPO B: COSTOS Y PRECIOS */}
                        <div className="mb-8">
                            <div className="relative overflow-hidden bg-white border border-slate-200 rounded-[24px] shadow-xl shadow-slate-200/50">
                                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Estructura de Costos
                                    </h4>
                                    <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                                        Tasa BCV: {formatBs(bcvRate)}
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                    <div className="flex-1 p-6 group hover:bg-blue-50/20 transition-colors relative">
                                        <label className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-2 block">Precio (Ref) *</label>
                                        <div className="relative flex items-baseline">
                                            <span className="text-3xl font-light text-slate-300 mr-2">$</span>
                                            <input type="number" step="0.01" min="0" required value={productForm.price_usd} onChange={(e) => setProductForm(prev => ({ ...prev, price_usd: e.target.value }))} className="w-full bg-transparent text-4xl font-black text-slate-800 outline-none font-mono tracking-tight" placeholder="0.00" />
                                        </div>
                                    </div>

                                    <div className="flex-1 p-6 bg-slate-50/30 group hover:bg-slate-50 transition-colors relative">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">Equivalente (Bs)</label>
                                        <div className="relative flex items-baseline">
                                            <span className="text-2xl font-light text-slate-300 mr-2">Bs</span>
                                            <input
                                                type="text"
                                                value={productForm.price_usd ? formatBs(parseFloat(productForm.price_usd) * bcvRate).replace('Bs ', '') : ''}
                                                onChange={(e) => {
                                                    let valClean = e.target.value.replace(/\./g, '').replace(',', '.');
                                                    let valBs = parseFloat(valClean);
                                                    if (!isNaN(valBs) && bcvRate > 0) setProductForm(prev => ({ ...prev, price_usd: (valBs / bcvRate).toFixed(2) }));
                                                    else setProductForm(prev => ({ ...prev, price_usd: '' }));
                                                }}
                                                className="w-full bg-transparent text-3xl font-bold text-slate-600 outline-none font-mono"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* GRUPO C: CONTROL LOGÍSTICO Y FISCAL */}
                        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm mb-8">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                3. Control de Inventario y Fiscal
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    {/* BLINDAJE: Si es un servicio, ocultamos stock y perecedero */}
                                    {!productForm.is_service ? (
                                        <>
                                            <div className={`relative group p-4 rounded-xl border ${productForm.id ? 'bg-slate-100 border-slate-200' : 'bg-white border-blue-200'}`}>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        Existencia Fisica ({productForm.unit_measure || 'UND'})
                                                    </label>
                                                    {productForm.id && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 rounded-full font-bold">🔒 BLOQUEADO</span>}
                                                </div>
                                                <input 
                                                    type="number" 
                                                    step="0.001" 
                                                    min="0"
                                                    disabled={!!productForm.id} 
                                                    value={productForm.stock} 
                                                    onChange={e => setProductForm({ ...productForm, stock: e.target.value })} 
                                                    className="w-full bg-transparent text-2xl font-black outline-none disabled:text-slate-400" 
                                                    placeholder="0.000" 
                                                />
                                                {productForm.id && (
                                                    <div className="mt-2 text-[10px] text-slate-500 leading-tight bg-slate-200/50 p-2 rounded-lg border border-slate-200">
                                                        ⚖️ Por normativa, use <b>"Registrar Entrada/Salida"</b> para auditar cambios de stock.
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-4">
                                                <div className={`flex-1 p-4 rounded-xl border ${productForm.is_perishable ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                        <input type="checkbox" className="accent-orange-500 w-4 h-4" checked={productForm.is_perishable} onChange={(e) => setProductForm(p => ({ ...p, is_perishable: e.target.checked }))} />
                                                        <span className={`text-xs font-bold uppercase ${productForm.is_perishable ? 'text-orange-700' : 'text-slate-400'}`}>Perecedero</span>
                                                    </label>
                                                    {productForm.is_perishable && <input type="date" name="expiration_date" value={productForm.expiration_date || ''} onChange={handleProductFormChange} className="w-full p-2 rounded border border-orange-200 text-sm font-bold text-gray-700" />}
                                                </div>

                                                {/* 📏 NUEVO: SELECTOR DE UNIDAD DE MEDIDA (UOM) */}
                                                <div className="flex-1 p-4 rounded-xl border bg-slate-50 border-slate-200">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Unidad / Empaque</label>
                                                    <select 
                                                        name="unit_measure" 
                                                        value={productForm.unit_measure || 'UND'} 
                                                        onChange={handleProductFormChange} 
                                                        className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg py-2 px-2 outline-none focus:border-blue-500"
                                                    >
                                                        {UOM_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl flex items-center justify-center flex-col text-center h-full min-h-[160px]">
                                            <span className="text-3xl mb-3">☁️</span>
                                            <span className="text-sm font-bold text-blue-700 uppercase tracking-widest">Servicio Intangible</span>
                                            <span className="text-[10px] text-blue-500 mt-2 max-w-[80%]">Este item no requiere control de inventario ni fechas de vencimiento.</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className={`p-4 rounded-xl border flex flex-col gap-2 ${productForm.id ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-200'}`}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block">Impuesto (IVA)</label>
                                                <span className="text-[10px] text-slate-400">Regimen General (16%)</span>
                                            </div>
                                            <select name="is_taxable" value={productForm.is_taxable} onChange={handleProductFormChange} className="bg-white border text-xs font-bold text-slate-700 rounded-lg py-1 px-2 outline-none">
                                                <option value="true">SI (Gravado)</option>
                                                <option value="false">NO (Exento)</option>
                                            </select>
                                        </div>
                                        {productForm.id && <p className="text-[9px] text-yellow-700">⚠️ Cambiar el estatus fiscal afecta el Libro de Ventas.</p>}
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Estatus</label>
                                        <select name="status" value={productForm.status} onChange={handleProductFormChange} className={`border-none text-xs font-bold rounded-lg py-2 pl-3 pr-8 outline-none ${productForm.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            <option value="ACTIVE">ACTIVO</option>
                                            <option value="INACTIVE">INACTIVO</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pb-2 z-20">
                            <Button type="submit" className="w-full bg-slate-900 hover:bg-black text-white py-4 text-lg border-0 shadow-lg shadow-slate-900/20">
                                <span>💾</span> <span>{productForm.id ? 'Guardar Cambios' : 'Registrar Producto'}</span>
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};