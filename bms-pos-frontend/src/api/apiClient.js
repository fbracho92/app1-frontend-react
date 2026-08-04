// src/api/apiClient.js
import axios from 'axios';
import Swal from 'sweetalert2'; 
import { API_URL } from '../constants/appConstants';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Blindaje: 10 segundos de timeout para evitar peticiones colgadas en redes lentas
    timeout: 10000, 
});

// 🛡️ INTERCEPTOR DE PETICIONES (Inyecta el Token y la Estación Activa)
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('bms_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        // 🚨 PASO 3: INYECCIÓN DE LA ESTACIÓN DE TRABAJO (AUTO-SANABLE) 🚨
        let finalRegisterId = '1'; // Fallback a Caja Principal por defecto para evitar Error 500

        const activeRegister = localStorage.getItem('bms_active_register');
        const altRegister = localStorage.getItem('register_id'); // Llave alternativa

        if (activeRegister && activeRegister !== 'undefined') {
            try {
                const registerObj = JSON.parse(activeRegister);
                if (registerObj && registerObj.id) {
                    finalRegisterId = registerObj.id.toString();
                }
            } catch (e) {
                // Si guardaron un string en vez de JSON
                finalRegisterId = activeRegister.toString();
            }
        } else if (altRegister) {
            finalRegisterId = altRegister.toString();
        }

        // Siempre enviamos el ID, garantizando que el backend no colapse
        config.headers['X-Register-Id'] = finalRegisterId;

        return config;
    },
    (error) => Promise.reject(error)
);

// --- INTERCEPTOR DE BLINDAJE CENTRALIZADO ---
apiClient.interceptors.response.use(
    (response) => {
        // Si la respuesta es exitosa, se retorna tal cual
        return response;
    },
    (error) => {
        // 🚀 1. EXPULSIÓN SOLO POR TOKEN VENCIDO (401)
        if (error.response && error.response.status === 401) {
            const activeToken = localStorage.getItem('bms_token');

            if (activeToken && !error.config.url.includes('/auth/login')) {
                localStorage.removeItem('bms_token');
                localStorage.removeItem('bms_user');
                localStorage.removeItem('bms_active_register');
                window.dispatchEvent(new Event('bms_session_expired'));
            }
            return Promise.reject(error); 
        }

        let errorMessage = 'Error de conexión con el servidor de Bracho Multiservicios';

        if (error.response) {
            errorMessage = error.response.data?.message || error.response.data?.error || `Error del Servidor: ${error.response.status}`;
        } else if (error.request) {
            errorMessage = 'No se recibió respuesta del servidor. Verifique su conexión a internet.';
        } else {
            errorMessage = error.message;
        }

        console.error(' [QA-NETWORK-ERROR]:', errorMessage);

        // 🚀 2. FIX CRÍTICO: SILENCIAR ALERTAS DE "CAJA OCUPADA"
        // Si el sistema consulta el estado de la caja en segundo plano y está ocupada, 
        // rechazamos el error silenciosamente para que el Gerente no reciba spam de alertas.
        const isCajaOcupada = errorMessage === 'CAJA_OCUPADA' || errorMessage?.includes('CAJA_OCUPADA');
        const isCashEndpoint = error.config?.url?.includes('/cash/current-status');

        if (isCajaOcupada || (error.response?.status === 403 && isCashEndpoint)) {
            return Promise.reject(error); // Salida silenciosa sin Swal.fire
        }

        // 🚀 3. ALERTA VISUAL GLOBAL PARA EL RESTO DE ERRORES (Permisos, BD, Red)
        Swal.fire({
            icon: 'error',
            title: '¡Ups! Algo salió mal',
            text: errorMessage,
            confirmButtonColor: '#10b981', 
            confirmButtonText: 'Entendido',
            background: '#ffffff',
            customClass: {
                popup: 'rounded-[2rem]',
                confirmButton: 'rounded-xl font-bold py-3 px-6'
            }
        });

        return Promise.reject(error);
    }
);

export default apiClient;