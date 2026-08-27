const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// --- LISTA COMPLETA DE PRODUCTOS (SHANTI URBAN) ---
// Todos configurados con stock 0 para funcionar como Servicios
const PRODUCTOS_A_MIGRAR = [
    // --- ALQUIMIA DE LA TIERRA (Arepas) ---
    { name: "Elixir Dorado (Base de Plátano)", price_usd: 4.50, category: "Alquimia de la Tierra", icon_emoji: "🫓", stock: 0, is_perishable: false },
    { name: "Raíz Ancestral (Base de Yuca)", price_usd: 4.50, category: "Alquimia de la Tierra", icon_emoji: "🫓", stock: 0, is_perishable: false },
    { name: "El Oráculo Blanco (Base de Arroz)", price_usd: 4.50, category: "Alquimia de la Tierra", icon_emoji: "🫓", stock: 0, is_perishable: false },

    // --- DESAYUNOS DEL AMANECER SAGRADO ---
    { name: "Bowls de Avena Ancestral", price_usd: 6.00, category: "Desayunos Sagrados", icon_emoji: "🥣", stock: 0, is_perishable: false },
    { name: "Geometría del Poder (Waffles)", price_usd: 5.00, category: "Desayunos Sagrados", icon_emoji: "🧇", stock: 0, is_perishable: false },
    { name: "Alquimia en Masa Madre", price_usd: 7.00, category: "Desayunos Sagrados", icon_emoji: "🍞", stock: 0, is_perishable: false },
    { name: "Tortillas del Despertar", price_usd: 4.50, category: "Desayunos Sagrados", icon_emoji: "🌮", stock: 0, is_perishable: false },
    { name: "El Ritual de la Transmutación", price_usd: 5.00, category: "Desayunos Sagrados", icon_emoji: "🍳", stock: 0, is_perishable: false },
    { name: "Prana Omelette: Energía Vital", price_usd: 6.50, category: "Desayunos Sagrados", icon_emoji: "🍳", stock: 0, is_perishable: false },

    // --- PACTOS DE TRIBU (Para Compartir) ---
    { name: "Tótems de Yuca (Bastones Rústicos)", price_usd: 12.00, category: "Pactos de Tribu", icon_emoji: "🍟", stock: 0, is_perishable: false },
    { name: "El Banquete de los Elementos", price_usd: 15.00, category: "Pactos de Tribu", icon_emoji: "🫓", stock: 0, is_perishable: false },
    { name: "El Mandala de los Elementos", price_usd: 18.00, category: "Pactos de Tribu", icon_emoji: "🥞", stock: 0, is_perishable: false },
    { name: "Brochetas del Templo", price_usd: 12.00, category: "Pactos de Tribu", icon_emoji: "🍡", stock: 0, is_perishable: false },

    // --- ALMUERZOS: RITUALES DE TRANSMUTACIÓN ---
    { name: "EL ALTARE DEL GUERRERO", price_usd: 7.00, category: "Almuerzos Rituales", icon_emoji: "🍗", stock: 0, is_perishable: false },
    { name: "EL RITUAL DEL FUEGO", price_usd: 8.00, category: "Almuerzos Rituales", icon_emoji: "🥩", stock: 0, is_perishable: false },
    { name: "EL YACIMIENTO DE FUERZA", price_usd: 8.00, category: "Almuerzos Rituales", icon_emoji: "🍲", stock: 0, is_perishable: false },
    { name: "Piedra Filosofal", price_usd: 12.00, category: "Almuerzos Rituales", icon_emoji: "🥩", stock: 0, is_perishable: false },

    // --- ELIXIRES DE TRANSMUTACIÓN & TOPPINGS ---
    { name: "Batido Proteico Vainilla", price_usd: 4.00, category: "Elixires Proteicos", icon_emoji: "🥤", stock: 0, is_perishable: false },
    { name: "Batido Proteico Cookies & Cream", price_usd: 4.00, category: "Elixires Proteicos", icon_emoji: "🥤", stock: 0, is_perishable: false },
    { name: "Topping: Leche de Almendras", price_usd: 1.50, category: "Toppings", icon_emoji: "🥛", stock: 0, is_perishable: false },
    { name: "Topping: Cambur", price_usd: 0.50, category: "Toppings", icon_emoji: "🍌", stock: 0, is_perishable: false },
    { name: "Topping: Avena", price_usd: 0.50, category: "Toppings", icon_emoji: "🌾", stock: 0, is_perishable: false },
    { name: "Topping: Fresas", price_usd: 0.50, category: "Toppings", icon_emoji: "🍓", stock: 0, is_perishable: false },
    { name: "Topping: Mantequilla de Maní", price_usd: 1.00, category: "Toppings", icon_emoji: "🥜", stock: 0, is_perishable: false },

    // --- ALQUIMIA LÍQUIDA & CAFETERÍA DE ESPECIALIDAD ---
    { name: "Metropolitan Detox", price_usd: 4.50, category: "Alquimia Líquida", icon_emoji: "🧃", stock: 0, is_perishable: false },
    { name: "Café Pequeño (Negro/Guayoyo/Espresso)", price_usd: 2.50, category: "Cafetería Especialidad", icon_emoji: "☕", stock: 0, is_perishable: false },
    { name: "Café Pequeño c/ Leche de Almendras", price_usd: 3.00, category: "Cafetería Especialidad", icon_emoji: "☕", stock: 0, is_perishable: false },
    { name: "Café Grande (Latte/Capuchino)", price_usd: 3.50, category: "Cafetería Especialidad", icon_emoji: "☕", stock: 0, is_perishable: false },
    { name: "Café Grande c/ Leche de Almendras", price_usd: 4.00, category: "Cafetería Especialidad", icon_emoji: "☕", stock: 0, is_perishable: false }
];

// --- FUNCIÓN PRINCIPAL DE MIGRACIÓN ---
async function migrarDatos() {
    const client = await pool.connect();
    
    // DEFINIMOS EL ID DE LA EMPRESA (Ajusta al que corresponda)
    const EMPRESA_ID = 3; 

    console.log(`🚀 Iniciando carga masiva de ${PRODUCTOS_A_MIGRAR.length} productos...`);
    console.log('--------------------------------------------------');

    try {
        await client.query('BEGIN'); // Iniciamos transacción general

        for (const prod of PRODUCTOS_A_MIGRAR) {
            
            // 1. Insertar Producto (Generamos código de barras simple si no lo tiene)
            const barcodeSimulado = `SU-${Math.floor(Math.random() * 1000000)}`;

            // Se agregó "is_service" al final de la consulta para forzar la naturaleza del producto
            const insertProductQuery = `
                INSERT INTO products (
                    name, category, price_usd, stock, icon_emoji, 
                    is_taxable, barcode, status, is_perishable, is_service, empresa_id
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, true, $9) 
                RETURNING id;
            `;
            
            const values = [
                prod.name,
                prod.category,
                prod.price_usd,
                prod.stock,
                prod.icon_emoji,
                false, // EXENTO DE IVA[cite: 31]
                barcodeSimulado,
                prod.is_perishable,
                EMPRESA_ID
            ];

            const res = await client.query(insertProductQuery, values);
            const productId = res.rows[0].id;

            // 2. Crear Lote Inicial (No se ejecutará porque stock es 0, manteniendo la lógica original)[cite: 31]
            if (prod.stock > 0) {
                const expDate = prod.is_perishable 
                    ? new Date(new Date().setMonth(new Date().getMonth() + 6)) 
                    : null;

                await client.query(`
                    INSERT INTO product_batches (product_id, stock, cost_usd, batch_code, expiration_date, created_at, empresa_id)
                    VALUES ($1, $2, $3, 'LOTE-INICIAL', $4, NOW(), $5)
                `, [productId, prod.stock, prod.price_usd * 0.70, expDate, EMPRESA_ID]); 

                await client.query(`
                    INSERT INTO inventory_movements (product_id, type, quantity, reason, document_ref, cost_usd, new_stock, empresa_id)
                    VALUES ($1, 'IN', $2, 'INVENTARIO_INICIAL', 'CARGA_MASIVA', $3, $4, $5)
                `, [productId, prod.stock, prod.price_usd * 0.70, prod.stock, EMPRESA_ID]);
            }

            console.log(`✅ Creado (Servicio sin IVA): ${prod.name} ($${prod.price_usd})`);
        }

        await client.query('COMMIT'); 
        console.log('--------------------------------------------------');
        console.log(`✨ ¡MIGRACIÓN DE ${PRODUCTOS_A_MIGRAR.length} SERVICIOS COMPLETADA! ✨`);

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