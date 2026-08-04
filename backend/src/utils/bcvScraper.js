const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { setRate } = require('./bcvState');
const pool = require('../config/db'); // 🚨 Conexión a DB para persistencia legal

const agent = new https.Agent({ rejectUnauthorized: false });

async function actualizarTasaBCV() {
    try {
        console.log('🔄 Sincronizando con portal oficial BCV...');
        
        // Mantenemos tu configuración original de Axios
        const response = await axios.get('https://www.bcv.org.ve/', { 
            httpsAgent: agent,
            timeout: 8000 // Añadimos un pequeño margen de espera para servidores lentos
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Mantenemos tus selectores originales exactamente igual
        const dollarElement = $('#dolar .centrado strong').first();
        const rateText = dollarElement.text().trim();

        if (rateText) {
            // Mantenemos tu lógica de limpieza de caracteres (Puntos por nada, comas por puntos)
            const cleanRate = parseFloat(rateText.replace(/\./g, '').replace(/,/g, '.'));
            
            if (!isNaN(cleanRate) && cleanRate > 0) {
                // 1. Actualizar Memoria Volátil (Tu función original)
                setRate(cleanRate);
                
                // 2. PERSISTENCIA EN DB (Blindaje contra intervención o caídas)
                // Se guarda en JSONB para trazabilidad legal ante el SENIAT/SUNDDE
                await pool.query(`
                    INSERT INTO system_settings (key, value, updated_at)
                    VALUES ('bcv_rate', $1, CURRENT_TIMESTAMP)
                    ON CONFLICT (key) 
                    DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
                `, [JSON.stringify({ amount: cleanRate, status: 'oficial' })]);

                console.log(`�?Tasa BCV actualizada: ${cleanRate} Bs/$ (Sincronizada y Guardada)`);
                return; 
            }
        }
    } catch (error) {
        console.error('⚠️ Portal BCV inalcanzable:', error.message);
        console.log('📡 Iniciando protocolo de contingencia (Rescate de DB)...');
        
        // 3. RECUPERACIÓN DE EMERGENCIA
        // Si la web del BCV no carga, rescatamos la última tasa oficial exitosa de nuestra DB
        try {
            const res = await pool.query("SELECT value FROM system_settings WHERE key = 'bcv_rate'");
            
            if (res.rows.length > 0) {
                const lastSavedRate = parseFloat(res.rows[0].value.amount);
                setRate(lastSavedRate);
                console.log(`📡 Contingencia Exitosa: Aplicando tasa guardada de ${lastSavedRate} Bs/$`);
            } else {
                console.error('�?Error: No se encontró una tasa previa en la Base de Datos.');
            }
        } catch (dbError) {
            console.error('🚨 Error crítico de conexión a Base de Datos:', dbError.message);
        }
    }
}

module.exports = actualizarTasaBCV;