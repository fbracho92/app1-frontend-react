// src/utils/fiscalFormatters.js
import { tenantConfig } from '../config/tenantConfig';

export const buildFiscalPayload = (cart, payments, customerData, globalDiscount = { type: 'NONE', value: 0 }, igtfUsd = 0) => {
    return {
        // Datos del cliente fiscal
        cliente: {
            nombre: customerData.full_name || 'CONSUMIDOR FINAL',
            rif: customerData.id_number || 'V000000000',
            direccion: customerData.institution || 'S/D'
        },
        // Mapeo exacto de tu carrito al formato de la impresora
        items: cart.map(item => ({
            descripcion: item.name.substring(0, 30), // Límite caracteres HKA
            cantidad: item.quantity,
            precio_unitario: item.price_usd, // o price_ves si facturas en Bs directo
            // Mapeo del IVA usando tu bandera is_taxable
            tasa_impuesto: item.is_taxable ? tenantConfig.defaultTaxRate * 100 : 0, 
            codigo_impuesto: item.is_taxable ? 'G' : 'E' // G = General (16%), E = Exento
        })),
        
        // 🚨 [NUEVO] COMANDO DE DESCUENTO GLOBAL (Art 33 Ley IVA)
        // La impresora fiscal prorrateará esto automáticamente entre las bases G y E.
        descuento_global: globalDiscount.type !== 'NONE' && globalDiscount.value > 0 ? {
            tipo: globalDiscount.type === 'PERCENTAGE' ? 'porcentaje' : 'monto',
            valor: globalDiscount.value
        } : null,

        // 🚨 [NUEVO] COMANDO DE PERCEPCIÓN IGTF (Providencia 0013)
        igtf: igtfUsd > 0 ? {
            aplica: true,
            porcentaje: tenantConfig.igtfRate * 100,
            monto_percibido: igtfUsd
        } : null,

        pagos: payments // Aquí pasaríamos un resumen de los métodos de pago
    };
};