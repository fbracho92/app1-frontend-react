import React, { useState, useMemo } from 'react';
import Button from '../components/ui/Button';

export const TableQRModal = ({ isOpen, onClose, tenantBrand }) => {
    // ESTADOS MULTI-NEGOCIO Y BANCARIOS
    const [locationType, setLocationType] = useState('MESA');
    const [identifier, setIdentifier] = useState('01');
    
    // Configuración Wi-Fi
    const [wifiSsid, setWifiSsid] = useState('MiLocal_WiFi');
    const [wifiPass, setWifiPass] = useState('12345678');
    const [wifiSecurity, setWifiSecurity] = useState('WPA');

    // Configuración Bancaria
    const [bankName, setBankName] = useState('Banco de Venezuela (0102)');
    const [bankPhone, setBankPhone] = useState('0412-1234567');
    const [bankRif, setBankRif] = useState('J-22270634-0');

    // 🚀 UX PRO: Optimizamos las URLs para evitar que el componente se congele al teclear
    const { qrMenuUrl, qrWifiUrl, locationLabel } = useMemo(() => {
        const catalogBaseUrl = window.location.origin;
        const encodedCompany = encodeURIComponent(tenantBrand?.companyName || '');
        const encodedRif = encodeURIComponent(tenantBrand?.companyDocument || '');
        
        // 🛡️ BLINDAJE MULTI-INQUILINO: Extraemos el ID real del usuario logueado o del tenantBrand
        const activeUser = JSON.parse(localStorage.getItem('bms_user') || '{}');
        const secureTenantId = activeUser.empresa_id || tenantBrand?.id || '1';

        const catalogUrl = `${catalogBaseUrl}/catalogo?tenant=${secureTenantId}&ubicacion=${locationType}_${identifier}&empresa=${encodedCompany}&rif=${encodedRif}`;
        const wifiString = `WIFI:S:${wifiSsid};T:${wifiSecurity};P:${wifiPass};;`;

        let label = 'UBICACIÓN ';
        if (locationType === 'MESA') label = 'MESA #';
        if (locationType === 'ESTACION') label = 'ESTACIÓN #';
        if (locationType === 'PASILLO') label = 'PASILLO / ZONA ';
        if (locationType === 'MOSTRADOR') label = 'MOSTRADOR ';
        if (locationType === 'CONSULTORIO') label = 'CONSULTORIO ';

        return {
            qrMenuUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(catalogUrl)}`,
            qrWifiUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(wifiString)}`,
            locationLabel: label
        };
    }, [tenantBrand, locationType, identifier, wifiSsid, wifiPass, wifiSecurity]);

    if (!isOpen) return null;

    // 🚀 BLINDAJE DE IMPRESIÓN: Garantizamos que las imágenes carguen ANTES de imprimir
    const handlePrintCards = () => {
        const printWindow = window.open('', '_blank');
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>QR Pro - ${locationType} ${identifier}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                    body { font-family: 'Inter', sans-serif; background: #fff; margin: 0; padding: 15px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .card { width: 380px; border: 2px solid #0f172a; border-radius: 24px; padding: 20px; text-align: center; background: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.05); page-break-after: always; box-sizing: border-box; }
                    .header { font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
                    .rif { font-size: 10px; color: #475569; font-weight: 700; margin-bottom: 12px; }
                    .location-badge { background: #0f172a; color: #fff; font-size: 18px; font-weight: 900; padding: 6px 14px; border-radius: 12px; display: inline-block; margin-bottom: 12px; text-transform: uppercase; }
                    
                    .qr-grid { display: flex; justify-content: space-around; gap: 10px; margin-bottom: 12px; }
                    .qr-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 8px; flex: 1; }
                    .qr-img { width: 110px; height: 110px; display: block; margin: 0 auto; }
                    .qr-title { font-size: 9px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-top: 4px; }
                    
                    .bank-box { background: #f1f5f9; border-radius: 12px; padding: 8px; font-size: 10px; color: #334155; text-align: left; margin-bottom: 10px; border-left: 4px solid #2563eb; }
                    .bank-title { font-weight: 800; color: #1e293b; margin-bottom: 2px; display: flex; justify-content: space-between; }
                    
                    .footer { font-size: 8px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px; font-weight: 600; }
                    @media print { body { padding: 0; } .card { border: 2px solid #000; box-shadow: none; } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">${tenantBrand?.companyName || 'CATÁLOGO DIGITAL'}</div>
                    <div class="rif">RIF: ${tenantBrand?.companyDocument || 'S/I'}</div>
                    
                    <div class="location-badge">${locationLabel}${identifier}</div>
                    
                    <div class="qr-grid">
                        <div class="qr-box">
                            <img src="${qrMenuUrl}" id="img-menu" class="qr-img" onload="checkImagesLoaded()" />
                            <div class="qr-title">📱 Ver Menú (Bs / Ref)</div>
                        </div>
                        <div class="qr-box">
                            <img src="${qrWifiUrl}" id="img-wifi" class="qr-img" onload="checkImagesLoaded()" />
                            <div class="qr-title">📶 Conectar Wi-Fi</div>
                        </div>
                    </div>

                    <div class="bank-box">
                        <div class="bank-title"><span>💳 PAGO MÓVIL / TRANSFERENCIA</span><span>Tasa BCV Activa</span></div>
                        <div><b>${bankName}</b></div>
                        <div>Tel: <b>${bankPhone}</b> | RIF: <b>${bankRif}</b></div>
                    </div>

                    <div class="footer">
                        Catálogo digital sincronizado diariamente con tasa oficial BCV. ¡Gracias por su compra!
                    </div>
                </div>
                
                <script>
                    let loadedCount = 0;
                    // Aseguramos que la ventana no imprima hasta que ambas imágenes estén listas
                    function checkImagesLoaded() {
                        loadedCount++;
                        if (loadedCount >= 2) {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 300);
                        }
                    }
                    // Respaldo de seguridad por si la API falla o tarda demasiado (3 segundos)
                    setTimeout(() => {
                        if (loadedCount < 2) {
                            window.print();
                            window.close();
                        }
                    }, 3000);
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onMouseDown={(e) => {
            // Permitimos que el click fuera del modal no lo cierre bruscamente, dando mejor UX
            if(e.target === e.currentTarget) onClose();
        }}>
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black flex items-center gap-2">
                            <span>✨</span> Generador Universal de QR (Multi-Negocio & Bancos)
                        </h3>
                        <p className="text-slate-400 text-xs mt-1">Ideal para mesas, farmacias, bodegones y mostradores.</p>
                    </div>
                    <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white rounded-full p-2 transition-colors outline-none focus:ring-2 focus:ring-blue-500">
                        ✕
                    </button>
                </div>

                {/* Contenido del Formulario */}
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div>
                            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Tipo de Establecimiento / Ubicación</label>
                            <select 
                                value={locationType} 
                                onChange={(e) => setLocationType(e.target.value)}
                                className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-bold text-sm text-slate-800 outline-none focus:border-blue-600 cursor-pointer transition-all"
                            >
                                <option value="MESA">🍽️ Restaurante / Cafetería (Mesa)</option>
                                <option value="ESTACION">💊 Farmacia / Pasillo (Estación)</option>
                                <option value="MOSTRADOR">🛒 Bodegón / Tienda (Mostrador)</option>
                                <option value="CONSULTORIO">🩺 Clínica / Servicio (Consultorio)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Número o Identificador</label>
                            <input 
                                type="text" 
                                value={identifier} 
                                onChange={(e) => setIdentifier(e.target.value)} 
                                className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-black text-lg text-slate-800 outline-none focus:border-blue-600 transition-all"
                                placeholder="Ej: 01, VIP, Pasillo-3"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                        <div>
                            <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">Banco Destino</label>
                            <input 
                                type="text" 
                                value={bankName} 
                                onChange={(e) => setBankName(e.target.value)} 
                                className="w-full bg-white border border-blue-200 rounded-xl p-2.5 font-bold text-xs text-slate-800 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">Teléfono Pago Móvil</label>
                            <input 
                                type="text" 
                                value={bankPhone} 
                                onChange={(e) => setBankPhone(e.target.value)} 
                                className="w-full bg-white border border-blue-200 rounded-xl p-2.5 font-bold text-xs text-slate-800 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-blue-900 uppercase tracking-wider mb-2">RIF / Cédula Pagos</label>
                            <input 
                                type="text" 
                                value={bankRif} 
                                onChange={(e) => setBankRif(e.target.value)} 
                                className="w-full bg-white border border-blue-200 rounded-xl p-2.5 font-bold text-xs text-slate-800 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Red Wi-Fi (SSID)</label>
                            <input 
                                type="text" 
                                value={wifiSsid} 
                                onChange={(e) => setWifiSsid(e.target.value)} 
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-800 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Contraseña Wi-Fi</label>
                            <input 
                                type="text" 
                                value={wifiPass} 
                                onChange={(e) => setWifiPass(e.target.value)} 
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-800 outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-center gap-6 justify-around">
                        <div className="text-center">
                            <p className="text-xs font-black text-slate-700 uppercase mb-2">QR Catálogo Digital</p>
                            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 inline-block min-h-[130px] min-w-[130px] flex items-center justify-center">
                                <img src={qrMenuUrl} alt="Cargando QR..." className="w-28 h-28" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-black text-slate-700 uppercase mb-2">QR Red Wi-Fi</p>
                            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 inline-block min-h-[130px] min-w-[130px] flex items-center justify-center">
                                <img src={qrWifiUrl} alt="Cargando QR..." className="w-28 h-28" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} className="!px-6 !py-3">Cerrar</Button>
                    <Button variant="primary" onClick={handlePrintCards} className="!bg-blue-600 hover:!bg-blue-700 !px-6 !py-3 shadow-lg shadow-blue-200 font-black">
                        🖨️ Imprimir Tarjeta Pro Universal
                    </Button>
                </div>
            </div>
        </div>
    );
};