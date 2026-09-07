import React, { useEffect } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export const MovementModal = ({
    isMovementModalOpen,
    setIsMovementModalOpen,
    movementProduct,
    movementType,
    movementForm,
    setMovementForm,
    handleMovementSubmit,
    fetchBatches,
    batches,
    selectedBatch,
    setSelectedBatch
}) => {
    // 🚨 EFECTO SEGURO: Cargar lotes automáticamente si el producto maneja inventario
    useEffect(() => {
        if (isMovementModalOpen && movementProduct?.id) {
            fetchBatches(movementProduct.id);
        }
    }, [isMovementModalOpen, movementProduct, fetchBatches]);

    if (!isMovementModalOpen || !movementProduct) return null;

    // =========================================================================
    // 🚨 BLINDAJE UX PRO: Lógica Inteligente de Unidades
    // =========================================================================
    const rawUnit = (movementProduct.unit_measure || 'UND').toUpperCase().trim();
    const integerOnlyUnits = ['UND', 'UNIDAD', 'CAJA', 'CAJAS', 'BULTO', 'BLISTER', 'DOCENA', 'PIEZA', 'PAILA', 'TAMBOR'];
    const isFractionable = !integerOnlyUnits.includes(rawUnit);

    // 🚨 FIX UX: Usamos parseFloat para que la alerta visual de stock funcione con gramos/kilos
    const currentStock = parseFloat(movementProduct.stock) || 0;
    const inputQuantity = parseFloat(movementForm.quantity) || 0;
    const isOverStock = movementType === 'OUT' && inputQuantity > currentStock;

    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl animate-scale-up overflow-hidden relative max-h-[90vh] flex flex-col">

                {/* Header con Código de Color */}
                <div className={`p-6 text-center text-white relative shrink-0 ${movementType === 'IN' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                    <button onClick={() => setIsMovementModalOpen(false)} className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center font-bold transition-all outline-none">✕</button>
                    <h3 className="text-xl font-black uppercase tracking-wider">{movementType === 'IN' ? 'Registrar Entrada' : 'Registrar Salida'}</h3>
                    <p className="text-white/90 text-sm font-medium mt-1">{movementProduct.name}</p>
                </div>

                <form id="movement-form" onSubmit={handleMovementSubmit} className="flex flex-col flex-1 overflow-hidden">
                    
                    {/* Contenedor Scrollable de los Inputs */}
                    <div className="overflow-y-auto custom-scrollbar p-6 space-y-5">

                        {/* 1. Cantidad (Input Inteligente Anti-Errores de Coma/Punto) */}
                        <div className="flex flex-col items-center justify-center">
                            <div className="w-1/2 relative text-center">
                                <input
                                    /* 🚨 FIX UX VENEZUELA: Control nativo de la coma decimal */
                                    type="text" 
                                    inputMode={isFractionable ? "decimal" : "numeric"}
                                    required
                                    autoFocus
                                    value={movementForm.quantity || ''}
                                    onChange={(e) => {
                                        let val = e.target.value;

                                        // 1. Convertimos la coma a punto en tiempo real para la Base de Datos
                                        val = val.replace(',', '.');

                                        // 2. Si es una unidad entera (CAJA, UND), bloqueamos el punto
                                        if (!isFractionable) val = val.replace(/\./g, '');

                                        // 3. Borramos letras o caracteres raros
                                        val = val.replace(/[^0-9.]/g, '');

                                        // 4. Prevenir múltiples puntos (Ej: 1.5.0)
                                        const parts = val.split('.');
                                        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');

                                        // 5. NORMATIVA SACS: Máximo 3 decimales
                                        if (isFractionable && parts.length === 2) val = parts[0] + '.' + parts[1].substring(0, 3);

                                        setMovementForm({ ...movementForm, quantity: val });
                                    }}
                                    style={{ fontSize: '3.5rem', fontWeight: '900' }}
                                    className={`w-full text-center border-b-2 outline-none py-2 bg-transparent transition-colors ${
                                        isOverStock ? 'border-rose-500 text-rose-600' : 'border-gray-200 focus:border-gray-800'
                                    }`}
                                    placeholder="0"
                                />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mt-1">
                                    {rawUnit} {isFractionable ? '' : '(Enteros)'}
                                </span>
                            </div>

                            {/* INDICADOR DE STOCK DISPONIBLE */}
                            {movementType === 'OUT' && (
                                <div className={`mt-2 text-xs font-bold px-3 py-1 rounded-full border ${
                                    isOverStock ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse' : 'bg-gray-50 text-gray-500 border-gray-200'
                                }`}>
                                    Disponibles: {currentStock} {rawUnit}
                                </div>
                            )}
                        </div>

                        {/* 2. Motivo */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Motivo del Movimiento</label>
                            <select
                                value={movementForm.reason || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    let newCost = movementForm.cost_usd;
                                    if (val === 'DONACION_RECIBIDA') newCost = 0;
                                    if (val === 'COMPRA_PROVEEDOR') newCost = movementProduct.price_usd;
                                    setMovementForm({ ...movementForm, reason: val, cost_usd: newCost });
                                    if (['VENCIMIENTO', 'MERMA_DAÑO'].includes(val)) fetchBatches(movementProduct.id);
                                }}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-gray-200 transition-all cursor-pointer"
                            >
                                <option value="" disabled>Seleccione...</option>
                                {movementType === 'IN' ? (
                                    <>
                                        <option value="COMPRA_PROVEEDOR">📦 Compra / Nuevo Lote</option>
                                        <option value="DEVOLUCION_CLIENTE">↩️ Devolución de Cliente</option>
                                        <option value="AJUSTE_POSITIVO">🔧 Ajuste de Inventario (+)</option>
                                        <option value="DONACION_RECIBIDA">🎁 Donación Recibida</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="VENTA">💰 Venta (Descargo Manual)</option>
                                        <option value="CONSUMO_INTERNO">☕ Consumo Interno</option>
                                        <option value="MERMA_DAÑO">🗑️ Merma / Daño (Seleccionar Lote)</option>
                                        <option value="VENCIMIENTO">📅 Retiro por Vencimiento (Seleccionar Lote)</option>
                                        <option value="AJUSTE_NEGATIVO">🔧 Ajuste de Inventario (-)</option>
                                    </>
                                )}
                            </select>
                        </div>

                        {/* 3. Lógica Condicional: SACS y SUNDDE */}
                        {movementType === 'IN' ? (
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <Input
                                    label="Costo Unitario ($)"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={movementForm.cost_usd || ''}
                                    onChange={(e) => setMovementForm({ ...movementForm, cost_usd: e.target.value })}
                                    className="!bg-white"
                                />
                                <Input
                                    label="Ref. / Factura"
                                    placeholder="Ej: FAC-001"
                                    value={movementForm.document_ref || ''}
                                    onChange={(e) => setMovementForm({ ...movementForm, document_ref: (e.target.value || '').toUpperCase() })}
                                    className="!bg-white uppercase"
                                />
                                {movementProduct.is_perishable && (
                                    <div className="col-span-2 mt-2">
                                        <Input
                                            label="Vencimiento del Lote (SACS) *"
                                            type="date"
                                            required={movementForm.reason !== 'DEVOLUCION_CLIENTE'}
                                            value={movementForm.new_expiration || ''}
                                            onChange={(e) => setMovementForm({ ...movementForm, new_expiration: e.target.value })}
                                            className="!bg-white border-orange-200 focus:ring-orange-100"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Input
                                    label="Nota de Salida / Ref."
                                    placeholder="Ej: Consumo gerencia"
                                    value={movementForm.document_ref || ''}
                                    onChange={(e) => setMovementForm({ ...movementForm, document_ref: (e.target.value || '').toUpperCase() })}
                                />
                                
                                {/* 🚨 GESTIÓN FEFO: Selector de Lotes */}
                                {movementProduct.is_perishable && ['VENCIMIENTO', 'MERMA_DAÑO'].includes(movementForm.reason) && (
                                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                        <p className="text-[10px] font-bold text-amber-800 uppercase mb-2">Seleccione lote a retirar (FEFO):</p>
                                        <div className="max-h-32 overflow-y-auto border border-amber-100 rounded-lg bg-white p-2 space-y-1 custom-scrollbar">
                                            {batches.length === 0 ? (
                                                <p className="text-xs text-slate-400 text-center py-2">Sin lotes disponibles</p>
                                            ) : (
                                                batches.map(batch => (
                                                    <label key={batch.id} className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer border transition-all ${selectedBatch === batch.id ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <input type="radio" name="batch_selector" className="text-amber-600 focus:ring-amber-500" checked={selectedBatch === batch.id} onChange={() => setSelectedBatch(batch.id)} />
                                                            <span>Vence: {batch.expiration_date ? new Date(batch.expiration_date).toLocaleDateString('es-VE') : 'N/A'}</span>
                                                        </div>
                                                        <span className="font-bold">{parseFloat(batch.stock)} {rawUnit}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Fijo */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
                        <Button type="button" variant="ghost" onClick={() => setIsMovementModalOpen(false)} className="w-1/3 !bg-white border border-gray-200 !text-gray-500 hover:!bg-gray-100 text-xs font-bold uppercase tracking-widest shadow-sm">
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isOverStock}
                            className={`w-2/3 text-xs font-black uppercase tracking-widest shadow-md hover:-translate-y-0.5 transition-all border-0 ${movementType === 'IN' ? '!bg-emerald-600 hover:!bg-emerald-700 text-white' : '!bg-rose-600 hover:!bg-rose-700 text-white'}`}
                        >
                            Confirmar {movementType === 'IN' ? 'Entrada' : 'Salida'}
                        </Button>
                    </div>
                </form>

            </div>
        </div>
    );
};