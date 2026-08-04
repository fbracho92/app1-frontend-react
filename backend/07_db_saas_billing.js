const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

(async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando Fase 1: Creación del Módulo Financiero SaaS...');
        await client.query('BEGIN');

        // 1. Tabla de Facturas SaaS (BMS Digital emite a Clientes)
        await client.query(`
            CREATE TABLE IF NOT EXISTS saas_invoices (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
                control_number VARCHAR(50) UNIQUE NOT NULL,
                amount_usd DECIMAL(10, 2) NOT NULL,
                amount_ves DECIMAL(10, 2) NOT NULL,
                bcv_rate DECIMAL(10, 4) NOT NULL,
                issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                due_date TIMESTAMP NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'PAGADA', 'ANULADA'
                billing_period_start DATE,
                billing_period_end DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla [saas_invoices] verificada/creada.');

        // 2. Tabla de Pagos SaaS (Clientes reportan sus pagos)
        await client.query(`
            CREATE TABLE IF NOT EXISTS saas_payments (
                id SERIAL PRIMARY KEY,
                invoice_id INTEGER REFERENCES saas_invoices(id) ON DELETE CASCADE,
                empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
                amount_paid_usd DECIMAL(10, 2) NOT NULL,
                amount_paid_ves DECIMAL(10, 2) NOT NULL,
                payment_method VARCHAR(50) NOT NULL, -- Ej: 'Zelle', 'Pago Móvil', 'Transferencia'
                reference_number VARCHAR(100) NOT NULL,
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'EN_REVISION', -- 'EN_REVISION', 'APROBADO', 'RECHAZADO'
                receipt_url TEXT, -- URL por si adjuntan captura del pago
                reviewed_at TIMESTAMP,
                notes TEXT
            );
        `);
        console.log('✅ Tabla [saas_payments] verificada/creada.');

        await client.query('COMMIT');
        console.log('🎉 Módulo Financiero SaaS integrado exitosamente. Sistema intacto.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico en la migración financiera:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();