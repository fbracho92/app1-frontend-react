import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { ProductService, InventoryService } from '../api/services';
import { EMOJI_OPTIONS } from '../constants/appConstants';

export const useInventory = (onDataUpdated) => {
    // --- ESTADOS PRINCIPALES ---
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);

    // --- ESTADO PARA VISOR DE KARDEX ---
    const [isKardexOpen, setIsKardexOpen] = useState(false);
    const [kardexHistory, setKardexHistory] = useState([]);
    const [kardexProduct, setKardexProduct] = useState(null);

    // --- ESTADOS NUEVOS: GESTIÓN DE INVENTARIO (KARDEX) ---
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [movementProduct, setMovementProduct] = useState(null);
    const [movementType, setMovementType] = useState('IN'); // 'IN' o 'OUT'
    const [movementForm, setMovementForm] = useState({ quantity: '', document_ref: '', reason: 'COMPRA_PROVEEDOR', cost_usd: '', new_expiration: '', next_expiration: '' });

    const [batches, setBatches] = useState([]); // Para guardar los lotes del producto
    const [selectedBatch, setSelectedBatch] = useState(null); // Lote seleccionado para borrar

    const [isProductFormOpen, setIsProductFormOpen] = useState(false); // NUEVO ESTADO PARA PRODUCTOS

    // ESTADO ACTUALIZADO
    const [productForm, setProductForm] = useState({
        id: null,
        name: '',
        category: '',
        price_usd: '',
        stock: '',      // <--- Para que el input empiece vacío
        is_taxable: true,
        icon_emoji: '🍔',
        barcode: '',
        status: 'ACTIVE',
        expiration_date: '',
        is_perishable: true, // <--- Para que el checkbox funcione
        is_raw_material: false
    });

    // NUEVOS ESTADOS para búsqueda de inventario
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [filteredInventory, setFilteredInventory] = useState([]);
    const [filterExpiration, setFilterExpiration] = useState(false);
    const [inventoryCurrentPage, setInventoryCurrentPage] = useState(1); // <-- PAGINACIÓN INVENTARIO

    // Estado para crear materia prima en el modal de inventario
    const [isRawMaterial, setIsRawMaterial] = useState(false);

    // 💡 Lógica de filtro OPTIMIZADA (Con Debounce para evitar Violations)
    useEffect(() => {
        // Creamos un temporizador para no filtrar inmediatamente al escribir
        const timerId = setTimeout(() => {
            let results = products;

            // 1. Filtro por Búsqueda (Texto)
            if (productSearchQuery) {
                const lowerQuery = productSearchQuery.toLowerCase();
                results = results.filter(p =>
                    p.name.toLowerCase().includes(lowerQuery) ||
                    p.category.toLowerCase().includes(lowerQuery) ||
                    p.id.toString().includes(lowerQuery) ||
                    (p.barcode && p.barcode.includes(lowerQuery))
                );
            }

            // 2. Filtro por Vencimiento
            if (filterExpiration) {
                results = results.filter(product => {
                    if (!product.expiration_date) return false;
                    const daysLeft = Math.ceil((new Date(product.expiration_date) - new Date()) / (1000 * 60 * 60 * 24));
                    return daysLeft <= 30;
                });
            }

            setFilteredInventory(results);
            setInventoryCurrentPage(1);
        }, 300); // <--- ESPERA 300ms (Esto elimina el lag del 'input handler')

        // Limpieza: Si escribes otra letra antes de los 300ms, cancela el cálculo anterior
        return () => clearTimeout(timerId);

    }, [productSearchQuery, products, filterExpiration]);

    const fetchBatches = async (productId) => {
        try {
            const res = await InventoryService.getBatches(productId);
            setBatches(res.data);
        } catch (error) { console.error(error); }
    };

    // ABRIR MODAL
    const openMovementModal = (product, type) => {
        setMovementProduct(product);
        setMovementType(type);
        setMovementForm({
            quantity: '',
            reason: type === 'IN' ? 'COMPRA_PROVEEDOR' : 'VENTA',
            document_ref: '',
            new_expiration: '',
            // IMPORTANTE: Cargamos el precio actual por defecto
            cost_usd: product.price_usd,
            batch_id: ''
        });
        setIsMovementModalOpen(true);
    };

    // ENVIAR MOVIMIENTO (CORREGIDO: CÁLCULO DE STOCK REAL)
    // ENVIAR MOVIMIENTO (NIVEL 2: GESTIÓN DE LOTES ROBUSTA)
    const handleMovementSubmit = async (e) => {
        e.preventDefault();
        const qty = parseInt(movementForm.quantity);

        if (!qty || qty <= 0) return Swal.fire('Error', 'Cantidad inválida', 'warning');
        if (movementType === 'IN' && !movementForm.document_ref) return Swal.fire('Atención', 'El Nro de Factura es obligatorio para entradas.', 'warning');

        // VALIDACIÓN: Si es una salida específica (Vencimiento o Merma), es obligatorio seleccionar un lote
        if (movementType === 'OUT' && (movementForm.reason === 'VENCIMIENTO' || movementForm.reason === 'MERMA_DAÑO') && !selectedBatch) {
            return Swal.fire('Error', 'Debes seleccionar un lote de la lista para retirar.', 'warning');
        }

        try {
            Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

            // ENVIAMOS AL BACKEND (El backend maneja la suma de lotes y lógica FEFO)
            await InventoryService.registerMovement({
                product_id: movementProduct.id,
                type: movementType,
                quantity: qty,
                document_ref: movementForm.document_ref,
                reason: movementForm.reason,
                cost_usd: movementForm.cost_usd,
                // Si es entrada, enviamos la fecha del nuevo lote
                new_expiration: movementType === 'IN' ? movementForm.new_expiration : null,
                // Si es salida específica, enviamos el ID del lote seleccionado
                specific_batch_id: selectedBatch
            });

            Swal.fire({ icon: 'success', title: 'Movimiento Exitoso', timer: 1500, showConfirmButton: false });

            // Limpieza y Cierre
            setIsMovementModalOpen(false);
            setMovementForm({
                quantity: '',
                document_ref: '',
                reason: 'COMPRA_PROVEEDOR',
                cost_usd: '',
                new_expiration: '',
                next_expiration: '' // Limpiamos campos viejos por si acaso
            });
            setSelectedBatch(null);

            // CRÍTICO: Recargar los datos para ver el nuevo stock total calculado por el backend
            if (onDataUpdated) onDataUpdated();

        } catch (error) {
            console.error(error);
            Swal.fire('Error', error.response?.data?.error || 'Error al procesar', 'error');
        }
    };

    // Helper auxiliar corregido (utilizando la Capa de Servicios)
    const updateProductDate = async (prod, date, correctStock) => {
        // Usamos ProductService.update en lugar de axios.post directo
        // Nota: Si tu backend requiere un POST a /products para actualizar, usa ProductService.create
        // Pero lo estándar en REST para actualizar por ID es ProductService.update (PUT)
        return ProductService.update(prod.id, {
            ...prod,
            price_usd: prod.price_usd,
            stock: correctStock, // <--- CORRECCIÓN: Usamos el stock calculado
            is_taxable: prod.is_taxable,
            expiration_date: date
        });
    };

    // --- FUNCIÓN: VER KARDEX (HISTORIAL) ---
    const viewKardexHistory = async (product) => {
        setKardexProduct(product);
        setIsKardexOpen(true);
        setKardexHistory([]); // Limpiar anterior

        try {
            Swal.fire({ title: 'Auditando Kardex...', didOpen: () => Swal.showLoading() });
            // Asegúrate de tener este endpoint en tu server.js (lo creamos en el paso anterior)
            const res = await InventoryService.getHistory(product.id);
            setKardexHistory(res.data);
            Swal.close();
        } catch (error) {
            console.error(error);
            Swal.fire('Info', 'No hay historial disponible aún para este producto.', 'info');
            setIsKardexOpen(false);
        }
    };

    // --- FUNCIÓN PARA PROCESAR LA IMAGEN DEL PRODUCTO (BASE64) ---
    const handleImageRead = (file, callback) => {
        if (!file) return;

        // Validación básica de tipo de archivo
        if (!file.type.startsWith('image/')) {
            return Swal.fire('Error', 'El archivo seleccionado debe ser una imagen', 'error');
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            // Ejecuta el callback que actualiza el estado del formulario
            callback(reader.result);
        };
        reader.readAsDataURL(file);
    };

    // --- NUEVA LÓGICA: Lógica de Edición/Creación de Productos con Campo Fiscal y Validación de Texto ---
    const handleProductFormChange = (e) => {
        const { name, value } = e.target;
        let newValue = value;

        // 🎯 LÓGICA DE VALIDACIÓN Y FORMATO: Nombre y Categoría solo letras + Capitalización
        if (name === 'name' || name === 'category') {
            // 1. Limpiar: Permitir solo letras, espacios y caracteres acentuados comunes.
            const cleaned = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');

            // 2. Formatear (Capitalizar por palabra)
            newValue = cleaned.toLowerCase().split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        }

        setProductForm(prev => ({
            ...prev,
            // CRUCIAL: Convertir el valor de `is_taxable` a booleano, o usar newValue si es otro campo
            [name]: (name === 'is_taxable') ? (value === 'true') : newValue
        }));
    };

    // Función para selección rápida de emoji
    const handleEmojiSelect = (emoji) => {
        setProductForm(prev => ({ ...prev, icon_emoji: emoji }));
    };

    const saveProduct = async (e) => {
        e.preventDefault();

        if (!productForm.name || !productForm.price_usd || parseFloat(productForm.price_usd) <= 0) {
            return Swal.fire('Datos Incompletos', 'Nombre y Precio (USD > 0) son obligatorios.', 'warning');
        }

        try {
            Swal.fire({ title: `Guardando Producto...`, didOpen: () => Swal.showLoading() });

            const productToSend = {
                ...productForm, // Hereda id, name, category, icon_emoji, etc.

                // Convertir valores numéricos y booleanos al formato correcto
                price_usd: parseFloat(productForm.price_usd),
                stock: parseInt(productForm.stock),

                // Aseguramos que is_taxable sea un booleano real (por si viene como string "true")
                is_taxable: (productForm.is_taxable === true || productForm.is_taxable === 'true'),

                // IMPORTANTE: Aseguramos explícitamente que status y barcode se envíen
                status: productForm.status,
                barcode: productForm.barcode
            };

            // Opcional: ver en consola qué se está enviando para depurar
            console.log("Enviando al servidor:", productToSend);

            await ProductService.create(productToSend);

            Swal.fire('¡Éxito!', `Producto ${productForm.id ? 'actualizado' : 'registrado'} correctamente.`, 'success');

            // Resetear formulario incluyendo los nuevos campos
            setProductForm({
                id: null,
                name: '',
                category: '',
                price_usd: 0.00,
                stock: 0,
                is_taxable: true,
                icon_emoji: EMOJI_OPTIONS[0] || '🍔',
                barcode: '',
                status: 'ACTIVE',
                expiration_date: '' // <--- RESETEAR FECHA
            });

            setIsProductFormOpen(false); // Cierra el modal al terminar
            if (onDataUpdated) onDataUpdated(); // Recarga la lista llamando a fetchData
        } catch (error) {
            const message = error.response?.data?.error || error.message;
            Swal.fire('Error', `Fallo al guardar producto: ${message}`, 'error');
        }
    }

    return {
        products, setProducts,
        categories, setCategories,
        isKardexOpen, setIsKardexOpen,
        kardexHistory, setKardexHistory,
        kardexProduct, setKardexProduct,
        isMovementModalOpen, setIsMovementModalOpen,
        movementProduct, setMovementProduct,
        movementType, setMovementType,
        movementForm, setMovementForm,
        batches, setBatches,
        selectedBatch, setSelectedBatch,
        isProductFormOpen, setIsProductFormOpen,
        productForm, setProductForm,
        productSearchQuery, setProductSearchQuery,
        filteredInventory, setFilteredInventory,
        filterExpiration, setFilterExpiration,
        inventoryCurrentPage, setInventoryCurrentPage,
        isRawMaterial, setIsRawMaterial,
        fetchBatches,
        openMovementModal,
        handleMovementSubmit,
        updateProductDate,
        viewKardexHistory,
        handleImageRead,
        handleProductFormChange,
        handleEmojiSelect,
        saveProduct
    };
};