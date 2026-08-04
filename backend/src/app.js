const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression'); // 🚀 Optimización de vuelo de datos
const saasRoutes = require('./routes/saas.routes'); // 🚨 Nueva ruta maestra

// 🚨 [NUEVO] Importamos el Guardaespaldas de Seguridad
const { verifyToken } = require('./middlewares/auth.middleware');
const { checkLicense } = require('./middlewares/license.middleware');

// --- 1. IMPORTAR TODAS LAS RUTAS (Módulos Preservados Exactamente) ---
const authRoutes = require('./routes/auth.routes'); // 🚨 Nueva
const userRoutes = require('./routes/user.routes');
const saleRoutes = require('./routes/sale.routes');
const productRoutes = require('./routes/product.routes');
const reportRoutes = require('./routes/report.routes');
const cashRoutes = require('./routes/cash.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const customerRoutes = require('./routes/customer.routes');
const systemRoutes = require('./routes/system.routes');
const providerRoutes = require('./routes/provider.routes');
const deliveryRoutes = require('./routes/delivery.routes');

// [Rutas Puente para Compatibilidad Legacy]
const inventoryRoutes = require('./routes/inventory.routes');
const creditRoutes = require('./routes/credit.routes');

// 🚨 IMPORTAR RUTA DE ÓRDENES EN ESPERA
const heldOrderRoutes = require('./routes/heldOrder.routes');

const app = express();

// --- 2. MIDDLEWARES GLOBALES (Performance y Seguridad) ---
app.use(cors());
app.use(compression()); // Reduce el peso de los JSON enviados al frontend
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/auth', authRoutes); // 🚨 Nueva

// --- 3. REGISTRAR RUTAS DE LA API (Sin obviar nada) ---
app.use('/api/master', verifyToken, saasRoutes);
app.use('/api/sales', verifyToken, checkLicense, saleRoutes);          // Ventas y Anulaciones
app.use('/api/users', verifyToken, checkLicense, userRoutes);
app.use('/api/products', verifyToken, checkLicense, productRoutes);    // Productos
app.use('/api/reports', verifyToken, checkLicense, reportRoutes);      // Reportes y Estadísticas
app.use('/api/cash', verifyToken, checkLicense, cashRoutes);           // Control de Caja
app.use('/api/purchases', verifyToken, checkLicense, purchaseRoutes);  // Compras
app.use('/api/customers', verifyToken, checkLicense, customerRoutes);  // Clientes
app.use('/api/system', verifyToken, checkLicense, systemRoutes);       // Estado del Sistema
app.use('/api/providers', verifyToken, checkLicense, providerRoutes);  // Proveedores
app.use('/api/delivery', verifyToken, checkLicense, deliveryRoutes);   // Delivery
app.use('/api/inventory', verifyToken, checkLicense, inventoryRoutes); // Kardex
app.use('/api/credits', verifyToken, checkLicense, creditRoutes);      // Cuentas por cobrar
app.use('/api/held-orders', verifyToken, checkLicense, heldOrderRoutes);

// --- 4. SERVIR FRONTEND (Estructura para Render) ---
const buildPath = path.join(__dirname, '../../bms-pos-frontend/dist');
app.use(express.static(buildPath));

// BLINDAJE SPA: Solo redirigir al index si NO es una ruta de API
// Esto evita que errores de la API devuelvan HTML por error
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

// --- 5. MANEJADOR DE ERRORES GLOBAL (Robustez Senior) ---
app.use((err, req, res, next) => {
    console.error('❌ Error detectado:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor'
    });
});

module.exports = app;