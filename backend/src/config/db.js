const { Pool } = require('pg');

// Configuración optimizada para alta disponibilidad y conexiones remotas
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    
    // 🚨 BLINDAJE DE ESTABILIDAD DE RED (Certificado 100%)
    max: 20,                       // Límite de conexiones simultáneas para evitar saturación de CPU
    idleTimeoutMillis: 30000,      // Cierra conexiones inactivas en 30s para liberar RAM
    connectionTimeoutMillis: 15000, // ⬆️ Ampliado a 15s para tolerar latencia en la nube
    keepAlive: true,                // 🛡️ Mantiene el túnel TCP abierto para evitar desconexiones por inactividad
    keepAliveInitialDelayMillis: 10000 
});

// Mantenemos la lógica de TimeZone crítica para Venezuela
pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'America/Caracas'", (err) => {
        if (err) console.error('Error configurando Timezone DB:', err);
    });
});

// 🚨 Captura de errores a nivel del Pool para evitar caídas del servidor
pool.on('error', (err) => {
    console.error('Error inesperado en el Pool de Postgres:', err.message);
});

module.exports = pool;