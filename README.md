# 🛒 BMS Digital - Point of Sale (POS) System

![Privado](https://img.shields.io/badge/Visibilidad-Privado-red?style=for-the-badge)
![Licencia](https://img.shields.io/badge/Licencia-Propiedad_Comercial-blue?style=for-the-badge)
![Estado](https://img.shields.io/badge/Estado-En_Desarrollo-success?style=for-the-badge)

Sistema integral de Punto de Venta (POS) diseñado y comercializado por **BMS Digital**. Este repositorio contiene tanto la lógica de servidor (Backend) como la interfaz de usuario (Frontend), optimizados para un rendimiento ágil y operaciones fiscales.

---

## 🏗️ Arquitectura del Sistema

El proyecto está dividido en dos aplicaciones principales:

*   **`/backend`**: API RESTful que maneja la lógica de negocio, usuarios, inventario, reportes y ventas. Incluye un scraper de la tasa BCV (`bcvScraper.js`) y utilidades de base de datos.
*   **`/bms-pos-frontend`**: Aplicación de interfaz de usuario construida con React, Vite y Tailwind CSS. Maneja el dashboard, la terminal de punto de venta (POS), inventario (Kardex), caja y clientes[cite: 1].

## ✨ Módulos Principales (Basado en la estructura)

*   📦 **Inventario y Productos:** Gestión de stock, alertas de stock bajo (`StockAlertModal.jsx`) y movimientos de Kardex (`KardexModal.jsx`)[cite: 1].
*   💳 **Ventas y Caja:** Cierre de caja (`DailySalesModal.jsx`), terminal POS con soporte numérico (`NumpadModal.jsx`), escáner de código de barras (`useBarcodeScanner.js`) y cobros parciales/créditos[cite: 1].
*   👥 **Usuarios y Clientes:** Gestión de clientes (`CustomersView.jsx`), proveedores (`ProviderModal.jsx`) y control de acceso de usuarios[cite: 1].
*   🧾 **Facturación:** Generadores de documentos (`documentGenerators.js`) y formateadores fiscales (`fiscalFormatters.js`) para impresión de recibos (`ReceiptPreviewModal.jsx`)[cite: 1].

---

## 🚀 Guía de Instalación y Despliegue

### Requisitos Previos
*   Node.js (v18 o superior recomendado)
*   Gestor de paquetes `npm`

### Configuración del Backend[cite: 1]
1. Entrar al directorio: `cd backend`
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno: Crear archivo `.env` basado en la configuración necesaria para la Base de Datos (`config/db.js`)[cite: 1].
4. Iniciar servidor: `npm run dev` (o `node server.js`)[cite: 1].

### Configuración del Frontend[cite: 1]
1. Entrar al directorio: `cd bms-pos-frontend`[cite: 1]
2. Instalar dependencias: `npm install`
3. Iniciar entorno de desarrollo (Vite): `npm run dev`[cite: 1].

---

## 🔒 Derechos de Autor y Confidencialidad

**© 2026 BMS Digital. Todos los derechos reservados.**

Este código fuente es estrictamente confidencial y es propiedad exclusiva de BMS Digital. Queda estrictamente prohibida la copia, distribución, modificación, compilación, uso comercial o divulgación de este código, en su totalidad o en partes, sin el consentimiento previo y por escrito de la gerencia de BMS Digital.
