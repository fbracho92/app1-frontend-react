import React from 'react';
import { tenantConfig } from '../config/tenantConfig'; // <-- 1. INYECTAMOS EL ADN DE LA EMPRESA

export const CheckoutModal = ({
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    IVA_RATE,
    finalTotalUSD,
    totalVES,
    isNumpadOpen,
    remainingUSD,
    remainingVES,
    handleExactPayment,
    paymentMethods,
    subtotalExemptUSD,
    subtotalTaxableUSD,
    ivaUSD,
    isFiscalInvoice,
    setIsFiscalInvoice,
    cart,
    paymentShares,
    isInsufficient,
    handleCreditProcess,
    PaymentInput,
    Button,
    // --- 🚨 NUEVAS PROPS IGTF ---
    igtfGeneratedUSD = 0,
    targetTotalUSD
}) => {
    if (!isPaymentModalOpen) return null;

    // Calculamos el Total Dinámico. Si targetTotalUSD no viene, usamos el finalTotalUSD normal
    const currentTargetUSD = targetTotalUSD || finalTotalUSD;
    
    // Obtenemos la tasa implícita para calcular el Bs del nuevo total dinámico sin romper tu App.jsx
    const bcvRateDerived = finalTotalUSD > 0 ? (totalVES / finalTotalUSD) : 0;
    const currentTargetVES = currentTargetUSD * bcvRateDerived;

    // 🚨 [NUEVO] LÓGICA DE ETIQUETAS FISCALES PARA UX BLINDADO
    const mode = tenantConfig.invoiceMode || 'FORMA_LIBRE';
    const fiscalLabels = {
        'FISCAL_PRINTER': { tag: 'MÁQUINA FISCAL', desc: 'Se enviará la orden a la impresora fiscal conectada.' },
        'FORMA_LIBRE': { tag: 'FORMA LIBRE', desc: 'Generará N° de Factura y Control (Libro de Ventas).' },
        'ELECTRONIC_BILLING': { tag: 'ELECTRÓNICA', desc: 'Se enviará el XML al Proveedor Autorizado (SENIAT).' },
        'ELECTRONIC': { tag: 'ELECTRÓNICA', desc: 'Se enviará el XML al Proveedor Autorizado (SENIAT).' }
    };
    const currentFiscalConfig = fiscalLabels[mode] || { tag: 'DESCONOCIDO', desc: 'Modalidad fiscal no configurada correctamente.' };

    // === [INICIO] PASO 3: EL DISTRIBUIDOR DE IMPRESIÓN FISCAL ===
    const handleDistributorProcess = async () => {
        const currentMode = tenantConfig.invoiceMode || 'LOCAL_PDF';

        // 🚨 FLUJO BLINDADO ANTI-DEPENDENCIA CIEGA (Para Hardware Fiscal)
        if (isFiscalInvoice && currentMode === 'FISCAL_PRINTER') {
            try {
                // 1. Bloqueamos la pantalla del cajero (Evita doble clic mientras la máquina procesa)
                Swal.fire({
                    title: 'Imprimiendo Factura Fiscal...',
                    html: 'Enviando datos a la impresora. <br/><b>NO APAGUE EL EQUIPO.</b>',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                // 2. Intentamos imprimir PRIMERO (Ping al Spooler/Intraweb PNP o HKA)
                console.log(`[DISTRIBUIDOR] Solicitando impresión en: ${tenantConfig.fiscalPrinterIP}`);
                
                /* =========================================================
                   🛑 AQUÍ VA TU CÓDIGO REAL DE CONEXIÓN CON LA IMPRESORA 🛑
                   Ejemplo de cómo debería verse:
                   
                   const printResponse = await fetch(`${tenantConfig.fiscalPrinterIP}/imprimirFactura`, { method: 'POST', body: tuTramaJson });
                   if (!printResponse.ok) throw new Error('La impresora no respondió. Verifica conexión y papel.');
                   const printData = await printResponse.json(); 
                ========================================================= */

                // 3. SI LA IMPRESORA TIENE ÉXITO: Cerramos el loading y guardamos en BD
                Swal.close();
                
                handleCreditProcess(); 

            } catch (error) {
                // 🛡️ EL ESCUDO SE ACTIVA: La impresora falló (sin papel, apagada, desconectada)
                // Atrapamos el error y NUNCA llamamos a handleCreditProcess(). La BD queda intacta.
                console.error("Error de Impresora Fiscal:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Falla de Hardware Fiscal',
                    text: 'No se pudo emitir la factura. Revise el papel, los cables de red o el spooler.',
                    confirmButtonColor: '#dc2626',
                    confirmButtonText: 'Entendido',
                    customClass: { popup: 'rounded-3xl' }
                });
                return; // ⛔ DETENEMOS EL FLUJO AQUÍ.
            }
        } 
        // Lógica para Facturación Electrónica (API SENIAT)
        else if (isFiscalInvoice && (currentMode === 'ELECTRONIC' || currentMode === 'ELECTRONIC_BILLING')) {
            console.log('[DISTRIBUIDOR] Enviando petición a API de Proveedor Autorizado (PACF) SENIAT...');
            // En el futuro, aquí también irá un try/catch cuando conectes la API del SENIAT
            handleCreditProcess();
        } 
        // Lógica para Forma Libre o Ticket Interno
        else {
            console.log('[DISTRIBUIDOR] Generando Factura en PDF Local / Forma Libre...');
            // Como las Formas Libres las genera la propia Base de Datos de manera segura (con el FOR UPDATE),
            // aquí SÍ guardamos directamente. Luego el Frontend generará el PDF local.
            handleCreditProcess();
        }
    };
    // === [FIN] DISTRIBUIDOR ===

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans">
            {/* Contenedor Principal Clean Premium (Hardware Accelerated) */}
            <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-scale-up border border-slate-100 flex flex-col max-h-[95vh] transform-gpu">
                
                {/* 🌟 HEADER LUMINOSO Y LIMPIO */}
                <div className="bg-gradient-to-b from-slate-50 to-white p-6 md:p-8 text-center relative shrink-0 border-b border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total a Cobrar ({IVA_RATE * 100}% IVA)</h3>
                    
                    {/* UX: Mostramos el Total Dinámico Limpio */}
                    <div className="flex flex-col items-center justify-center mb-2">
                        <p className="text-6xl font-black text-slate-800 tracking-tighter drop-shadow-sm">
                            <span className="text-2xl text-slate-400 font-bold mr-1 align-top relative top-2">Ref</span>
                            {currentTargetUSD.toFixed(2)}
                        </p>
                        <div className="mt-3 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
                            <p className="text-sm font-bold text-slate-600">
                                Bs {currentTargetVES.toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    {/* ACCIÓN RÁPIDA DE PAGO EXACTO */}
                    {!isNumpadOpen && remainingUSD > 0.05 && (
                        <div className="mt-5">
                            <Button
                                variant="primary"
                                onClick={() => handleExactPayment(paymentMethods[0].name)}
                                className="!bg-slate-800 hover:!bg-slate-900 !text-white text-xs !px-5 !py-2.5 !rounded-xl !shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
                            >
                                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                Pago Exacto: {paymentMethods[0].name}
                            </Button>
                        </div>
                    )}

                    {/* 💡 Desglose Fiscal Sutil */}
                    <div className='mt-5 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] text-slate-500'>
                        {subtotalExemptUSD > 0 && (
                            <div className="flex justify-between mb-1.5"><span className='font-medium'>Subtotal Exento</span><span className='font-bold text-slate-700'>Ref {subtotalExemptUSD.toFixed(2)}</span></div>
                        )}
                        <div className="flex justify-between mb-1.5"><span className='font-medium'>Base Imponible</span><span className='font-bold text-slate-700'>Ref {subtotalTaxableUSD.toFixed(2)}</span></div>
                        <div className="flex justify-between text-slate-600"><span className='font-medium'>Monto IVA ({IVA_RATE * 100}%)</span><span className='font-black text-slate-800'>Ref {ivaUSD.toFixed(2)}</span></div>
                        
                        {/* --- 🚨 LÍNEA DINÁMICA DE IGTF --- */}
                        {igtfGeneratedUSD > 0 && (
                            <div className="flex justify-between text-amber-600 mt-2 pt-2 border-t border-dashed border-slate-200 animate-fade-in">
                                <span className='font-bold'>IGTF ({tenantConfig.igtfRate * 100}% s/Divisas)</span>
                                <span className='font-black'>Ref {igtfGeneratedUSD.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 💳 ÁREA DE MÉTODOS DE PAGO (Scrollable & Fluido sin desenfoques) */}
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-white">

                    {/* --- 🚨 SWITCH FISCAL MODERNO (Tono Indigo Premium) --- */}
                    <div className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${isFiscalInvoice ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`} onClick={() => setIsFiscalInvoice(!isFiscalInvoice)}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                                <span className={`text-sm font-black flex items-center gap-2 ${isFiscalInvoice ? 'text-indigo-700' : 'text-slate-700'}`}>
                                    {isFiscalInvoice ? '📄 Factura Legal' : '🧾 Ticket Interno'}
                                </span>
                                <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-relaxed">
                                    {isFiscalInvoice ? currentFiscalConfig.desc : 'Uso interno. No consume correlativos fiscales.'}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                                {/* Toggle nativo estilo iOS Clean */}
                                <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${isFiscalInvoice ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${isFiscalInvoice ? 'left-6' : 'left-1'}`}></div>
                                </div>
                                
                                {/* Etiqueta dinámica */}
                                {isFiscalInvoice && (
                                    <span className="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-widest animate-fade-in border border-indigo-200">
                                        {currentFiscalConfig.tag}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* --- [FIN] SWITCH FISCAL --- */}

                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
                            Métodos de Pago
                        </p>

                        <div className="space-y-3">
                            {/* --- BLOQUEO DE EFECTIVO BS EN AVANCES --- */}
                            {paymentMethods.map(method => {
                                const hasCashAdvance = cart.some(item =>
                                    (item.name && item.name.toUpperCase().includes('AVANCE')) ||
                                    (item.id && item.id.toString().startsWith('ADV'))
                                );

                                const isBlocked = hasCashAdvance && method.name === 'Efectivo Bs';

                                if (isBlocked) {
                                    return (
                                        <div key={method.name} className="relative p-4 bg-slate-50 border border-slate-200 rounded-2xl opacity-75 cursor-not-allowed select-none">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-slate-500 text-sm">
                                                    {method.name}
                                                </span>
                                                <span className="text-[9px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-bold border border-rose-100">
                                                    🚫 BLOQUEADO
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                                                Avance en proceso
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <PaymentInput
                                        key={method.name}
                                        name={method.name}
                                        currency={method.currency}
                                        value={paymentShares[method.name] || '0.00'}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* 💰 RESULTADO CALCULADORA DUAL (Minimalista y Colores de Éxito) */}
                    <div className={`mt-6 p-5 rounded-2xl border transition-all duration-300 ${remainingUSD > 0.05 ? 'bg-rose-50/50 border-rose-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${remainingUSD > 0.05 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    {remainingUSD > 0.05 ? 'Falta por Cobrar' : 'Vuelto al Cliente'}
                                </span>
                                <span className={`font-black tracking-tight leading-none ${remainingUSD > 0.05 ? 'text-2xl text-rose-600' : 'text-3xl text-emerald-600'}`}>
                                    <span className="text-base mr-1 opacity-70">Ref</span>{Math.abs(remainingUSD).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex flex-col items-end text-right">
                                <span className={`text-[9px] font-medium uppercase tracking-wider mb-1 ${remainingUSD > 0.05 ? 'text-rose-400' : 'text-emerald-500'}`}>
                                    Equivalente
                                </span>
                                <span className={`text-sm font-bold ${remainingUSD > 0.05 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    Bs {Math.abs(remainingVES).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ⚡ FOOTER DE ACCIÓN (Limpio, claro y corporativo) */}
                <div className="p-5 md:p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3 shrink-0 rounded-b-[2rem]">
                    <Button
                        variant="ghost"
                        onClick={() => setIsPaymentModalOpen(false)}
                        className="w-1/3 !py-4 !bg-white border border-slate-200 !text-slate-600 hover:!bg-slate-50 text-xs font-bold uppercase tracking-wide rounded-xl transition-colors shadow-sm"
                    >
                        Cancelar
                    </Button>

                    <Button
                        variant="primary"
                        onClick={handleCreditProcess} 
                        disabled={isInsufficient && (parseFloat(paymentShares['Crédito']) || 0) === 0}
                        className={`w-2/3 !py-4 text-sm font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                            isInsufficient && (parseFloat(paymentShares['Crédito']) || 0) === 0
                                ? '!bg-slate-200 !text-slate-400 !shadow-none cursor-not-allowed'
                                : '!bg-slate-800 hover:!bg-slate-900 !text-white !shadow-lg shadow-slate-800/20 active:scale-95'
                        }`}
                    >
                        <span className="mr-2 opacity-80">
                            {(parseFloat(paymentShares['Crédito']) || 0) > 0 ? '📝' : '💰'}
                        </span>
                        {(parseFloat(paymentShares['Crédito']) || 0) > 0 ? 'Generar Crédito' : 'Procesar Pago'}
                    </Button>
                </div>
            </div>
        </div>
    );
};