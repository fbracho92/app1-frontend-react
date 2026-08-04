import React from 'react';
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
    if (!isMovementModalOpen || !movementProduct) return null;

    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl animate-scale-up overflow-hidden relative">

                {/* Header con Código de Color */}
                <div className={`p-6 text-center text-white relative ${movementType === 'IN' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                    <button onClick={() => setIsMovementModalOpen(false)} className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center font-bold transition-all">✕</button>
                    <h3 className="text-xl font-black uppercase tracking-wider">{movementType === 'IN' ? 'Registrar Entrada' : 'Registrar Salida'}</h3>
                    <p className="text-white/90 text-sm font-medium mt-1">{movementProduct.name}</p>
                </div>

                <form onSubmit={handleMovementSubmit} className="p-6 space-y-5">

                    {/* 1. Cantidad (Input Nativo Estilizado para asegurar funcionamiento de lógica) */}
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-1/2 relative text-center">
                            <input
                                type="number"
                                min="1"
                                required
                                autoFocus
                                value={movementForm.quantity}
                                onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                                style={{ fontSize: '3.5rem', fontWeight: '900' }}
                                className={`w-full text-center border-b-2 outline-none py-2 bg-transparent transition-colors ${movementType === 'OUT' && parseInt(movementForm.quantity) > movementProduct.stock
                                        ? 'border-rose-500 text-rose-600'
                                        : 'border-gray-200 focus:border-gray-800'
                                    }`}
                                placeholder="0"
                            />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mt-1">Unidades</span>
                        </div>

                        {/* MEJORA UX: INDICADOR DE STOCK DISPONIBLE */}
                        {movementType === 'OUT' && (
                            <div className={`mt-2 text-xs font-bold px-3 py-1 rounded-full border ${parseInt(movementForm.quantity) > movementProduct.stock
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                                    : 'bg-gray-50 text-gray-500 border-gray-200'
                                }`}>
                                Disponibles: {movementProduct.stock}
                            </div>
                        )}
                    </div>

                    {/* 2. Motivo */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Motivo del Movimiento</label>
                        <select
                            value={movementForm.reason}
                            onChange={(e) => {
                                const val = e.target.value;
                                let newCost = movementForm.cost_usd;
                                if (val === 'DONACION_RECIBIDA') newCost = 0;
                                if (val === 'COMPRA_PROVEEDOR') newCost = movementProduct.price_usd;
                                setMovementForm({ ...movementForm, reason: val, cost_usd: newCost });
                                if (['VENCIMIENTO', 'MERMA_DAÑO'].includes(val)) fetchBatches(movementProduct.id);
                            }}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                        >
                            {movementType === 'IN' ? (
                                <>
                                    <option value="COMPRA_PROVEEDOR">📦 Compra / Nuevo Lote</option>
                                    <option value="DEVOLUCION_CLIENTE">↩️ Devolución de Cliente (A Stock)</option>
                                    <option value="AJUSTE_POSITIVO">🔧 Ajuste de Inventario (+)</option>
                                    <option value="DONACION_RECIBIDA">🎁 Donación Recibida</option>
                                </>
                            ) : (
                                <>
                                    <option value="VENTA">💰 Venta (FEFO Automático)</option>
                                    <option value="CONSUMO_INTERNO">☕ Consumo Interno</option>
                                    <option value="MERMA_DAÑO">🗑️ Merma / Daño (Seleccionar Lote)</option>
                                    <option value="VENCIMIENTO">📅 Retiro por Vencimiento (Seleccionar Lote)</option>
                                    <option value="AJUSTE_NEGATIVO">🔧 Ajuste de Inventario (-)</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* 3. Datos Dinámicos con Componente Modular Input */}
                    {movementType === 'IN' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Costo Unitario ($)"
                                type="number"
                                value={movementForm.cost_usd}
                                onChange={(e) => setMovementForm({ ...movementForm, cost_usd: e.target.value })}
                                icon={() => <span className="font-bold">$</span>}
                            />
                            <Input
                                label="Ref. / Factura"
                                placeholder="Ej: FAC-001"
                                value={movementForm.document_ref}
                                onChange={(e) => setMovementForm({ ...movementForm, document_ref: e.target.value })}
                            />
                        </div>
                    ) : (
                        <Input
                            label="Nota de Salida"
                            placeholder="Ej: Consumo gerencia"
                            value={movementForm.document_ref}
                            onChange={(e) => setMovementForm({ ...movementForm, document_ref: e.target.value })}
                        />
                    )}

                    {/* Fecha Vencimiento (Solo Entradas de Perecederos) */}
                    {movementType === 'IN' && movementProduct.is_perishable && (
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 animate-fade-in-up">
                            <Input
                                label="Vencimiento del Lote"
                                type="date"
                                required={movementForm.reason !== 'DEVOLUCION_CLIENTE'}
                                value={movementForm.new_expiration}
                                onChange={(e) => setMovementForm({ ...movementForm, new_expiration: e.target.value })}
                            />
                        </div>
                    )}

                    {/* Selector de Lote (Solo Salidas Específicas) */}
                    {movementType === 'OUT' && ['VENCIMIENTO', 'MERMA_DAÑO'].includes(movementForm.reason) && (
                        <div className="animate-fade-in-up">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Seleccione lote a retirar:</p>
                            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-2 space-y-1 custom-scrollbar">
                                {batches.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-2">Sin lotes disponibles</p>
                                ) : (
                                    batches.map(batch => (
                                        <div
                                            key={batch.id}
                                            onClick={() => setSelectedBatch(batch.id)}
                                            className={`p-2 rounded-lg text-xs flex justify-between cursor-pointer border transition-all ${selectedBatch === batch.id ? 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <span>📅 Vence: {batch.expiration_date ? new Date(batch.expiration_date).toLocaleDateString() : 'N/A'}</span>
                                            <span className="font-bold">Cant: {batch.stock}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Botón de Confirmación usando componente Button */}
                    <Button
                        type="submit"
                        variant={movementType === 'IN' ? 'primary' : 'danger'}
                        disabled={movementType === 'OUT' && parseInt(movementForm.quantity) > movementProduct.stock}
                        className={`w-full py-4 !shadow-xl ${movementType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                    >
                        {movementType === 'IN' ? 'CONFIRMAR ENTRADA' : 'CONFIRMAR SALIDA'}
                    </Button>
                </form>
            </div>
        </div>
    );
};