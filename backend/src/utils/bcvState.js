let currentRate = 0;
// CRÍTICO: Definimos un valor base por si el Scraper falla o tarda
const FALLBACK_RATE = 40.00; 

module.exports = {
    // Si la tasa es 0 o inválida, devolvemos el Fallback
    getRate: () => (currentRate > 0 ? currentRate : FALLBACK_RATE),
    setRate: (rate) => { currentRate = rate; },
    getFallback: () => FALLBACK_RATE
};