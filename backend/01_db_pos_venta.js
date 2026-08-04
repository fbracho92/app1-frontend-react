// db_setup_master.js
// Script Maestro Unificado: Creación, Actualización y Blindaje BMS-POS
// Incluye: Ventas, Inventario, Delivery, Tasas BCV y Auditoría de Contingencia

const { Pool } = require('pg');

// URL de conexión (Render)
const connectionString = 'postgresql://pos_venta_demo_user:bDrMiOSfhjBwZFCDfk0V0Epzk9horTbu@dpg-d98plf6cjfls73f33iog-a.ohio-postgres.render.com/pos_venta_demo'; 

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const sqlStructure = `
CREATE TABLE IF NOT EXISTS cash_registers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- Ej: 'Caja Principal'
    serie VARCHAR(20) DEFAULT 'A', -- Serie SENIAT única por caja
    margin_top INTEGER DEFAULT 45, -- Calibración individual
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 1. Tabla Clientes
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    id_number VARCHAR(20) UNIQUE NOT NULL,
    phone VARCHAR(20),
    institution VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVO',
    initial_balance_usd DECIMAL(10, 2) DEFAULT 0,
    initial_balance_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla Productos
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    price_usd DECIMAL(10, 2) NOT NULL,
    price_ves DECIMAL(10, 2),
    barcode VARCHAR(50) UNIQUE,
    stock DECIMAL(10, 2) DEFAULT 0,
    icon_emoji TEXT,
    is_taxable BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    expiration_date DATE,
    is_perishable BOOLEAN DEFAULT FALSE,
    is_raw_material BOOLEAN DEFAULT FALSE,
    last_stock_update TIMESTAMP,
    is_service BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla Ventas (Cabecera)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    total_usd DECIMAL(10, 2) NOT NULL,
    total_ves DECIMAL(10, 2) NOT NULL,
    amount_paid_usd DECIMAL(10, 2) DEFAULT 0.00,
    bcv_rate_snapshot DECIMAL(10, 4) NOT NULL,
    payment_method TEXT,
    invoice_type VARCHAR(20) DEFAULT 'TICKET',
    status VARCHAR(20) DEFAULT 'PAGADO',
    due_date TIMESTAMP,
    subtotal_taxable_usd DECIMAL(10, 2) DEFAULT 0,
    subtotal_exempt_usd DECIMAL(10, 2) DEFAULT 0,
    iva_rate DECIMAL(10, 2) DEFAULT 0.16,
    iva_usd DECIMAL(10, 2) DEFAULT 0,
    discount_usd DECIMAL(10, 2) DEFAULT 0.00,
    is_delivery BOOLEAN DEFAULT FALSE,
    delivery_info JSONB,
    void_reason TEXT,
    control_number VARCHAR(50),
    
    -- ?? CAMPOS FISCALES (FASE 1: SENIAT)
    fiscal_invoice_number VARCHAR(50),
    fiscal_control_number VARCHAR(50),
    fiscal_machine_serial VARCHAR(50),
    igtf_usd DECIMAL(10, 2) DEFAULT 0.00,
    igtf_ves DECIMAL(10, 2) DEFAULT 0.00,
    credit_note_number VARCHAR(50),
    credit_note_control VARCHAR(50),
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla Detalle de Ventas
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity DECIMAL(10, 2) NOT NULL,
    price_at_moment_usd DECIMAL(10, 2) NOT NULL
);

-- 5. Tabla Proveedores
CREATE TABLE IF NOT EXISTS providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    rif VARCHAR(20) UNIQUE, 
    phone VARCHAR(20),
    address TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla Créditos / Abonos
CREATE TABLE IF NOT EXISTS credit_payments (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    amount_usd DECIMAL(10, 2) NOT NULL,
    payment_method TEXT,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabla Compras
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id),
    invoice_number VARCHAR(50),
    control_number VARCHAR(50),
    purchase_date DATE,
    total_amount_usd DECIMAL(10, 2),
    total_amount_bs DECIMAL(10, 2),
    exchange_rate DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla Detalle de Compras
CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity DECIMAL(10, 2) NOT NULL,
    cost_usd DECIMAL(10, 2) NOT NULL,
    cost_bs DECIMAL(10, 2) NOT NULL
);

-- 9. Tabla Lotes
CREATE TABLE IF NOT EXISTS product_batches (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    stock DECIMAL(10, 2) NOT NULL,
    cost_usd DECIMAL(10, 2) NOT NULL,
    expiration_date DATE,
    batch_code VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabla Kardex
CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- IN / OUT
    quantity DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    document_ref VARCHAR(100),
    new_stock DECIMAL(10, 2),
    cost_usd DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Tabla Cierres de Caja
CREATE TABLE IF NOT EXISTS cash_shifts (
    id SERIAL PRIMARY KEY,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    initial_cash_usd DECIMAL(10, 2) DEFAULT 0,
    initial_cash_ves DECIMAL(10, 2) DEFAULT 0,
    system_cash_usd DECIMAL(10, 2) DEFAULT 0,
    system_cash_ves DECIMAL(10, 2) DEFAULT 0,
    system_zelle DECIMAL(10, 2) DEFAULT 0,
    system_pago_movil DECIMAL(10, 2) DEFAULT 0,
    system_punto DECIMAL(10, 2) DEFAULT 0,
    real_cash_usd DECIMAL(10, 2) DEFAULT 0,
    real_cash_ves DECIMAL(10, 2) DEFAULT 0,
    real_zelle DECIMAL(10, 2) DEFAULT 0,
    real_pago_movil DECIMAL(10, 2) DEFAULT 0,
    real_punto DECIMAL(10, 2) DEFAULT 0,
    diff_usd DECIMAL(10, 2) DEFAULT 0,
    diff_ves DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'ABIERTA',
    fiscal_z_report VARCHAR(50),
    user_id INTEGER
);

-- 12. Tabla Órdenes en Espera
CREATE TABLE IF NOT EXISTS held_orders (
    id SERIAL PRIMARY KEY,
    reference_name VARCHAR(100) NOT NULL,
    cart_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 13. Tabla Delivery (Motorizados)
CREATE TABLE IF NOT EXISTS delivery_drivers (
    id SERIAL PRIMARY KEY,
    id_number VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    vehicle_info TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. TABLAS DE PERSISTENCIA BCV Y AUDITORÍA
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    forma_libre_serie VARCHAR(20) DEFAULT 'SERIE - A',
    forma_libre_margin_top INTEGER DEFAULT 45,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_rate_contingency (
    id SERIAL PRIMARY KEY,
    event_type TEXT DEFAULT 'MODO_CONTINGENCIA',
    previous_rate DECIMAL(10, 2),
    used_rate DECIMAL(10, 2),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Tabla de Secuencias (SaaS Multi-Modal)
CREATE TABLE IF NOT EXISTS document_sequences (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL, -- ?? IMPORTANTE: Se quitó el "UNIQUE" de aquí
    prefix VARCHAR(20) DEFAULT '',             
    current_number BIGINT DEFAULT 0,
    register_id INTEGER REFERENCES cash_registers(id),    
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT TRUE,
    last_modified_by VARCHAR(100) DEFAULT 'SISTEMA',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_type, register_id) -- ?? La regla ahora es: "Mismo Documento + Misma Caja = Único"
);
`;

(async () => {
    const client = await pool.connect();
    try {
        console.log('?? Iniciando sincronización MAESTRA de la Base de Datos BMS-POS...');
        await client.query('BEGIN');

        // 1. Ejecución de estructura base
        await client.query(sqlStructure);
        console.log('? Estructura de tablas verificada.');

        // 2. Migraciones Dinámicas (Asegura columnas en DBs viejas)
        const migrations = [
            // ?? MIGRACIÓN CRÍTICA PARA MULTI-CAJA: Eliminar restricción vieja
            `ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_document_type_key;`,
            
            // Estaciones de Trabajo (Cajas)
            `ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS register_id INTEGER REFERENCES cash_registers(id);`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS register_id INTEGER REFERENCES cash_registers(id);`,
            `ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS register_id INTEGER REFERENCES cash_registers(id);`,
            `ALTER TABLE held_orders ADD COLUMN IF NOT EXISTS register_id INTEGER REFERENCES cash_registers(id);`,
        
            // Productos
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS last_stock_update TIMESTAMP;`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_raw_material BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service BOOLEAN DEFAULT FALSE;`,
            
            // Ventas y Créditos
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid_usd DECIMAL(10, 2) DEFAULT 0.00;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_taxable_usd DECIMAL(10, 2) DEFAULT 0;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_exempt_usd DECIMAL(10, 2) DEFAULT 0;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS iva_rate DECIMAL(10, 2) DEFAULT 0.16;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS iva_usd DECIMAL(10, 2) DEFAULT 0;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_info JSONB;`,
            
            // MIGRACIONES FISCALES
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiscal_invoice_number VARCHAR(50);`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiscal_control_number VARCHAR(50);`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiscal_machine_serial VARCHAR(50);`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS igtf_usd DECIMAL(10, 2) DEFAULT 0.00;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS igtf_ves DECIMAL(10, 2) DEFAULT 0.00;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_note_number VARCHAR(50);`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_note_control VARCHAR(50);`,
            
            // Cierres de Caja
            `ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS fiscal_z_report VARCHAR(50);`,
            `ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS user_id INTEGER;`,
            
            // BLINDAJE DE SEGURIDAD EN SECUENCIAS
            `ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT TRUE;`,
            `ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100) DEFAULT 'SISTEMA';`,
            
            // Proveedores
            `ALTER TABLE providers ADD COLUMN IF NOT EXISTS rif VARCHAR(20);`,
            `ALTER TABLE providers ADD COLUMN IF NOT EXISTS address TEXT;`,
            `ALTER TABLE providers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);`,
            
            // Configuración de Formas Libres
            `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS forma_libre_serie VARCHAR(20) DEFAULT 'SERIE - A';`,
            `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS forma_libre_margin_top INTEGER DEFAULT 45;`,

            // Auditoría
            `ALTER TABLE audit_rate_contingency ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'MODO_CONTINGENCIA';`
        ];

        for (const query of migrations) {
            try { await client.query(query); } catch (e) { /* Fallo silencioso si ya existe o no aplica */ }
        }
        console.log('? Migraciones de integridad y Multi-Caja completadas.');
        
        // 3. Inicialización Inteligente de Cajas y Secuencias
        // Primero nos aseguramos de que exista al menos la "Caja Principal"
        const checkCaja = await client.query('SELECT id FROM cash_registers ORDER BY id ASC LIMIT 1');
        let cajaId;
        
        if (checkCaja.rows.length === 0) {
            const newCaja = await client.query("INSERT INTO cash_registers (name, serie, margin_top) VALUES ('Caja Principal', 'A', 45) RETURNING id");
            cajaId = newCaja.rows[0].id;
        } else {
            cajaId = checkCaja.rows[0].id;
        }

        // Auto-Sanado: Vinculamos las secuencias viejas huérfanas a la Caja Principal
        await client.query('UPDATE document_sequences SET register_id = $1 WHERE register_id IS NULL', [cajaId]);

        // ?? CONFIGURACIÓN INTEGRADA MÓDULO MULTI-ESTACIÓN (Crea secuencias para TODAS las cajas existentes)
        const allRegisters = await client.query('SELECT id, name, serie FROM cash_registers WHERE is_active = TRUE');
        
        for (const reg of allRegisters.rows) {
            const defaultSequences = [
                { type: 'FACTURA', prefix: `SERIE - ${reg.serie || 'A'}`, number: 0 },
                { type: 'NOTA_CREDITO', prefix: 'NC-', number: 0 },
                { type: 'NOTA_ENTREGA', prefix: 'NE-', number: 0 }
            ];

            for (const seq of defaultSequences) {
                await client.query(`
                    INSERT INTO document_sequences (document_type, prefix, current_number, register_id)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (document_type, register_id) DO NOTHING;
                `, [seq.type, seq.prefix, seq.number, reg.id]);
            }
        }
        console.log('? Secuencias maestras asignadas a todas las estaciones correctamente.');

        // 4. Semilla de Tasa BCV
        await client.query(`
            INSERT INTO system_settings (key, value) 
            VALUES ('bcv_rate', '{"amount": 477.15, "status": "contingencia_inicial"}'::jsonb)
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('? Persistencia de tasa BCV inicial asegurada.');

        // 5. Semillas de Motorizados / Transporte (Blindado)
        await client.query(`
            INSERT INTO delivery_drivers (id_number, name, phone, vehicle_info, status) 
            VALUES 
                ('V-12345678-9', 'Carlos (Motorizado 1)', '0412-0000000', 'Moto Bera SBR Placa AA11BB', 'ACTIVO'), 
                ('V-87654321-0', 'Luis (Motorizado 2)', '0414-0000000', 'Moto Empire TX Placa CC22DD', 'ACTIVO') 
            ON CONFLICT (phone) DO NOTHING;
        `);
        console.log('? Datos maestros de Transporte (Delivery) verificados y blindados.');

        await client.query('COMMIT');
        console.log('?? ¡SISTEMA BMS-POS TOTALMENTE ACTUALIZADO PARA MULTI-ESTACIÓN!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('? Error crítico en la sincronización:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();