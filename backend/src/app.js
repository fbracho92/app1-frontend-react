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
const heldOrderController = require('./controllers/heldOrder.controller');
app.post('/api/public/held-orders', heldOrderController.savePublicOrder);

// 👇 [NUEVO SAAS] ENDPOINT PÚBLICO BLINDADO PARA EL CATÁLOGO QR 👇
const pool = require('./config/db');
const productService = require('./services/product.service');
const { getRate } = require('./utils/bcvState');

app.get('/api/public/catalog/:empresaId', async (req, res) => {
    try {
        const empresaId = parseInt(req.params.empresaId, 10);
        if (isNaN(empresaId)) return res.status(400).json({ error: 'ID de empresa inválido' });

        // 1. Validar que la empresa exista y NO esté suspendida (Blindaje Kill-Switch)
        const empCheck = await pool.query(
            'SELECT nombre, rif, logo_url FROM empresas WHERE id = $1 AND suspendido_manualmente = FALSE', 
            [empresaId]
        );
        
        if (empCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Catálogo no disponible o empresa inactiva' });
        }

        // 2. Extraer datos vitales para el QR (Productos filtrados y Tasa BCV Oficial)
        const products = await productService.getAllProducts(empresaId);
        const bcvRate = getRate() || 40.00;

        res.json({
            success: true,
            empresa: empCheck.rows[0],
            bcvRate,
            products
        });
    } catch (error) {
        console.error('❌ Error en catálogo público:', error.message);
        res.status(500).json({ error: 'Error cargando el catálogo público' });
    }
});
// 👆 FIN DEL ENDPOINT PÚBLICO 👆

app.use('/api/master', verifyToken, saasRoutes);
app.use('/api/sales', verifyToken, checkLicense, saleRoutes);         // Ventas y Anulaciones
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