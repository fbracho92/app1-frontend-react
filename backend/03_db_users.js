const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const sqlUsersStructure = `
-- 1. Tabla de Roles (Permisos)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- Ej: 'ADMIN', 'CAJERO', 'SUPERVISOR'
    permissions JSONB DEFAULT '{}',   -- Guardaremos qué módulos puede ver
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Usuarios (Blindada)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    status VARCHAR(20) DEFAULT 'ACTIVO', -- 'ACTIVO' o 'INACTIVO' (Legal: No se borran usuarios)
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. LA BITÁCORA MAESTRA (Trazabilidad Total)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(100), -- Guardamos nombre por si el usuario es inactivado luego
    action VARCHAR(100) NOT NULL, -- Ej: 'LOGIN', 'VENTA_CREADA', 'CONFIG_MODIFICADA'
    module VARCHAR(50),           -- Ej: 'VENTAS', 'SISTEMA', 'INVENTARIO'
    details TEXT,                 -- Descripción legible
    old_values JSONB,             -- Foto de cómo estaba antes (Para auditoría)
    new_values JSONB,             -- Foto de cómo quedó después
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

(async () => {
    const client = await pool.connect();
    try {
        console.log('🛡️ Iniciando Fase de Seguridad: Usuarios y Auditoría...');
        await client.query('BEGIN');

        await client.query(sqlUsersStructure);
        console.log('✅ Tablas de Seguridad verificadas.');

        // Inyectamos los Roles Básicos
        const roles = ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'];
        for (const role of roles) {
            await client.query("INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [role]);
        }

        // 🚨 IMPORTANTE: Verificación, Creación y REPARACIÓN del Usuario Maestro
        const checkUser = await client.query("SELECT id FROM users WHERE username = 'admin'");
        
        if (checkUser.rows.length === 0) {
            // CASO A: El usuario no existe (Se crea por primera vez)
            const adminRoleId = (await client.query("SELECT id FROM roles WHERE name = 'ADMINISTRADOR'")).rows[0].id;
            await client.query(`
                INSERT INTO users (username, password_hash, full_name, email, role_id) 
                VALUES ('admin', 'hash_provisional_admin123', 'Administrador Maestro', 'admin@bms.com', $1)
            `, [adminRoleId]);
            console.log('👤 Usuario Administrador creado (admin / Admin123).');
        } else {
            // CASO B: El usuario ya existe (INTEGRACIÓN DEL PASO 3 - Reparación Quirúrgica)
            await client.query(`
                UPDATE users 
                SET password_hash = 'hash_provisional_admin123',
                    status = 'ACTIVO'
                WHERE username = 'admin'
            `);
            console.log('🛠️ Acceso de Administrador existente reparado y reactivado (admin / Admin123).');
        }

        await client.query('COMMIT');
        console.log('🚀 ¡FASE DE SEGURIDAD COMPLETADA CON ÉXITO!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error en Fase de Seguridad:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
})();