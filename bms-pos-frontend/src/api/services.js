import apiClient from './apiClient';

export const ProductService = {
    getAll: () => apiClient.get('/products'),
    create: (data) => apiClient.post('/products', data),
    update: (id, data) => apiClient.put(`/products/${id}`, data),
    delete: (id) => apiClient.delete(`/products/${id}`),
};

export const SaleService = {
    getAll: () => apiClient.get('/sales'),
    getOne: (id) => apiClient.get(`/sales/${id}`),
    create: (data) => apiClient.post('/sales', data),
    
    // 🚨 FASE 2: Actualizado para soportar el objeto con la Nota de Crédito
    // Soporta tanto un string (compatibilidad vieja) como el objeto nuevo
    void: (id, payload) => apiClient.post(`/sales/${id}/void`, typeof payload === 'string' ? { reason: payload } : payload),
    
    payCredit: (id, data) => apiClient.post(`/sales/${id}/pay-credit`, data),

    // 🚨 FASE 5 (SAAS MULTI-MODAL): Nuevo Endpoint para formalizar Notas de Entrega a Facturas
    billDeliveryNote: (id, payload) => apiClient.put(`/sales/${id}/formalizar`, payload),
};

export const ProviderService = {
    getAll: () => apiClient.get('/providers'),
    create: (data) => apiClient.post('/providers', data),
    update: (id, data) => apiClient.put(`/providers/${id}`, data),
};

export const PurchaseService = {
    create: (data) => apiClient.post('/purchases', data),
};

export const InventoryService = {
    getBatches: (id) => apiClient.get(`/inventory/batches/${id}`),
    getHistory: (id) => apiClient.get(`/inventory/history/${id}`),
    registerMovement: (data) => apiClient.post('/inventory/movement', data),
};

export const CustomerService = {
    getAll: () => apiClient.get('/customers'),
    // Blindaje: Si query es null, envía string vacío para evitar error 400
    search: (query = '') => apiClient.get(`/customers/search?query=${query}`),
    save: (data) => apiClient.post('/customers', data),
    addInitialBalance: (id, data) => apiClient.post(`/customers/${id}/initial-balance`, data),
};

export const CreditService = {
    getPending: () => apiClient.get('/reports/credit-pending'),
    getGrouped: () => apiClient.get('/reports/credit-grouped'),
    getByCustomer: (id) => apiClient.get(`/credits/customer/${id}`),
    payAll: (customerId, data) => apiClient.post(`/credits/customer/${customerId}/pay-all`, data),
};

export const CashService = {
    getStatus: () => apiClient.get('/cash/current-status'),
    open: (data) => apiClient.post('/cash/open', data),
    close: (data) => apiClient.post('/cash/close', data),
};

export const ReportService = {
    // 🚀 OPTIMIZACIÓN MULTI-CAJA: Se añadió (params = {}) a los reportes que lo soportan en el backend
    getDaily: (params = {}) => apiClient.get('/reports/daily', { params }),
    getRecentSales: (params = {}) => apiClient.get('/reports/recent-sales', { params }),
    getLowStock: () => apiClient.get('/reports/low-stock'),
    getSalesToday: (params = {}) => apiClient.get('/reports/sales-today', { params }),
    // Blindaje: Asegura que params sea al menos un objeto vacío
    getSalesDetail: (params = {}) => apiClient.get('/reports/sales-detail', { params }),
    getInventoryDetail: () => apiClient.get('/reports/inventory-detail'),
    getAnalytics: (params = {}) => apiClient.get('/reports/analytics', { params }),
    getSalesBook: (params = {}) => apiClient.get('/reports/legal/sales-book', { params }),
    getAgedDebt: () => apiClient.get('/reports/legal/aged-debt'),
    getClosings: (params = {}) => apiClient.get('/reports/closings', { params }),
    getConnectivityLogs: () => apiClient.get('/reports/legal/connectivity-logs'),
};

export const AnalyticsService = {
    getGeneral: () => apiClient.get('/reports/analytics'),
};

export const SettingsService = {
    getExchangeRate: () => apiClient.get('/system'),
};

export const HeldOrderService = {
    getAll: () => apiClient.get('/held-orders'),
    save: (data) => apiClient.post('/held-orders', data),
    delete: (id) => apiClient.delete(`/held-orders/${id}`)
};

export const DeliveryService = {
    // Hacemos que getAll apunte a tu ruta existente de drivers
    getAll: () => apiClient.get('/delivery/drivers'), 
    // Nuevas rutas para crear y editar el perfil del transportista
    create: (data) => apiClient.post('/delivery/drivers', data), 
    update: (id, data) => apiClient.put(`/delivery/drivers/${id}`, data),
    
    getDrivers: () => apiClient.get('/delivery/drivers'),
    getActive: () => apiClient.get('/delivery/active'),
    linkSale: (data) => apiClient.post('/delivery/link', data),
    updateStatus: (id, status) => apiClient.put(`/delivery/${id}/status`, { status }),
};

export const SystemService = {
    getSequences: () => apiClient.get('/system/sequences'),
    updateSequence: (data) => apiClient.put('/system/sequences', data),
    
    // 🚨 [NUEVO] Puente para enviar las configuraciones generales a la BD
    updateSettings: (data) => apiClient.put('/system/settings', data),
    getSettings: () => apiClient.get('/system/settings'),
    
    // 🚨 [NUEVO] Conexión Multi-Estación
    getRegisters: () => apiClient.get('/system/registers'),
    updateRegister: (id, data) => apiClient.put(`/system/registers/${id}`, data),
    createRegister: (data) => apiClient.post('/system/registers', data),

    // 🚨 PUENTE DE COMPATIBILIDAD FRONTEND: Evita que el modal falle si se llama desde SystemService
    billDeliveryNote: (id, payload) => apiClient.put(`/sales/${id}/formalizar`, payload)
};

export const AuthService = {
    // 🛡️ Enviar credenciales para iniciar sesión
    login: (credentials) => apiClient.post('/auth/login', credentials),
    
    // 🛡️ (Futuro) Solicitud de recuperación de clave
    recoverPassword: (email) => apiClient.post('/auth/recover', { email }),
    
    // 🚨 [NUEVO] Métodos para el Flujo de Recuperación de Contraseña
    forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
    resetPassword: (data) => apiClient.post('/auth/reset-password', data)
};

export const SaasService = {
    getAllTenants: () => apiClient.get('/master/tenants'),
    createTenant: (data) => apiClient.post('/master/tenants', data),
    renewLicense: (id, data) => apiClient.put(`/master/tenants/${id}/renew`, data),
    toggleSuspension: (id, suspender) => apiClient.put(`/master/tenants/${id}/suspend`, { suspender }),
    // 🚨 NUEVO: Servicio para actualizar la personalización del inquilino
    updateTenant: (id, data) => apiClient.put(`/master/tenants/${id}`, data),
    
    // 🚨 NUEVOS SERVICIOS FINANCIEROS SAAS
    getAllInvoices: () => apiClient.get('/master/invoices'),
    registerPayment: (invoiceId, data) => apiClient.post(`/master/invoices/${invoiceId}/pay`, data)
};
