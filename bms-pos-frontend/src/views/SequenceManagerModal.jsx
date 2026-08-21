// src/views/SequenceManagerModal.jsx
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { SystemService } from '../api/services';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { tenantConfig } from '../config/tenantConfig';
import { API_URL } from '../constants/appConstants';

export const SequenceManagerModal = ({ isOpen, onClose, setReceiptPreview }) => {
    // --- LECTURA SEGURA DEL USUARIO Y EMPRESA ACTUAL ---
    const storedUser = JSON.parse(localStorage.getItem('bms_user') || '{}');
    const currentUserId = storedUser.id || 1;
    const currentUser = storedUser.full_name || storedUser.username || "Admin Principal";
    const identity = storedUser.identity || {};
    const baseConfigFiscal = identity.configFiscal || {};

    const [activeTab, setActiveTab] = useState('COMPANY');

    const [tenantForm, setTenantForm] = useState({
        companyName: identity.companyName || '',
        tradeName: identity.tradeName || '',
        companyDocument: identity.companyDocument || '',
        companyPhone: identity.companyPhone || '',
        companyAddress: identity.companyAddress || '',
        logoUrl: identity.logoUrl || '',
        configFiscal: {
            invoiceMode: baseConfigFiscal.invoiceMode || 'FORMA_LIBRE',
            igtfRate: baseConfigFiscal.igtfRate || 0.03,
            taxName: baseConfigFiscal.taxName || 'IVA',
            defaultTaxRate: baseConfigFiscal.defaultTaxRate || 0.16,
        }
    });
    const [isSavingTenant, setIsSavingTenant] = useState(false);

    const [registers, setRegisters] = useState([]); 
    const [selectedRegId, setSelectedRegId] = useState(null); 
    
    const [sequences, setSequences] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ prefix: '', current_number: 0 });

    const [flConfig, setFlConfig] = useState({
        name: 'Cargando...',
        formaLibreSerie: 'SERIE - A',
        formaLibreMarginTop: 45
    });

    const activeLocalRegisterId = parseInt(localStorage.getItem('bms_active_register') ? JSON.parse(localStorage.getItem('bms_active_register')).id : '1', 10);

    const sanitizeInput = (str) => {
        if (!str) return '';
        return str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
    };

    useEffect(() => {
        if (isOpen) {
            initModule();
        } else {
            setEditingId(null);
            setActiveTab('COMPANY');
        }
    }, [isOpen]);
    
    const initModule = async () => {
        setIsLoading(true);
        try {
            const resRegs = await SystemService.getRegisters(); 
            const regs = resRegs.data || [];
            
            if (regs.length > 0) {
                setRegisters(regs);
                const initialReg = regs.find(r => r.id === activeLocalRegisterId) || regs[0];
                handleSelectRegister(initialReg); 
            }

            const resSeq = await SystemService.getSequences();
            setSequences(resSeq.data);

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo cargar el m\u00F3dulo de estaciones.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectRegister = (reg) => {
        setSelectedRegId(reg.id);
        setFlConfig({
            name: reg.name,
            formaLibreSerie: reg.serie,
            formaLibreMarginTop: reg.margin_top
        });
        setEditingId(null);
    };

    const formatAuditDate = (dateString) => {
        if (!dateString) return 'Nunca';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleTenantChange = (e) => {
        const { name, value } = e.target;
        setTenantForm(prev => ({ ...prev, [name]: value }));
    };

    const handleTenantConfigChange = (e) => {
        const { name, value } = e.target;
        setTenantForm(prev => ({
            ...prev,
            configFiscal: { ...prev.configFiscal, [name]: value }
        }));
    };

    // ?? FIX 1: URL BLINDADA Y MANEJO DE ERROR HTML (404/500)
    const handleSaveTenant = async () => {
        setIsSavingTenant(true);
        try {
            const token = localStorage.getItem('bms_token');
            const baseUrl = API_URL.replace(/\/api\/?$/, ''); // Limpia duplicados
            const endpoint = `${baseUrl}/api/system/tenant-settings`;

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(tenantForm)
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (err) {
                throw new Error('Error en el Servidor (Posible HTML 404). Contacte a soporte.');
            }

            if (!response.ok) throw new Error(result.error || 'Error al guardar');

            const updatedUser = { ...storedUser, identity: { ...storedUser.identity, ...tenantForm } };
            localStorage.setItem('bms_user', JSON.stringify(updatedUser));

            Swal.fire({
                icon: 'success',
                title: 'Guardado',
                text: 'Configuraci\u00F3n actualizada exitosamente. El sistema se reiniciar\u00E1.',
                confirmButtonColor: '#10b981',
                customClass: { popup: 'rounded-3xl' }
            }).then(() => {
                window.location.reload();
            });
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        } finally {
            setIsSavingTenant(false);
        }
    };

    // ?? FIX 2: PARÁMETROS COMPLETOS PARA EVITAR ERROR 400
    const handleUnlock = async (seq) => {
        const confirm = await Swal.fire({
            title: '\u00BFDesbloquear Correlativo?',
            text: 'Modificar este n\u00FAmero afectar\u00E1 el Libro de Ventas legal.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0F172A', 
            cancelButtonColor: '#E2E8F0',  
            confirmButtonText: 'S\u00ED, Autorizar Edici\u00F3n',
            cancelButtonText: '<span style="color:#475569">Cancelar</span>',
            customClass: { popup: 'rounded-3xl' }
        });

        if (confirm.isConfirmed) {
            try {
                await SystemService.updateSequence({ 
                    document_type: seq.document_type, 
                    prefix: seq.prefix || '', 
                    current_number: seq.current_number || 0,
                    is_locked: false,
                    modified_by: currentUser,
                    admin_user_id: currentUserId,
                    register_id: selectedRegId
                });
                
                setEditingId(seq.id);
                setEditForm({ prefix: seq.prefix || '', current_number: seq.current_number });
                
                const resSeq = await SystemService.getSequences();
                setSequences(resSeq.data);
            } catch (e) {
                Swal.fire('Error', 'No se pudo desbloquear el correlativo.', 'error');
            }
        }
    };

    const handleSaveAndLock = async (document_type) => {
        if (editForm.current_number < 0) {
            return Swal.fire('Atenci\u00F3n', 'El n\u00FAmero no puede ser negativo.', 'warning');
        }

        try {
            Swal.fire({ title: 'Asegurando Correlativo...', didOpen: () => Swal.showLoading(), allowOutsideClick: false, customClass: { popup: 'rounded-3xl' } });
            
            await SystemService.updateSequence({
                document_type,
                prefix: sanitizeInput(editForm.prefix),
                current_number: parseInt(editForm.current_number, 10),
                is_locked: true,
                modified_by: currentUser,
                admin_user_id: currentUserId,
                register_id: selectedRegId
            });

            Swal.fire({ icon: 'success', title: 'Blindado', text: `Correlativo actualizado de forma segura.`, timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
            setEditingId(null);
            
            const resSeq = await SystemService.getSequences();
            setSequences(resSeq.data);
        } catch (error) {
            Swal.fire('Error', 'No se pudo actualizar la secuencia.', 'error');
        }
    };

    const handleCancel = async (seq) => {
        setEditingId(null);
        await SystemService.updateSequence({ 
            document_type: seq.document_type, 
            prefix: seq.prefix || '', 
            current_number: seq.current_number || 0,
            is_locked: true,
            modified_by: currentUser,
            admin_user_id: currentUserId,
            register_id: selectedRegId 
        });
        
        const resSeq = await SystemService.getSequences();
        setSequences(resSeq.data);
    };

    const handlePrintTestPage = () => {
        const testHTML = `
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                    @page { size: 216mm 140mm; margin: 0; }
                    body { 
                        font-family: 'Courier Prime', monospace; 
                        padding-top: ${flConfig.formaLibreMarginTop}mm;
                        padding-left: 10mm;
                        text-transform: uppercase;
                        background: #fff;
                        color: #000;
                    }
                    .guide { border: 2px dashed #000; padding: 20px; text-align: center; margin-right: 15mm; }
                </style>
            </head>
            <body>
                <div class="guide">
                    <strong>--- PRUEBA DE CALCE T\u00C9CNICO: ${flConfig.name.toUpperCase()} ---</strong><br/><br/>
                    SERIE ASIGNADA: ${flConfig.formaLibreSerie}<br/>
                    MARGEN SUPERIOR ACTUAL: ${flConfig.formaLibreMarginTop}mm<br/>
                    <br/><br/>
                    ESTA L\u00CDNEA DEBE QUEDAR JUSTO DEBAJO<br/>
                    DEL MEMBRETE PRE-IMPRESO DEL SENIAT.<br/><br/>
                    SI EL TEXTO PISA EL MEMBRETE, AUMENTE EL MARGEN EN EL SISTEMA.
                </div>
            </body>
            </html>
        `;
        
        if (setReceiptPreview) {
            setReceiptPreview(testHTML);
            onClose(); 
        } else {
            const printWindow = window.open('', '', 'width=800,height=600');
            printWindow.document.write(testHTML);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        }
    };

    const handleSaveFlConfig = async () => {
        try {
            Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading(), allowOutsideClick: false, customClass: { popup: 'rounded-3xl' } });
            
            const sanitizedSerie = sanitizeInput(flConfig.formaLibreSerie);

            await SystemService.updateRegister(selectedRegId, { 
                serie: sanitizedSerie, 
                margin_top: parseInt(flConfig.formaLibreMarginTop, 10) 
            });
            
            if (selectedRegId === activeLocalRegisterId) {
                tenantConfig.formaLibreSerie = sanitizedSerie;
                tenantConfig.formaLibreMarginTop = parseInt(flConfig.formaLibreMarginTop, 10);
            }
            
            setRegisters(prev => prev.map(r => r.id === selectedRegId 
                ? { ...r, serie: sanitizedSerie, margin_top: parseInt(flConfig.formaLibreMarginTop, 10) } 
                : r
            ));

            Swal.fire({ icon: 'success', title: 'Guardado', text: 'Calibraci\u00F3n exitosa.', timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
        } catch (error) {
            Swal.fire('Error', 'No se pudo conectar con el servidor para guardar.', 'error');
        }
    };
    
    const handleAddRegister = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Nueva Estaci\u00F3n de Caja',
            html: `
                <div class="flex flex-col gap-4 text-left px-2">
                    <div>
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre de la Estaci\u00F3n</label>
                        <input id="swal-reg-name" class="swal2-input !m-0 !w-full !rounded-xl !bg-slate-50 border border-slate-200" placeholder="Ej: Caja Pasillo 2">
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Serie Fiscal (Providencia 0071)</label>
                        <input id="swal-reg-serie" class="swal2-input !m-0 !w-full !rounded-xl !bg-slate-50 border border-slate-200 uppercase" placeholder="Ej: SERIE - B">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Crear Estaci\u00F3n',
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'rounded-3xl', confirmButton: '!bg-slate-900 !rounded-xl', cancelButton: '!bg-slate-100 !text-slate-600 !rounded-xl' },
            preConfirm: () => {
                const name = document.getElementById('swal-reg-name').value;
                const serie = document.getElementById('swal-reg-serie').value;
                if (!name) Swal.showValidationMessage('El nombre es obligatorio');
                return { name, serie };
            }
        });

        if (formValues) {
            try {
                Swal.fire({ title: 'Creando Estaci\u00F3n...', didOpen: () => Swal.showLoading(), allowOutsideClick: false, customClass: { popup: 'rounded-3xl' } });
                
                const res = await SystemService.createRegister({ 
                    name: formValues.name.trim(), 
                    serie: sanitizeInput(formValues.serie) || 'SERIE - B', 
                    margin_top: 45,
                    admin_user_id: currentUserId,
                    admin_user_name: currentUser
                });
                
                Swal.fire({ icon: 'success', title: '\u00A1Estaci\u00F3n Creada!', text: 'Se generaron los correlativos.', timer: 2000, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
                
                await initModule(); 
                if (res && res.data && res.data.id) {
                    setActiveTab('REGISTERS');
                    setSelectedRegId(res.data.id);
                }
            } catch (error) {
                Swal.fire('Error', 'No se pudo crear la estaci\u00F3n.', 'error');
            }
        }
    };

    const activeSequences = sequences.filter(s => s.register_id === selectedRegId || !s.register_id);
    const inputClasses = "!rounded-xl !bg-slate-50 border-slate-200 focus:!ring-blue-100 focus:!border-blue-400 focus:!bg-white shadow-inner";

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 transition-opacity">
            <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] w-full max-w-6xl overflow-hidden shadow-2xl border border-white/20 flex flex-col md:flex-row h-[90vh] max-h-[90vh] animate-scale-up">
                
                {/* --- SIDEBAR DE NAVEGACIÓN MAESTRA --- */}
                <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 flex flex-col overflow-hidden shrink-0">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Centro de Control</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{'Configuraci\u00F3n SaaS'}</p>
                        </div>
                        <button onClick={onClose} className="md:hidden p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-500 text-slate-500 rounded-full transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-2">General</span>
                        
                        <button onClick={() => { setActiveTab('COMPANY'); setSelectedRegId(null); }} className={`p-4 rounded-2xl text-left transition-all font-bold text-sm flex items-center gap-3 ${activeTab === 'COMPANY' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}>
                            <span className="flex items-center justify-center bg-white/20 p-1.5 rounded-lg shadow-sm">
                                <svg className={`w-5 h-5 ${activeTab === 'COMPANY' ? 'text-white' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                            </span> 
                            Identidad y Fiscal
                        </button>

                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6 mb-1 px-2 flex justify-between items-center">
                            {'Estaciones F\u00EDsicas'}
                            <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-[9px]">{registers.length}</span>
                        </span>
                        
                        {isLoading ? (
                            <div className="flex justify-center py-5"><div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent"></div></div>
                        ) : (
                            registers.map(reg => (
                                <button key={reg.id} onClick={() => { setActiveTab('REGISTERS'); handleSelectRegister(reg); }} className={`p-4 rounded-2xl text-left transition-all border flex flex-col gap-1.5 ${activeTab === 'REGISTERS' && selectedRegId === reg.id ? 'bg-blue-50 border-blue-400 shadow-sm scale-[1.02] ring-1 ring-blue-100' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                                    <div className="flex items-center justify-between w-full">
                                        <span className={`font-black text-sm truncate ${activeTab === 'REGISTERS' && selectedRegId === reg.id ? 'text-blue-800' : 'text-slate-700'}`}>{reg.name}</span>
                                        <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">ID {reg.id}</span>
                                    </div>
                                    <div className="flex justify-between items-center w-full">
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase">{reg.serie}</span>
                                        <span className="text-[10px] font-medium text-slate-400">Calce: {reg.margin_top}mm</span>
                                    </div>
                                </button>
                            ))
                        )}
                        
                        <button onClick={handleAddRegister} className="mt-3 p-3.5 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs font-black uppercase hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group outline-none">
                            <svg className="w-4 h-4 group-hover:scale-125 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                            {'A\u00F1adir Estaci\u00F3n'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden bg-white/40">
                    <div className="hidden md:flex justify-end p-4 shrink-0">
                        <button onClick={onClose} className="p-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-all shadow-sm border border-slate-100 outline-none">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 md:pt-0">
                        
                        {activeTab === 'COMPANY' && (
                            <div className="max-w-4xl mx-auto animate-fade-in flex flex-col gap-6 h-full pb-10">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Identidad Corporativa</h2>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Ajustes globales para {tenantForm.tradeName || 'tu negocio'}</p>
                                    </div>
                                    <Button variant="primary" onClick={handleSaveTenant} disabled={isSavingTenant} className="!bg-slate-900 hover:!bg-black text-white shadow-xl flex-1 md:flex-none text-xs uppercase tracking-widest font-black border-0 !py-3.5 !px-6 !rounded-xl">
                                        {isSavingTenant ? (
                                            'Guardando...'
                                        ) : (
                                            <div className="flex items-center justify-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                                <span>Guardar Cambios</span>
                                            </div>
                                        )}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                                        <div className="flex justify-between items-start mb-5">
                                            <h3 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Datos Empresariales
                                            </h3>
                                        </div>
                                        
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex gap-3 items-center">
                                            <span className="flex items-center justify-center p-2 bg-blue-100 rounded-full">
                                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                                            </span>
                                            <p className="text-[9px] text-blue-800 font-medium leading-relaxed">
                                                Por normativas del <b>SENIAT (Prov. 0071)</b>, el RIF y la {'Raz\u00F3n Social'} est&aacute;n bloqueados. Si requiere una modificaci&oacute;n, contacte a soporte.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <Input 
                                                label={'Raz\u00F3n Social Legal'} 
                                                name="companyName" 
                                                value={tenantForm.companyName} 
                                                disabled={true} 
                                                className="!bg-slate-50 opacity-70 cursor-not-allowed border-slate-200 shadow-none" 
                                            />
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input 
                                                    label="Nombre Comercial" 
                                                    name="tradeName" 
                                                    value={tenantForm.tradeName} 
                                                    onChange={handleTenantChange} 
                                                    className={inputClasses} 
                                                />
                                                <Input 
                                                    label={'C\u00E9dula / RIF'} 
                                                    name="companyDocument" 
                                                    value={tenantForm.companyDocument} 
                                                    disabled={true}
                                                    className="!bg-slate-50 opacity-70 cursor-not-allowed border-slate-200 shadow-none [&_input]:!font-mono [&_input]:!uppercase" 
                                                />
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input 
                                                    label={'Tel\u00E9fono'} 
                                                    name="companyPhone" 
                                                    value={tenantForm.companyPhone} 
                                                    onChange={handleTenantChange} 
                                                    className={inputClasses} 
                                                />
                                                <Input 
                                                    label="URL del Logo (Imgur)" 
                                                    name="logoUrl" 
                                                    placeholder="https://..." 
                                                    value={tenantForm.logoUrl} 
                                                    onChange={handleTenantChange} 
                                                    className={inputClasses} 
                                                />
                                            </div>
                                            <Input 
                                                label={'Direcci\u00F3n Fiscal Completa'} 
                                                name="companyAddress" 
                                                value={tenantForm.companyAddress} 
                                                onChange={handleTenantChange} 
                                                className={inputClasses} 
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                                        <h3 className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-5 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Normativas y Fiscalidad
                                        </h3>
                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 pl-1">Modalidad Base del Sistema</label>
                                                <select name="invoiceMode" value={tenantForm.configFiscal.invoiceMode} onChange={handleTenantConfigChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-100 focus:bg-white shadow-inner transition-all cursor-pointer">
                                                    <option value="FORMA_LIBRE">Forma Libre (Impresora Normal)</option>
                                                    <option value="FISCAL_PRINTER">{'M\u00E1quina Fiscal (Impresora Serial)'}</option>
                                                    <option value="ELECTRONIC">{'Facturaci\u00F3n Electr\u00F3nica (SENIAT)'}</option>
                                                </select>
                                                <p className="text-[9px] text-slate-400 mt-2 italic">* Define c&oacute;mo se comporta el check de factura en el POS.</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 pl-1">Impuesto Principal</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="text" name="taxName" value={tenantForm.configFiscal.taxName} onChange={handleTenantConfigChange} className="w-1/2 bg-slate-50 border border-slate-200 shadow-inner rounded-xl p-3 text-sm font-bold text-slate-700 outline-none text-center focus:bg-white focus:border-rose-300" />
                                                        <input type="number" step="0.01" name="defaultTaxRate" value={tenantForm.configFiscal.defaultTaxRate} onChange={handleTenantConfigChange} className="w-1/2 bg-slate-50 border border-slate-200 shadow-inner rounded-xl p-3 text-sm font-bold text-slate-700 outline-none text-center focus:bg-white focus:border-rose-300" />
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider text-center">Ej: IVA | 0.16 (16%)</p>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 pl-1">Impuesto IGTF</label>
                                                    <input type="number" step="0.01" name="igtfRate" value={tenantForm.configFiscal.igtfRate} onChange={handleTenantConfigChange} className="w-full bg-slate-50 border border-slate-200 shadow-inner rounded-xl p-3 text-sm font-bold text-slate-700 outline-none text-center focus:bg-white focus:border-rose-300" />
                                                    <p className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider text-center">Ej: 0.03 (3%)</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'REGISTERS' && (
                            <div className="flex flex-col gap-6 max-w-4xl mx-auto animate-fade-in pb-10">
                                
                                <div className="flex flex-col gap-4">
                                    <h3 className="font-bold text-slate-400 text-[11px] uppercase tracking-widest mb-2 border-b border-slate-200 pb-2">
                                        Correlativos Activos - <span className="text-blue-600">{flConfig.name}</span>
                                    </h3>
                                    
                                    {activeSequences.length === 0 ? (
                                        <div className="bg-white rounded-[1.5rem] p-10 text-center border border-slate-200 shadow-sm">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                            </div>
                                            <h3 className="font-bold text-slate-800 text-lg">Sin Correlativos Visibles</h3>
                                            <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">Esta estaci&oacute;n no tiene secuencias registradas.</p>
                                        </div>
                                    ) : (
                                        activeSequences.map((seq) => (
                                            <div key={seq.id} className={`group relative p-6 rounded-[1.5rem] border transition-all duration-300 ${!seq.is_locked ? 'bg-blue-50/40 border-blue-200 shadow-xl shadow-blue-900/5' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}>
                                                
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${seq.is_locked ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600 animate-pulse'}`}>
                                                            {seq.is_locked ? (
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                                            ) : (
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                                                            )}
                                                        </div>
                                                        <h3 className="font-bold text-slate-800 text-lg uppercase tracking-widest">{seq.document_type.replace('_', ' ')}</h3>
                                                    </div>
                                                    
                                                    <div className="flex flex-col sm:items-end text-left sm:text-right bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                            Rastro de Auditor&iacute;a
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-500">
                                                            {formatAuditDate(seq.updated_at)} &bull; <strong className="text-slate-700">{seq.last_modified_by}</strong>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col md:flex-row items-end gap-4">
                                                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-[1.25rem] border border-slate-100/80">
                                                        <div className="col-span-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Prefijo (Control)</span>
                                                            {!seq.is_locked ? (
                                                                <Input value={editForm.prefix} onChange={(e) => setEditForm({...editForm, prefix: e.target.value})} placeholder="Ej: 00-" className="mt-1 font-mono text-center uppercase !rounded-xl !bg-white focus:!border-blue-300 shadow-sm" />
                                                            ) : (
                                                                <div className="mt-1 font-mono text-sm bg-white/60 border border-slate-200 px-4 py-3 rounded-xl text-slate-500 flex items-center h-[42px]">{seq.prefix || 'N/A'}</div>
                                                            )}
                                                        </div>
                                                        <div className="col-span-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{'Pr\u00F3xima Factura'}</span>
                                                            {!seq.is_locked ? (
                                                                <Input type="number" min="0" value={editForm.current_number} onChange={(e) => setEditForm({...editForm, current_number: e.target.value})} className="mt-1 font-mono text-xl font-bold text-blue-700 text-center !rounded-xl !bg-white shadow-sm focus:!border-blue-300" />
                                                            ) : (
                                                                <div className="mt-1 font-mono text-xl bg-white/60 border border-slate-200 px-4 py-2 rounded-xl text-slate-800 font-bold tracking-widest flex items-center h-[42px]">
                                                                    {seq.current_number.toString().padStart(8, '0')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="w-full md:w-auto flex justify-end">
                                                        {!seq.is_locked ? (
                                                            <div className="flex gap-3 w-full md:w-auto">
                                                                <Button variant="cancel" onClick={() => handleCancel(seq)} className="w-full md:w-auto text-xs tracking-wider px-6 !rounded-xl">Cancelar</Button>
                                                                <Button variant="primary" onClick={() => handleSaveAndLock(seq.document_type)} className="w-full md:w-auto text-xs tracking-wider px-6 !rounded-xl !bg-slate-800 hover:!bg-slate-900 border-0">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                                                    Asegurar
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button variant="secondary" onClick={() => handleUnlock(seq)} className="w-full md:w-auto text-xs tracking-wider px-6 !rounded-xl bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                                                                Modificar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <hr className="border-slate-100 my-2" />

                                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -z-10"></div>
                                    
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm">{'Calibraci\u00F3n T\u00E9cnica'}</h3>
                                                <p className="text-xs text-slate-400">Ajustes de Forma Libre para: <strong className="text-slate-600">{flConfig.name}</strong></p>
                                            </div>
                                        </div>
                                        <Button variant="primary" onClick={handleSaveFlConfig} className="text-[11px] tracking-widest px-5 py-2.5 !rounded-xl">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                            Guardar Ajustes
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                {'Serie de esta estaci\u00F3n'}
                                            </label>
                                            <Input 
                                                type="text"
                                                placeholder="Ej: SERIE - A"
                                                className="w-full bg-slate-50 border border-slate-200 !rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all uppercase"
                                                value={flConfig.formaLibreSerie}
                                                onChange={(e) => setFlConfig({...flConfig, formaLibreSerie: e.target.value.toUpperCase()})}
                                            />
                                            <p className="text-[9px] text-slate-400 italic">
                                                * El SENIAT exige una serie distinta por cada caja.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                Salto de Membrete (Margen mm)
                                            </label>
                                            <div className="relative">
                                                <Input 
                                                    type="number"
                                                    min="0"
                                                    className="w-full bg-slate-50 border border-slate-200 !rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                                    value={flConfig.formaLibreMarginTop}
                                                    onChange={(e) => setFlConfig({...flConfig, formaLibreMarginTop: e.target.value})}
                                                />
                                                <span className="absolute right-4 top-3.5 text-[9px] font-bold text-slate-400">MM</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                                        <div className="flex gap-3 items-center">
                                            <div className="text-amber-500 shrink-0 bg-white p-2 rounded-full shadow-sm">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            </div>
                                            <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                                                <strong>Sugerencia de Ahorro:</strong> Realice las pruebas de calce con papel bond blanco cortado a media carta antes de usar sus Formas Libres originales.
                                            </p>
                                        </div>
                                        
                                        <Button 
                                            variant="warning" 
                                            onClick={handlePrintTestPage}
                                            className="w-full md:w-auto text-[10px] font-black uppercase tracking-widest whitespace-nowrap px-6 py-3 !rounded-xl"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            {'Imprimir Hoja de Gu\u00EDa'}
                                        </Button>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};