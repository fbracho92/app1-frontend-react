import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { ProviderService, PurchaseService } from '../api/services';

export const usePurchases = ({ bcvRate, products, onGlobalUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    // 1. Estado para la búsqueda optimizada (evita lag al escribir)
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [providers, setProviders] = useState([]);

    // --- ESTADOS PARA MÓDULO DE COMPRAS ---
    const [purchaseCart, setPurchaseCart] = useState([]); // Carrito de compras al proveedor
    const [purchaseForm, setPurchaseForm] = useState({
        provider_id: '',
        invoice_number: '',
        control_number: '',
        date: new Date().toISOString().split('T')[0]
    });
    
    const [providerFilter, setProviderFilter] = useState('');
    
    // --- ESTADOS PARA MODAL DE PROVEEDOR (NUEVO) ---
    const [showProviderModal, setShowProviderModal] = useState(false);
    
    // 3. Efecto "Debounce": Solo actualiza el filtro 300ms después de que dejas de escribir
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);
    
    // --- OPTIMIZACIÓN DE RENDIMIENTO (ESTO ELIMINA EL LAG AL TRANSCRIBIR) ---
    // Memorizamos la lista filtrada: Solo se recalcula si cambia el buscador (debounced) o los productos.
    // NO se recalcula si escribes en la factura, control o fecha.
    const filteredPurchaseProducts = useMemo(() => {
        // 1. Filtramos
        const filtered = products.filter(p =>
            p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
        // 2. [OPTIMIZACIÓN CLAVE] Limitamos a 50 items visuales para no saturar el DOM
        // Si necesitas ver más, simplemente escribes más específico en el buscador.
        return filtered.slice(0, 50);
    }, [products, debouncedSearchTerm]);
    
    // Cargar proveedores
    const fetchProviders = async () => {
        try {
            // CORRECCIÓN: Usar `${API_URL}/providers` en lugar de `${API_URL}/api/providers`
            const res = await ProviderService.getAll();
            setProviders(res.data);
        } catch (error) {
            console.error("Error cargando proveedores:", error);
        }
    };
    
    // --- FUNCIÓN GUARDAR PROVEEDOR (SENIAT COMPLIANT) ---
    const handleSaveProvider = async (formData) => {
        // Ya no necesitamos e.preventDefault() aquí, el modal lo hace.

        // Validamos usando 'formData' (que viene limpio del modal)
        if (!formData.rif || !formData.name || !formData.address) {
            return Swal.fire('Error', 'RIF, Razón Social y Dirección son obligatorios', 'warning');
        }

        try {
            // CORRECCIÓN AQUÍ: Quitamos el "/api" extra porque API_URL ya lo trae
            // Antes: ${API_URL}/api/providers -> Ahora: ${API_URL}/providers
            // Blindaje: El servicio ya usa el apiClient con interceptor y timeout
            await ProviderService.create(formData); // <-- Enviamos formData

            Swal.fire('Éxito', 'Proveedor registrado correctamente', 'success');

            // Recargar select (Mantenemos tus funciones de refresco)
            fetchProviders();

            setShowProviderModal(false);

            // Ya no es necesario limpiar 'setProviderForm' aquí porque el modal 
            // maneja su propio estado y se limpia solo al reabrirse.

        } catch (error) {
            // Blindaje: Captura el error específico del backend o falla de red
            console.error("Error en registro de proveedor:", error);

            const serverMessage = error.response?.data?.message;
            const finalMsg = serverMessage || 'No se pudo registrar (Posible RIF duplicado o error de conexión)';

            Swal.fire('Error', finalMsg, 'error');
        }
    };
    
    // 🛡️ Agregar item al "Carrito de Compra" (Blindado contra Stale Closures)
    const addToPurchaseCart = (product, quantity, costUsd) => {
        setPurchaseCart(prevCart => {
            const existing = prevCart.find(p => p.id === product.id);
            if (existing) {
                // Si ya existe, actualizamos usando el estado previo garantizado
                return prevCart.map(p =>
                    p.id === product.id ? { ...p, quantity: parseFloat(quantity), cost_usd: parseFloat(costUsd) } : p
                );
            } else {
                // Si es nuevo, lo anexamos de forma segura
                return [...prevCart, {
                    ...product,
                    quantity: parseFloat(quantity),
                    cost_usd: parseFloat(costUsd)
                }];
            }
        });
    };
    
    // Enviar la compra al servidor (CORREGIDO)
    const handleProcessPurchase = async () => {
        // Validación básica
        if (!purchaseForm.provider_id || !purchaseForm.invoice_number || purchaseCart.length === 0) {
            return Swal.fire('Error', 'Faltan datos de factura o productos', 'error');
        }

        try {
            // Preparamos los datos para enviar
            const payload = {
                provider_id: purchaseForm.provider_id,
                invoice_number: purchaseForm.invoice_number,
                control_number: purchaseForm.control_number,
                purchase_date: purchaseForm.date,
                exchange_rate: bcvRate,
                items: purchaseCart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    cost_usd: item.cost_usd,
                    cost_bs: (item.cost_usd * bcvRate).toFixed(2)
                }))
            };

            // 1. CORRECCIÓN DE URL:
            // Usamos `${API_URL}/purchases` directamente.
            // (Quitamos el extra "/api" porque API_URL ya lo incluye)
            await PurchaseService.create(payload);

            Swal.fire('Éxito', 'Compra registrada e inventario actualizado', 'success');

            // Limpieza del formulario
            setPurchaseCart([]);
            setPurchaseForm({ ...purchaseForm, invoice_number: '', control_number: '' });

            // 2. CORRECCIÓN DE FUNCIÓN:
            // Cambiamos 'fetchProducts()' (que no existe) por la recarga global
            // Esto recargará tus productos y el stock nuevo inmediatamente.
            if (onGlobalUpdate) onGlobalUpdate();

        } catch (error) {
            console.error(error); // Ver error detallado en consola
            Swal.fire('Error', 'No se pudo registrar la compra', 'error');
        }
    };

    return {
        searchTerm, setSearchTerm,
        debouncedSearchTerm, setDebouncedSearchTerm,
        providers, setProviders,
        purchaseCart, setPurchaseCart,
        purchaseForm, setPurchaseForm,
        providerFilter, setProviderFilter,
        showProviderModal, setShowProviderModal,
        filteredPurchaseProducts,
        fetchProviders, handleSaveProvider,
        addToPurchaseCart, handleProcessPurchase
    };
};