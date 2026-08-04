import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
// ?? FIX ARQUITECTURA: Importamos los TRES servicios de la API
import { CustomerService, ProviderService, DeliveryService } from '../api/services';
import { capitalizeWords, validatePhone } from '../utils/formatters';

export const useCustomers = (onDataUpdated, currentView) => {
    // ESTADOS para el m車dulo de Directorio Unificado
    const [allCustomers, setAllCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]); 
    const [customerSearchQuery, setCustomerSearchQuery] = useState(''); 
    const [customerCurrentPage, setCustomerCurrentPage] = useState(1); 

    // ESTADOS para el formulario (Esqueleto Unificado)
    // ?? FIX UX: Agregamos 'original_type' para blindar la edici車n
    const [customerForm, setCustomerForm] = useState({ 
        id: null, full_name: '', id_number: '', phone: '', institution: '', status: 'ACTIVO', type: 'CLIENTE', original_type: null
    });

    // --- 1. CARGAR Y UNIFICAR CONTACTOS (Patr車n Adaptador Tri-Entidad) ---
    const loadCustomers = async () => {
        try {
            // ?? Paralelizamos las 3 peticiones para m芍ximo rendimiento y carga instant芍nea
            const [resCust, resProv, resDeliv] = await Promise.all([
                CustomerService.getAll().catch(() => ({ data: [] })), // Fallback seguro
                ProviderService.getAll().catch(() => ({ data: [] })),
                DeliveryService.getAll().catch(() => ({ data: [] }))
            ]);

            const customersData = Array.isArray(resCust.data) ? resCust.data : [];
            const providersData = Array.isArray(resProv.data) ? resProv.data : [];
            const driversData = Array.isArray(resDeliv.data) ? resDeliv.data : [];

            // ?? ADAPTADOR: Transformamos Proveedores para la UI
            const mappedProviders = providersData.map(p => ({
                id: p.id,
                full_name: p.name,           
                id_number: p.rif || '',      
                institution: p.address || '',
                phone: p.phone || '',
                status: p.status || 'ACTIVO',
                type: 'PROVEEDOR'            
            }));

            // ?? ADAPTADOR: Transformamos Transporte/Motorizados para la UI
            const mappedDrivers = driversData.map(d => ({
                id: d.id,
                full_name: d.name,
                id_number: d.id_number || '',      // C谷dula del motorizado
                institution: d.vehicle_info || '', // Placa/Veh赤culo va en el campo de instituci車n visualmente
                phone: d.phone || '',
                status: d.status || 'ACTIVO',
                type: 'TRANSPORTE'                 // Etiqueta crucial de 3ra Entidad
            }));

            // ADAPTADOR: Clientes regulares
            const mappedCustomers = customersData.map(c => ({
                ...c,
                type: 'CLIENTE'
            }));

            // ?? FUSI車N MAESTRA: Unimos las 3 listas en el Directorio Global
            setAllCustomers([...mappedCustomers, ...mappedProviders, ...mappedDrivers]);
        } catch (error) {
            console.error("Error loading directory:", error);
        }
    };

    // --- 2. CARGAS AUTOM芍TICAS ---
    useEffect(() => {
        loadCustomers();
    }, []);

    useEffect(() => {
        if (currentView === 'CUSTOMERS') {
            loadCustomers();
        }
    }, [currentView]);

    // L車gica de filtro global para la tabla
    useEffect(() => {
        if (customerSearchQuery) {
            const lowerQuery = customerSearchQuery.toLowerCase();
            const results = allCustomers.filter(c =>
                (c.full_name || '').toLowerCase().includes(lowerQuery) ||
                (c.id_number || '').toLowerCase().includes(lowerQuery) ||
                (c.phone || '').includes(lowerQuery)
            );
            setFilteredCustomers(results);
        } else {
            setFilteredCustomers(allCustomers);
        }
        setCustomerCurrentPage(1); // RESET DE P芍GINA
    }, [customerSearchQuery, allCustomers]);

    // Funci車n para cargar datos en el formulario de edici車n
    const editCustomer = (customer) => {
        setCustomerForm({
            id: customer.id,
            full_name: customer.full_name,
            id_number: customer.id_number,
            phone: customer.phone || '',
            institution: customer.institution || '',
            status: customer.status || 'ACTIVO',
            type: customer.type || 'CLIENTE',
            original_type: customer.type || 'CLIENTE' // ?? GUARDAMOS EL TIPO ORIGINAL PARA EL BLINDAJE
        });
        window.scrollTo(0, 0);
    }

    // --- FUNCI車N PARA AGREGAR SALDO INICIAL (ESTANDARIZADO CORPORATIVO) ---
    const addInitialBalance = async (customer) => {
        // ?? BLOQUEO PROVEEDOR
        if (customer.type === 'PROVEEDOR') {
            return Swal.fire({
                icon: 'warning',
                title: 'Acci車n No Permitida',
                html: '<p class="text-sm text-slate-600">Las deudas a proveedores son <b>Cuentas por Pagar</b>.</p><br/><p class="text-xs text-slate-500">Para registrar un saldo inicial de proveedor, ve al m車dulo de <b>Recepci車n de Mercanc赤a</b> y registra una compra con fecha antigua.</p>',
                confirmButtonColor: '#1e293b',
                customClass: { popup: 'rounded-[1.5rem] p-6' }
            });
        }

        // ?? BLOQUEO TRANSPORTE
        if (customer.type === 'TRANSPORTE') {
            return Swal.fire({
                icon: 'warning',
                title: 'Gesti\u00F3n de Personal',
                html: '<p class="text-sm text-slate-600">El personal de transporte no maneja cuentas por cobrar comerciales.</p><br/><p class="text-xs text-slate-500">Los pagos y adelantos a motorizados se gestionan en los cierres de caja o en el m&oacute;dulo de n&oacute;mina.</p>',
                confirmButtonColor: '#1e293b',
                customClass: { popup: 'rounded-[1.5rem] p-6' }
            });
        }

        const { value: formValues } = await Swal.fire({
            title: '', 
            html: `
              <div class="flex flex-col items-center font-sans">
                  <div class="flex items-center justify-center gap-3 mb-6">
                      <div class="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-800 shadow-sm border border-slate-200">
                          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                      </div>
                      <span class="text-2xl font-black text-slate-800 tracking-tight">Saldo Inicial</span>
                  </div>

                  <div class="text-left w-full">
                      <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 text-center">
                          Cliente: <span class="text-slate-800">${customer.full_name}</span>
                      </p>
                      
                      <div class="mb-4">
                          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Monto de la Deuda (USD Ref)</label>
                          <input id="swal-balance-amount" type="number" step="0.01" 
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none transition-all text-slate-800 font-black text-2xl shadow-inner text-center" 
                            placeholder="0.00">
                      </div>

                      <div>
                          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nota / Descripcion (Opcional)</label>
                          <input id="swal-balance-desc" type="text" 
                            class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 focus:bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none transition-all text-slate-600 text-sm font-medium text-center" 
                            placeholder="Ej: Deuda arrastrada del a&ntilde;o 2024">
                      </div>
                  </div>
              </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'REGISTRAR DEUDA',
            cancelButtonText: 'CANCELAR',
            buttonsStyling: false,
            customClass: {
                popup: 'rounded-[1.5rem] border border-slate-100 shadow-2xl p-6 !w-[90%] !max-w-[400px]',
                confirmButton: 'w-full bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all shadow-md mb-2 outline-none border-0',
                cancelButton: 'w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition-all outline-none',
                actions: 'flex flex-col w-full mt-4 gap-0'
            },
            preConfirm: () => {
                const amount = document.getElementById('swal-balance-amount').value;
                const desc = document.getElementById('swal-balance-desc').value;
                if (!amount || parseFloat(amount) <= 0) {
                    Swal.showValidationMessage('<span class="text-[10px] font-black uppercase tracking-widest text-rose-500 mt-2 block">&#9888; Ingrese un monto v芍lido mayor a 0</span>');
                    return false;
                }
                return { amount, desc };
            }
        });

        if (formValues) {
            try {
                Swal.fire({
                    title: 'Procesando...',
                    html: '<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Guardando registro en historial</p>',
                    didOpen: () => Swal.showLoading(),
                    customClass: { popup: 'rounded-[1.5rem] p-6' }
                });

                await CustomerService.addInitialBalance(customer.id, {
                    amount: formValues.amount,
                    description: formValues.desc
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Operaci車n Exitosa', 
                    text: 'La deuda ha sido integrada correctamente.',
                    confirmButtonColor: '#1e293b',
                    customClass: { popup: 'rounded-[1.5rem] p-6' }
                });

                if (onDataUpdated) onDataUpdated(); 
                loadCustomers();

            } catch (error) {
                console.error("Error al registrar saldo inicial:", error);
                const errorMsg = error.response?.data?.message || 'No se pudo registrar el saldo inicial.';
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg, confirmButtonColor: '#1e293b', customClass: { popup: 'rounded-[1.5rem] p-6' } });
            }
        }
    };

    // --- ?? ENRUTADOR DE GUARDADO BLINDADO 1000% ---
    const saveCustomer = async (e) => {
        e.preventDefault();

        if (!customerForm.full_name || !customerForm.id_number) {
            return Swal.fire({ icon: 'warning', title: 'Datos Incompletos', text: 'El Nombre y Documento de Identidad (C谷dula/RIF) son obligatorios.', confirmButtonColor: '#1e293b' });
        }

        // ?? BLINDAJE 1000%: Si est芍 editando, bloqueamos el cambio cruzado de naturaleza de la empresa/persona
        if (customerForm.id && customerForm.type !== customerForm.original_type) {
            return Swal.fire({ 
                icon: 'error', 
                title: 'Acci車n Bloqueada', 
                html: `<p class="text-sm">Por seguridad e integridad de los datos, <b>no puedes convertir un registro de ${customerForm.original_type} en ${customerForm.type}</b>.</p><br/><p class="text-xs text-slate-500">Si la persona o empresa cumple m迆ltiples roles, debes crear un registro nuevo y separado.</p>`, 
                confirmButtonColor: '#1e293b',
                customClass: { popup: 'rounded-[1.5rem] p-6' }
            });
        }

        try {
            Swal.fire({ title: `Procesando...`, didOpen: () => Swal.showLoading(), customClass: { popup: 'rounded-[1.5rem] p-6' } });
            
            // ?? ENRUTADOR MAESTRO 3 V赤AS
            if (customerForm.type === 'PROVEEDOR') {
                const providerPayload = {
                    rif: customerForm.id_number,
                    name: customerForm.full_name,
                    phone: customerForm.phone,
                    address: customerForm.institution,
                    status: customerForm.status
                };
                if (customerForm.id) {
                    await ProviderService.update(customerForm.id, providerPayload);
                } else {
                    await ProviderService.create(providerPayload);
                }
            } else if (customerForm.type === 'TRANSPORTE') {
                const driverPayload = {
                    id_number: customerForm.id_number,
                    name: customerForm.full_name,
                    phone: customerForm.phone,
                    vehicle_info: customerForm.institution,
                    status: customerForm.status
                };
                if (customerForm.id) {
                    await DeliveryService.update(customerForm.id, driverPayload);
                } else {
                    await DeliveryService.create(driverPayload);
                }
            } else {
                // CLIENTE NORMAL
                await CustomerService.save(customerForm);
            }

            Swal.fire({
                icon: 'success',
                title: '\u00C9xito',
                text: `Registro de ${customerForm.type.toLowerCase()} procesado correctamente.`,
                confirmButtonColor: '#1e293b',
                customClass: { popup: 'rounded-[1.5rem] p-6' }
            });

            setCustomerForm({ id: null, full_name: '', id_number: '', phone: '', institution: '', status: 'ACTIVO', type: 'CLIENTE', original_type: null });
            loadCustomers();
        } catch (error) {
            const message = error.response?.data?.error || error.response?.data?.message || error.message;
            const status = error.response?.status;

            if (status === 409) {
                Swal.fire({ icon: 'error', title: 'Conflicto de Datos', text: message, confirmButtonColor: '#1e293b', customClass: { popup: 'rounded-[1.5rem] p-6' } });
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: `Fallo al procesar registro: ${message}`, confirmButtonColor: '#1e293b', customClass: { popup: 'rounded-[1.5rem] p-6' } });
            }
        }
    }

    // Funci車n para manejar los cambios en el formulario con formateo en vivo
    const handleCustomerFormChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;

        if (name === 'full_name' || name === 'institution') {
            newValue = capitalizeWords(value);
        } else if (name === 'id_number') {
            // ?? SMART MASK: Formato inteligente SENIAT (J, V, E, G, C, P)
            let val = value.toUpperCase();
            
            // 1. Auto-prefijo inteligente seg迆n el tipo de registro seleccionado
            if (/^[0-9]/.test(val)) {
                // Si es Proveedor asume Jur赤dico (J). Para Clientes y Transporte asume Venezolano (V).
                const defaultPrefix = customerForm.type === 'PROVEEDOR' ? 'J' : 'V';
                val = defaultPrefix + val;
            }

            // 2. Limpieza estricta de caracteres
            val = val.replace(/[^JVEGCP0-9]/g, '');

            // 3. Forzar arranque con letra legal
            if (val.length > 0 && !/^[JVEGCP]/.test(val[0])) {
                val = val.replace(/^[^JVEGCP]+/, '');
            }

            // 4. Aplicar estructura visual con guiones (L-12345678-9)
            if (val.length > 1) {
                const letter = val[0];
                const numbers = val.substring(1).replace(/[^0-9]/g, '');
                
                if (numbers.length > 8) {
                    newValue = `${letter}-${numbers.substring(0, 8)}-${numbers.substring(8, 9)}`;
                } else if (numbers.length > 0) {
                    newValue = `${letter}-${numbers}`;
                } else {
                    newValue = letter;
                }
            } else {
                newValue = val;
            }
        } else if (name === 'phone') {
            newValue = validatePhone(value);
        }

        setCustomerForm(prev => ({ ...prev, [name]: newValue }));
    };

    return {
        allCustomers, setAllCustomers,
        filteredCustomers, setFilteredCustomers,
        customerSearchQuery, setCustomerSearchQuery,
        customerCurrentPage, setCustomerCurrentPage,
        customerForm, setCustomerForm,
        loadCustomers, editCustomer, addInitialBalance,
        saveCustomer, handleCustomerFormChange
    };
};