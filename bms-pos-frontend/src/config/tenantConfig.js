/**
 * ============================================================================
 * ARCHIVO DE CONFIGURACIÓN MAESTRA SAAS (BMS DIGITAL)
 * ============================================================================
 * Este archivo ahora funciona como la "Marca Paraguas" para el Login.
 * Una vez el usuario inicia sesión, el sistema sobreescribirá estos datos
 * con la identidad visual y fiscal descargada desde la Base de Datos.
 * ============================================================================
 */

export const tenantConfig = {
    // ---------------------------------------------------------
    // 1. IDENTIDAD DEL NEGOCIO (MARCA PARAGUAS - LOGIN)
    // ---------------------------------------------------------
    tradeName: "BMS Digital",
    companyName: "BMSDigital es tu solución", 
    companyDocument: "J-00000000-0", 
    companyAddress: "Plataforma Cloud Segura",
    companyPhone: "+58 000-0000000",
    companyEmail: "soporte@bmsdigital.com",
    
    isSpecialTaxpayer: false, 
    igtfRate: 0.03,          

    // ---------------------------------------------------------
    // 2. CONFIGURACIÓN DE IMPRESIÓN Y TICKETS (VALORES POR DEFECTO)
    // ---------------------------------------------------------
    receiptFooterMessage: "Gracias por su preferencia.",
    receiptSecondaryMessage: "Recibí conforme mercancía y servicios. Precios en Bolívares según tasa oficial BCV vigente.",
    printerPaperSize: "80mm", 
    
    formaLibreMarginTop: 45,      
    formaLibreMarginLeft: 10,     
    formaLibreSerie: "SERIE - A", 
    formaLibrePaperSize: "half-letter", 
    
    // ---------------------------------------------------------
    // 3. IDENTIDAD VISUAL (LOGOS)
    // ---------------------------------------------------------
    // Este logo es el que se verá en el Login. Usa el logo oficial de BMS Digital.
    // He colocado un logo neutral provisional, cámbialo por el enlace de tu logo real.
    logoUrl: "https://i.postimg.cc/dtH6wGzv/Logo-01.png", 
    
    // ---------------------------------------------------------
    // 4. PREFERENCIAS REGIONALES Y FISCALES
    // ---------------------------------------------------------
    primaryCurrency: "Bs",      
    secondaryCurrency: "Ref",   
    taxName: "IVA",             
    defaultTaxRate: 0.16,       
    
    // ---------------------------------------------------------
    // 5. MODO DE FACTURACIÓN (CUMPLIMIENTO SENIAT)
    // ---------------------------------------------------------
    invoiceMode: 'FORMA_LIBRE', 
    fiscalPrinterIP: 'http://localhost:8080', 
};