import { useEffect } from 'react';
import Swal from 'sweetalert2';

export const useBarcodeScanner = ({ products, addToCart }) => {
    // --- LÓGICA DE ESCÁNER DE CÓDIGO DE BARRAS (GLOBAL) ---
    useEffect(() => {
        let barcodeBuffer = '';
        let lastKeyTime = 0;
        const SCANNER_THRESHOLD = 50; // ms entre teclas (los escáneres son muy rápidos)

        const handleGlobalKeyDown = (e) => {
            // 1. Ignorar si el usuario está escribiendo en un input normal (Buscador, formulario, etc)
            // EXCEPCIÓN: Si el input es "readOnly" o el body, dejamos pasar el evento.
            const target = e.target;
            if (target.tagName === 'INPUT' && !target.readOnly && target.type !== 'checkbox' && target.type !== 'radio') {
                return;
            }

            const currentTime = Date.now();

            // 2. Si pasó mucho tiempo desde la última tecla, reiniciamos el buffer (es tecleo manual lento)
            if (currentTime - lastKeyTime > SCANNER_THRESHOLD) {
                barcodeBuffer = '';
            }

            lastKeyTime = currentTime;

            // 3. Detectar "Enter" como final del código
            if (e.key === 'Enter') {
                if (barcodeBuffer.length > 2) { // Evitamos lecturas fantasmas de 1 o 2 caracteres

                    // BUSCAR EL PRODUCTO POR CÓDIGO DE BARRAS
                    const scannedProduct = products.find(p =>
                        p.barcode === barcodeBuffer ||
                        p.barcode === barcodeBuffer.trim()
                    );

                    if (scannedProduct) {
                        // LÓGICA DE STOCK (UX: Feedback si no hay stock)
                        if (scannedProduct.stock > 0) {
                            addToCart(scannedProduct);

                            // Feedback Visual Sutil (Toast rápido)
                            const Toast = Swal.mixin({
                                toast: true,
                                position: 'bottom-end',
                                showConfirmButton: false,
                                timer: 1500,
                                timerProgressBar: true
                            });
                            Toast.fire({
                                icon: 'success',
                                title: `+1 ${scannedProduct.name}`
                            });
                        } else {
                            // Sonido o alerta de error
                            Swal.fire({
                                icon: 'error',
                                title: 'Sin Stock',
                                text: `El producto "${scannedProduct.name}" está agotado.`,
                                timer: 2000,
                                showConfirmButton: false
                            });
                        }
                    } else {
                        // Opcional: Feedback si no existe el código
                        console.log(`Código no encontrado: ${barcodeBuffer}`);
                    }
                }
                barcodeBuffer = ''; // Limpiar buffer después del Enter
            } else {
                // 4. Acumular caracteres imprimibles (Números y Letras)
                if (e.key.length === 1) {
                    barcodeBuffer += e.key;
                }
            }
        };

        // Agregar el listener al documento global
        window.addEventListener('keydown', handleGlobalKeyDown);

        // Limpieza al desmontar
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [products, addToCart]); // Dependencias vitales para que funcione con la data actual
};