const axios = require('axios');

/**
 * Obtiene la fecha y hora oficial sincronizada desde los servidores de Google.
 * Si falla la conexión a internet, recurre al reloj interno del servidor Linux.
 */
const getOfficialGoogleTime = async () => {
    try {
        // Hacemos una petición HEAD a los servidores ultra-rápidos de Google
        const response = await axios.head('https://www.google.com', { timeout: 3500 });
        const googleDateHeader = response.headers['date'];
        
        if (googleDateHeader) {
            const googleDate = new Date(googleDateHeader);
            // Convertimos la hora GMT de Google a la hora oficial de Venezuela (America/Caracas)
            return new Date(googleDate.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
        }
    } catch (error) {
        console.warn('⚠️ No se pudo consultar el servidor de tiempo de Google. Usando hora del servidor local.');
    }

    // Fallback de alta disponibilidad: Hora del servidor Linux (sincronizado por NTP)
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
};

module.exports = { getOfficialGoogleTime };