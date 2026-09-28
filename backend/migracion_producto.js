const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// --- LISTA COMPLETA DE PRODUCTOS (AUDITORÍA PDF 04/08/2026 - TASA BCV: 752.09) ---
const PRODUCTOS_A_MIGRAR = [
    { barcode: "INT-791022", name: "BROWNIE", price_usd: 1.50, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-47703", name: "CHOCO AREQUIPE", price_usd: 0.55, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-765046", name: "COLADO HEINZ 113G", price_usd: 1.30, category: "Postre", icon_emoji: "🍰", stock: 4, is_perishable: true },
    { barcode: "INT-908486", name: "DUO DE PONQUECITOS", price_usd: 1.15, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-683190", name: "GELATINA", price_usd: 1.45, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-979433", name: "MINI PANQUE", price_usd: 0.63, category: "Postre", icon_emoji: "🍰", stock: 12, is_perishable: true },
    { barcode: "INT-474931", name: "PANQUE QUEEN", price_usd: 1.65, category: "Postre", icon_emoji: "🍰", stock: 2, is_perishable: true },
    { barcode: "INT-762923", name: "PONQUECITOS", price_usd: 0.55, category: "Postre", icon_emoji: "🍰", stock: 11, is_perishable: true },
    { barcode: "INT-450238", name: "PONQUECITOS BRIGADEIRO", price_usd: 3.50, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-692635", name: "TORTA DE AUYAMA", price_usd: 1.00, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-435800", name: "TORTA DE CAMBUR", price_usd: 2.50, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-268650", name: "TORTA DE CHOCOLATE", price_usd: 1.00, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-884348", name: "TORTA DE PAN", price_usd: 1.00, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-510089", name: "TORTA DE PIÑA", price_usd: 1.00, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-916454", name: "TORTA DE VAINILLA", price_usd: 1.19, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-243245", name: "TORTA MARMOLEADA", price_usd: 1.29, category: "Postre", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { barcode: "INT-602708", name: "Refresco 2Litro", price_usd: 2.20, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "INT-18", name: "AGUA 1.50ML LARA", price_usd: 2.00, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "7702111510807", name: "AGUA 333ml Lara", price_usd: 0.60, category: "Bebidas", icon_emoji: "🥤", stock: 44, is_perishable: true },
    { barcode: "INT171286-", name: "AGUA 600ml Minalba", price_usd: 1.10, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "INT-488406", name: "AGUA 600ml NEVADA", price_usd: 1.05, category: "Bebidas", icon_emoji: "🥤", stock: 19, is_perishable: true },
    { barcode: "INT-891230", name: "AGUA GASIFICADA 355ml", price_usd: 1.00, category: "Bebidas", icon_emoji: "🥤", stock: 9, is_perishable: true },
    { barcode: "INT-676594", name: "AVENA", price_usd: 0.65, category: "Bebidas", icon_emoji: "🥤", stock: 9, is_perishable: true },
    { barcode: "INT-324250", name: "GATORADE", price_usd: 2.20, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "INT-956912", name: "JUGO 400ml", price_usd: 0.95, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "INT-433946", name: "JUGO NATULAC 250ML", price_usd: 1.20, category: "Bebidas", icon_emoji: "🥤", stock: 10, is_perishable: true },
    { barcode: "INT-545286", name: "MALTA", price_usd: 0.80, category: "Bebidas", icon_emoji: "🥤", stock: 1, is_perishable: true },
    { barcode: "INT-132868", name: "REFRESCO", price_usd: 1.00, category: "Bebidas", icon_emoji: "🥤", stock: 14, is_perishable: true },
    { barcode: "INT-509236", name: "REFRESCO 1,50ml", price_usd: 1.90, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "INT-214158", name: "REFRESCO 1 LITRO", price_usd: 1.35, category: "Bebidas", icon_emoji: "🥤", stock: 5, is_perishable: true },
    { barcode: "INT-594280", name: "SODA", price_usd: 1.10, category: "Bebidas", icon_emoji: "🥤", stock: 2, is_perishable: true },
    { barcode: "INT-31226", name: "TE LIMON", price_usd: 1.80, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "INT-657579", name: "EMPANADA", price_usd: 0.69, category: "Alimentos", icon_emoji: "🥪", stock: 9, is_perishable: true },
    { barcode: "INT-258479", name: "PANQUE DANY'S", price_usd: 1.90, category: "Alimentos", icon_emoji: "🥪", stock: 0, is_perishable: true },
    { barcode: "INT-56436", name: "PAN SOLO", price_usd: 0.45, category: "Alimentos", icon_emoji: "🥪", stock: 0, is_perishable: true },
    { barcode: "INT-46552", name: "SANDWICH", price_usd: 2.00, category: "Alimentos", icon_emoji: "🥪", stock: 0, is_perishable: true },
    { barcode: "INT-429494", name: "SANDWICH INTEGRAL", price_usd: 1.80, category: "Alimentos", icon_emoji: "🥪", stock: 0, is_perishable: true },
    { barcode: "INT-345856", name: "CAFÉ GRANDE 57", price_usd: 0.55, category: "Cafeteria", icon_emoji: "☕", stock: 21, is_perishable: true },
    { barcode: "INT-285806", name: "CAFÉ MEDIΑΝΟ 47", price_usd: 0.45, category: "Cafeteria", icon_emoji: "☕", stock: 12, is_perishable: true },
    { barcode: "INT-46199", name: "CAFÉ PEQUEÑO 27", price_usd: 0.23, category: "Cafeteria", icon_emoji: "☕", stock: 21, is_perishable: true },
    { barcode: "INT-109121", name: "Combo Imagen", price_usd: 1.00, category: "Cafeteria", icon_emoji: "☕", stock: 10, is_perishable: true },
    { barcode: "INT-896200", name: "NESCAFE BEBIDA ACHOCOLATADA", price_usd: 2.50, category: "Cafeteria", icon_emoji: "☕", stock: 20, is_perishable: true },
    { barcode: "INT-216564", name: "NESCAFE CAFÉ CON LECHE", price_usd: 2.50, category: "Cafeteria", icon_emoji: "☕", stock: 14, is_perishable: true },
    { barcode: "INT-974441", name: "NESCAFE CAPPUCCINO", price_usd: 2.50, category: "Cafeteria", icon_emoji: "☕", stock: 12, is_perishable: true },
    { barcode: "INT-189224", name: "NESCAFE CAPPUCCINO VAINILLA", price_usd: 2.50, category: "Cafeteria", icon_emoji: "☕", stock: 32, is_perishable: true },
    { barcode: "INT-677709", name: "NESCAFE CHOCO VAINILLA", price_usd: 2.50, category: "Cafeteria", icon_emoji: "☕", stock: 11, is_perishable: true },
    { barcode: "INT-77421", name: "NESCAFE LATTE VAINILLA", price_usd: 2.50, category: "Cafeteria", icon_emoji: "☕", stock: 6, is_perishable: true },
    { barcode: "INT-196502", name: "NESCAFE MOKACCINO", price_usd: 2.50, category: "Cafeteria", icon_emoji: "☕", stock: 21, is_perishable: true },
    { barcode: "INT-264410", name: "BOCADILLO GUAYABA", price_usd: 0.30, category: "Dulces Criollos", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-492589", name: "BOCADILLO PLATANO", price_usd: 0.65, category: "Dulces Criollos", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-501178", name: "BOCADILLO TAMARINDO", price_usd: 0.72, category: "Dulces Criollos", icon_emoji: "🍬", stock: 1, is_perishable: true },
    { barcode: "INT-428259", name: "CONSERVA DE GUAYABA CON LECHE", price_usd: 0.20, category: "Dulces Criollos", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-672384", name: "CONSERVA DE LECHE", price_usd: 0.50, category: "Dulces Criollos", icon_emoji: "🍬", stock: 14, is_perishable: true },
    { barcode: "INT-45258", name: "Conservas Mixtas", price_usd: 0.80, category: "Dulces Criollos", icon_emoji: "🍬", stock: 4, is_perishable: true },
    { barcode: "INT-79931", name: "Bocadillo Galleta Guayaba", price_usd: 0.35, category: "Galletas", icon_emoji: "🍪", stock: 12, is_perishable: true },
    { barcode: "INT-887218", name: "CANELITAS", price_usd: 0.90, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-68633", name: "COCOSETE", price_usd: 1.55, category: "Galletas", icon_emoji: "🍪", stock: 2, is_perishable: true },
    { barcode: "INT-612360", name: "GALLETA CHISPA DE CHOCOLATE", price_usd: 1.35, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-622578", name: "GALLETA DE AVENA", price_usd: 0.75, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-891273", name: "GALLETA DE SODA", price_usd: 0.30, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-742746", name: "GALLETA GUAYABA INDEPENDENCIA", price_usd: 0.78, category: "Galletas", icon_emoji: "🍪", stock: 4, is_perishable: true },
    { barcode: "INT-180874", name: "GALLETA HONNY", price_usd: 0.55, category: "Galletas", icon_emoji: "🍪", stock: 46, is_perishable: true },
    { barcode: "INT-18011", name: "GALLETA KRAKER", price_usd: 0.55, category: "Galletas", icon_emoji: "🍪", stock: 11, is_perishable: true },
    { barcode: "INT-649275", name: "GALLETA MARIA", price_usd: 0.32, category: "Galletas", icon_emoji: "🍪", stock: 11, is_perishable: true },
    { barcode: "INT-910935", name: "GALLETA OREO", price_usd: 0.70, category: "Galletas", icon_emoji: "🍪", stock: 1, is_perishable: true },
    { barcode: "INT-472993", name: "GALLETAS CLUB SOCIAL", price_usd: 0.42, category: "Galletas", icon_emoji: "🍪", stock: 9, is_perishable: true },
    { barcode: "INT-170596", name: "GALLETAS MINI", price_usd: 0.75, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-71897", name: "GALLETAS PANCHI-GUAYABA", price_usd: 0.90, category: "Galletas", icon_emoji: "🍪", stock: 3, is_perishable: true },
    { barcode: "INT-378671", name: "GALLETAS RELLENAS", price_usd: 2.70, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-8998", name: "GALLETAS SURTIDAS", price_usd: 1.35, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-460", name: "MAX COCO", price_usd: 0.70, category: "Galletas", icon_emoji: "🍪", stock: 4, is_perishable: true },
    { barcode: "INT-42810", name: "PALITO", price_usd: 0.60, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-484931", name: "PIAZZA", price_usd: 0.25, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-196666", name: "PIRUETA", price_usd: 0.42, category: "Galletas", icon_emoji: "🍪", stock: 4, is_perishable: true },
    { barcode: "INT-776021", name: "SAMBA", price_usd: 1.30, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-955442", name: "SAMBA MINI", price_usd: 0.75, category: "Galletas", icon_emoji: "🍪", stock: 4, is_perishable: true },
    { barcode: "INT-381337", name: "SUSY", price_usd: 1.20, category: "Galletas", icon_emoji: "🍪", stock: 12, is_perishable: true },
    { barcode: "INT-819521", name: "TROPICOCO", price_usd: 0.50, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { barcode: "INT-217575", name: "TAMARINDO BOCADILLO", price_usd: 0.45, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-165315", name: "BARQUILLON", price_usd: 0.75, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-292318", name: "BIANCHI BOMBOM", price_usd: 0.20, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-291500", name: "BIANCHI SNACK", price_usd: 1.15, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-555852", name: "CARAMELOS BIANCHI", price_usd: 0.06, category: "Golosinas", icon_emoji: "🍬", stock: 83, is_perishable: true },
    { barcode: "INT-433777", name: "CARAMELOS CAFÉ GOURMET", price_usd: 0.07, category: "Golosinas", icon_emoji: "🍬", stock: 87, is_perishable: true },
    { barcode: "INT-636258", name: "CARAMELOS CHAO", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 86, is_perishable: true },
    { barcode: "INT-878128", name: "CARAMELOS CHAO EN LINEA", price_usd: 0.20, category: "Golosinas", icon_emoji: "🍬", stock: 3, is_perishable: true },
    { barcode: "INT-773756", name: "CARAMELOS CHAO PASTILLAS", price_usd: 0.40, category: "Golosinas", icon_emoji: "🍬", stock: 1, is_perishable: true },
    { barcode: "INT-812100", name: "CARAMELOS CHOCO TURRON", price_usd: 0.08, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-386820", name: "CARAMELOS LOKIÑO", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 89, is_perishable: true },
    { barcode: "INT-259419", name: "CARAMELOS MENTA HELADA", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 37, is_perishable: true },
    { barcode: "INT-634595", name: "CARAMELOS RICATO", price_usd: 0.07, category: "Golosinas", icon_emoji: "🍬", stock: 45, is_perishable: true },
    { barcode: "INT-915505", name: "CARAMELOS TAMARINDO", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 108, is_perishable: true },
    { barcode: "INT-210093", name: "CHICLE AGOGO", price_usd: 0.28, category: "Golosinas", icon_emoji: "🍬", stock: 40, is_perishable: true },
    { barcode: "INT-694636", name: "CHICLES TRIDENT", price_usd: 0.80, category: "Golosinas", icon_emoji: "🍬", stock: 5, is_perishable: true },
    { barcode: "INT-752190", name: "CHICLES TRIDENT INDIVIDUAL", price_usd: 0.20, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-688548", name: "CHOCOLATE SAVOY CRICRI", price_usd: 1.60, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-854536", name: "CHOCOLATE SAVOY DE LECHE 30GR", price_usd: 1.65, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-83423", name: "CHOCOLATE SAVOY DE LECHE 70GR", price_usd: 3.20, category: "Golosinas", icon_emoji: "🍬", stock: 1, is_perishable: true },
    { barcode: "INT-218279", name: "CHOCO LOOK RELLENOS", price_usd: 0.50, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-144394", name: "CHUPETAS", price_usd: 0.25, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-517498", name: "DANDY", price_usd: 0.50, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-888851", name: "FLAQUITO MINI", price_usd: 0.25, category: "Golosinas", icon_emoji: "🍬", stock: 7, is_perishable: true },
    { barcode: "INT-656023", name: "FREEGELLS BARRA", price_usd: 0.45, category: "Golosinas", icon_emoji: "🍬", stock: 12, is_perishable: true },
    { barcode: "INT-448259", name: "MENTICAS", price_usd: 0.60, category: "Golosinas", icon_emoji: "🍬", stock: 14, is_perishable: true },
    { barcode: "INT-196192", name: "MINI CHOCOLATE SAVOY DE LECHE 15GR", price_usd: 1.00, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-308059", name: "MORDISQUITOS", price_usd: 0.40, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-392851", name: "TORONTO Y BOMBONES", price_usd: 0.75, category: "Golosinas", icon_emoji: "🍬", stock: 13, is_perishable: true },
    { barcode: "INT-968892", name: "TRULULU BOLSA", price_usd: 1.10, category: "Golosinas", icon_emoji: "🍬", stock: 4, is_perishable: true },
    { barcode: "INT-52293", name: "TRULULU CHOCOLORES", price_usd: 0.70, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-884988", name: "TRULULU GOMITAS", price_usd: 0.10, category: "Golosinas", icon_emoji: "🍬", stock: 28, is_perishable: true },
    { barcode: "INT-57715", name: "TRULULU SABORES", price_usd: 0.40, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { barcode: "INT-836350", name: "JABON DE TOCADOR", price_usd: 1.50, category: "Higiene", icon_emoji: "🧼", stock: 0, is_perishable: false },
    { barcode: "INT-163832", name: "TOALLAS SANITARIAS", price_usd: 0.20, category: "Higiene", icon_emoji: "🧼", stock: 6, is_perishable: false },
    { barcode: "INT-268111", name: "YOGURT", price_usd: 2.50, category: "Lácteos", icon_emoji: "📦", stock: 0, is_perishable: true },
    { barcode: "INT102243-", name: "ROSA Y CORAZON", price_usd: 4.00, category: "Regalos", icon_emoji: "📦", stock: 0, is_perishable: false },
    { barcode: "INT-535522", name: "FRANELA DIVINA PASTORA", price_usd: 25.00, category: "Temporada", icon_emoji: "📦", stock: 23, is_perishable: false },
    { barcode: "INT-175446", name: "AVANCE DE EFECTIVO", price_usd: 0.00, category: "Servicios", icon_emoji: "📦", stock: 999999, is_perishable: false },
    { barcode: "INT-459155", name: "CHEESE TRIS", price_usd: 1.25, category: "Snacks", icon_emoji: "🍟", stock: 3, is_perishable: true },
    { barcode: "INT-426196", name: "DORITOS", price_usd: 1.60, category: "Snacks", icon_emoji: "🍟", stock: 2, is_perishable: true },
    { barcode: "INT-842231", name: "FLIPS LONCHERA", price_usd: 1.02, category: "Snacks", icon_emoji: "🍟", stock: 1, is_perishable: true },
    { barcode: "INT-359630", name: "MANI CON SAL", price_usd: 0.65, category: "Snacks", icon_emoji: "🍟", stock: 10, is_perishable: true },
    { barcode: "INT-234785", name: "MIXTURA", price_usd: 0.65, category: "Snacks", icon_emoji: "🍟", stock: 14, is_perishable: true },
    { barcode: "INT-204927", name: "PEPITO", price_usd: 0.90, category: "Snacks", icon_emoji: "🍟", stock: 3, is_perishable: true },
    { barcode: "INT-859754", name: "TOSTON", price_usd: 0.80, category: "Snacks", icon_emoji: "🍟", stock: 0, is_perishable: true },
    { barcode: "INT-943096", name: "TURRON DE MANI", price_usd: 0.50, category: "Snacks", icon_emoji: "🍟", stock: 0, is_perishable: true },
    { barcode: "INT-261070", name: "TURRON JUMBY RIKOS MANI", price_usd: 0.30, category: "Snacks", icon_emoji: "🍟", stock: 0, is_perishable: true },
    { barcode: "INT-367422", name: "TURRON MANIPASAS", price_usd: 0.50, category: "Snacks", icon_emoji: "🍟", stock: 0, is_perishable: true },
    { barcode: "INT-128", name: "Tizana", price_usd: 1.50, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { barcode: "INT-129", name: "LECHE CONDENSADA 25GR", price_usd: 0.30, category: "Golosinas", icon_emoji: "🍬", stock: 26, is_perishable: true }
];

// --- FUNCIÓN PRINCIPAL DE MIGRACIÓN ---
async function migrarDatos() {
    const client = await pool.connect();
    
    // DEFINIMOS EL ID DE LA EMPRESA SAAS (Empresa 1)
    const EMPRESA_ID = 1; 

    console.log(`🚀 Iniciando carga masiva de ${PRODUCTOS_A_MIGRAR.length} productos para la Empresa ID ${EMPRESA_ID}...`);
    console.log('--------------------------------------------------');

    try {
        await client.query('BEGIN'); // Transacción segura

        for (const prod of PRODUCTOS_A_MIGRAR) {
            
            // 1. Verificamos si el producto ya existe para este tenant (por barcode)
            const checkQuery = `SELECT id FROM products WHERE barcode = $1 AND empresa_id = $2 LIMIT 1;`;
            const checkRes = await client.query(checkQuery, [prod.barcode, EMPRESA_ID]);
            
            let productId;
            let esNuevo = false;

            if (checkRes.rowCount > 0) {
                // Si existe, actualizamos su info básica
                productId = checkRes.rows[0].id;
                const updateQuery = `
                    UPDATE products 
                    SET name = $1, category = $2, price_usd = $3, icon_emoji = $4, is_perishable = $5, stock = $6
                    WHERE id = $7 AND empresa_id = $8;
                `;
                await client.query(updateQuery, [prod.name, prod.category, prod.price_usd, prod.icon_emoji, prod.is_perishable, prod.stock, productId, EMPRESA_ID]);
                console.log(`🔄 Actualizado: ${prod.name} (ID: ${productId})`);
            } else {
                // 2. Si no existe, lo insertamos
                const insertProductQuery = `
                    INSERT INTO products (
                        name, category, price_usd, stock, icon_emoji, 
                        is_taxable, barcode, status, is_perishable, empresa_id
                    ) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9) 
                    RETURNING id;
                `;
                const res = await client.query(insertProductQuery, [
                    prod.name, prod.category, prod.price_usd, prod.stock, prod.icon_emoji, 
                    false, prod.barcode, prod.is_perishable, EMPRESA_ID
                ]);
                productId = res.rows[0].id;
                esNuevo = true;
                console.log(`✅ Creado: ${prod.name} ($${prod.price_usd}) - Stock: ${prod.stock}`);
            }

            // 3. Crear Lote Inicial y Movimiento en Kardex SOLO si hay stock > 0
            if (prod.stock > 0) {
                // Verificamos si ya existe el lote de auditoría para este producto en la empresa
                const checkLote = await client.query(
                    `SELECT id FROM product_batches WHERE product_id = $1 AND batch_code = 'LOTE-INICIAL-2026' AND empresa_id = $2 LIMIT 1;`,
                    [productId, EMPRESA_ID]
                );

                // Solo insertamos si es nuevo o no tenía registrado ese lote inicial
                if (checkLote.rowCount === 0) {
                    const expDate = prod.is_perishable 
                        ? new Date(new Date().setMonth(new Date().getMonth() + 6)) 
                        : null;
                    const costoEstimado = (prod.price_usd * 0.70).toFixed(2); // Estimación del 70% del PVP

                    // Insertar lote asociado al empresa_id
                    await client.query(`
                        INSERT INTO product_batches (product_id, stock, cost_usd, batch_code, expiration_date, created_at, empresa_id)
                        VALUES ($1, $2, $3, 'LOTE-INICIAL-2026', $4, CURRENT_TIMESTAMP, $5)
                    `, [productId, prod.stock, costoEstimado, expDate, EMPRESA_ID]);

                    // Insertar movimiento en inventario asociado al empresa_id
                    await client.query(`
                        INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, cost_usd, new_stock, created_at, empresa_id)
                        VALUES ($1, 'IN', $2, 'INVENTARIO_INICIAL_AUDITORIA', 'AUDIT-04082026', $3, $4, CURRENT_TIMESTAMP, $5)
                    `, [productId, prod.stock, costoEstimado, prod.stock, EMPRESA_ID]);
                }
            }
        }

        await client.query('COMMIT'); 
        console.log('--------------------------------------------------');
        console.log(`✨ ¡MIGRACIÓN DE ${PRODUCTOS_A_MIGRAR.length} ARTÍCULOS A EMPRESA ${EMPRESA_ID} COMPLETADA CON ÉXITO! ✨`);

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error('❌ Error fatal, se revirtieron los cambios:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar script
migrarDatos();