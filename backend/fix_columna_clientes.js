const { Pool } = require('pg');
require('dotenv').config(); // Carga el .env desde la ra赤z del proyecto

// Conexi車n din芍mica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Requerido para conexiones a bases de datos en la nube
});

async function ampliarColumnaInstitucion() {
    const client = await pool.connect();

    console.log('?? Iniciando parche de base de datos (Ampliaci車n de caracteres)...');
    console.log('--------------------------------------------------');

    try {
        await client.query('BEGIN'); // Transacci車n segura

        console.log('?? Modificando tabla "customers" -> ampliando "institution" a VARCHAR(255)...');

        // Ejecutamos la alteraci車n de la columna
        await client.query(`ALTER TABLE customers ALTER COLUMN institution TYPE VARCHAR(255);`);

        await client.query('COMMIT'); 
        console.log('? ?谷XITO! La columna ahora soporta hasta 255 caracteres.');
        console.log('??? Ya no tendr芍s errores al guardar nombres largos de condominios o empresas.');
        console.log('--------------------------------------------------');

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error('? Error fatal al intentar modificar la tabla:', err.message);
    } finally {
        client.release();
        await pool.end();
        console.log('?? Proceso finalizado.');
    }
}

// Ejecutar script
ampliarColumnaInstitucion();