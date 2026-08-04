// src/views/SaasMasterView.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { SaasService } from '../api/services';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // 🚨 CORRECCIÓN: Importación activa del motor de tablas

// 🛡️ REGLAS DE VALIDACIÓN (REGEX BLINDADO)
const REGEX = {
    rif: /^[JGVEPC]-\d{7,9}-\d?$/i, 
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    username: /^[a-z0-9_]{4,15}$/, 
    phone: /^[\d\+\-\s\(\)]{10,20}$/
};

// 🚨 COMPONENTE EXTRAÍDO: Input Validado y Estable
const ValidatedInput = ({ label, name, type = "text", placeholder, value, onChange, error, customClass = "" }) => (
    <div className="flex flex-col relative w-full pb-4">
        <Input 
            label={label} 
            type={type} 
            name={name} 
            placeholder={placeholder} 
            value={value || ''} 
            onChange={onChange}
            className={`w-full !rounded-xl shadow-sm ${customClass} ${error ? '!border-rose-400 !bg-rose-50 focus:!ring-rose-200' : 'focus:!ring-blue-100'}`}
        />
        {error && (
            <span className="text-[10px] font-bold text-rose-500 absolute bottom-0 left-1 animate-fade-in flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
            </span>
        )}
    </div>
);

export const SaasMasterView = () => {
    // 🚨 ESTADO GLOBAL DE TABS ('TENANTS' | 'BILLING' | 'REPORTS')
    const [activeTab, setActiveTab] = useState('TENANTS'); 

    // ESTADOS INQUILINOS
    const [tenants, setTenants] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // 🎨 ESTADOS DEL WIZARD
    const [step, setStep] = useState(1);
    const [errors, setErrors] = useState({});

    // ESTADOS FACTURACIÓN
    const [invoices, setInvoices] = useState([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [paymentData, setPaymentData] = useState({ payment_method: '', reference_number: '', amount_paid_usd: 0, notes: '' });

    // 🚨 CAMPOS FISCALES AÑADIDOS AL ESTADO INICIAL
    const initialFormState = {
        id: null,
        nombre_empresa: '', rif: '', telefono: '', direccion: '', 
        admin_username: '', admin_password: '', admin_email: '', meses_licencia: 1,
        logo_url: '', 
        invoiceMode: 'FORMA_LIBRE', 
        receiptFooterMessage: 'Gracias por su preferencia',
        printerPaperSize: '80mm',
        isSpecialTaxpayer: false,
        taxName: 'IVA',
        defaultTaxRate: 16,
        planPrice: 30, // Precio Editable
        cryptoSpread: 15 // Margen de Cobertura BCV vs Paralelo/USDT
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (activeTab === 'TENANTS') fetchTenants();
        if (activeTab === 'BILLING' || activeTab === 'REPORTS') {
            fetchInvoices();
            if(tenants.length === 0) fetchTenants(); 
        }
    }, [activeTab]);

    const fetchTenants = async () => {
        setIsLoading(true);
        try {
            const res = await SaasService.getAllTenants();
            setTenants(res.data);
            setIsLoading(false);
        } catch (error) {
            Swal.fire('Error', 'No se pudo cargar la matriz de clientes', 'error');
            setIsLoading(false);
        }
    };

    const fetchInvoices = async () => {
        setIsLoadingInvoices(true);
        try {
            const res = await SaasService.getAllInvoices();
            setInvoices(res.data);
        } catch (error) {
            Swal.fire('Error', 'No se pudieron cargar las facturas', 'error');
        } finally {
            setIsLoadingInvoices(false);
        }
    };

    // ==========================================
    // 📊 LÓGICA Y CÁLCULO DE REPORTES / KPIs
    // ==========================================
    const totalActiveTenants = tenants.filter(t => t.estatus_licencia === 'ACTIVO').length;
    const estimatedMRR = tenants.reduce((acc, curr) => {
        const config = typeof curr.config_fiscal === 'string' ? JSON.parse(curr.config_fiscal) : (curr.config_fiscal || {});
        return acc + Number(config.planPrice || 30);
    }, 0);
    const pendingCollectionUSD = invoices.filter(i => i.status === 'PENDIENTE').reduce((acc, curr) => acc + Number(curr.amount_usd), 0);
    const collectedUSD = invoices.filter(i => i.status === 'PAGADA').reduce((acc, curr) => acc + Number(curr.amount_usd), 0);
    
    const getDaysRemaining = (dateString) => Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24));
    
    const tenantsExpiringSoon = tenants.filter(t => {
        const days = getDaysRemaining(t.licencia_expira_el);
        return days <= 7 && days >= 0 && t.estatus_licencia === 'ACTIVO';
    }).sort((a, b) => getDaysRemaining(a.licencia_expira_el) - getDaysRemaining(b.licencia_expira_el));

    const formatStats = { formaLibre: 0, fiscal: 0, electronica: 0 };
    tenants.forEach(t => {
        const config = typeof t.config_fiscal === 'string' ? JSON.parse(t.config_fiscal) : (t.config_fiscal || {});
        if(config.invoiceMode === 'FORMA_LIBRE' || !config.invoiceMode) formatStats.formaLibre++;
        if(config.invoiceMode === 'FISCAL_PRINTER') formatStats.fiscal++;
        if(config.invoiceMode === 'ELECTRONIC') formatStats.electronica++;
    });

    // 📥 FUNCIÓN DE EXPORTACIÓN PDF CORPORATIVO
    const handleDownloadReport = () => {
        const doc = new jsPDF();
        const fecha = new Date().toLocaleDateString('es-VE');

        // 1. Encabezado Corporativo
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("BMS Digital", 14, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text("Reporte Gerencial SaaS y Estado de Red", 14, 28);
        doc.text(`Fecha de Emisión: ${fecha}`, 150, 28);

        // 2. Resumen Financiero (KPIs)
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Resumen Ejecutivo", 14, 55);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Inquilinos Activos: ${totalActiveTenants} / ${tenants.length}`, 14, 65);
        doc.text(`Proyección MRR (Ingreso Mensual): $${estimatedMRR.toFixed(2)} USD`, 14, 72);
        doc.text(`Capital Recaudado: $${collectedUSD.toFixed(2)} USD`, 14, 79);
        
        doc.setTextColor(220, 38, 38); // Rojo Riesgo
        doc.text(`Cobranza Pendiente: $${pendingCollectionUSD.toFixed(2)} USD`, 14, 86);

        // 3. Tabla de Inquilinos
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Matriz de Clientes", 14, 105);

        const tenantRows = tenants.map(t => {
            const config = typeof t.config_fiscal === 'string' ? JSON.parse(t.config_fiscal) : (t.config_fiscal || {});
            return [
                `#${t.id}`, 
                t.nombre, 
                t.rif, 
                `$${config.planPrice || 30}`,
                new Date(t.licencia_expira_el).toLocaleDateString(),
                t.estatus_licencia
            ];
        });

        // 🚨 CORRECCIÓN DE SINTAXIS PARA jspdf-autotable
        autoTable(doc, {
            startY: 110,
            head: [['ID', 'Empresa', 'RIF', 'Plan', 'Vencimiento', 'Estatus']],
            body: tenantRows,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], fontSize: 9 }, // blue-600
            styles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [248, 250, 252] } // slate-50
        });

        // 4. Tabla de Facturación y Cobranza
        let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : 150;
        if (finalY > 250) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Estado de Facturación", 14, finalY);

        const invoiceRows = invoices.map(i => [
            i.control_number,
            i.empresa,
            `$${Number(i.amount_usd).toFixed(2)}`,
            `Bs ${Number(i.amount_ves).toFixed(2)}`,
            new Date(i.due_date).toLocaleDateString(),
            i.status
        ]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['N° Control', 'Cliente', 'Monto USD', 'Monto VES', 'Fecha Límite', 'Estatus']],
            body: invoiceRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], fontSize: 9 }, // slate-900
            styles: { fontSize: 8 },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) {
                    if (data.cell.raw === 'PENDIENTE') {
                        data.cell.styles.textColor = [217, 119, 6]; // amber-600
                        data.cell.styles.fontStyle = 'bold';
                    } else if (data.cell.raw === 'PAGADA') {
                        data.cell.styles.textColor = [5, 150, 105]; // emerald-600
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // Guardar el documento
        doc.save(`BMS_Reporte_SaaS_${fecha.replace(/\//g, '-')}.pdf`);
        Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Reporte PDF Generado', showConfirmButton: false, timer: 3000 });
    };

    // 🛡️ MOTOR DE VALIDACIÓN
    const validateField = (name, value) => {
        let error = null;
        switch (name) {
            case 'nombre_empresa': if (value.length < 3) error = 'Mínimo 3 caracteres'; break;
            case 'rif': if (!REGEX.rif.test(value)) error = 'Formato inválido (Ej: J-12345678-9)'; break;
            case 'telefono': if (value && !REGEX.phone.test(value)) error = 'Teléfono inválido'; break;
            case 'admin_username': if (!formData.id && !REGEX.username.test(value)) error = 'Mín. 4 letras/números, sin espacios'; break;
            case 'admin_password': if (!formData.id && value.length < 6) error = 'La clave debe tener mínimo 6 caracteres'; break;
            case 'admin_email': if (!formData.id && !REGEX.email.test(value)) error = 'Correo electrónico inválido'; break;
            case 'meses_licencia': if (!formData.id && value < 1) error = 'Mínimo 1 mes'; break;
            case 'defaultTaxRate': if (value < 0 || value > 100) error = 'Porcentaje inválido'; break;
            case 'planPrice': if (value < 1) error = 'Monto inválido'; break;
            case 'cryptoSpread': if (value < 0 || value > 100) error = 'Porcentaje inválido'; break;
            default: break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return error === null;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let finalValue = value;
        if (name === 'rif') finalValue = value.toUpperCase();
        if (name === 'admin_username' || name === 'admin_email') finalValue = value.toLowerCase().replace(/\s/g, '');
        setFormData(prev => ({ ...prev, [name]: finalValue }));
        if (finalValue.length > 0) validateField(name, finalValue);
        else setErrors(prev => ({ ...prev, [name]: null }));
    };

    const validateStep = (currentStep) => {
        let isValid = true;
        const currentErrors = {};
        if (currentStep === 1) {
            if (!formData.nombre_empresa) { currentErrors.nombre_empresa = 'Requerido'; isValid = false; }
            if (!formData.rif || !REGEX.rif.test(formData.rif)) { currentErrors.rif = 'Formato inválido'; isValid = false; }
        } else if (currentStep === 2 && !formData.id) {
            if (!formData.admin_username || !REGEX.username.test(formData.admin_username)) { currentErrors.admin_username = 'Inválido'; isValid = false; }
            if (!formData.admin_password || formData.admin_password.length < 6) { currentErrors.admin_password = 'Clave muy corta'; isValid = false; }
            if (!formData.admin_email || !REGEX.email.test(formData.admin_email)) { currentErrors.admin_email = 'Correo inválido'; isValid = false; }
        } else if (currentStep === 3) {
            if (formData.defaultTaxRate < 0 || formData.defaultTaxRate > 100) { currentErrors.defaultTaxRate = 'Tasa inválida'; isValid = false; }
            if (formData.planPrice < 1) { currentErrors.planPrice = 'Inválido'; isValid = false; }
            if (formData.cryptoSpread < 0 || formData.cryptoSpread > 100) { currentErrors.cryptoSpread = 'Inválido'; isValid = false; }
        }
        setErrors(currentErrors);
        return isValid;
    };

    const handleNext = () => { if (validateStep(step)) { if (formData.id && step === 1) setStep(3); else setStep(prev => prev + 1); } };
    const handlePrev = () => { if (formData.id && step === 3) setStep(1); else setStep(prev => prev - 1); };

    // 🚨 ACCIÓN UNIFICADA: Crear o Editar
    const handleSave = async (e) => {
        e.preventDefault();
        if (!validateStep(3)) return; 

        try {
            Swal.fire({ title: formData.id ? 'Guardando Cambios...' : 'Aprovisionando...', text: 'Actualizando base de datos.', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            const payload = {
                ...formData,
                config_fiscal: {
                    invoiceMode: formData.invoiceMode,
                    receiptFooterMessage: formData.receiptFooterMessage,
                    printerPaperSize: formData.printerPaperSize,
                    isSpecialTaxpayer: formData.isSpecialTaxpayer,
                    taxName: formData.taxName,
                    defaultTaxRate: parseFloat(formData.defaultTaxRate) / 100, 
                    igtfRate: 0.03,
                    planPrice: parseFloat(formData.planPrice),
                    cryptoSpread: parseFloat(formData.cryptoSpread)
                }
            };

            if (formData.id) {
                await SaasService.updateTenant(formData.id, payload);
                Swal.fire({ icon: 'success', title: '¡Actualizado!', text: 'Datos guardados con éxito.', confirmButtonColor: '#10b981', customClass: { popup: 'rounded-3xl' }});
            } else {
                await SaasService.createTenant(payload);
                Swal.fire({ icon: 'success', title: '¡Aprovisionamiento Exitoso!', text: 'Cliente en línea.', confirmButtonColor: '#10b981', customClass: { popup: 'rounded-3xl' }});
            }

            setIsFormOpen(false);
            setStep(1);
            setFormData(initialFormState);
            setErrors({});
            await fetchTenants();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.error || 'Error al procesar la solicitud', 'error');
        }
    };

    const openEditModal = (tenant) => {
        const config = typeof tenant.config_fiscal === 'string' ? JSON.parse(tenant.config_fiscal) : (tenant.config_fiscal || {});
        
        setFormData({
            ...initialFormState,
            id: tenant.id,
            nombre_empresa: tenant.nombre || '',
            rif: tenant.rif || '',
            telefono: tenant.telefono || '',
            direccion: tenant.direccion || '',
            logo_url: tenant.logo_url || '',
            invoiceMode: config.invoiceMode || 'FORMA_LIBRE',
            receiptFooterMessage: config.receiptFooterMessage || 'Gracias por su preferencia',
            printerPaperSize: config.printerPaperSize || '80mm',
            isSpecialTaxpayer: config.isSpecialTaxpayer || false,
            taxName: config.taxName || 'IVA',
            defaultTaxRate: (config.defaultTaxRate || 0.16) * 100,
            planPrice: config.planPrice || 30,
            cryptoSpread: config.cryptoSpread !== undefined ? config.cryptoSpread : 15
        });
        
        setErrors({});
        setStep(1);
        setIsFormOpen(true);
    };

    // 🚨 RENOVACIÓN MEJORADA (UX PRO)
    const handleRenew = async (tenant) => { 
        const { value: meses, isConfirmed } = await Swal.fire({ 
            html: `
                <div class="flex flex-col gap-3 text-left mt-2">
                    <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                        <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-blue-500 uppercase tracking-widest">Renovar Licencia de</p>
                            <p class="font-bold text-slate-800 leading-tight">${tenant.nombre}</p>
                        </div>
                    </div>
                    <div class="mt-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Meses a sumar</label>
                        <input id="swal-input-meses" type="number" min="1" value="1" class="w-full p-4 rounded-xl border border-slate-300 text-xl font-black text-center text-slate-800 outline-none focus:ring-2 focus:ring-blue-400 shadow-sm" />
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Aprobar Renovación',
            cancelButtonText: 'Cancelar',
            buttonsStyling: false,
            customClass: { 
                popup: '!rounded-[2rem] !p-6', 
                confirmButton: '!bg-blue-600 hover:!bg-blue-700 !text-white !rounded-xl !font-black !uppercase !tracking-widest !text-xs !px-6 !py-3 w-1/2 mx-2 shadow-lg shadow-blue-500/30 transition-all', 
                cancelButton: '!bg-slate-100 hover:!bg-slate-200 !text-slate-600 !rounded-xl !font-black !uppercase !tracking-widest !text-xs !px-6 !py-3 w-1/2 mx-2 transition-all',
                actions: 'w-full flex justify-between mt-4'
            },
            preConfirm: () => {
                const val = document.getElementById('swal-input-meses').value;
                if (!val || val <= 0) { Swal.showValidationMessage('Ingrese una cantidad mayor a 0'); return false; }
                return val;
            }
        });

        if (isConfirmed && meses) {
            try {
                Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
                await SaasService.renewLicense(tenant.id, { meses_adicionales: meses });
                await fetchTenants();
                Swal.fire('¡Renovado!', 'Licencia extendida con éxito.', 'success');
            } catch (error) { Swal.fire('Error', 'No se pudo renovar la licencia.', 'error'); }
        }
    };

    // 🚨 KILL-SWITCH MEJORADO (UX PRO)
    const handleToggleSuspension = async (tenant) => { 
        const isSuspended = tenant.estatus_licencia === 'BLOQUEADO_MANUAL';
        
        const iconBg = isSuspended ? 'bg-emerald-50' : 'bg-rose-50';
        const iconText = isSuspended ? 'text-emerald-500' : 'text-rose-500';
        const iconBorder = isSuspended ? 'border-emerald-100' : 'border-rose-100';
        const btnClass = isSuspended ? '!bg-emerald-500 hover:!bg-emerald-600 shadow-emerald-500/30' : '!bg-rose-500 hover:!bg-rose-600 shadow-rose-500/30';
        const iconPath = isSuspended ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636';
        const titleText = isSuspended ? '¿Reactivar Acceso?' : '¿Suspender Inquilino?';
        const descText = isSuspended 
            ? 'El personal volverá a tener acceso completo e inmediato a sus terminales de venta.'
            : 'Se cortará el acceso al sistema inmediatamente para todo el personal de esta empresa (Cajeros, Supervisores y Gerentes).';

        const confirm = await Swal.fire({
            html: `
                <div class="flex flex-col items-center gap-4 mt-2">
                    <div class="w-20 h-20 ${iconBg} ${iconText} rounded-full flex items-center justify-center mb-2 animate-pulse border-4 ${iconBorder}">
                        <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" /></svg>
                    </div>
                    <h3 class="text-2xl font-black text-slate-800">${titleText}</h3>
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full text-left">
                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Empresa Afectada</p>
                        <p class="font-bold text-slate-800">${tenant.nombre}</p>
                        <div class="mt-3 pt-3 border-t border-slate-200">
                            <p class="text-xs font-medium text-slate-600 leading-relaxed">${descText}</p>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: isSuspended ? 'Sí, Reactivar' : 'Sí, Suspender',
            cancelButtonText: 'Cancelar',
            buttonsStyling: false,
            customClass: { 
                popup: '!rounded-[2rem] !p-6', 
                confirmButton: `${btnClass} !text-white !rounded-xl !font-black !uppercase !tracking-widest !text-xs !px-6 !py-3 w-1/2 mx-2 shadow-lg transition-all`, 
                cancelButton: '!bg-slate-100 hover:!bg-slate-200 !text-slate-600 !rounded-xl !font-black !uppercase !tracking-widest !text-xs !px-6 !py-3 w-1/2 mx-2 transition-all',
                actions: 'w-full flex justify-between mt-4'
            }
        });

        if (confirm.isConfirmed) {
            try {
                Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
                await SaasService.toggleSuspension(tenant.id, !isSuspended);
                await fetchTenants();
                Swal.fire('¡Éxito!', `Empresa ${isSuspended ? 'reactivada' : 'suspendida'}.`, 'success');
            } catch (error) { Swal.fire('Error', 'Acción denegada.', 'error'); }
        }
    };

    const openPaymentModal = (invoice) => {
        setSelectedInvoice(invoice);
        setPaymentData({ payment_method: '', reference_number: '', amount_paid_usd: invoice.amount_usd, notes: '' });
        setIsPaymentModalOpen(true);
    };

    const handleRegisterPayment = async (e) => {
        e.preventDefault();
        try {
            Swal.fire({ title: 'Registrando Pago...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            await SaasService.registerPayment(selectedInvoice.id, paymentData);
            setIsPaymentModalOpen(false);
            Swal.fire({ icon: 'success', title: '¡Cobro Exitoso!', text: 'Factura liquidada y licencia extendida.', confirmButtonColor: '#10b981', customClass: { popup: 'rounded-3xl' }});
            fetchInvoices();
            if (activeTab === 'TENANTS') fetchTenants();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.error || 'No se pudo procesar el pago', 'error');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'ACTIVO': return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Al Día</span>;
            case 'EN_PERIODO_DE_GRACIA': return <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-md text-[10px] font-black uppercase tracking-widest w-max">En Gracia (Alerta)</span>;
            case 'BLOQUEADO_POR_PAGO': return <span className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-[10px] font-black uppercase tracking-widest w-max">Licencia Vencida</span>;
            case 'BLOQUEADO_MANUAL': return <span className="px-2 py-1 bg-slate-800 text-white rounded-md text-[10px] font-black uppercase tracking-widest w-max">Suspendido (Kill-Switch)</span>;
            case 'PAGADA': return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max">Factura Pagada</span>;
            case 'PENDIENTE': return <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max">Pago Pendiente</span>;
            default: return <span>{status}</span>;
        }
    };

    const slideVariants = { enter: { x: 50, opacity: 0 }, center: { x: 0, opacity: 1 }, exit: { x: -50, opacity: 0 } };

    return (
        <div className="p-4 md:p-8 overflow-y-auto flex-1 min-h-0 w-full relative bg-slate-50 font-sans flex flex-col">
            
            {/* HEADER, KPI DASHBOARD Y SISTEMA DE TABS */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 md:gap-6 mb-6 shrink-0 bg-slate-900 text-white p-5 md:p-6 pb-0 rounded-[2rem] shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
                            <span className="text-blue-400 drop-shadow-md">⚡</span> Panel Maestro SaaS
                        </h2>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                            Gestión Global de Plataforma y Resumen Financiero
                        </p>
                    </div>
                    {activeTab === 'TENANTS' && (
                        <Button onClick={() => { setFormData(initialFormState); setStep(1); setIsFormOpen(true); }} className="w-full md:w-auto !bg-blue-600 hover:!bg-blue-500 text-white h-12 px-6 rounded-xl font-black shadow-lg shadow-blue-900 border-0 active:scale-95 transition-transform">
                            + Nuevo Cliente
                        </Button>
                    )}
                </div>

                {/* 📊 TARJETONES DE CONTROL FINANCIERO GLOBALES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 relative z-10 my-2">
                    <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl shadow-inner flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MRR Proyectado (Mes)</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-emerald-400">${estimatedMRR.toFixed(2)}</span>
                            <span className="text-xs text-slate-400 font-bold">/ mes</span>
                        </div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl shadow-inner flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inquilinos Activos</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-blue-400">{totalActiveTenants}</span>
                            <span className="text-xs text-slate-400 font-bold">de {tenants.length} total</span>
                        </div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl shadow-inner flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cobranza Pendiente</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-amber-400">${pendingCollectionUSD.toFixed(2)}</span>
                            <span className="text-xs text-slate-400 font-bold">por liquidar</span>
                        </div>
                    </div>
                </div>

                {/* 🚀 NAVEGACIÓN DE TRES PESTAÑAS */}
                <div className="flex gap-4 md:gap-6 border-b border-slate-700/50 relative z-10 overflow-x-auto custom-scrollbar pt-2">
                    <button 
                        onClick={() => setActiveTab('TENANTS')}
                        className={`pb-4 text-xs md:text-sm font-black uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === 'TENANTS' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        🏢 Licencias
                        {activeTab === 'TENANTS' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('BILLING')}
                        className={`pb-4 text-xs md:text-sm font-black uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === 'BILLING' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        💳 Facturación
                        {activeTab === 'BILLING' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('REPORTS')}
                        className={`pb-4 text-xs md:text-sm font-black uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === 'REPORTS' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        📊 Reportes
                        {activeTab === 'REPORTS' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full" />}
                    </button>
                </div>
            </motion.div>

            {/* ========================================================= */}
            {/* PESTAÑA 1: INQUILINOS */}
            {/* ========================================================= */}
            {activeTab === 'TENANTS' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden flex-1 flex flex-col relative">
                    <div className="hidden md:grid grid-cols-12 bg-slate-50/80 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/60 sticky top-0 z-10 shrink-0">
                        <div className="col-span-1 pl-2">ID</div>
                        <div className="col-span-3">Empresa</div>
                        <div className="col-span-2">Corte / Vencimiento</div>
                        <div className="col-span-2 text-center">Estado</div>
                        <div className="col-span-4 text-right pr-4">Acciones Administrativas</div>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                        ) : tenants.map((t) => (
                            <div 
                                key={t.id} 
                                onClick={() => openEditModal(t)} 
                                className="p-4 hover:bg-slate-50/80 transition-all border-b border-slate-100 last:border-0 flex flex-col md:grid md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 group relative cursor-pointer"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                                
                                <div className="col-span-1 font-black text-slate-300 text-sm md:pl-2">#{t.id}</div>
                                <div className="col-span-3 flex flex-col">
                                    <span className="font-bold text-slate-800 text-sm truncate">{t.nombre}</span>
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 font-bold bg-slate-100 w-max px-1.5 rounded">{t.rif}</span>
                                </div>
                                <div className="col-span-2 flex flex-col mt-1 md:mt-0">
                                    <span className="text-xs font-bold text-slate-600">{new Date(t.licencia_expira_el).toLocaleDateString()}</span>
                                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{t.plan_actual}</span>
                                </div>
                                <div className="col-span-2 flex justify-start md:justify-center w-full md:w-auto mt-1 md:mt-0">{getStatusBadge(t.estatus_licencia)}</div>
                                
                                <div className="col-span-4 flex flex-row flex-wrap justify-start md:justify-end w-full md:w-auto gap-2 md:pr-2 mt-3 md:mt-0">
                                    <Button disabled={t.id === 1} variant="secondary" onClick={(e) => { e.stopPropagation(); handleRenew(t); }} className="!text-[10px] !px-3 !py-1.5 !bg-blue-50 !text-blue-700 border-blue-200 shadow-sm hover:!bg-blue-600 hover:!text-white transition-colors">
                                        Renovar
                                    </Button>
                                    <Button disabled={t.id === 1} variant="danger" onClick={(e) => { e.stopPropagation(); handleToggleSuspension(t); }} className={`!text-[10px] !px-3 !py-1.5 border-0 shadow-sm ${t.estatus_licencia === 'BLOQUEADO_MANUAL' ? '!bg-emerald-500 hover:!bg-emerald-600' : '!bg-slate-800 hover:!bg-black'}`}>
                                        {t.estatus_licencia === 'BLOQUEADO_MANUAL' ? 'Reactivar' : 'Kill-Switch'}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ========================================================= */}
            {/* PESTAÑA 2: FACTURACIÓN Y COBRANZA */}
            {/* ========================================================= */}
            {activeTab === 'BILLING' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden flex-1 flex flex-col relative">
                    <div className="hidden md:grid grid-cols-12 bg-slate-50/80 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/60 sticky top-0 z-10 shrink-0">
                        <div className="col-span-1 pl-2">ID</div>
                        <div className="col-span-3">Cliente / N° Control</div>
                        <div className="col-span-2 text-center">Vencimiento</div>
                        <div className="col-span-2 text-right">Monto a Cobrar</div>
                        <div className="col-span-2 text-center">Estatus</div>
                        <div className="col-span-2 text-right pr-4">Acciones</div>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                        {isLoadingInvoices ? (
                            <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                        ) : invoices.map((inv) => (
                            <div key={inv.id} className="p-4 hover:bg-slate-50/80 transition-all border-b border-slate-100 last:border-0 flex flex-col md:grid md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 group relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center"></div>
                                
                                <div className="col-span-1 font-black text-slate-300 text-sm md:pl-2">#{inv.id}</div>
                                <div className="col-span-3 flex flex-col w-full md:w-auto">
                                    <span className="font-bold text-slate-800 text-sm truncate">{inv.empresa}</span>
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 font-bold bg-slate-100 w-max px-1.5 rounded">{inv.control_number}</span>
                                </div>
                                <div className="col-span-2 flex flex-col items-start md:items-center w-full md:w-auto mt-1 md:mt-0">
                                    <span className="text-[10px] md:hidden text-slate-400 uppercase tracking-widest mb-0.5">Vencimiento</span>
                                    <span className="text-xs font-bold text-slate-600">{new Date(inv.due_date).toLocaleDateString()}</span>
                                </div>
                                <div className="col-span-2 flex flex-row md:flex-col items-center justify-between md:justify-center md:items-end w-full mt-2 md:mt-0">
                                    <span className="text-sm font-black text-slate-800">${inv.amount_usd.toFixed(2)}</span>
                                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">Bs {inv.amount_ves.toFixed(2)}</span>
                                </div>
                                <div className="col-span-2 flex justify-start md:justify-center w-full md:w-auto mt-2 md:mt-0">{getStatusBadge(inv.status)}</div>
                                
                                <div className="col-span-2 flex justify-start md:justify-end w-full md:w-auto gap-2 md:pr-2 mt-3 md:mt-0">
                                    {inv.status === 'PENDIENTE' ? (
                                        <Button variant="primary" onClick={() => openPaymentModal(inv)} className="w-full md:w-auto !text-[10px] !px-4 !py-2 md:!py-1.5 !bg-emerald-600 hover:!bg-emerald-700 text-white shadow-sm border-0 flex justify-center items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Cobrar Factura
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" disabled className="w-full md:w-auto !text-[10px] !px-4 !py-2 md:!py-1.5 opacity-50 cursor-not-allowed text-slate-400 flex justify-center">
                                            Liquidada
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ========================================================= */}
            {/* PESTAÑA 3: ANALÍTICAS Y REPORTES (NUEVA) */}
            {/* ========================================================= */}
            {activeTab === 'REPORTS' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-y-auto custom-scrollbar gap-6">
                    
                    {/* ACCIÓN DE DESCARGA PDF */}
                    <div className="flex justify-end shrink-0">
                        <Button onClick={handleDownloadReport} className="!bg-slate-800 hover:!bg-black text-white font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl shadow-lg shadow-slate-300/50 flex items-center gap-2 transition-all">
                            <svg className="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 24 24"><path d="M11.25 1.053v10.697h10.697c-.201-5.748-4.75-10.296-10.697-10.697z"/><path d="M12.75 13.25h10.697c-.201 5.748-4.75 10.296-10.697 10.697V13.25z"/><path d="M9.75 1.053c-5.947.401-10.496 4.949-10.697 10.697h10.697V1.053z"/><path d="M9.75 13.25H-.947c.201 5.748 4.75 10.296 10.697 10.697V13.25z"/></svg>
                            Descargar Reporte PDF
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                        {/* RECAUDACIÓN Y SALUD FINANCIERA */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col gap-6">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
                                    Salud de Recaudación Mensual
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 font-medium">Comparativa de facturas pagadas contra deuda pendiente en la calle.</p>
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center gap-4">
                                <div>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span className="text-slate-600">Cobrado (Liquidado)</span>
                                        <span className="text-emerald-600">${collectedUSD.toFixed(2)}</span>
                                    </div>
                                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(collectedUSD / (collectedUSD + pendingCollectionUSD || 1)) * 100}%` }} className="h-full bg-emerald-500 rounded-full"></motion.div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span className="text-slate-600">Por Cobrar (Riesgo)</span>
                                        <span className="text-amber-500">${pendingCollectionUSD.toFixed(2)}</span>
                                    </div>
                                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(pendingCollectionUSD / (collectedUSD + pendingCollectionUSD || 1)) * 100}%` }} className="h-full bg-amber-400 rounded-full"></motion.div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SEMÁFORO CHURN RISK */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 flex flex-col max-h-[400px]">
                            <div className="mb-4 shrink-0">
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    <span className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></span>
                                    Alerta de Vencimientos Próximos
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 font-medium">Inquilinos activos cuya licencia expira en los próximos 7 días.</p>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                                {tenantsExpiringSoon.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-sm font-bold">Todo al día</span>
                                        <span className="text-xs">No hay cortes esta semana.</span>
                                    </div>
                                ) : (
                                    tenantsExpiringSoon.map(t => {
                                        const days = getDaysRemaining(t.licencia_expira_el);
                                        const badgeColor = days <= 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                                        return (
                                            <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800">{t.nombre}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(t.licencia_expira_el).toLocaleDateString()}</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${badgeColor}`}>
                                                    {days === 0 ? 'Vence HOY' : `Faltan ${days} días`}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* ESTADÍSTICAS TÉCNICAS (USO DE PLATAFORMA) */}
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 lg:col-span-2">
                            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 mb-6">
                                <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></span>
                                Configuración Fiscal de la Red SaaS
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl font-black text-slate-700 mb-1">{formatStats.formaLibre}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Puntos Forma Libre</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl font-black text-indigo-600 mb-1">{formatStats.fiscal}</span>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Impresoras Fiscales</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-3xl font-black text-blue-500 mb-1">{formatStats.electronica}</span>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Puntos Electrónicos</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </motion.div>
            )}

            {/* ========================================================= */}
            {/* MODALES: CREAR/EDITAR INQUILINO */}
            {/* ========================================================= */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            
                            <div className="p-5 md:p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-lg md:text-xl font-black flex items-center gap-2">
                                        <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-lg"><svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></div>
                                        {formData.id ? 'Modificar Inquilino' : 'Aprovisionamiento Seguro'}
                                    </h3>
                                    <p className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-widest mt-1 ml-10">Gestión Multi-Tenant Automatizada</p>
                                </div>
                                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/20 p-2 rounded-full transition-colors outline-none"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>

                            <div className="flex items-center justify-between px-4 md:px-8 py-4 bg-slate-50 border-b border-slate-100 shrink-0 relative overflow-hidden">
                                <div className="absolute left-10 right-10 top-1/2 h-1 bg-slate-200 -translate-y-1/2 z-0 rounded-full overflow-hidden hidden md:block">
                                    <motion.div className="h-full bg-blue-500" initial={{ width: "0%" }} animate={{ width: step === 1 ? "0%" : (step === 2 && !formData.id ? "50%" : "100%") }} transition={{ duration: 0.3 }} />
                                </div>
                                {(() => {
                                    const steps = formData.id 
                                        ? [{ num: 1, label: 'Empresa' }, { num: 3, label: 'Facturación' }]
                                        : [{ num: 1, label: 'Empresa' }, { num: 2, label: 'Seguridad' }, { num: 3, label: 'Facturación' }];
                                    
                                    return steps.map((s) => (
                                        <div key={s.num} className="relative z-10 flex flex-col items-center gap-1.5 px-2 bg-transparent md:bg-slate-50">
                                            <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-black text-xs transition-colors duration-300 shadow-sm border-2 ${step >= s.num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-300'}`}>
                                                {step > s.num ? <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg> : s.num}
                                            </div>
                                            <span className={`text-[8px] md:text-[9px] uppercase tracking-widest font-black ${step >= s.num ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</span>
                                        </div>
                                    ));
                                })()}
                            </div>

                            <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar flex-1 relative bg-white overflow-x-hidden">
                                <AnimatePresence mode="wait">
                                    {step === 1 && (
                                        <motion.div key="step1" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-6 pb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                                                <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">Datos Jurídicos y Comerciales</h4>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="col-span-1 md:col-span-2">
                                                    <ValidatedInput label="Nombre de Fantasía o Razón Social (*)" name="nombre_empresa" value={formData.nombre_empresa} onChange={handleInputChange} placeholder="Ej: Inversiones Globales C.A." error={errors.nombre_empresa} />
                                                </div>
                                                <div>
                                                    <ValidatedInput label="RIF Oficial (*)" name="rif" value={formData.rif} onChange={handleInputChange} placeholder="J-12345678-9" error={errors.rif} customClass="uppercase" />
                                                </div>
                                                <div>
                                                    <ValidatedInput label="Teléfono de Contacto" name="telefono" type="tel" value={formData.telefono} onChange={handleInputChange} placeholder="0414-0000000" error={errors.telefono} />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <ValidatedInput label="Dirección Física Principal" name="direccion" value={formData.direccion} onChange={handleInputChange} placeholder="Ej: Av. Principal, Local 4, Barquisimeto" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {step === 2 && !formData.id && (
                                        <motion.div key="step2" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-6 pb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="w-2 h-6 bg-rose-500 rounded-full"></span>
                                                <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">Credenciales del Gerente (Cliente)</h4>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 md:p-6 rounded-3xl border border-slate-100 shadow-inner">
                                                <div>
                                                    <ValidatedInput label="Usuario (Login) (*)" name="admin_username" value={formData.admin_username} onChange={handleInputChange} placeholder="Ej: admin_global" error={errors.admin_username} />
                                                </div>
                                                <div>
                                                    <ValidatedInput label="Contraseña Temporal (*)" name="admin_password" type="password" value={formData.admin_password} onChange={handleInputChange} placeholder="Mínimo 6 caracteres" error={errors.admin_password} />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <ValidatedInput label="Correo Electrónico Oficial (*)" name="admin_email" type="email" value={formData.admin_email} onChange={handleInputChange} placeholder="gerencia@empresa.com" error={errors.admin_email} />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center flex justify-center items-center gap-1">
                                                <svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                Estas credenciales tendrán acceso absoluto al nuevo entorno.
                                            </p>
                                        </motion.div>
                                    )}

                                    {step === 3 && (
                                        <motion.div key="step3" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-6 pb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                                                <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">Personalización y Cobranza</h4>
                                            </div>
                                            
                                            <div className="space-y-6">
                                                <div>
                                                    <ValidatedInput label="URL del Logotipo (Opcional)" name="logo_url" value={formData.logo_url} onChange={handleInputChange} placeholder="https://i.postimg.cc/tu-logo.png" />
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 p-4 md:p-5 rounded-3xl border border-indigo-100">
                                                    <div>
                                                        <label className="text-[10px] font-black text-indigo-800 uppercase tracking-widest block mb-2">Modalidad de Emisión</label>
                                                        <select className="w-full bg-white border border-indigo-200 rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400" value={formData.invoiceMode} onChange={handleInputChange} name="invoiceMode">
                                                            <option value="FORMA_LIBRE">📄 Forma Libre</option>
                                                            <option value="FISCAL_PRINTER">📠 Impresora Fiscal</option>
                                                            <option value="ELECTRONIC">🌐 Facturación Electrónica</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-indigo-800 uppercase tracking-widest block mb-2">Formato de Ticket</label>
                                                        <select className="w-full bg-white border border-indigo-200 rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400" value={formData.printerPaperSize} onChange={handleInputChange} name="printerPaperSize">
                                                            <option value="80mm">Estándar 80mm</option>
                                                            <option value="58mm">Pequeño 58mm</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-1 md:col-span-2">
                                                        <ValidatedInput label="Pie de Ticket / Mensaje Legal" name="receiptFooterMessage" value={formData.receiptFooterMessage} onChange={handleInputChange} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50 p-4 md:p-5 rounded-3xl border border-emerald-100 shadow-inner">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Precio Base (USD)</label>
                                                        <div className="relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                                                            <input type="number" min="1" step="0.01" name="planPrice" value={formData.planPrice} onChange={handleInputChange} className="w-full p-3.5 pl-8 rounded-xl border border-emerald-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm" />
                                                        </div>
                                                        {errors.planPrice && <span className="text-[10px] font-bold text-rose-500">{errors.planPrice}</span>}
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Cobertura USDT (%)</label>
                                                        <div className="relative">
                                                            <input type="number" min="0" max="100" name="cryptoSpread" value={formData.cryptoSpread} onChange={handleInputChange} className="w-full p-3.5 pr-8 rounded-xl border border-emerald-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm" />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">%</span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-emerald-600 mt-1">
                                                            Monto final facturado: ${(Number(formData.planPrice) * (1 + (Number(formData.cryptoSpread) / 100))).toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {!formData.id && (
                                                    <div className="flex flex-col md:flex-row items-center gap-4 p-4 md:p-5 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-3xl text-white shadow-lg">
                                                        <div className="flex-1 w-full md:w-auto text-center md:text-left">
                                                            <label className="text-[10px] font-black text-blue-300 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span> Meses de Licencia Inicial</label>
                                                            <p className="text-xs text-slate-300 mt-0.5">Tiempo otorgado antes del bloqueo automático.</p>
                                                        </div>
                                                        <input type="number" min="1" required name="meses_licencia" className="w-full md:w-24 p-3 rounded-xl border-2 border-slate-600 bg-slate-800 text-center font-black text-white text-xl outline-none" value={formData.meses_licencia} onChange={handleInputChange} />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-200 flex justify-between gap-4 shrink-0">
                                <Button variant="ghost" onClick={handlePrev} disabled={step === 1} className={`w-1/3 !py-4 font-black uppercase tracking-widest text-xs transition-all ${step === 1 ? 'opacity-0 cursor-default pointer-events-none' : '!bg-white border border-slate-200 !text-slate-500 hover:!bg-slate-100 shadow-sm'}`}>Atrás</Button>
                                {step < 3 ? (
                                    <Button onClick={handleNext} className="w-2/3 !py-4 !bg-slate-800 hover:!bg-black text-white font-black uppercase tracking-widest text-xs">Continuar</Button>
                                ) : (
                                    <Button onClick={handleSave} className="w-2/3 !py-4 !bg-blue-600 hover:!bg-blue-700 text-white font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                        {formData.id ? 'Guardar Cambios' : 'Crear Cliente'}
                                    </Button>
                                )}
                            </div>

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL WIZARD: REGISTRAR PAGO Y RENOVAR */}
            <AnimatePresence>
                {isPaymentModalOpen && selectedInvoice && (
                    <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                            
                            <div className="p-5 md:p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg md:text-xl font-black flex items-center gap-2">
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Liquidación de Factura
                                    </h3>
                                    <p className="text-[9px] md:text-[10px] text-emerald-100 uppercase tracking-widest mt-1 ml-7 md:ml-8">Factura N° {selectedInvoice.control_number}</p>
                                </div>
                                <button onClick={() => setIsPaymentModalOpen(false)} className="text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors outline-none">
                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleRegisterPayment} className="flex-1 flex flex-col overflow-y-auto">
                                <div className="p-5 md:p-6 space-y-6">
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 text-center shadow-inner">
                                        <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Pendiente ({selectedInvoice.empresa})</p>
                                        <p className="text-3xl md:text-4xl font-black text-slate-800">${selectedInvoice.amount_usd.toFixed(2)}</p>
                                        <p className="text-xs font-bold text-emerald-600 mt-1">Equivalente: Bs. {selectedInvoice.amount_ves.toFixed(2)}</p>
                                    </div>

                                    <div>
                                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Vía de Recepción de Fondos</label>
                                        <select 
                                            required
                                            className="w-full bg-white border border-slate-300 rounded-xl p-3.5 md:p-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm cursor-pointer"
                                            value={paymentData.payment_method}
                                            onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                                        >
                                            <option value="" disabled>Seleccione método de pago...</option>
                                            <optgroup label="Nacionales (VE)">
                                                <option value="PAGO_MOVIL">📱 Pago Móvil</option>
                                                <option value="TRANSFERENCIA_BS">🏦 Transferencia Bancaria (Bs)</option>
                                            </optgroup>
                                            <optgroup label="Internacionales y Digitales">
                                                <option value="ZELLE">🇺🇸 Zelle</option>
                                                <option value="BINANCE">🪙 Binance Pay / USDT</option>
                                                <option value="EFECTIVO">💵 Efectivo (Taquilla)</option>
                                            </optgroup>
                                        </select>
                                    </div>

                                    {paymentData.payment_method !== 'EFECTIVO' && paymentData.payment_method !== '' && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                                            <div className="pb-4">
                                                <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Número de Referencia / Recibo</label>
                                                <Input required type="text" placeholder="Ej: 12345678" value={paymentData.reference_number} onChange={(e) => setPaymentData({...paymentData, reference_number: e.target.value})} className="w-full !rounded-xl" />
                                            </div>
                                        </motion.div>
                                    )}

                                    <div>
                                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Notas u Observaciones (Opcional)</label>
                                        <textarea rows="2" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm resize-none" placeholder="Pago recibido, etc..." value={paymentData.notes} onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}></textarea>
                                    </div>
                                </div>

                                <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-200 mt-auto">
                                    <Button type="submit" className="w-full !bg-emerald-600 hover:!bg-emerald-700 text-white !py-3.5 md:!py-4 text-xs md:text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30">
                                        Registrar Cobro y Renovar Licencia
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
};