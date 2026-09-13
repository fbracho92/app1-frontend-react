import ProductAvatar from '../components/ui/ProductAvatar';
import React, { useState, useEffect } from 'react';
import { ProductService, SettingsService } from '../api/services';
import { formatBs, formatUSD } from '../utils/formatters';
import { tenantConfig } from '../config/tenantConfig';
import { API_URL } from '../constants/appConstants';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function PublicCatalogView() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [searchQuery, setSearchQuery] = useState('');
    const [bcvRate, setBcvRate] = useState(0);
    const [loading, setLoading] = useState(true);

    // 🚀 LECTURA DIRECTA Y BLINDADA DESDE LA URL DEL QR
    const urlParams = new URLSearchParams(window.location.search);
    const tenantId = urlParams.get('tenant') || '1';
    const rawUbicacion = urlParams.get('ubicacion') || 'General';
    const ubicacion = rawUbicacion.replace('_', ' #');
    
    const empresaParam = urlParams.get('empresa');
    const rifParam = urlParams.get('rif');

    // ESTADO INICIAL BLINDADO
    const [tenantData, setTenantData] = useState({ 
        name: empresaParam ? decodeURIComponent(empresaParam) : (tenantConfig?.companyName || 'CATÁLOGO DIGITAL'), 
        rif: rifParam ? decodeURIComponent(rifParam) : (tenantConfig?.companyDocument || 'S/I') 
    });

    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    
    // 🚀 NUEVO: Estado para el Quick View Modal del Producto
    const [activeProductDetail, setActiveProductDetail] = useState(null);

    useEffect(() => {
        let isMounted = true; // 🛡️ Evita fugas de memoria si el usuario cierra el catálogo

        const loadPublicData = async (isSilent = false) => {
            try {
                // Si NO es silencioso, mostramos el spinner de carga
                if (!isSilent) setLoading(true);

                const [rateRes, prodRes] = await Promise.all([
                    SettingsService.getExchangeRate(),
                    fetch(`${API_URL}/products/public?tenant=${tenantId}`).then(res => {
                        if (!res.ok) throw new Error("Error al cargar el catálogo público");
                        return res.json();
                    }).then(data => ({ data }))
                ]);
                
                // Si el componente se desmontó mientras cargaba, abortamos para no crashear
                if (!isMounted) return;
                
                setBcvRate(rateRes.data.bcv_rate || 1);

                const checkIsInternalService = (product) => {
                    const pName = (product.name || '').toUpperCase();
                    const pCat = (product.category || '').toUpperCase();
                    return pName.includes('DELIVERY') || 
                           pName.includes('DESPACHO') || 
                           pName.includes('ENVÍO') || 
                           pName.includes('ENVIO') || 
                           pName.includes('AVANCE') || 
                           pName.includes('FLETE') ||
                           pCat.includes('DELIVERY') || 
                           pCat.includes('DESPACHO') ||
                           pCat.includes('AVANCE');
                };

                // 🚀 UX PRO: FILTRO DEFINITIVO (Sin servicios internos y SIN productos agotados)
                const activeProducts = (prodRes.data || []).filter(p => {
                    const isService = p.is_service === true || p.is_service === 't' || p.is_service === 1;
                    const hasStock = isService || parseFloat(p.stock) > 0;

                    return p.status === 'ACTIVE' && 
                           !p.is_raw_material &&
                           !checkIsInternalService(p) &&
                           hasStock;
                });

                setProducts(activeProducts);
                
                // Extraer categorías únicas basándose solo en los productos DISPONIBLES
                setCategories(['Todos', ...new Set(activeProducts.map(p => p.category).filter(Boolean))]);
                
                // Ocultamos el spinner solo si lo encendimos en esta pasada
                if (!isSilent) setLoading(false);
            } catch (error) {
                console.error("Error cargando catálogo público:", error);
                if (!isSilent) setLoading(false);
            }
        };

        // 1. Carga inicial pesada (Con pantalla de carga)
        loadPublicData(false);

        // 2. 🚀 AUTO-POLLING SILENCIOSO (Refresca cada 10 segundos)
        const intervalId = setInterval(() => {
            loadPublicData(true); // isSilent = true (no activa el loading)
        }, 10000);

        // 3. Limpieza del intervalo al salir (Memory Leak Shield)
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [tenantId]);

    // --- LÓGICA DE CARRITO ---
    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, { ...product, quantity: 1 }];
        });
        Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Agregado a tu orden', showConfirmButton: false, timer: 1200 });
    };

    const decreaseQuantity = (productId) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === productId);
            if (existing.quantity === 1) return prev.filter(item => item.id !== productId);
            return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
        });
    };

    const totalCartUSD = cart.reduce((acc, item) => acc + (parseFloat(item.price_usd) * item.quantity), 0);
    const totalCartVES = totalCartUSD * bcvRate;

    // --- ENVÍO DE ÓRDENES ---
    const handleSendOrder = async () => {
        if (cart.length === 0) return;

        const { value: customerName } = await Swal.fire({
            title: '¿Quién ordena?',
            text: `Ingresa tu nombre o empresa para el pedido en: ${ubicacion}`,
            input: 'text',
            inputPlaceholder: 'Ej: Carlos, Silla 3, Empresa C.A.',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Enviar Pedido',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb',
            inputValidator: (value) => { if (!value) return '¡Necesitamos un nombre de referencia!'; },
            customClass: { popup: 'rounded-3xl' }
        });

        if (customerName) {
            Swal.fire({ title: 'Enviando a Caja...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            try {
                const orderPayload = {
                    tenant_id: tenantId,
                    referenceName: `${customerName} - ${ubicacion}`,
                    cartData: cart
                };

                const response = await fetch(`${API_URL}/public/held-orders`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(orderPayload) 
                });

                if (!response.ok) {
                    throw new Error('Error al conectar con la base de datos');
                }

                setTimeout(() => {
                    setCart([]);
                    setIsCartOpen(false);
                    Swal.fire('¡Pedido Confirmado!', `Tu orden fue recibida en caja a nombre de <b>${customerName}</b>.`, 'success');
                }, 800);

            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'No se pudo comunicar con el sistema del local. Por favor avise a un empleado.', 'error');
            }
        }
    };

    // --- GENERADOR DE PRESUPUESTO PDF BLINDADO ---
    const handleGenerateBudget = () => {
        if (cart.length === 0) return;

        const doc = new jsPDF({ format: 'a4', unit: 'mm' });
        
        // 🎨 PALETA EXECUTIVA / FINTECH (Midnight & Steel)
        const primaryColor = [15, 23, 42];    // Slate 900
        const tableHeaderBg = [30, 41, 59];   // Slate 800
        const altRowBg = [248, 250, 252];     // Slate 50
        const textColor = [51, 65, 85];       // Slate 700

        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 42, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("COTIZACIÓN DE PRODUCTOS", 14, 18);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(203, 213, 225); 
        doc.text(`${tenantData.name.toUpperCase()}  |  RIF: ${tenantData.rif}`, 14, 26);

        const dateStr = new Date().toLocaleDateString('es-VE');
        doc.text(`FECHA: ${dateStr}`, 196, 17, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(52, 211, 153); 
        doc.text(`TASA BCV: Bs ${formatBs(bcvRate)}`, 196, 26, { align: 'right' });

        doc.setFillColor(37, 99, 235); 
        doc.rect(0, 42, 210, 1.5, 'F');

        const tableBody = cart.map(item => [
            item.name,
            `${item.quantity}`,
            `Ref ${formatUSD(item.price_usd)}`,
            `Ref ${formatUSD(item.price_usd * item.quantity)}`,
            `Bs ${formatBs((item.price_usd * item.quantity) * bcvRate)}`
        ]);

        autoTable(doc, {
            startY: 52,
            head: [['DESCRIPCIÓN DEL PRODUCTO', 'CANT.', 'PRECIO UNIT.', 'TOTAL (REF)', 'TOTAL (BS)']],
            body: tableBody,
            headStyles: {
                fillColor: tableHeaderBg,
                textColor: [255, 255, 255],
                fontSize: 8.5,
                fontStyle: 'bold',
                cellPadding: 4,
                halign: 'left'
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { halign: 'center', cellWidth: 20 },
                2: { halign: 'right', cellWidth: 32 },
                3: { halign: 'right', cellWidth: 32 },
                4: { halign: 'right', cellWidth: 38 }
            },
            bodyStyles: {
                textColor: textColor,
                fontSize: 8.5,
                cellPadding: 4
            },
            alternateRowStyles: {
                fillColor: altRowBg
            },
            tableLineColor: [226, 232, 240],
            tableLineWidth: 0.1,
            margin: { left: 14, right: 14 }
        });

        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 90;
        
        doc.setFillColor(241, 245, 249); 
        doc.roundedRect(114, finalY - 4, 82, 22, 2, 2, 'F');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('TOTAL GENERAL:', 118, finalY + 3);
        doc.text('REF', 158, finalY + 3, { align: 'right' });
        doc.text('BS', 192, finalY + 3, { align: 'right' });

        doc.setFontSize(10);
        doc.text(`${formatUSD(totalCartUSD)}`, 158, finalY + 11, { align: 'right' });
        doc.text(`${formatBs(totalCartVES)}`, 192, finalY + 11, { align: 'right' });

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139); 
        doc.text("* Documento informativo no fiscal. Precios sujetos a modificación según la tasa oficial vigente del BCV.", 14, finalY + 30);
        doc.text(`Generado por ${tenantData.name} — Terminal Seguro BMS Digital`, 14, finalY + 35);

        const safeName = tenantData.name.replace(/\s+/g, '_').toUpperCase();
        doc.save(`COTIZACION_${safeName}_${dateStr.replace(/\//g, '-')}.pdf`);
        
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Cotización Ejecutiva Generada', showConfirmButton: false, timer: 2000 });
    };

    const filtered = products.filter(p => {
        if (selectedCategory !== 'Todos' && p.category !== selectedCategory) return false;
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold text-sm tracking-widest uppercase text-slate-400">Cargando Catálogo...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 selection:bg-blue-600 selection:text-white">
            {/* HEADER */}
            <header className="bg-blue-700 text-white p-5 md:p-6 shadow-md sticky top-0 z-40 border-b border-blue-800">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="bg-white/20 text-white border border-white/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest backdrop-blur-sm shadow-sm">
                                📍 {ubicacion}
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase drop-shadow-sm">
                            {tenantData.name}
                        </h1>
                        <p className="text-xs text-blue-100 font-bold tracking-widest mt-0.5">
                            RIF: {tenantData.rif}
                        </p>
                    </div>
                    
                    <div className="bg-white px-5 py-3 rounded-[1rem] text-right shrink-0 shadow-sm flex items-center gap-4 border border-blue-100 w-full md:w-auto mt-2 md:mt-0">
                        <div className="text-right flex-1 md:flex-none">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Tasa Oficial BCV</span>
                            <span className="text-lg font-black text-slate-800">Bs {formatBs(bcvRate)}</span>
                        </div>
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse shrink-0"></div>
                    </div>
                </div>
            </header>

            {/* Buscador y Controles */}
            <div className="max-w-6xl mx-auto px-4 mt-6">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </span>
                        <input 
                            type="text" 
                            placeholder="Buscar artículo..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full bg-white border-2 border-slate-200 rounded-[1.25rem] pl-12 pr-4 py-3.5 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-600 transition-all"
                        />
                    </div>
                    
                    <div className="shrink-0 flex items-center justify-between gap-3 bg-white border-2 border-slate-200 rounded-[1.25rem] px-5 py-3 md:py-2 shadow-sm">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Mostrar:</span>
                        <select 
                            value={itemsPerPage} 
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-transparent font-black text-sm text-slate-700 outline-none cursor-pointer"
                        >
                            <option value={25}>25 / pág</option>
                            <option value={50}>50 / pág</option>
                            <option value={100}>100 / pág</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
                    {categories.map((cat, idx) => (
                        <button
                            key={idx}
                            onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
                            className={`px-6 py-2.5 rounded-[1rem] text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all shadow-sm shrink-0 ${
                                selectedCategory === cat 
                                    ? 'bg-blue-600 text-white shadow-blue-200 shadow-md' 
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* CUADRÍCULA DE PRODUCTOS CLICKEABLES CON QUICK VIEW */}
            <main className="max-w-6xl mx-auto px-4 mt-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                    {currentItems.map(product => {
                        const priceUsd = parseFloat(product.price_usd) || 0;
                        const priceVes = priceUsd * bcvRate;

                        return (
                            <div 
                                key={product.id} 
                                // 🚀 UX PRO: Si tiene descripción abre el modal, sino agrega directo
                                onClick={() => {
                                    if (product.description) {
                                        setActiveProductDetail(product);
                                    } else {
                                        addToCart(product);
                                    }
                                }}
                                className="bg-white rounded-2xl md:rounded-[2rem] p-4 md:p-5 border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between relative group select-none cursor-pointer active:scale-[0.98]"
                            >
                                <div className="relative z-10 flex flex-col items-center text-center mt-2 pointer-events-none">
                                    <div className="relative mb-3 md:mb-4">
                                        {/* 🚀 USANDO PRODUCT AVATAR: Soporta perfectamente Emojis e Imágenes Comprimidas (Base64 / URL) */}
                                        <ProductAvatar 
                                            icon={product.icon_emoji} 
                                            size="w-12 h-12 md:w-16 md:h-16 text-3xl md:text-4xl rounded-xl md:rounded-2xl" 
                                        />
                                        
                                        {/* Indicador visual de que tiene detalles */}
                                        {product.description && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-blue-100 text-blue-600 w-5 h-5 flex items-center justify-center rounded-full border border-blue-200 shadow-sm text-[10px]">
                                                ℹ️
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-black text-slate-800 text-xs md:text-sm mt-1 mb-2 leading-tight line-clamp-2">{product.name}</h3>
                                </div>

                                <div className="mt-1 flex flex-col items-center justify-center relative z-10 pointer-events-none">
                                    <span className="text-base md:text-xl font-black text-slate-800">Bs {formatBs(priceVes)}</span>
                                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 block mt-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">Ref {formatUSD(priceUsd)}</span>
                                </div>

                                <div className="mt-4 md:mt-5 w-full z-20">
                                     <button 
                                        // 🚀 UX PRO: El botón siempre hace AddToCart directo (evade el modal)
                                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                                        className="w-full py-2.5 md:py-3 rounded-xl md:rounded-[1rem] flex items-center justify-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100"
                                    >
                                        <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                        Agregar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-3 md:gap-4 mt-8 md:mt-10 mb-4">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-[1rem] bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-50 text-xs md:text-sm">Anterior</button>
                        <span className="text-[10px] md:text-[11px] font-black text-slate-500 tracking-widest uppercase bg-white border border-slate-200 px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-[1rem]">{currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-[1rem] bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-50 text-xs md:text-sm">Siguiente</button>
                    </div>
                )}
            </main>

            {/* CARRITO FLOTANTE */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 animate-fade-in px-4">
                    <button 
                        onClick={() => setIsCartOpen(true)}
                        className="bg-blue-600 text-white rounded-full px-6 md:px-8 py-3.5 md:py-4 flex items-center gap-4 md:gap-6 shadow-xl shadow-blue-600/40 hover:scale-105 transition-transform w-full max-w-sm justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white text-blue-600 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-black text-xs md:text-sm shadow-sm">
                                {cart.reduce((a, b) => a + b.quantity, 0)}
                            </div>
                            <span className="font-black text-xs md:text-sm tracking-wide uppercase">Ver Carrito</span>
                        </div>
                        <span className="font-black text-white text-base md:text-lg tracking-wide">Ref {formatUSD(totalCartUSD)}</span>
                    </button>
                </div>
            )}

            {/* MODAL DEL CARRITO OPTIMIZADO PARA MÓVILES */}
            {isCartOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-end">
                    <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-in-right md:rounded-l-3xl overflow-hidden">
                        
                        <div className="p-5 md:p-6 bg-blue-700 text-white flex justify-between items-center shrink-0 shadow-md z-10">
                            <div>
                                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">Tu Orden</h2>
                                <p className="text-blue-200 text-[9px] md:text-[10px] font-bold mt-0.5 tracking-widest uppercase">{ubicacion}</p>
                            </div>
                            <button onClick={() => setIsCartOpen(false)} className="text-white bg-blue-800 p-2 rounded-full active:scale-95 transition-all">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar bg-slate-50">
                            {cart.map(item => (
                                <div key={item.id} className="flex flex-col bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start w-full mb-3">
                                        <p className="font-bold text-slate-800 text-sm line-clamp-2 pr-2">{item.name}</p>
                                        <p className="text-sm font-black text-slate-900 shrink-0">Ref {formatUSD(parseFloat(item.price_usd) * item.quantity)}</p>
                                    </div>
                                    
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-[10px] md:text-[11px] font-black text-slate-400">Ref {formatUSD(parseFloat(item.price_usd))} c/u</p>
                                        
                                        <div className="flex items-center gap-2 md:gap-3 bg-slate-50 border border-slate-100 rounded-[1rem] p-1.5 shadow-inner">
                                            <button 
                                                onClick={() => decreaseQuantity(item.id)} 
                                                className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl shadow-sm transition-all active:scale-90 ${
                                                    item.quantity === 1 
                                                    ? 'bg-rose-100 text-rose-600 border border-rose-200' 
                                                    : 'bg-white text-slate-600 border border-slate-200'
                                                }`}
                                            >
                                                {item.quantity === 1 ? (
                                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                ) : (
                                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
                                                )}
                                            </button>
                                            
                                            <span className="font-black text-slate-800 w-5 md:w-6 text-center text-sm md:text-base">{item.quantity}</span>
                                            
                                            <button 
                                                onClick={() => addToCart(item)} 
                                                className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 transition-all active:scale-90"
                                            >
                                                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-5 md:p-6 bg-white border-t border-slate-200 shadow-[0_-15px_30px_rgba(0,0,0,0.04)] shrink-0 z-10 relative pb-safe">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px] md:text-[10px]">Total Divisa</span>
                                <span className="font-black text-lg md:text-xl text-slate-900">Ref {formatUSD(totalCartUSD)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-5 md:mb-6 pb-4 border-b border-slate-100">
                                <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px] md:text-[10px]">Total Bs (BCV)</span>
                                <span className="font-black text-base md:text-lg text-blue-600">Bs {formatBs(totalCartVES)}</span>
                            </div>
                            
                            <div className="flex flex-col gap-2 md:gap-3">
                                <button 
                                    onClick={handleSendOrder}
                                    className="w-full bg-blue-600 text-white font-black py-3.5 md:py-4 rounded-xl md:rounded-2xl uppercase tracking-widest text-[11px] md:text-xs shadow-lg shadow-blue-200 transition-all active:scale-95 flex justify-center items-center gap-2"
                                >
                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    Procesar Pedido Local
                                </button>
                                
                                <button 
                                    onClick={handleGenerateBudget}
                                    className="w-full bg-white border-2 border-slate-200 text-slate-600 font-black py-3.5 md:py-4 rounded-xl md:rounded-2xl uppercase tracking-widest text-[11px] md:text-xs transition-all active:scale-95 flex justify-center items-center gap-2"
                                >
                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Cotización PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🚀 NUEVO: MODAL QUICK VIEW (VISTA PREVIA DEL PRODUCTO) */}
            {activeProductDetail && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in" onClick={() => setActiveProductDetail(null)}>
                    <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative border border-slate-100 flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setActiveProductDetail(null)} className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center font-bold outline-none transition-all">✕</button>
                        
                        <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-inner overflow-hidden">
                            <ProductAvatar 
                                icon={activeProductDetail.icon_emoji} 
                                size="w-full h-full text-4xl" 
                            />
                        </div>
                        
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest text-center block">{activeProductDetail.category || 'General'}</span>
                        <h3 className="font-black text-slate-800 text-lg text-center mt-1 leading-snug">{activeProductDetail.name}</h3>
                        
                        <div className="my-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed text-center shadow-inner whitespace-pre-wrap">
                            {activeProductDetail.description}
                        </div>

                        <div className="flex items-center justify-between mb-6 px-2">
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-widest">Precio Unitario</span>
                                <span className="text-xl font-black text-slate-900">Ref {formatUSD(activeProductDetail.price_usd)}</span>
                            </div>
                            <span className="text-sm font-black text-blue-600">Bs {formatBs(activeProductDetail.price_usd * bcvRate)}</span>
                        </div>

                        <button 
                            onClick={() => {
                                addToCart(activeProductDetail);
                                setActiveProductDetail(null);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-blue-200 active:scale-95 transition-all outline-none"
                        >
                            Agregar a mi Orden
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}