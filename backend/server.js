require('dotenv').config();
// ?? PRESERVADO: Forzar Hora Venezuela a nivel global
process.env.TZ = 'America/Caracas'; 

const app = require('./src/app');
const actualizarTasaBCV = require('./src/utils/bcvScraper');

// ?? IMPORTACIONES DE TAREAS PROGRAMADAS (CRON JOBS)
const { startBillingCron } = require('./src/utils/billingCron');
const { startDemoResetCron } = require('./src/utils/demoResetCron'); // <-- NUEVO: Cron de Reseteo Demo

// ?? PRESERVADO: Configuraci車n de DB y ejecuci車n de migraciones
require('./src/config/db'); 

const port = process.env.PORT || 3000;

// 1. Iniciar Cron Jobs (Tasa del BCV y Tareas Autom芍ticas)
console.log('?? Iniciando servicio de tasas (BCV)...');

// BLINDAJE: Ejecuci車n inicial as赤ncrona para no bloquear el arranque del servidor
const iniciarServicios = async () => {
    try {
        await actualizarTasaBCV();
        console.log('? Tasa inicial cargada correctamente.');
    } catch (err) {
        // Si el BCV est芍 ca赤do, el servidor sigue encendido
        console.error('?? Aviso: No se pudo cargar la tasa inicial (BCV Offline).');
    }

    // ?? BLINDAJE EXTRA: Iniciamos el Cron de Facturaci車n independientemente del BCV
    try {
        startBillingCron();
    } catch (err) {
        console.error('? Error al iniciar el Cron de Facturaci車n SaaS:', err.message);
    }

    // ??? BLINDAJE DEMO: Iniciamos el Cron de Reseteo aislado para la Empresa 1
    try {
        startDemoResetCron();
    } catch (err) {
        console.error('? Error al iniciar el Cron de Reseteo Demo:', err.message);
    }
};

iniciarServicios();

// ?? PRESERVADO: Actualizar cada hora (3600000 ms)
setInterval(async () => {
    try {
        await actualizarTasaBCV();
    } catch (err) {
        console.error('? Error en actualizaci車n c赤clica de tasa:', err.message);
    }
}, 3600000);

// 2. Iniciar Servidor Web
const server = app.listen(port, () => {
    console.log(`=============================================`);
    console.log(`?? SERVIDOR BMS MODULAR ONLINE EN PUERTO: ${port}`);
    console.log(`?? ZONA HORARIA: ${process.env.TZ}`);
    console.log(`?? ENTORNO: ${process.env.NODE_ENV || 'production'}`);
    console.log(`=============================================`);
});

// 3. BLINDAJE ANTI-CRASH: Captura de errores fuera de las rutas de Express
process.on('unhandledRejection', (reason, promise) => {
    console.error('??? Rechazo no manejado en:', promise, 'raz車n:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('??? Excepci車n no capturada:', err);
    // En errores cr赤ticos de memoria o CPU, cerramos para que Render reinicie la instancia
    process.exit(1);
});

// 4. APAGADO ELEGANTE (Graceful Shutdown)
// Vital para que Render cierre las conexiones a la DB correctamente al desplegar
process.on('SIGTERM', () => {
    console.log('?? Se?al SIGTERM recibida. Cerrando servidor de forma segura...');
    server.close(() => {
        console.log('?? Procesos finalizados.');
        process.exit(0);
    });
});