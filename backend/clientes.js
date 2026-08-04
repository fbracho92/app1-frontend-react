const { Pool } = require('pg');
require('dotenv').config();

// Conexión dinámica usando las variables de entorno locales del servidor (.env)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// --- LISTADO MAESTRO DE CLIENTES (Extraído de Clientes.txt) ---
// Estandarizado con la primera letra en mayúscula por cada palabra
const clientesParaCargar = [
    { fullName: "Gudely Zerpa. Atencion Al Paciente.", idNumber: "V-20045396", phone: "04120537581", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Gustavo Melendez. Atencion Al Paciente.", idNumber: "V-30528647", phone: "04121329614", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Hans Orellana. Sistema.", idNumber: "V-18105607", phone: "04126730866", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Jacdiel Pineda. Sistema.", idNumber: "V-25814612", phone: "04125160019", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Jonathan Rosario. Administracion.", idNumber: "V-7439857", phone: "04168512498", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Jose Luis Diaz. Atencion Al Paciente.", idNumber: "V-5248451", phone: "04122505917", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Juan Dudamel. Atencion Al Paciente.", idNumber: "V-7445958", phone: "04166159975", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Maria Andrade. Administracion.", idNumber: "V-9251839", phone: "04121512298", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Katherina Rodriguez. Psicologia.", idNumber: "V-25145689", phone: "04120577127", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Mariangeli Sanchez. Atencion Al Paciente.", idNumber: "V-21461343", phone: "04245412916", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Marielis Andrade. Atencion Al Paciente.", idNumber: "V-22180565", phone: "04121348469", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Marlyn Melendez. Tecnico.", idNumber: "V-16322900", phone: "04126772652", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Maria Montes. Mantenimiento.", idNumber: "V-4385426", phone: "04245501918", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Marielis Arrieche. Administracion.", idNumber: "V-15597354", phone: "04267091082", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Yorleydis Guedez. Administracion.", idNumber: "V-26187867", phone: "04245599157", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Yosmary Escalona. Atencion Al Paciente.", idNumber: "V-21244309", phone: "04245796309", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Yaneth Linarez. Administracion.", idNumber: "V-12706691", phone: "04164582856", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Rosana Salas. Tecnico.", idNumber: "V-13033011", phone: "04120632333", institution: "Fundación Higea", status: "ACTIVO" },
    { fullName: "Geoffreyli Suarez. Administración.", idNumber: "V-13603077", phone: "04149567117", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Fraibert Bracho. Sistema.", idNumber: "V-22270634", phone: "04121547616", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Adriana Campos. Laboratorio.", idNumber: "V-26555484", phone: "04266595622", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Ana Crespo. Atencion Al Paciente.", idNumber: "V-15996958", phone: "04169511304", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Ana Vizcaya. Atencion Al Paciente.", idNumber: "V-20920105", phone: "04145057535", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Andreina Montilla. Atencion Al Paciente.", idNumber: "V-17625978", phone: "04124157442", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Arali Sanchez. Atencion Al Paciente.", idNumber: "V-14878056", phone: "04145469515", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Maria Briggi Suarez. Laboratorio.", idNumber: "V-14864447", phone: "04164741001", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Emilia Espinoza. Administracion.", idNumber: "V-7438739", phone: "04165599906", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Giset Ramos. Atencion Al Paciente.", idNumber: "V-20671321", phone: "04245391722", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Migdalia Palencia. Farmacia.", idNumber: "V-13645941", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Dr. Luis Perez.", idNumber: "V-20250753", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Dr. Joel Ballester.", idNumber: "V-4069944", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Ali Escalona Imagen.", idNumber: "V-19640403", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Maria Chavez Imagen.", idNumber: "V-16867992", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Beira Caruci. Novosalud.", idNumber: "V-17783768", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Guadalupe. Voluntariado.", idNumber: "SIN-CEDULA-69", phone: "04143510832", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Yuli. Mantenimiento.", idNumber: "SIN-CEDULA-77", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Jose Perez. Aire Acondicionado.", idNumber: "SIN-CEDULA-81", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Jose Toribio. Mantenimeinto.", idNumber: "SIN-CEDULA-82", phone: "", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Lisbeth Rodriguez. Voluntariado.", idNumber: "V-7425632", phone: "04145106659", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Keimberling Martinez. Atencion Al Paciente.", idNumber: "V-26768868", phone: "", institution: "Fundacion Higea", status: "INACTIVO" },
    { fullName: "Fundación Higea", idNumber: "J-085188193", phone: "", institution: "", status: "ACTIVO" },
    { fullName: "Dra. Galianira Hernandez.", idNumber: "V-725680", phone: "04245124559", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Carolina Miranda. Enfermeria.", idNumber: "V-7443257", phone: "04145007193", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Nuglis Rangel. Novosalud.", idNumber: "V-11469452", phone: "04145155657", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Isabel Lopez. Novosalud.", idNumber: "V-7457516", phone: "04120337762", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Isaura Torrealba. Enfermeria.", idNumber: "V-5363710", phone: "04145087877", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Alba Romelia. Laboratorio.", idNumber: "V-1569963", phone: "04125103555", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Ana Capodiece. Novosalud.", idNumber: "V-9544202", phone: "04166500538", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Maida Beatriz Añez. Voluntariado.", idNumber: "SIN-CEDULA-64", phone: "04143500198", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Carmen Elena Campos. Voluntariado.", idNumber: "SIN-CEDULA-65", phone: "04126201656", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Charlymar. Voluntariado.", idNumber: "SIN-CEDULA-66", phone: "04140350125", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Daniel Alvarez. Enfermeria.", idNumber: "V-16089783", phone: "04163155608", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Dra. Ciria Zerpa.", idNumber: "V-9102222", phone: "04245703092", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Dra. Norma Torres.", idNumber: "V-7356040", phone: "04145126141", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Dra. Sheyla Lopez.", idNumber: "V-4069520", phone: "04145156825", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Dr. Elio Escalona.", idNumber: "V-18996180", phone: "04245781824", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Eva Delgado. Voluntariado.", idNumber: "SIN-CEDULA-67", phone: "04245815581", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Fiorella Fatale Sierralta. Farmacia.", idNumber: "V-30226941", phone: "04147238066", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Gloria. Voluntariado.", idNumber: "SIN-CEDULA-68", phone: "04146995358", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Jhoseline Rodriguez. Voluntariado.", idNumber: "V-20669764", phone: "04143509667", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Jose Peña. Infraestructura.", idNumber: "V-9609500", phone: "04145758995", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Josmar. Voluntariado.", idNumber: "SIN-CEDULA-72", phone: "04248721669", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Gladys Luarte. Voluntariado.", idNumber: "V-11507832", phone: "04145716986", institution: "Fundación Higea", status: "ACTIVO" },
    { fullName: "Hilda Arrieche. Voluntariado.", idNumber: "SIN-CEDULA-70", phone: "04245717182", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Juan Castillo. Mantenimiento.", idNumber: "SIN-CEDULA-76", phone: "", institution: "Fundacion Higea", status: "INACTIVO" },
    { fullName: "María José. Voluntariado.", idNumber: "V-33446600", phone: "", institution: "", status: "ACTIVO" },
    { fullName: "Carlos Madriz. Infraestructura.", idNumber: "V-16531450", phone: "04264504605", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Voluntariado Higea.", idNumber: "J-305213224", phone: "", institution: "Fundación Higea", status: "ACTIVO" },
    { fullName: "Juan Gomez. Laboratorio.", idNumber: "V-21506414", phone: "04263579186", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Juan Mujica. Infraestructura.", idNumber: "SIN-CEDULA-79", phone: "04163548569", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Lisbeth Alvarez. Laboratorio.", idNumber: "V-14293645", phone: "04145486870", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Juandiego Peña. Voluntariado.", idNumber: "V-32553068", phone: "", institution: "", status: "ACTIVO" },
    { fullName: "Lcda. Yoyce Roman. Gerente.", idNumber: "V-13505369", phone: "04145251065", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Lcdo. Efrain Parra. Gerente.", idNumber: "V-7404658", phone: "04245678705", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Lcdo. Eneisa Gonzalez. Gerente.", idNumber: "V-10961430", phone: "04145001727", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Maria Andreina. Farmacia.", idNumber: "SIN-CEDULA-45", phone: "04145236572", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Maria Gloria Hernandez. Laboratorio.", idNumber: "V-12038380", phone: "04145986548", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Martha Garcia. Laboratorio.", idNumber: "V-14648694", phone: "04164535457", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Ruth Pino. Laboratorio.", idNumber: "V-16655254", phone: "04247207948", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Yudith Betancourt. Enfermeria.", idNumber: "V-7592736", phone: "04245135417", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Zolys Perez. Enfermeria.", idNumber: "V-7917442", phone: "04125060312", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Tania Perez. Imagen.", idNumber: "V-12436616", phone: "04145652878", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Johadira Segarra. Imagen.", idNumber: "V-15667454", phone: "04245948217", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Tatiana. Voluntariado.", idNumber: "SIN-CEDULA-75", phone: "04245409836", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Zol. Mantenimiento.", idNumber: "SIN-CEDULA-78", phone: "04245838890", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Ana Carrillo. Voluntariado.", idNumber: "V-7372594", phone: "04126536204", institution: "Fundacion Higea", status: "ACTIVO" },
    { fullName: "Dr. Vladimir Salcedo.", idNumber: "V-12344556", phone: "", institution: "Fundación Higea", status: "ACTIVO" },
    { fullName: "Mariel Melendez. Voluntariado.", idNumber: "SIN-CEDULA-74", phone: "04120540133", institution: "Fundacion Higea", status: "INACTIVO" },
    { fullName: "Valeria Pimentel. Atencion Al Paciente.", idNumber: "V-30226732", phone: "", institution: "Fundacion Higea", status: "INACTIVO" },
    { fullName: "Mariangel Lopez. Metropolis.", idNumber: "V-111", phone: "", institution: "", status: "ACTIVO" },
    { fullName: "Jeison Torres. Almacen.", idNumber: "V-32319733", phone: "04245461899", institution: "Fundación Higea", status: "ACTIVO" },
    { fullName: "Chicos. Voluntariado.", idNumber: "V-1234567", phone: "", institution: "", status: "ACTIVO" },
    { fullName: "Yohana Camacaro. Atencion Al Paciente.", idNumber: "V-15445058", phone: "04145676716", institution: "Fundacion Higea", status: "ACTIVO" }
];

async function cargarClientes() {
    console.log(`🚀 Iniciando carga de ${clientesParaCargar.length} clientes estandarizados...`);
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        for (const c of clientesParaCargar) {
            // Usamos UPSERT (Insert o Update en caso de existir)
            // Se agregaron los campos phone y status para que se actualicen también
            const upsertQuery = `
                INSERT INTO customers (full_name, id_number, institution, phone, status, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT (id_number) 
                DO UPDATE SET 
                    full_name = EXCLUDED.full_name,
                    institution = EXCLUDED.institution,
                    phone = EXCLUDED.phone,
                    status = EXCLUDED.status;
            `;

            await client.query(upsertQuery, [
                c.fullName,
                c.idNumber,
                c.institution,
                c.phone,
                c.status 
            ]);
            
            console.log(`👤 Procesado: ${c.fullName} (${c.idNumber})`);
        }

        await client.query('COMMIT');
        console.log('✨ Carga de clientes completada exitosamente.');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la carga de clientes:', err);
    } finally {
        client.release();
        pool.end();
    }
}

// Ejecutar
cargarClientes();