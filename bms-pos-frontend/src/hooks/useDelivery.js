import { useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { DeliveryService } from '../api/services';

export const useDelivery = (onGlobalUpdate) => {
    const [deliveries, setDeliveries] = useState([]);
    const [drivers, setDrivers] = useState([]); // 🚨 Estado para motorizados
    const [isLoading, setIsLoading] = useState(false);

    const fetchDeliveries = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await DeliveryService.getActive();
            setDeliveries(res.data || []);
        } catch (error) {
            console.error("Error al cargar deliveries", error);
            // 🛡️ BLINDAJE UX: Mensaje de error adaptativo y corporativo
            Swal.fire({ 
                icon: 'error', 
                title: 'Error de Conexi\u00F3n', 
                text: 'No se pudieron cargar los despachos activos.', 
                buttonsStyling: false,
                customClass: { 
                    popup: 'rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl border border-white/80 backdrop-blur-xl bg-white/90',
                    confirmButton: 'w-full sm:w-auto bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-lg active:scale-95 outline-none mt-2'
                } 
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 🚨 Función para buscar los motorizados activos (Intacta)
    const fetchDrivers = useCallback(async () => {
        try {
            const res = await DeliveryService.getDrivers();
            setDrivers(res.data || []);
        } catch (error) {
            console.error("Error al cargar motorizados", error);
        }
    }, []);

    const changeStatus = async (saleId, newStatus) => {
        try {
            // 🛡️ BLINDAJE UX: Loader nativo transparente (Glassmorphism)
            Swal.fire({ 
                title: '', 
                html: '<span class="text-sm font-bold text-slate-500 animate-pulse">Registrando movimiento log\u00EDstico...</span>',
                allowOutsideClick: false,
                background: 'transparent',
                backdrop: 'rgba(255,255,255,0.8)',
                didOpen: () => Swal.showLoading(), 
                customClass: { popup: 'shadow-none border-0' } 
            });
            
            await DeliveryService.updateStatus(saleId, newStatus);
            await fetchDeliveries();
            if (onGlobalUpdate) onGlobalUpdate();
            
            // 🛡️ BLINDAJE UX: Toast Neumórfico suave y moderno
            Swal.mixin({ 
                toast: true, 
                position: 'top', 
                showConfirmButton: false, 
                timer: 2000,
                timerProgressBar: true,
                customClass: { popup: 'rounded-xl shadow-lg border border-slate-100 font-sans mt-2' },
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer)
                    toast.addEventListener('mouseleave', Swal.resumeTimer)
                }
            }).fire({
                icon: 'success', 
                title: `Movido a ${newStatus.replace('_', ' ')}` 
            });

        } catch (error) {
            // 🛡️ BLINDAJE UX: Error controlado adaptativo
            Swal.fire({ 
                icon: 'error', 
                title: 'Error de Actualizaci\u00F3n', 
                text: 'No se pudo actualizar el estatus del despacho.', 
                buttonsStyling: false,
                customClass: { 
                    popup: 'rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl border border-white/80',
                    confirmButton: 'w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-lg active:scale-95 outline-none mt-2'
                } 
            });
        }
    };

    return { deliveries, drivers, isLoading, fetchDeliveries, fetchDrivers, changeStatus };
};