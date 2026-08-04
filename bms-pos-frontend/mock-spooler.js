import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// 1. ENDPOINT: Simulación de Factura Fiscal
app.post('/imprimirFactura', (req, res) => {
    console.log("=========================================");
    console.log("🖨️ MÁQUINA FISCAL SIMULADA RECIBIÓ DATOS:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=========================================\n");

    setTimeout(() => {
        res.status(200).json({
            status: "success",
            mensaje: "Factura impresa correctamente",
            numero_factura: "0000" + Math.floor(1000 + Math.random() * 9000)
        });
    }, 1000);
});

// 2. ENDPOINT: Simulación de Reporte X (Lectura)
app.post('/imprimirReporteX', (req, res) => {
    console.log("=========================================");
    console.log("📄 EMITIENDO REPORTE X (Lectura Parcial de Caja)");
    console.log("=========================================\n");

    setTimeout(() => {
        res.status(200).json({
            status: "success",
            mensaje: "Reporte X impreso correctamente"
        });
    }, 1500); // 1.5 segundos simulando impresión
});

// 3. ENDPOINT: Simulación de Reporte Z (Cierre)
app.post('/imprimirReporteZ', (req, res) => {
    console.log("=========================================");
    console.log("🔒 EMITIENDO REPORTE Z (Cierre Diario de Memoria)");
    console.log("=========================================\n");

    setTimeout(() => {
        res.status(200).json({
            status: "success",
            mensaje: "Reporte Z impreso correctamente"
        });
    }, 2000); // 2 segundos simulando impresión de cierre
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`🚀 Spooler Fiscal Simulado corriendo en http://localhost:${PORT}`);
    console.log(`Esperando comandos del Frontend React (Facturas, Reporte X y Reporte Z)...`);
});