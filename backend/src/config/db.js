const { Pool } = require('pg');

// Configuración optimizada para alta disponibilidad y "vuelo" de procesos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    
    // MEJORAS DE PERFORMANCE (PUNTO 3)
    max: 20,                       // Límite de conexiones simultáneas para evitar saturación de CPU
    idleTimeoutMillis: 30000,      // Cierra conexiones inactivas en 30s para liberar memoria RAM
    connectionTimeoutMillis: 2000  // Falla rápido si la DB no responde en 2s (evita cuellos de botella)
});

// Mantenemos tu lógica de TimeZone crítica para Venezuela
pool.on('connect', (client) => {
    client.query("SET TIME ZONE 'America/Caracas'", (err) => {
        if (err) console.error('Error configurando Timezone DB:', err);
    });
});

module.exports = pool;