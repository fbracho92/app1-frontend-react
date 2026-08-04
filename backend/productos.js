// migracion_datos_actualizada.js
// Script de carga masiva EXACTA basado en el archivo Productos.txt
// Incluye creación de Lotes y Kardex inicial.

const { Pool } = require('pg');

// URL de conexión (Render)
const connectionString = 'postgresql://pos_venta_demo_user:bDrMiOSfhjBwZFCDfk0V0Epzk9horTbu@dpg-d98plf6cjfls73f33iog-a.ohio-postgres.render.com/pos_venta_demo'; 

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

// --- LISTA COMPLETA DE PRODUCTOS (DATA EXACTA DE Productos.txt) ---
const PRODUCTOS_A_MIGRAR = [
    // Postres
    { name: "BROWNIE", price_usd: 1.50, category: "Postre", icon_emoji: "🍰", stock: 1, is_perishable: true },
    { name: "CHOCO AREQUIPE", price_usd: 0.55, category: "Postre", icon_emoji: "🍰", stock: 2, is_perishable: true },
    { name: "COLADO HEINZ 113G", price_usd: 1.30, category: "Postres", icon_emoji: "🍮", stock: 2, is_perishable: true },
    { name: "DUO DE PONQUECITOS", price_usd: 1.15, category: "Postres", icon_emoji: "🧁", stock: 0, is_perishable: true },
    { name: "GELATINA", price_usd: 1.45, category: "Postres", icon_emoji: "🍮", stock: 0, is_perishable: true },
    { name: "MINI PANQUE", price_usd: 0.63, category: "Postres", icon_emoji: "🧁", stock: 8, is_perishable: true },
    { name: "PANQUE QUEEN", price_usd: 1.65, category: "Postres", icon_emoji: "🧁", stock: 2, is_perishable: true },
    { name: "PONQUECITOS", price_usd: 0.55, category: "Postres", icon_emoji: "🧁", stock: 0, is_perishable: true },
    { name: "PONQUECITOS BRIGADEIRO", price_usd: 3.50, category: "Postres", icon_emoji: "🧁", stock: 0, is_perishable: true },
    { name: "TORTA DE AUYAMA", price_usd: 1.00, category: "Postres", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { name: "TORTA DE CAMBUR", price_usd: 2.50, category: "Postres", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { name: "TORTA DE CHOCOLATE", price_usd: 1.00, category: "Postres", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { name: "TORTA DE PAN", price_usd: 1.00, category: "Postres", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { name: "TORTA DE PIÑA", price_usd: 1.00, category: "Postres", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { name: "TORTA DE VAINILLA", price_usd: 1.19, category: "Postres", icon_emoji: "🍰", stock: 0, is_perishable: true },
    { name: "TORTA MARMOLEADA", price_usd: 1.29, category: "Postres", icon_emoji: "🍰", stock: 1, is_perishable: true },

    // Bebidas
    { name: "Refresco 2Litro", price_usd: 2.20, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { name: "AGUA 1.50ML LARA", price_usd: 2.00, category: "Bebidas", icon_emoji: "💧", stock: 0, is_perishable: true },
    { name: "AGUA 500ml Lara", price_usd: 0.55, category: "Bebidas", icon_emoji: "💧", stock: 38, is_perishable: true },
    { name: "AGUA 600ml Minalba", price_usd: 1.35, category: "Bebidas", icon_emoji: "💧", stock: 0, is_perishable: true },
    { name: "AGUA 600ml NEVADA", price_usd: 1.05, category: "Bebidas", icon_emoji: "💧", stock: 0, is_perishable: true },
    { name: "AGUA GASIFICADA 355ml", price_usd: 1.00, category: "Bebidas", icon_emoji: "💧", stock: 5, is_perishable: true },
    { name: "AVENA", price_usd: 0.65, category: "Bebidas", icon_emoji: "🥛", stock: 9, is_perishable: true },
    { name: "GATORADE", price_usd: 2.20, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { name: "JUGO 400ml", price_usd: 0.95, category: "Bebidas", icon_emoji: "🧃", stock: 4, is_perishable: true },
    { name: "JUGO NATULAC 250ML", price_usd: 1.20, category: "Bebidas", icon_emoji: "🧃", stock: 3, is_perishable: true },
    { name: "MALTA", price_usd: 0.80, category: "Bebidas", icon_emoji: "🥤", stock: 26, is_perishable: true },
    { name: "REFRESCO", price_usd: 1.00, category: "Bebidas", icon_emoji: "🥤", stock: 12, is_perishable: true },
    { name: "REFRESCO 1,50ml", price_usd: 1.90, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { name: "REFRESCO 1 LITRO", price_usd: 1.35, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },
    { name: "SODA", price_usd: 1.10, category: "Bebidas", icon_emoji: "🥤", stock: 7, is_perishable: true },
    { name: "TE LIMON", price_usd: 1.80, category: "Bebidas", icon_emoji: "🥤", stock: 0, is_perishable: true },

    // Alimentos
    { name: "EMPANADA", price_usd: 0.69, category: "Alimentos", icon_emoji: "🥟", stock: 9, is_perishable: true },
    { name: "PANQUE DANY'S", price_usd: 1.90, category: "Alimentos", icon_emoji: "🍞", stock: 6, is_perishable: true },
    { name: "PAN SOLO", price_usd: 0.45, category: "Alimentos", icon_emoji: "🍞", stock: 0, is_perishable: true },
    { name: "SANDWICH", price_usd: 2.00, category: "Alimentos", icon_emoji: "🥪", stock: 1, is_perishable: true },
    { name: "SANDWICH INTEGRAL", price_usd: 1.80, category: "Alimentos", icon_emoji: "🥪", stock: 0, is_perishable: true },

    // Cafetería
    { name: "CAFÉ GRANDE 57", price_usd: 0.55, category: "Cafetería", icon_emoji: "☕", stock: 35, is_perishable: false },
    { name: "CAFÉ MEDIANO 47", price_usd: 0.45, category: "Cafetería", icon_emoji: "☕", stock: 64, is_perishable: false },
    { name: "CAFÉ PEQUEÑO 27", price_usd: 0.23, category: "Cafetería", icon_emoji: "☕", stock: 54, is_perishable: false },
    { name: "Combo Imagen", price_usd: 1.00, category: "Cafetería", icon_emoji: "☕", stock: 10, is_perishable: false },
    { name: "NESCAFE BEBIDA ACHOCOLATADA", price_usd: 2.50, category: "Cafetería", icon_emoji: "☕", stock: 10, is_perishable: false },
    { name: "NESCAFE CAFÉ CON LECHE", price_usd: 2.50, category: "Cafetería", icon_emoji: "☕", stock: 13, is_perishable: false },
    { name: "NESCAFE CAPPUCCINO", price_usd: 2.50, category: "Cafetería", icon_emoji: "☕", stock: 10, is_perishable: false },
    { name: "NESCAFE CAPPUCCINO VAINILLA", price_usd: 2.50, category: "Cafetería", icon_emoji: "☕", stock: 75, is_perishable: false },
    { name: "NESCAFE CHOCO VAINILLA", price_usd: 2.50, category: "Cafetería", icon_emoji: "☕", stock: 9, is_perishable: false },
    { name: "NESCAFE LATTE VAINILLA", price_usd: 2.50, category: "Cafetería", icon_emoji: "☕", stock: 19, is_perishable: false },
    { name: "NESCAFE MOKACCINO", price_usd: 2.50, category: "Cafetería", icon_emoji: "☕", stock: 21, is_perishable: false },

    // Dulces Criollos
    { name: "BOCADILLO GUAYABA", price_usd: 0.30, category: "Dulces Criollos", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "BOCADILLO PLATANO", price_usd: 0.65, category: "Dulces Criollos", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "BOCADILLO TAMARINDO", price_usd: 0.72, category: "Dulces Criollos", icon_emoji: "🍬", stock: 2, is_perishable: true },
    { name: "CONSERVA DE GUAYABA CON LECHE", price_usd: 0.20, category: "Dulces Criollos", icon_emoji: "🍬", stock: 2, is_perishable: true },
    { name: "CONSERVA DE LECHE", price_usd: 0.50, category: "Dulces Criollos", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "Conservas Mixtas", price_usd: 0.80, category: "Dulces Criollos", icon_emoji: "🍬", stock: 21, is_perishable: true },

    // Galletas
    { name: "Bocadillo Galleta Guayaba", price_usd: 0.35, category: "Galletas", icon_emoji: "🍪", stock: 12, is_perishable: true },
    { name: "CANELITAS", price_usd: 0.90, category: "Galletas", icon_emoji: "🍪", stock: 3, is_perishable: true },
    { name: "COCOSETE", price_usd: 1.55, category: "Galletas", icon_emoji: "🥥", stock: 4, is_perishable: true },
    { name: "GALLETA CHISPA DE CHOCOLATE", price_usd: 1.35, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { name: "GALLETA DE AVENA", price_usd: 0.75, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { name: "GALLETA DE SODA", price_usd: 0.30, category: "Galletas", icon_emoji: "🍪", stock: 5, is_perishable: true },
    { name: "GALLETA GUAYABA INDEPENDENCIA", price_usd: 0.78, category: "Galletas", icon_emoji: "🍪", stock: 5, is_perishable: true },
    { name: "GALLETA HONNY", price_usd: 0.55, category: "Galletas", icon_emoji: "🍪", stock: 85, is_perishable: true },
    { name: "GALLETA KRAKER", price_usd: 0.55, category: "Galletas", icon_emoji: "🍪", stock: 79, is_perishable: true },
    { name: "GALLETA MARIA", price_usd: 0.32, category: "Galletas", icon_emoji: "🍪", stock: 3, is_perishable: true },
    { name: "GALLETA OREO", price_usd: 0.70, category: "Galletas", icon_emoji: "🍪", stock: 7, is_perishable: true },
    { name: "GALLETAS CLUB SOCIAL", price_usd: 0.42, category: "Galletas", icon_emoji: "🍪", stock: 18, is_perishable: true },
    { name: "GALLETAS MINI", price_usd: 0.75, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { name: "GALLETAS PANCHI-GUAYABA", price_usd: 0.90, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { name: "GALLETAS RELLENAS", price_usd: 2.70, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { name: "GALLETAS SURTIDAS", price_usd: 1.35, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { name: "MAX COCO", price_usd: 0.70, category: "Galletas", icon_emoji: "🥥", stock: 0, is_perishable: true },
    { name: "PALITO", price_usd: 0.60, category: "Galletas", icon_emoji: "🥨", stock: 2, is_perishable: true },
    { name: "PIAZZA", price_usd: 0.25, category: "Galletas", icon_emoji: "🍪", stock: 0, is_perishable: true },
    { name: "PIRUETA", price_usd: 0.42, category: "Galletas", icon_emoji: "🍪", stock: 4, is_perishable: true },
    { name: "SAMBA", price_usd: 1.30, category: "Galletas", icon_emoji: "🍫", stock: 0, is_perishable: true },
    { name: "SAMBA MINI", price_usd: 0.75, category: "Galletas", icon_emoji: "🍫", stock: 5, is_perishable: true },
    { name: "SUSY", price_usd: 1.20, category: "Galletas", icon_emoji: "🍪", stock: 13, is_perishable: true },
    { name: "TROPICOCO", price_usd: 0.50, category: "Galletas", icon_emoji: "🥥", stock: 0, is_perishable: true },

    // Golosinas
    { name: "TAMARINDO BOCADILLO", price_usd: 0.45, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "BARQUILLON", price_usd: 0.75, category: "Golosinas", icon_emoji: "🍦", stock: 0, is_perishable: true },
    { name: "BIANCHI BOMBOM", price_usd: 0.20, category: "Golosinas", icon_emoji: "🍬", stock: 3, is_perishable: true },
    { name: "BIANCHI SNACK", price_usd: 1.15, category: "Golosinas", icon_emoji: "🍫", stock: 0, is_perishable: true },
    { name: "CARAMELOS BIANCHI", price_usd: 0.06, category: "Golosinas", icon_emoji: "🍬", stock: 2, is_perishable: true },
    { name: "CARAMELOS CAFÉ GOURMET", price_usd: 0.07, category: "Golosinas", icon_emoji: "🍬", stock: 20, is_perishable: true },
    { name: "CARAMELOS CHAO", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 76, is_perishable: true },
    { name: "CARAMELOS CHAO EN LINEA", price_usd: 0.20, category: "Golosinas", icon_emoji: "🍬", stock: 14, is_perishable: true },
    { name: "CARAMELOS CHAO PASTILLAS", price_usd: 0.40, category: "Golosinas", icon_emoji: "🍬", stock: 7, is_perishable: true },
    { name: "CARAMELOS CHOCO TURRON", price_usd: 0.08, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "CARAMELOS LOKIÑO", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 30, is_perishable: true },
    { name: "CARAMELOS MENTA HELADA", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 41, is_perishable: true },
    { name: "CARAMELOS RICATO", price_usd: 0.07, category: "Golosinas", icon_emoji: "🍬", stock: 14, is_perishable: true },
    { name: "CARAMELOS TAMARINDO", price_usd: 0.04, category: "Golosinas", icon_emoji: "🍬", stock: 26, is_perishable: true },
    { name: "CHICLE AGOGO", price_usd: 0.28, category: "Golosinas", icon_emoji: "🍬", stock: 6, is_perishable: true },
    { name: "CHICLES TRIDENT", price_usd: 0.80, category: "Golosinas", icon_emoji: "🍬", stock: 5, is_perishable: true },
    { name: "CHICLES TRIDENT INDIVIDUAL", price_usd: 0.20, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "CHOCOLATE SAVOY CRICRI", price_usd: 1.60, category: "Golosinas", icon_emoji: "🍫", stock: 0, is_perishable: true },
    { name: "CHOCOLATE SAVOY DE LECHE 30GR", price_usd: 1.65, category: "Golosinas", icon_emoji: "🍫", stock: 0, is_perishable: true },
    { name: "CHOCOLATE SAVOY DE LECHE 70GR", price_usd: 3.20, category: "Golosinas", icon_emoji: "🍫", stock: 0, is_perishable: true },
    { name: "CHOCO LOOK RELLENOS", price_usd: 0.50, category: "Golosinas", icon_emoji: "🍫", stock: 0, is_perishable: true },
    { name: "CHUPETAS", price_usd: 0.25, category: "Golosinas", icon_emoji: "🍭", stock: 0, is_perishable: true },
    { name: "DANDY", price_usd: 0.50, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "FLAQUITO MINI", price_usd: 0.25, category: "Golosinas", icon_emoji: "🍫", stock: 7, is_perishable: true },
    { name: "FREEGELLS BARRA", price_usd: 0.45, category: "Golosinas", icon_emoji: "🍬", stock: 26, is_perishable: true },
    { name: "MENTICAS", price_usd: 0.60, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "MINI CHOCOLATE SAVOY DE LECHE 15GR", price_usd: 1.00, category: "Golosinas", icon_emoji: "🍫", stock: 7, is_perishable: true },
    { name: "MORDISQUITOS", price_usd: 0.40, category: "Golosinas", icon_emoji: "🍫", stock: 3, is_perishable: true },
    { name: "TORONTO Y BOMBONES", price_usd: 0.75, category: "Golosinas", icon_emoji: "🍫", stock: 39, is_perishable: true },
    { name: "TRULULU BOLSA", price_usd: 1.10, category: "Golosinas", icon_emoji: "🍬", stock: 3, is_perishable: true },
    { name: "TRULULU CHOCOLORES", price_usd: 0.70, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },
    { name: "TRULULU GOMITAS", price_usd: 0.10, category: "Golosinas", icon_emoji: "🍬", stock: 23, is_perishable: true },
    { name: "TRULULU SABORES", price_usd: 0.40, category: "Golosinas", icon_emoji: "🍬", stock: 0, is_perishable: true },

    // Higiene
    { name: "JABON DE TOCADOR", price_usd: 1.50, category: "Higiene", icon_emoji: "🧼", stock: 0, is_perishable: false },
    { name: "TOALLAS SANITARIAS", price_usd: 0.20, category: "Higiene", icon_emoji: "🧼", stock: 6, is_perishable: false },

    // Lácteos
    { name: "YOGURT", price_usd: 2.50, category: "Lácteos", icon_emoji: "🥛", stock: 0, is_perishable: true },

    // Regalos y Temporada
    { name: "ROSA Y CORAZON", price_usd: 4.00, category: "Regalos", icon_emoji: "🎁", stock: 0, is_perishable: false },
    { name: "FRANELA DIVINA PASTORA", price_usd: 25.00, category: "Temporada", icon_emoji: "👕", stock: 23, is_perishable: false },

    // Servicios
    { name: "AVANCE DE EFECTIVO", price_usd: 0.00, category: "SERVICIOS", icon_emoji: "💳", stock: 999999, is_perishable: false },

    // Snacks
    { name: "CHEESE TRIS", price_usd: 1.25, category: "Snacks", icon_emoji: "🧀", stock: 4, is_perishable: true },
    { name: "DORITOS", price_usd: 1.60, category: "Snacks", icon_emoji: "🍟", stock: 4, is_perishable: true },
    { name: "FLIPS LONCHERA", price_usd: 1.02, category: "Snacks", icon_emoji: "🥣", stock: 4, is_perishable: true },
    { name: "MANI CON SAL", price_usd: 0.65, category: "Snacks", icon_emoji: "🥜", stock: 2, is_perishable: true },
    { name: "MIXTURA", price_usd: 0.65, category: "Snacks", icon_emoji: "🥜", stock: 9, is_perishable: true },
    { name: "PEPITO", price_usd: 0.90, category: "Snacks", icon_emoji: "🍟", stock: 8, is_perishable: true },
    { name: "TOSTON", price_usd: 0.80, category: "Snacks", icon_emoji: "🍌", stock: 8, is_perishable: true },
    { name: "TURRON DE MANI", price_usd: 0.50, category: "Snacks", icon_emoji: "🥜", stock: 0, is_perishable: true },
    { name: "TURRON JUMBY RIKOS MANI", price_usd: 0.30, category: "Snacks", icon_emoji: "🥜", stock: 0, is_perishable: true },
    { name: "TURRON MANIPASAS", price_usd: 0.50, category: "Snacks", icon_emoji: "🥜", stock: 0, is_perishable: true }
];

// --- FUNCIÓN PRINCIPAL DE MIGRACIÓN ---
async function migrarDatos() {
    const client = await pool.connect();
    
    console.log(`🚀 Iniciando carga masiva de ${PRODUCTOS_A_MIGRAR.length} productos...`);
    console.log('--------------------------------------------------');

    try {
        await client.query('BEGIN'); // Iniciamos transacción general

        for (const prod of PRODUCTOS_A_MIGRAR) {
            
            // 1. Insertar Producto (Generamos código de barras simple si no lo tiene)
            const barcodeSimulado = `INT-${Math.floor(Math.random() * 1000000)}`;

            const insertProductQuery = `
                INSERT INTO products (
                    name, category, price_usd, stock, icon_emoji, 
                    is_taxable, barcode, status, is_perishable
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8) 
                RETURNING id;
            `;
            
            const values = [
                prod.name,
                prod.category,
                prod.price_usd,
                prod.stock,
                prod.icon_emoji,
                false, // Default: Todo paga IVA (ajustable en backend si quieres)
                prod.barcode || barcodeSimulado,
                prod.is_perishable
            ];

            const res = await client.query(insertProductQuery, values);
            const productId = res.rows[0].id;

            // 2. Crear Lote Inicial (Obligatorio para que aparezca disponible)
            if (prod.stock > 0) {
                // Fecha de vencimiento simulada: 
                // Si es perecedero: +6 meses desde hoy. Si no: NULL.
                const expDate = prod.is_perishable 
                    ? new Date(new Date().setMonth(new Date().getMonth() + 6)) 
                    : null;

                await client.query(`
                    INSERT INTO product_batches (product_id, stock, cost_usd, batch_code, expiration_date, created_at)
                    VALUES ($1, $2, $3, 'LOTE-INICIAL-2025', $4, NOW())
                `, [productId, prod.stock, prod.price_usd * 0.70, expDate]); // Costo estimado al 70%

                // 3. Registrar en Kardex
                await client.query(`
                    INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, cost_usd, new_stock)
                    VALUES ($1, 'IN', $2, 'INVENTARIO_INICIAL', 'CARGA_MASIVA', $3, $4)
                `, [productId, prod.stock, prod.price_usd * 0.70, prod.stock]);
            }

            console.log(`✅ Creado: ${prod.name} ($${prod.price_usd}) - Stock: ${prod.stock}`);
        }

        await client.query('COMMIT'); 
        console.log('--------------------------------------------------');
        console.log(`✨ ¡MIGRACIÓN DE ${PRODUCTOS_A_MIGRAR.length} ARTÍCULOS COMPLETADA! ✨`);

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error('❌ Error fatal:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

// Ejecutar
migrarDatos();