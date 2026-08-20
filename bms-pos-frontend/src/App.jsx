import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Button from './components/ui/Button';
import Input from './components/ui/Input';
import ProductAvatar from './components/ui/ProductAvatar';
import ProviderModal from './views/ProviderModal';
import InventoryView from './views/InventoryView';
import CustomersView from './views/CustomersView';
import CreditsView from './views/CreditsView';
import PosView, { CartItem } from './views/PosView';
import { PurchasesView } from './views/PurchasesView';
import { DashboardView } from './views/DashboardView';
import { AdvancedReportsView } from './views/AdvancedReportsView';
import { CheckoutModal } from './views/CheckoutModal';
import { UsersManagementView } from './views/UsersManagementView';
import PaymentInput from './components/ui/PaymentInput';
import NumpadModal from './components/ui/NumpadModal';
import SimpleBarChart from './components/ui/SimpleBarChart';
import CustomerModal from './views/CustomerModal';
import { useCustomers } from './hooks/useCustomers';
import { useInventory } from './hooks/useInventory';
import { useCashRegister } from './hooks/useCashRegister';
import { usePOS } from './hooks/usePOS';
import { CashAdvanceModal } from './views/CashAdvanceModal';
import { ProductFormModal } from './views/ProductFormModal';
import { SaleDetailModal } from './views/SaleDetailModal';
import { MovementModal } from './views/MovementModal';
import { DailySalesModal } from './views/DailySalesModal';
import { KardexModal } from './views/KardexModal';
import { StockAlertModal } from './views/StockAlertModal';
import { ReceiptPreviewModal } from './views/ReceiptPreviewModal';
import { MobileCartModal } from './views/MobileCartModal';
import { useCredits } from './hooks/useCredits';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { usePurchases } from './hooks/usePurchases';
// 🚨 [NUEVAS IMPORTACIONES] MÓDULO DE DELIVERY
import { useDelivery } from './hooks/useDelivery';
import { DeliveryView } from './views/DeliveryView';

import { SequenceManagerModal } from './views/SequenceManagerModal';
import { LoginScreen } from './views/LoginScreen';
import { SaasMasterView } from './views/SaasMasterView';

import { tenantConfig } from './config/tenantConfig';
import {
    ProductService,
    SaleService,
    ProviderService,
    PurchaseService,
    SettingsService,
    CashService,
    CustomerService,
    CreditService,
    ReportService,
    AnalyticsService,
    InventoryService,
    HeldOrderService
} from './api/services';

import * as DocGen from './utils/documentGenerators';
import Swal from 'sweetalert2';

import { API_URL, IVA_RATE, EMOJI_OPTIONS, PAYMENT_METHODS, METHODS_REQUIRING_REFERENCE } from './constants/appConstants';
import { formatBs, formatUSD, capitalizeWords, validateIdNumber, validatePhone, debounce } from './utils/formatters';

function MainApp({ user, handleLogout }) {
    // 🎨 [NUEVO] MAPEO DINÁMICO DE MARCA BLANCA CERTIFICADO
    // Mezclamos la configuración base con los datos reales de la empresa del usuario
    const tenantBrand = useMemo(() => {
        const customConfig = user?.identity?.configFiscal || {};
        return {
            ...tenantConfig,
            companyName: user?.identity?.companyName || tenantConfig.companyName,
            tradeName: user?.identity?.tradeName || tenantConfig.tradeName,
            companyDocument: user?.identity?.companyDocument || tenantConfig.companyDocument,
            companyPhone: user?.identity?.companyPhone || tenantConfig.companyPhone,
            companyAddress: user?.identity?.companyAddress || tenantConfig.companyAddress,
            // 🚨 Si el backend manda un logo válido, lo usamos. Si no, usamos el de BMS Digital por defecto.
            logoUrl: (user?.identity?.logoUrl && user.identity.logoUrl.trim() !== '') 
                ? user.identity.logoUrl 
                : tenantConfig.logoUrl,
            ...customConfig // Incorpora el modo de factura, impuestos, etc.
        };
    }, [user]);
    
    // --- ESTADOS PRINCIPALES ---
    const [view, setView] = useState('POS');
    const [filteredProducts, setFilteredProducts] = useState([]);
    
    // 🚨 [NUEVO] ESTADO PARA IDENTIFICAR LA CAJA Y USUARIO ACTUAL
    const [activeRegister, setActiveRegister] = useState(null);

    useEffect(() => {
        const storedReg = localStorage.getItem('bms_active_register');
        if (storedReg && storedReg !== 'undefined') {
            try {
                setActiveRegister(JSON.parse(storedReg));
            } catch (e) {
                console.error("Error leyendo caja", e);
            }
        }
    }, []);
    
    const [selectedCategory, setSelectedCategory] = useState('Todos');

    // --- LÓGICA PARA CARRUSEL DE CATEGORÍAS UX ---
    const categoryScrollRef = useRef(null);

    const scrollCategories = (direction) => {
        if (categoryScrollRef.current) {
            const scrollAmount = 300; 
            categoryScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };
    const [bcvRate, setBcvRate] = useState(0);
    const [fallbackRate, setFallbackRate] = useState(0); 
    const [loading, setLoading] = useState(true);
    
    // 🚨 [NUEVO] ESTADO PARA LOGS DE AUDITORÍA BCV
    const [connectivityLogs, setConnectivityLogs] = useState([]);

    const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false); 
    
    const [closingsHistory, setClosingsHistory] = useState([]);

    const [salesReportPage, setSalesReportPage] = useState(1);

    const [inventoryReportPage, setInventoryReportPage] = useState(1);
    const [selectedAuditProduct, setSelectedAuditProduct] = useState(null); 

    const [auditTab, setAuditTab] = useState('INFO'); 

    const [reportTab, setReportTab] = useState('DASHBOARD'); 
    const [detailedSales, setDetailedSales] = useState([]);
    const [detailedInventory, setDetailedInventory] = useState([]);

    const [stats, setStats] = useState({ total_usd: 0, total_ves: 0, total_transactions: 0 });
    
    const [recentSales, setRecentSales] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    
    const [productsPerPage, setProductsPerPage] = useState(12);

    const [showStockModal, setShowStockModal] = useState(false);
    
    const [showDailySalesModal, setShowDailySalesModal] = useState(false); 
    const [dailySalesList, setDailySalesList] = useState([]); 
    const [topDebtors, setTopDebtors] = useState([]); 

    const [analyticsData, setAnalyticsData] = useState(null);
    
    const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
    
    // 🚨 1. PUENTE ANTI-PANTALLA BLANCA (Resuelve la dependencia circular de React)
    const addToCartRef = useRef(null);

    // === CUSTOM HOOK: LÓGICA DE CAJA REGISTRADORA ===
    const {
        cashShift, setCashShift, isCashOpen, setIsCashOpen,
        isCashAdvanceOpen, setIsCashAdvanceOpen, advanceData, setAdvanceData,
        promptOpenCash, handleCashClose, validateAndAddAdvance
    } = useCashRegister({
        bcvRate, 
        addToCart: (item) => addToCartRef.current && addToCartRef.current(item), // 👈 Pasamos el puente en lugar de la variable directa
        onShiftClosed: () => {
            if (view === 'ADVANCED_REPORTS' && typeof fetchClosingsHistory === 'function') {
                fetchClosingsHistory();
            }
        },
        dailySalesList // 🚀 NUEVO: Le pasamos las ventas del día para que audite con exactitud
    });
    
    // === CUSTOM HOOK: LÓGICA DE PUNTO DE VENTA (POS) ===
    const {
        cart, setCart, addToCart, removeFromCart,
        isFiscalInvoice, setIsFiscalInvoice, receiptPreview, setReceiptPreview,
        isMobileCartOpen, setIsMobileCartOpen, isPaymentModalOpen, setIsPaymentModalOpen,
        showSaleDetailModal, setShowSaleDetailModal, selectedSaleDetail, setSelectedSaleDetail,
        isCustomerModalOpen, setIsCustomerModalOpen, paymentShares, setPaymentShares,
        isNumpadOpen, setIsNumpadOpen, currentMethod, setCurrentMethod,
        currentInputValue, setCurrentInputValue, paymentReferences, setPaymentReferences,
        currentReference, setCurrentReference, customerData, setCustomerData,
        dueDays, setDueDays, selectedCustomerId, setSelectedCustomerId,
        customerSearchResults, setCustomerSearchResults, isSearchingCustomer, setIsSearchingCustomer,
        posSearchQuery, setPosSearchQuery, currentPage, setCurrentPage,
        paymentMethods, methodsRequiringReference, subtotalTaxableUSD, subtotalExemptUSD,
        ivaUSD, finalTotalUSD, totalVES, remainingUSD, remainingVES, isInsufficient,
        
        igtfGeneratedUSD, targetTotalUSD,
        globalDiscount, handleApplyDiscount, discountUSD, 
        
        // 🚨 ESTADOS MÓDULO DE DELIVERY (Extraídos del hook)
        isDelivery, setIsDelivery, deliveryInfo, setDeliveryInfo,
        
        // ESTADOS DE ÓRDENES EN ESPERA
        heldOrders, fetchHeldOrders, handlePauseOrder, handleResumeOrder, handleDeleteHeldOrder,

        updatePaymentShare, handleOpenPayment, handlePayRemaining, handleExactPayment,
        handleClear, handleNameChange, handleIdChange, handleListSelect, handleChange, handleConfirm,
        handleCreditProcess, showSaleDetail, handlePrintTicket, handleVoidSale, processSale, isFormReadyToSubmit
    } = usePOS({
        bcvRate,
        cashShift: cashShift,
        // 🚨 AQUÍ INYECTAMOS LA IDENTIDAD DEL USUARIO AL GENERAR EL TICKET
        generateReceiptHTML: (saleId, customer, items, invoiceType = 'TICKET', saleStatus = 'PAGADO', createdAt = null, totalSaleUsd = 0, historicalRate = null, paymentMethod = 'NO ESPECIFICADO', igtfUsd = 0, discountUsd = 0) => {
            const finalDate = createdAt ? new Date(createdAt) : new Date();
            return DocGen.generateReceiptHTML(saleId, customer, items, invoiceType, saleStatus, finalDate, totalSaleUsd, historicalRate, paymentMethod, bcvRate, igtfUsd, discountUsd, null, user?.identity);
        },
        onRequireCashOpen: () => {
            if (!cashShift) {
                Swal.fire({
                    title: '<h3 class="text-2xl font-black text-slate-800 mt-2">Caja Cerrada</h3>',
                    html: `
                        <div class="flex flex-col items-center py-4 px-2">
                            <div class="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 border-4 border-amber-100 shadow-inner">
                                <span class="text-4xl animate-pulse">🔒</span>
                            </div>
                            <p class="text-slate-600 font-bold text-sm px-2 leading-relaxed mb-8">
                                No es posible procesar pagos sin abrir caja. Por favor, inicia la jornada para comenzar a vender.
                            </p>
                        </div>
                    `,
                    showConfirmButton: true,
                    confirmButtonText: 'Abrir Caja Ahora',
                    showCancelButton: true,
                    cancelButtonText: 'Cancelar',
                    buttonsStyling: false,
                    customClass: {
                        popup: 'rounded-[2.5rem] p-6 shadow-2xl border border-white/80 bg-white/90 backdrop-blur-xl',
                        confirmButton: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-8 rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-200 outline-none',
                        cancelButton: 'mt-4 text-slate-400 font-bold hover:text-slate-600 transition-all outline-none'
                    }
                }).then((res) => { if (res.isConfirmed) promptOpenCash(); });
                return false;
            }
            return true;
        },
        onGlobalUpdate: (action) => {
            fetchData();
            if (action === 'VOID') {
                if (reportTab === 'SALES' && typeof fetchSalesDetail === 'function') fetchSalesDetail();
                if (showDailySalesModal && typeof openDailySalesDetail === 'function') openDailySalesDetail();
                if (view === 'ADVANCED_REPORTS' && reportTab === 'DASHBOARD' && typeof fetchAdvancedReport === 'function') fetchAdvancedReport();
            }
        }
    });

    // 🚨 2. CONECTAMOS LA FUNCIÓN REAL AL PUENTE
    // Justo después de que el POS nos entrega "addToCart", se lo asignamos al puente para que la caja pueda usarlo
    addToCartRef.current = addToCart;
    
    // === CUSTOM HOOK: LÓGICA DE INVENTARIO Y PRODUCTOS ===
    const {
        products, setProducts, categories, setCategories,
        isKardexOpen, setIsKardexOpen, kardexHistory, setKardexHistory, kardexProduct, setKardexProduct,
        isMovementModalOpen, setIsMovementModalOpen, movementProduct, setMovementProduct, movementType, setMovementType, movementForm, setMovementForm,
        batches, setBatches, selectedBatch, setSelectedBatch,
        isProductFormOpen, setIsProductFormOpen, productForm, setProductForm,
        productSearchQuery, setProductSearchQuery, filteredInventory, setFilteredInventory, filterExpiration, setFilterExpiration, inventoryCurrentPage, setInventoryCurrentPage,
        isRawMaterial, setIsRawMaterial,
        fetchBatches,
        openMovementModal, handleMovementSubmit, viewKardexHistory, handleImageRead, handleProductFormChange, handleEmojiSelect, saveProduct
    } = useInventory(() => fetchData());
    
    const { 
        allCustomers,
        filteredCustomers, customerSearchQuery, setCustomerSearchQuery, 
        customerCurrentPage, setCustomerCurrentPage, 
        customerForm, setCustomerForm, 
        loadCustomers, editCustomer, addInitialBalance, saveCustomer, handleCustomerFormChange 
    } = useCustomers(() => fetchData(), view);


    // 🚨 === CUSTOM HOOK: LÓGICA DE DELIVERY MANAGER ===
    const { deliveries, drivers, fetchDeliveries, fetchDrivers, changeStatus } = useDelivery(() => fetchData());


    const [reportDateRange, setReportDateRange] = useState(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const toLocalISO = (date) => {
            const offset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() - offset).toISOString().split('T')[0];
        };

        return {
            start: toLocalISO(firstDay), 
            end: toLocalISO(now)         
        };
    });

    const [salesSearch, setSalesSearch] = useState('');       
    const [inventorySearch, setInventorySearch] = useState(''); 
    const [isSearchingSales, setIsSearchingSales] = useState(false); 
    
    // === ⚡ INYECCIÓN DE MARCA FIJA (UX/UI PROFESIONAL SAAS) ===
    useEffect(() => {
        // 🚨 Título y logo fijos de la plataforma matriz
        const baseTitle = 'BMS Digital • POS VENTA';
        const inactiveTitle = '🔒 Terminal Asegurado • BMS Digital';
        const fixedLogoUrl = 'https://i.postimg.cc/dtH6wGzv/Logo-01.png'; // Favicon oficial de BMS Digital

        // 1. Identidad Principal Estricta
        document.title = baseTitle;
        
        // 2. Inyección de Favicon Multi-plataforma (Estética Premium)
        const injectIcon = (rel, href, sizes = null) => {
            let link = document.querySelector(`link[rel="${rel}"]`);
            if (!link) {
                link = document.createElement('link');
                link.rel = rel;
                if (sizes) link.sizes = sizes;
                document.head.appendChild(link);
            }
            link.href = href;
        };

        // Favicon estándar y Apple Touch Icon para ecosistema Apple usando el logo fijo
        injectIcon('icon', fixedLogoUrl);
        injectIcon('apple-touch-icon', fixedLogoUrl, '180x180');

        // 3. Microinteracción de Recuperación (Visibility API)
        const handleVisibilityChange = () => {
            // Si el cajero cambia de pestaña, el título llama su atención sutilmente
            document.title = document.hidden ? inactiveTitle : baseTitle;
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Limpieza de memoria (Best Practice)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []); // 🚨 CLAVE: Arreglo vacío. Al ser fijo, solo se renderiza una vez al cargar el sistema.
    
    useEffect(() => {
        // 🚨 CAMBIO QUIRÚRGICO: Solo pedir datos si el usuario ya inició sesión
        if (user) {
            fetchData();
            if(typeof fetchHeldOrders === 'function') fetchHeldOrders(); 
            if(typeof fetchDrivers === 'function') fetchDrivers(); 
        }
    }, [user]);

    useEffect(() => {
        if (view === 'CUSTOMERS') {
            loadCustomers();
        }
    }, [view]);

    useEffect(() => {
        let results = products.filter(p => p.status === 'ACTIVE' && !p.is_raw_material);

        if (selectedCategory !== 'Todos') {
            results = results.filter(p => p.category === selectedCategory);
        }

        if (posSearchQuery) {
            const lowerQuery = posSearchQuery.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(lowerQuery) ||
                p.category.toLowerCase().includes(lowerQuery) ||
                (p.barcode && p.barcode.includes(lowerQuery)) 
            );
        }

        setFilteredProducts(results);
        setCurrentPage(1);
    }, [selectedCategory, products, posSearchQuery]);


    useEffect(() => {
        if (reportTab === 'SALES') {
            const delayTime = salesSearch ? 500 : 50;

            const timer = setTimeout(() => {
                fetchSalesDetail(salesSearch);
            }, delayTime);

            return () => clearTimeout(timer);
        }
    }, [salesSearch, reportTab]); 

    // === CUSTOM HOOK: LÓGICA DE COMPRAS ===
 const {
     searchTerm, setSearchTerm, debouncedSearchTerm,
     providers, setProviders, purchaseCart, setPurchaseCart,
     purchaseForm, setPurchaseForm, providerFilter, setProviderFilter,
     showProviderModal, setShowProviderModal, filteredPurchaseProducts,
     fetchProviders, handleSaveProvider, addToPurchaseCart, handleProcessPurchase
 } = usePurchases({ bcvRate, products, onGlobalUpdate: () => fetchData() });

    const fetchSalesDetail = async (termInput) => {
        const start = new Date(reportDateRange.start);
        const end = new Date(reportDateRange.end);

        if (end < start) {
            return Swal.fire({
                icon: 'error',
                title: 'Rango de Fechas Inválido',
                text: 'La fecha final no puede ser menor a la fecha de inicio.',
                confirmButtonColor: '#E11D2B'
            });
        }

        try {
            const term = (typeof termInput === 'string') ? termInput : salesSearch;

            if (!term) Swal.fire({ title: 'Cargando ventas...', didOpen: () => Swal.showLoading() }); 
            else setIsSearchingSales(true);

            const res = await ReportService.getSalesDetail({
                startDate: reportDateRange.start,
                endDate: reportDateRange.end,
                search: term
            });

            const normalizedData = res.data.map(item => ({
                ...item,
                id: item.id || item["Nro Factura"] || item.sale_id,
                full_name: item.client_name || item["Cliente"] || 'Cliente Casual', 
                total_ves: item.total_ves || item["Total Bs"],
                total_usd: item.total_usd || item["Total USD"],
                status: item.status || item["Estado"]
            }));

            setDetailedSales(normalizedData);
            setReportTab('SALES'); 
            setSalesReportPage(1);

            if (!term) Swal.close();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudieron cargar las ventas.', 'error');
        } finally {
            setIsSearchingSales(false);
        }
    };

    const fetchInventoryDetail = async () => {
        try {
            Swal.fire({ title: 'Analizando inventario...', didOpen: () => Swal.showLoading() });
            const res = await ReportService.getInventoryDetail();
            setDetailedInventory(res.data);
            setReportTab('INVENTORY');
            setInventoryReportPage(1); 
            Swal.close();
        } catch (error) {
            Swal.fire('Error', 'Revisa la conexión.', 'error');
        }
    };

    // 🛡️ ESCUDO 1: Flag para evitar llamadas simultáneas (Anti-Spam)
    const isFetchingRef = useRef(false);

    const fetchData = async () => {
        if (!user || isFetchingRef.current) return;
        
        isFetchingRef.current = true;
        
        try {
            const statusRes = await SettingsService.getExchangeRate();
            const currentBcvRate = statusRes.data.bcv_rate;

            setBcvRate(currentBcvRate);
            setFallbackRate(statusRes.data.fallback_rate);

            const [prodRes] = await Promise.all([
                ProductService.getAll()
            ]);

            const rawProducts = Array.isArray(prodRes.data) ? prodRes.data : [];
            const allProducts = rawProducts
                .map(p => ({ ...p, is_taxable: p.is_taxable === true || p.is_taxable === 't' || p.is_taxable === 1 }))
                .sort((a, b) => a.id - b.id);

            setProducts(allProducts);
            setFilteredProducts(allProducts);
            setFilteredInventory(allProducts);
            setCategories(['Todos', ...new Set(allProducts.map(p => p.category))]);

            const [statsRes, recentRes, stockRes, salesRes, analyticsRes] = await Promise.all([
                ReportService.getDaily(),
                ReportService.getRecentSales(),
                ReportService.getLowStock(),
                ReportService.getSalesToday(),
                AnalyticsService.getGeneral()
            ]);

            const rawStats = statsRes.data;
            setRecentSales(Array.isArray(recentRes.data) ? recentRes.data : []);
            setLowStock(Array.isArray(stockRes.data) ? stockRes.data : []);

            setTopDebtors(analyticsRes.data.topDebtors || []);
            setAnalyticsData(analyticsRes.data);

            const rawSales = Array.isArray(salesRes.data) ? salesRes.data : [];
            const sales = rawSales.map(sale => ({
                ...sale,
                total_usd: parseFloat(sale.total_usd) || 0,
                amount_paid_usd: parseFloat(sale.amount_paid_usd) || 0,
                bcv_rate_snapshot: parseFloat(sale.bcv_rate_snapshot) || 0,
                total_ves: parseFloat(sale.total_ves) || 0,
                payment_method: sale.payment_method || ''
            }));

            setDailySalesList(sales);

            let totalRef = 0;
            let totalBs = 0;
            let count = 0;

            sales.forEach(sale => {
                const isStatusDonation = sale.status === 'DONADO';
                const methodStr = (sale.payment_method || '').toUpperCase();
                const isDescDonation = methodStr.includes('DONACI') || methodStr.includes('DONACIÓN');

                if (sale.status !== 'ANULADO' && !isStatusDonation && !isDescDonation) {
                    let montoReal = sale.amount_paid_usd;

                    if (methodStr.includes('[CAP:')) {
                        try {
                            const match = sale.payment_method.match(/\[CAP:([\d\.]+)\]/);
                            if (match && match[1]) {
                                montoReal -= parseFloat(match[1]);
                            }
                        } catch (e) { console.error("Error CAP:", e); }
                    }

                    let tasaVenta = sale.bcv_rate_snapshot;
                    if (!tasaVenta || tasaVenta === 0) {
                        if (sale.total_usd > 0 && sale.total_ves > 0) {
                            tasaVenta = sale.total_ves / sale.total_usd;
                        } else {
                            tasaVenta = currentBcvRate;
                        }
                    }

                    totalRef += montoReal;
                    totalBs += (montoReal * tasaVenta);
                    count++;
                }
            });

            setStats({
                ...rawStats,
                total_usd: totalRef,
                total_ves: totalBs,
                total_transactions: count
            });

            const creditsRes = await CreditService.getPending();
            const creditsData = Array.isArray(creditsRes.data) ? creditsRes.data : [];
            setPendingCredits(creditsData);
            setOverdueCount(creditsData.filter(c => c.is_overdue).length);

            const groupedRes = await CreditService.getGrouped();
            setGroupedCredits(Array.isArray(groupedRes.data) ? groupedRes.data : []);

            // 🛡️ ESCUDO 2: Aislamos la consulta de la caja para que un error 403 no tumbe la App
            try {
                 const cashRes = await CashService.getStatus();
                 if (cashRes.data && cashRes.data.status === 'ABIERTA') {
                     setIsCashOpen(true);
                     setCashShift(cashRes.data.shift_info);
                 } else {
                     setIsCashOpen(false);
                     setCashShift(null);
                 }
            } catch (cashError) {
                // Manejo silencioso: Si tira 403 (Caja ocupada), la App sigue funcionando normal
                setIsCashOpen(false);
                setCashShift(null);
            }

            setLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            if (!dailySalesList) setDailySalesList([]);
            setLoading(false);
        } finally {
            // Liberamos la bandera para permitir futuras recargas
            isFetchingRef.current = false;
        }
    };

    // === CUSTOM HOOK: ESCÁNER GLOBAL DE CÓDIGOS DE BARRA ===
        useBarcodeScanner({ products, addToCart });

    // === CUSTOM HOOK: LÓGICA DE CRÉDITOS Y COBRANZAS ===
 const {
     pendingCredits, setPendingCredits,
     groupedCredits, setGroupedCredits,
     selectedCreditCustomer, setSelectedCreditCustomer,
     customerCreditsDetails, setCustomerCreditsDetails,
     overdueCount, setOverdueCount,
     creditSearchQuery, setCreditSearchQuery,
     filteredCredits, setFilteredCredits,
     creditCurrentPage, setCreditCurrentPage,
     detailsCurrentPage, setDetailsCurrentPage,
     openCustomerCredits, handlePaymentProcess, handlePayAll, markAsPaid
 } = useCredits({ bcvRate, onGlobalUpdate: () => fetchData() });

    // =========================================================================
    // LÓGICA DEL MODAL DE CLIENTES (INTEGRADA EN APP PARA CORREGIR FOCO)
    // =========================================================================

    const isCreditUsed = (parseFloat(paymentShares['Crédito']) || 0) > 0;
    const isDonationUsed = (parseFloat(paymentShares['Donación']) || 0) > 0; 

    const openDailySalesDetail = async () => {
        try {
            Swal.fire({ title: 'Cargando...', didOpen: () => Swal.showLoading() });

            const res = await ReportService.getSalesToday();

            const safeData = (Array.isArray(res.data) ? res.data : []).map(sale => ({
                ...sale,
                payment_method: sale.payment_method || 'Desconocido',
                total_usd: parseFloat(sale.total_usd) || 0,
                amount_paid_usd: parseFloat(sale.amount_paid_usd) || 0,
                bcv_rate_snapshot: parseFloat(sale.bcv_rate_snapshot) || 0,
                full_name: sale.full_name || 'Consumidor Final'
            }));

            setDailySalesList(safeData);
            setShowDailySalesModal(true);

            Swal.close();
        } catch (error) {
            console.error("Error cargando ventas diarias:", error);
            Swal.close();
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cargar el reporte de hoy. Intente de nuevo.',
                confirmButtonColor: '#10b981'
            });
        }
    };

    // 🚨 [ADAPTACIÓN] FETCH DE REPORTES AVANZADOS
    const fetchAdvancedReport = async () => {
        try {
            Swal.fire({ title: 'Generando Estadísticas...', didOpen: () => Swal.showLoading() });
            
            // Ejecutamos en paralelo para optimizar velocidad
            const [analyticsRes, logsRes] = await Promise.all([
                ReportService.getAnalytics({
                    startDate: reportDateRange.start,
                    endDate: reportDateRange.end
                }),
                ReportService.getConnectivityLogs() // 🚨 Carga de logs de auditoría
            ]);

            setAnalyticsData(analyticsRes.data);
            setConnectivityLogs(logsRes.data || []); // 🚨 Seteo de logs para la vista
            
            Swal.close();
        } catch (error) {
            console.error("Error en Reporte Avanzado:", error);
            Swal.fire('Error', 'No se pudo generar el reporte completo', 'error');
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-higea-blue border-t-transparent rounded-full animate-spin"></div></div>;

    const isFallbackActive = bcvRate === fallbackRate; 

    const indexOfLastProduct = currentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

    const paginate = (pageNumber) => {
        if (pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const inventoryFilteredData = detailedInventory.filter(p => {
        if (!inventorySearch) return true; 
        const term = inventorySearch.toLowerCase();
        return (
            p.name.toLowerCase().includes(term) ||
            (p.category && p.category.toLowerCase().includes(term)) ||
            (p.barcode && p.barcode.includes(term))
        );
    });

    const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

    const fetchClosingsHistory = async () => {
        try {
            Swal.fire({ title: 'Cargando cierres...', didOpen: () => Swal.showLoading() });
            const res = await ReportService.getClosings();
            setClosingsHistory(res.data);
            setReportTab('CLOSINGS');
            Swal.close();
        } catch (error) {
            Swal.fire('Error', 'No se pudo cargar el historial', 'error');
        }
    };

    // =========================================================================
    // 👇(PUENTE HACIA LOS GENERADORES PDF) 👇
    // =========================================================================
    const printKardexReport = () => DocGen.printKardexReport(kardexProduct, kardexHistory, bcvRate);
    const printInventoryAuditPDF = () => DocGen.printInventoryAuditPDF(products, bcvRate);
    const printPhysicalCountReport = () => DocGen.printPhysicalCountReport(inventoryFilteredData, products);
    const printLegalDebtReport = () => DocGen.printLegalDebtReport(ReportService, bcvRate);
    
    const printSalesBookPDF = () => DocGen.printSalesBookPDF(reportDateRange, ReportService);
    
    const downloadCSV = (data, fileName) => DocGen.downloadCSV(data, fileName, bcvRate);
    
    // 🚨 FUNCIÓN EXPORTADA PARA REIMPRESIÓN (CON DESCUENTO)
    const generateReceiptHTML = (saleId, customer, items, invoiceType = 'TICKET', saleStatus = 'PAGADO', createdAt = null, totalSaleUsd = 0, historicalRate = null, paymentMethod = 'NO ESPECIFICADO', igtfUsd = 0, discountUsd = 0) => {
        const finalDate = createdAt ? new Date(createdAt) : new Date();
        return DocGen.generateReceiptHTML(saleId, customer, items, invoiceType, saleStatus, finalDate, totalSaleUsd, historicalRate, paymentMethod, bcvRate, igtfUsd, discountUsd);
    };
    const printClosingReport = (shift) => DocGen.printClosingReport(shift);
    const exportReportToPDF = () => DocGen.exportReportToPDF(analyticsData, reportDateRange);
    // =========================================================================

    // === INYECTAR LÓGICA DE MÁQUINA FISCAL (SENIAT) ===
    const handlePrintReportX = async () => {
        try {
            Swal.fire({ 
                title: 'Procesando Reporte X...', 
                text: 'Enviando comando a la impresora fiscal.', 
                didOpen: () => Swal.showLoading() 
            });
            
            const res = await fetch(`${tenantConfig.fiscalPrinterIP}/imprimirReporteX`, { 
                method: 'POST' 
            });
            
            if (!res.ok) throw new Error("Error de comunicación con el spooler fiscal.");
            
            Swal.fire('Reporte X Emitido', 'Revisa la bandeja de la impresora.', 'success');
        } catch (error) {
            Swal.fire('Error Fiscal', 'No se pudo emitir el Reporte X. Verifique conexión y papel.', 'error');
        }
    };

    const handlePrintReportZ = async () => {
        const confirm = await Swal.fire({
            title: '¿Emitir Reporte Z?',
            text: 'ATENCIÓN: Esto cerrará el día fiscal en la impresora. Es una acción irreversible impuesta por el SENIAT.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#DC2626',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Sí, Emitir Cierre Z',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            try {
                Swal.fire({ 
                    title: 'Procesando Reporte Z...', 
                    text: 'Grabando en memoria fiscal. NO APAGUE LA IMPRESORA.', 
                    didOpen: () => Swal.showLoading() 
                });
                
                const res = await fetch(`${tenantConfig.fiscalPrinterIP}/imprimirReporteZ`, { 
                    method: 'POST' 
                });
                
                if (!res.ok) throw new Error("Error de comunicación con el spooler fiscal.");
                
                Swal.fire('Cierre Fiscal Exitoso', 'El Reporte Z ha sido emitido correctamente.', 'success');
            } catch (error) {
                Swal.fire('Error Fiscal Crítico', 'No se pudo emitir el Reporte Z. Verifique la máquina.', 'error');
            }
        }
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden text-gray-800">

            {/* SIDEBAR PC (Iconos Profesionales Actualizados, Blindados y con UX de Scroll) */}
            <nav className="hidden md:flex w-20 bg-white border-r border-gray-200 flex-col items-center py-4 z-50 shadow-lg h-full">
                
{/* 🏢 LOGO OFICIAL Y FIJO DE LA PLATAFORMA SAAS (BMS DIGITAL) */}
<div className="flex items-center justify-center shrink-0 mb-2 p-1">
    <img 
        src={tenantConfig.logoUrl} 
        alt="BMS Digital" 
        className="h-10 w-10 object-contain rounded-xl shadow-sm bg-white p-0.5 border border-slate-100" 
        title="BMS Digital • Plataforma SaaS"
    />
</div>

                {/* 📜 ÁREA DE BOTONES ORGANIZADA POR NIVELES OPERATIVOS */}
                <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center gap-2 py-2">
                    
                    {/* SECCIÓN 1: OPERACIÓN DIARIA */}
                    <Button variant="ghost" onClick={() => setView('POS')} title="Punto de Venta" className={`!p-3 !rounded-xl ${view === 'POS' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </Button>

                    <Button variant="ghost" onClick={() => { setView('DELIVERY'); fetchDeliveries(); }} title="Gestión de Delivery" className={`!p-3 !rounded-xl ${view === 'DELIVERY' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12.5M8 7v8M8 7L4 9.5V15h4m12.5-8v8M12 15h4.5M6 15a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                    </Button>

                    {/* SEPARADOR VISUAL 1 */}
                    <div className="w-8 h-px bg-slate-200 my-1"></div>

                    {/* SECCIÓN 2: GESTIÓN DE NEGOCIO */}
                    {(user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR') && (
                        <Button variant="ghost" onClick={() => { setView('PRODUCTS'); }} title="Inventario de Productos" className={`!p-3 !rounded-xl ${view === 'PRODUCTS' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </Button>
                    )}

                    <Button variant="ghost" onClick={() => { setView('CUSTOMERS'); }} title="Directorio General (Clientes / Proveedores)" className={`!p-3 !rounded-xl ${view === 'CUSTOMERS' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </Button>

                    {(user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR') && (
                        <Button variant="ghost" onClick={() => { fetchData(); setView('CREDIT_REPORT'); }} title="Cuentas por Cobrar" className={`!p-3 !rounded-xl relative ${view === 'CREDIT_REPORT' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </Button>
                    )}

                    {(user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR') && (
                        <Button variant="ghost" onClick={() => { setView('purchases'); fetchProviders(); }} title="Gastos y Compras" className={`!p-3 !rounded-xl ${view === 'purchases' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </Button>
                    )}

                    {/* SEPARADOR VISUAL 2 */}
                    <div className="w-8 h-px bg-slate-200 my-1"></div>

                    {/* SECCIÓN 3: GERENCIA Y CONTROL FISCAL */}
                    {(user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR') && (
                        <Button variant="ghost" onClick={() => { fetchData(); setView('DASHBOARD'); }} title="Panel Principal" className={`!p-3 !rounded-xl relative ${view === 'DASHBOARD' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                            </svg>
                            {overdueCount > 0 && <span className="absolute top-1 right-1 h-3 w-3 bg-rose-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">{overdueCount}</span>}
                        </Button>
                    )}

                    {(user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR') && (
                        <Button variant="ghost" onClick={() => { setView('ADVANCED_REPORTS'); fetchAdvancedReport(); }} title="Reportes Gerenciales" className={`!p-3 !rounded-xl ${view === 'ADVANCED_REPORTS' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </Button>
                    )}

                    {(user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR') && (
                        <Button variant="ghost" onClick={() => setIsCashAdvanceOpen(true)} title="Avance de Efectivo" className="!p-3 !rounded-xl !text-emerald-600 !bg-emerald-50 hover:!bg-emerald-100">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </Button>
                    )}

                    {user?.role === 'ADMINISTRADOR' && (
                        <Button variant="ghost" onClick={() => setIsSequenceModalOpen(true)} title="Configurar Correlativos Forma Libre" className="!p-3 !rounded-xl !text-slate-500 bg-slate-50 hover:!bg-slate-200">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </Button>
                    )}

                    {user?.role === 'ADMINISTRADOR' && (
                        <Button variant="ghost" onClick={() => setView('USERS')} title="Seguridad y Usuarios" className={`!p-3 !rounded-xl ${view === 'USERS' ? '!bg-blue-50 !text-blue-600' : '!text-slate-400 hover:!bg-slate-100'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </Button>
                    )}
                </div>
                
                {/* 🌟 [UX PRO] USER HUB: PERFIL, CAJA Y CERRAR SESIÓN INTEGRADO */}
                <div className="mt-auto w-full flex flex-col items-center shrink-0 bg-white pb-6 pt-4 border-t border-slate-100 relative">
                    
                    <div className="group relative flex flex-col items-center w-full cursor-pointer">
                        
                        {/* Menú Flotante (Pop-out hacia la derecha) */}
                        <div className="absolute left-[4.5rem] bottom-0 bg-slate-800 text-white rounded-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-2xl w-56 z-50 transform origin-bottom-left scale-95 group-hover:scale-100 border border-slate-700">
                            
                            <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                                <div className="h-12 w-12 bg-slate-700 rounded-full flex items-center justify-center text-white font-black text-xl shadow-inner shrink-0">
                                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : 'U')}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="font-bold text-sm truncate w-full">{user?.full_name || user?.username || 'Cajero'}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
                                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest truncate">
                                            {activeRegister?.name || 'Caja Administrativa'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* 🛡️ MODO DIOS: Acceso Secreto (Solo Usuario ID 1 de la Empresa ID 1) */}
{user?.empresa_id === 1 && user?.id === 1 && (
    <button 
        onClick={() => {
            Swal.fire({
                title: '<h2 class="text-2xl font-black text-slate-800">Autenticación Maestra</h2>',
                html: '<p class="text-sm text-slate-500 font-bold uppercase tracking-widest mb-4">Terminal de Control BMS Digital</p>',
                input: 'password',
                inputPlaceholder: 'Ingrese PIN de Seguridad',
                inputAttributes: { 
                    autocapitalize: 'off', 
                    maxlength: 6,
                    style: 'text-align: center; font-size: 1.5rem; font-weight: 900; letter-spacing: 0.5em;' 
                },
                showCancelButton: true,
                confirmButtonText: 'Desbloquear',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4f46e5',
                cancelButtonColor: '#cbd5e1',
                customClass: { 
                    popup: 'rounded-[2rem] p-6 shadow-2xl',
                    confirmButton: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition-all shadow-md',
                    cancelButton: 'w-full text-slate-500 font-bold mt-2 hover:bg-slate-50',
                    actions: 'flex flex-col w-full px-4'
                }
            }).then((result) => {
                // PIN de alta seguridad (Puedes cambiar este '2026' por tu PIN real)
                if (result.value === '2026') { 
                    setView('SAAS_MASTER');
                } else if (result.value) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Acceso Denegado',
                        text: 'El PIN maestro es incorrecto.',
                        confirmButtonColor: '#e11d48',
                        customClass: { popup: 'rounded-[2rem]' }
                    });
                }
            });
        }} 
        className="w-full flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white py-3 rounded-xl transition-all duration-300 text-xs font-black uppercase tracking-widest mb-3 border border-indigo-500/20 shadow-inner group outline-none"
    >
        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
        Panel Master
    </button>
)}
                            
                            <button 
                                onClick={handleLogout} 
                                className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white py-2.5 rounded-xl transition-all duration-300 text-xs font-bold"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                Cerrar Sesión
                            </button>
                        </div>

                        {/* Avatar en la barra lateral */}
                        <div className="relative">
                            <div className="h-12 w-12 bg-slate-50 border-2 border-slate-200 rounded-full flex items-center justify-center text-slate-600 font-black text-xl shadow-sm group-hover:border-higea-blue group-hover:text-higea-blue group-hover:bg-blue-50 transition-all duration-300">
                                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : 'U')}
                            </div>
                            {/* Punto verde de conexión (Online Status) */}
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                        </div>
                        
                        {/* Nombre corto de la caja */}
                        <span className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[60px] group-hover:text-higea-blue transition-colors">
                            {activeRegister?.name ? activeRegister.name.split(' ')[0] : 'ADMIN'}
                        </span>
                    </div>

                </div>

            </nav>

            {/* CONTENIDO (Estructura de renderizado blindada) */}
            <div className="flex-1 relative overflow-hidden flex flex-col pb-[4.5rem] md:pb-0">
                
                {/* 📱 [UX PRO NIVEL 4] HEADER NATIVO CORPORATIVO (Solo Móvil) */}
                <div className="md:hidden w-full bg-gradient-to-r from-blue-700 to-slate-900 px-4 py-2 flex items-center justify-between z-30 shrink-0 shadow-md border-b border-blue-900/50">
                    <div className="flex items-center gap-3">
                        {/* Avatar con Glassmorphism */}
                        <div className="relative">
                            <div className="h-8 w-8 bg-white/10 border border-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-inner">
                                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : 'U')}
                            </div>
                            {/* Punto verde de conexión contrastado */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]"></div>
                        </div>
                        
                        {/* Textos con alta legibilidad */}
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-white leading-tight tracking-wide drop-shadow-sm">
                                {user?.full_name?.split(' ')[0] || user?.username || 'Cajero'}
                            </span>
                            <span className="text-[9px] font-semibold text-blue-200 uppercase tracking-widest mt-0.5">
                                {activeRegister?.name?.split(' ')[0] || 'ADMIN'}
                            </span>
                        </div>
                    </div>
                    
                    {/* Botón Salir (Estilo Destructivo Sutil) */}
                    <button onClick={handleLogout} className="p-2 bg-white/5 hover:bg-rose-500/90 border border-white/10 rounded-xl transition-all flex items-center shadow-sm active:scale-95 outline-none">
                         <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>

                    {view === 'POS' ? (
                    <PosView
                        tenantBrand={tenantBrand}
                        isFallbackActive={isFallbackActive}
                        bcvRate={bcvRate}
                        products={products}
                        posSearchQuery={posSearchQuery}
                        setPosSearchQuery={setPosSearchQuery}
                        
                        productsPerPage={productsPerPage}
                        setProductsPerPage={setProductsPerPage}
                        
                        scrollCategories={scrollCategories}
                        categoryScrollRef={categoryScrollRef}
                        categories={categories}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        currentProducts={currentProducts}
                        addToCart={addToCart}
                        totalPages={totalPages}
                        currentPage={currentPage}
                        paginate={paginate}
                        cashShift={cashShift}
                        promptOpenCash={promptOpenCash}
                        cart={cart}
                        removeFromCart={removeFromCart}
                        subtotalExemptUSD={subtotalExemptUSD}
                        subtotalTaxableUSD={subtotalTaxableUSD}
                        IVA_RATE={IVA_RATE}
                        ivaUSD={ivaUSD}
                        totalVES={totalVES}
                        finalTotalUSD={finalTotalUSD}
                        handleOpenPayment={handleOpenPayment}
                        setCart={setCart}
                        
                        globalDiscount={globalDiscount}
                        handleApplyDiscount={handleApplyDiscount}
                        discountUSD={discountUSD}
                        
                        // 🚨 PASAMOS LAS PROPS DE ÓRDENES EN ESPERA
                        heldOrders={heldOrders}
                        handlePauseOrder={handlePauseOrder}
                        handleResumeOrder={handleResumeOrder}
                        handleDeleteHeldOrder={handleDeleteHeldOrder}

                        // 🚨 PASAMOS LAS PROPS DE DELIVERY
                        isDelivery={isDelivery}
                        setIsDelivery={setIsDelivery}
                        deliveryInfo={deliveryInfo}
                        setDeliveryInfo={setDeliveryInfo}
						
						dailySalesUSD={stats.total_usd}      // Cambiado de salesUSD a stats.total_usd
						dailySalesVES={stats.total_ves}      // Cambiado de salesVES a stats.total_ves
						handleOpenDailySales={openDailySalesDetail} // Usamos la función que ya tienes definida
						lowStockCount={lowStock.length} 
						handleOpenStockAlerts={() => setShowStockModal(true)}
                    />
                ) : view === 'DASHBOARD' ? (
                <DashboardView
                    stats={stats}
                    lowStock={lowStock}
                    topDebtors={topDebtors}
                    recentSales={recentSales}
                    openDailySalesDetail={openDailySalesDetail}
                    showSaleDetail={showSaleDetail}
                    setShowStockModal={setShowStockModal}
                    setView={setView}
                />
            ) : view === 'CREDIT_REPORT' ? (
                    /* COMPONENTE EXTRAÍDO (VISTA DE CRÉDITOS / CUENTAS POR COBRAR) */
                    <CreditsView 
                        selectedCreditCustomer={selectedCreditCustomer}
                        setSelectedCreditCustomer={setSelectedCreditCustomer}
                        creditSearchQuery={creditSearchQuery}
                        setCreditSearchQuery={setCreditSearchQuery}
                        filteredCredits={filteredCredits}
                        creditCurrentPage={creditCurrentPage}
                        setCreditCurrentPage={setCreditCurrentPage}
                        customerCreditsDetails={customerCreditsDetails}
                        detailsCurrentPage={detailsCurrentPage}
                        setDetailsCurrentPage={setDetailsCurrentPage}
                        showSaleDetail={showSaleDetail}
                        openCustomerCredits={openCustomerCredits}
                        handlePayAll={handlePayAll}
                        handlePaymentProcess={handlePaymentProcess}
                        printLegalDebtReport={printLegalDebtReport}
                    />
                ) : view === 'CUSTOMERS' ? (
                    /* COMPONENTE EXTRAÍDO (VISTA DE CLIENTES) */
                    <CustomersView 
                        customerSearchQuery={customerSearchQuery}
                        setCustomerSearchQuery={setCustomerSearchQuery}
                        customerForm={customerForm}
                        setCustomerForm={setCustomerForm}
                        isCustomerFormOpen={isCustomerFormOpen}
                        setIsCustomerFormOpen={setIsCustomerFormOpen}
                        filteredCustomers={filteredCustomers}
                        customerCurrentPage={customerCurrentPage}
                        setCustomerCurrentPage={setCustomerCurrentPage}
                        editCustomer={editCustomer}
                        addInitialBalance={addInitialBalance}
                        saveCustomer={saveCustomer}
                        handleCustomerFormChange={handleCustomerFormChange}
                    />
                ) : view === 'PRODUCTS' ? (
                    /* MÓDULO DE PRODUCTOS (UX PRO + KARDEX EN LISTA) */
                    <div className="p-4 md:p-8 overflow-y-auto h-full relative bg-slate-50">

                        {/* COMPONENTE EXTRAÍDO (VISTA DE INVENTARIO) */}
                        <InventoryView 
                            productSearchQuery={productSearchQuery}
                            setProductSearchQuery={setProductSearchQuery}
                            filterExpiration={filterExpiration}
                            setFilterExpiration={setFilterExpiration}
                            setProductForm={setProductForm}
                            setIsProductFormOpen={setIsProductFormOpen}
                            filteredInventory={filteredInventory}
                            inventoryCurrentPage={inventoryCurrentPage}
                            setInventoryCurrentPage={setInventoryCurrentPage}
                            openMovementModal={openMovementModal}
                            viewKardexHistory={viewKardexHistory}
                        />

                        {/* --- MODAL GESTIÓN DE STOCK --- */}
                     <MovementModal
                         isMovementModalOpen={isMovementModalOpen}
                         setIsMovementModalOpen={setIsMovementModalOpen}
                         movementProduct={movementProduct}
                         movementType={movementType}
                         movementForm={movementForm}
                         setMovementForm={setMovementForm}
                         handleMovementSubmit={handleMovementSubmit}
                         fetchBatches={fetchBatches}
                         batches={batches}
                         selectedBatch={selectedBatch}
                         setSelectedBatch={setSelectedBatch}
                     />

                        {/* --- MODAL FORMULARIO DE PRODUCTO --- */}
                     <ProductFormModal 
                         isProductFormOpen={isProductFormOpen}
                         setIsProductFormOpen={setIsProductFormOpen}
                         productForm={productForm}
                         setProductForm={setProductForm}
                         saveProduct={saveProduct}
                         handleImageRead={handleImageRead}
                         handleProductFormChange={handleProductFormChange}
                         uniqueCategories={uniqueCategories}
                         bcvRate={bcvRate}
                     />
                    
                    </div>
                    ) : view === 'purchases' ? (
                <PurchasesView
                    purchaseForm={purchaseForm}
                    setPurchaseForm={setPurchaseForm}
                    providerFilter={providerFilter}
                    setProviderFilter={setProviderFilter}
                    purchaseCart={purchaseCart}
                    setPurchaseCart={setPurchaseCart}
                    providers={providers}
                    showProviderModal={showProviderModal}
                    setShowProviderModal={setShowProviderModal}
                    setSearchTerm={setSearchTerm}
                    debouncedSearchTerm={debouncedSearchTerm}
                    filteredPurchaseProducts={filteredPurchaseProducts}
                    addToPurchaseCart={addToPurchaseCart}
                    handleProcessPurchase={handleProcessPurchase}
                    handleSaveProvider={handleSaveProvider}
                    bcvRate={bcvRate}
                    formatUSD={formatUSD}
                    formatBs={formatBs}
                    Button={Button}
                    Input={Input}
                    ProductAvatar={ProductAvatar}
                    ProviderModal={ProviderModal}
                />
            ) : view === 'DELIVERY' ? (
                /* 🚨 INYECCIÓN RENDERIZADO DEL KANBAN DELIVERY */
                <DeliveryView
                    deliveries={deliveries}
                    fetchDeliveries={fetchDeliveries}
                    changeStatus={changeStatus}
                />
            ) : view === 'ADVANCED_REPORTS' ? (
                <AdvancedReportsView
                    reportTab={reportTab}
                    setReportTab={setReportTab}
                    reportDateRange={reportDateRange}
                    setReportDateRange={setReportDateRange}
                    analyticsData={analyticsData}
                    detailedSales={detailedSales}
                    salesSearch={salesSearch}
                    setSalesSearch={setSalesSearch}
                    isSearchingSales={isSearchingSales}
                    salesReportPage={salesReportPage}
                    setSalesReportPage={setSalesReportPage}
                    inventoryFilteredData={inventoryFilteredData}
                    inventorySearch={inventorySearch}
                    setInventorySearch={setInventorySearch}
                    detailedInventory={detailedInventory}
                    topDebtors={topDebtors}
                    closingsHistory={closingsHistory}
                    connectivityLogs={connectivityLogs} 
                    selectedAuditProduct={selectedAuditProduct}
                    setSelectedAuditProduct={setSelectedAuditProduct}
                    auditTab={auditTab}
                    setAuditTab={setAuditTab}
                    kardexHistory={kardexHistory}
                    setKardexHistory={setKardexHistory}
                    products={products}
                    fetchAdvancedReport={fetchAdvancedReport}
                    exportReportToPDF={exportReportToPDF}
                    fetchSalesDetail={fetchSalesDetail}
                    fetchInventoryDetail={fetchInventoryDetail}
                    fetchClosingsHistory={fetchClosingsHistory}
                    showSaleDetail={showSaleDetail}
                    downloadCSV={downloadCSV}
                    printSalesBookPDF={printSalesBookPDF}
                    printLegalDebtReport={printLegalDebtReport}
                    printInventoryAuditPDF={printInventoryAuditPDF}
                    printPhysicalCountReport={printPhysicalCountReport}
                    viewKardexHistory={viewKardexHistory}
                    printClosingReport={printClosingReport}
                    printReportX={handlePrintReportX}
                    printReportZ={handlePrintReportZ}
                    InventoryService={InventoryService}
                    bcvRate={bcvRate}
                    formatBs={formatBs}
                    formatUSD={formatUSD}
                    Button={Button}
                    Input={Input}
                    SimpleBarChart={SimpleBarChart}
                />
                ) : view === 'SAAS_MASTER' && user?.empresa_id === 1 ? (
                    <SaasMasterView />
    
           ) : view === 'USERS' && user?.role === 'ADMINISTRADOR' ? (
                <UsersManagementView />
            ) : (
                <div className="h-full p-8 text-center text-red-500">Vista no encontrada.</div>
            )}

            {/* 🛡️ FOOTER LEGAL GLOBAL (Visible en todo el sistema) */}
            <div className="w-full shrink-0 bg-white py-3 border-t border-slate-200 z-[60] flex justify-center items-center mt-auto hidden md:flex shadow-[0_-4px_15px_rgba(0,0,0,0.02)] relative">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    <span>BMS Digital © 2026</span>
                    <span className="hidden sm:inline text-slate-300">|</span>
                    <span>Plataforma Cifrada de Alta Seguridad</span>
                </div>
            </div>

            </div> {/* Cierre del flex-1 relative overflow-hidden flex flex-col */}

            {/* Navegación Móvil (Limpia, Ergonómica y Centralizada) */}
            <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-end py-2 z-50 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] pb-safe">
                
                {/* VENTAS */}
                <button onClick={() => setView('POS')} className={`flex flex-col items-center pt-1 ${view === 'POS' ? 'text-higea-blue' : 'text-slate-400'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    <span className="text-[9px] font-bold mt-0.5">Venta</span>
                </button>

                {/* CARRITO (Botón Flotante Liberado) */}
                <div className="relative -top-5">
                    <button onClick={() => setIsMobileCartOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-14 w-14 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 border-[4px] border-white active:scale-95 transition-all duration-300 outline-none">
                        <span className="font-black text-lg drop-shadow-sm">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                    </button>
                </div>

                {/* REPORTES MÓVIL */}
                {(user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR') && (
                    <button onClick={() => { fetchData(); setView('DASHBOARD'); }} className={`flex flex-col items-center pt-1 ${view === 'DASHBOARD' ? 'text-higea-blue' : 'text-slate-400'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <span className="text-[9px] font-bold mt-0.5">Reportes</span>
                    </button>
                )}

                {/* DELIVERY */}
                <button onClick={() => { setView('DELIVERY'); fetchDeliveries(); }} className={`flex flex-col items-center pt-1 ${view === 'DELIVERY' ? 'text-higea-blue' : 'text-slate-400'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12.5M8 7v8M8 7L4 9.5V15h4m12.5-8v8M12 15h4.5M6 15a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    <span className="text-[9px] font-bold mt-0.5">Delivery</span>
                </button>

                {/* CLIENTES */}
                <button onClick={() => { setView('CUSTOMERS'); }} className={`flex flex-col items-center pt-1 ${view === 'CUSTOMERS' ? 'text-higea-blue' : 'text-slate-400'}`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span className="text-[9px] font-bold mt-0.5">Clientes</span>
                </button>
            </div>


            {/* MODALES */}
            {/* 1. INYECCIÓN DE PAYMENT INPUT Y CHECKOUT */}
            <CheckoutModal
                isPaymentModalOpen={isPaymentModalOpen}
                setIsPaymentModalOpen={setIsPaymentModalOpen}
                IVA_RATE={IVA_RATE}
                finalTotalUSD={finalTotalUSD}
                totalVES={totalVES}
                isNumpadOpen={isNumpadOpen}
                remainingUSD={remainingUSD}
                remainingVES={remainingVES}
                handleExactPayment={handleExactPayment}
                paymentMethods={paymentMethods}
                subtotalExemptUSD={subtotalExemptUSD}
                subtotalTaxableUSD={subtotalTaxableUSD}
                ivaUSD={ivaUSD}
                isFiscalInvoice={isFiscalInvoice}
                setIsFiscalInvoice={setIsFiscalInvoice}
                cart={cart}
                paymentShares={paymentShares}
                isInsufficient={isInsufficient}
                handleCreditProcess={handleCreditProcess}
                PaymentInput={(props) => <PaymentInput {...props} currentMethod={currentMethod} isNumpadOpen={isNumpadOpen} paymentReferences={paymentReferences} setCurrentMethod={setCurrentMethod} setCurrentInputValue={setCurrentInputValue} setCurrentReference={setCurrentReference} setIsNumpadOpen={setIsNumpadOpen} />}
                Button={Button}
                igtfGeneratedUSD={igtfGeneratedUSD}
                targetTotalUSD={targetTotalUSD}
            />

            {/* 2. INYECCIÓN DEL NUMPAD: Le pasamos todas las funciones matemáticas y estados */}
            {isNumpadOpen && (
                <NumpadModal
                    paymentMethods={paymentMethods}
                    currentMethod={currentMethod}
                    methodsRequiringReference={methodsRequiringReference}
                    bcvRate={bcvRate}
                    totalRemainingUSD={remainingUSD}
                    currentInputValue={currentInputValue}
                    setCurrentInputValue={setCurrentInputValue}
                    currentReference={currentReference}
                    setCurrentReference={setCurrentReference}
                    updatePaymentShare={updatePaymentShare}
                    setPaymentReferences={setPaymentReferences}
                    setIsNumpadOpen={setIsNumpadOpen}
                    handlePayRemaining={handlePayRemaining}
                />
            )}
            
            {/* 3. INYECCIÓN DEL MODAL DE CLIENTE: Le pasamos la lógica de búsqueda y formulario */}
            {isCustomerModalOpen && (
                <CustomerModal
                    paymentMethod={currentMethod} 
                    paymentShares={paymentShares}
                    handleClear={handleClear}
                    dueDays={dueDays}
                    setDueDays={setDueDays}
                    customerData={customerData}
                    handleNameChange={handleNameChange}
                    isSearchingCustomer={isSearchingCustomer}
                    customerSearchResults={customerSearchResults}
                    handleListSelect={handleListSelect}
                    handleIdChange={handleIdChange}
                    handleChange={handleChange}
                    setIsCustomerModalOpen={setIsCustomerModalOpen}
                    setIsPaymentModalOpen={setIsPaymentModalOpen}
                    isFormReadyToSubmit={isFormReadyToSubmit}
                    handleConfirm={handleConfirm}
                    
                    // 🚨 PROPS DELIVERY AÑADIDOS
                    isDelivery={isDelivery}
                    deliveryInfo={deliveryInfo}
                    setDeliveryInfo={setDeliveryInfo}
                    drivers={drivers}
                />
            )}

            {/* --- MODAL CARRITO MÓVIL --- */}
         <MobileCartModal
             isMobileCartOpen={isMobileCartOpen}
             setIsMobileCartOpen={setIsMobileCartOpen}
             cart={cart}
             removeFromCart={removeFromCart}
             subtotalExemptUSD={subtotalExemptUSD}
             subtotalTaxableUSD={subtotalTaxableUSD}
             IVA_RATE={IVA_RATE}
             ivaUSD={ivaUSD}
             totalVES={totalVES}
             finalTotalUSD={finalTotalUSD}
             handleOpenPayment={handleOpenPayment}
         />
            
            {/* --- MODAL DETALLE VENTA --- */}
            <SaleDetailModal
            selectedSaleDetail={selectedSaleDetail}
            setSelectedSaleDetail={setSelectedSaleDetail}
            handlePrintTicket={handlePrintTicket}
            handleVoidSale={handleVoidSale}
            />

            {/* --- MODAL DE ALERTA DE STOCK BAJO --- */}
         <StockAlertModal
             showStockModal={showStockModal}
             setShowStockModal={setShowStockModal}
             lowStock={lowStock}
         />

            {/* --- MODAL MONITOR DE OPERACIONES (REPORTE X) --- */}
            <DailySalesModal
                showDailySalesModal={showDailySalesModal}
                setShowDailySalesModal={setShowDailySalesModal}
                dailySalesList={dailySalesList}
                bcvRate={bcvRate}
                showSaleDetail={showSaleDetail}
                handleCashClose={handleCashClose}
            />

            {/* --- MODAL DE VISUALIZACIÓN PREVIA DE FACTURA --- */}
         <ReceiptPreviewModal
             receiptPreview={receiptPreview}
             setReceiptPreview={setReceiptPreview}
         />

            {/* --- MODAL VISOR DE KARDEX --- */}
            <KardexModal
                isKardexOpen={isKardexOpen}
                setIsKardexOpen={setIsKardexOpen}
                kardexProduct={kardexProduct}
                kardexHistory={kardexHistory}
                printKardexReport={printKardexReport}
            />

            {/* --- MODAL AVANCE DE EFECTIVO (GLOBAL) --- */}
         <CashAdvanceModal 
             isCashAdvanceOpen={isCashAdvanceOpen}
             setIsCashAdvanceOpen={setIsCashAdvanceOpen}
             advanceData={advanceData}
             setAdvanceData={setAdvanceData}
             validateAndAddAdvance={validateAndAddAdvance}
             bcvRate={bcvRate}
         />
         
         {/* 🚨 [NUEVO] MODAL CONTROL DE CORRELATIVOS (FASE 5) */}
            <SequenceManagerModal 
                isOpen={isSequenceModalOpen} 
                onClose={() => setIsSequenceModalOpen(false)} 
            />
            
        </div>
    );
}

// =========================================================
// 🛡️ ESCUDO DE SEGURIDAD MAESTRO (Auth Wrapper)
// =========================================================
export default function App() {
    const [user, setUser] = useState(null);
    const [checkingSession, setCheckingSession] = useState(true);

    // 1. Escuchador de sesión expirada
    useEffect(() => {
        const handleSessionExpired = () => {
            setUser(null);
        };

        window.addEventListener('bms_session_expired', handleSessionExpired);
        return () => window.removeEventListener('bms_session_expired', handleSessionExpired);
    }, []);

    // 2. Verificar si ya está logueado al abrir la página + BLINDAJE ANTI F5
    useEffect(() => {
        const storedUser = localStorage.getItem('bms_user');
        const token = localStorage.getItem('bms_token');
        const storedRegister = localStorage.getItem('bms_active_register');

        if (storedUser && token) {
            try {
                const parsedUser = JSON.parse(storedUser);

                // 🚨 BLINDAJE ANTI-F5: Si es CAJERO y no tiene caja seleccionada (o es null/undefined)
                if (parsedUser.role === 'CAJERO' && (!storedRegister || storedRegister === 'undefined' || storedRegister === 'null')) {
                    console.warn("🛡️ Escudo BMS: Bypass detectado. Cajero sin caja asignada. Expulsando...");
                    localStorage.removeItem('bms_token');
                    localStorage.removeItem('bms_user');
                    localStorage.removeItem('bms_active_register');
                    setUser(null);
                } else {
                    // Si todo está en orden o es Administrador/Supervisor
                    setUser(parsedUser);
                }
            } catch (error) {
                // Mejora de seguridad: Evita un crash si el JSON del localStorage está corrupto
                console.error("Error validando sesión:", error);
                setUser(null);
            }
        }
        setCheckingSession(false);
    }, []);

    const handleLoginSuccess = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        Swal.fire({
            title: '¿Cerrar Sesión?',
            text: "Se requerirá su contraseña para volver a entrar.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0F172A',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Sí, Salir',
            cancelButtonText: 'Cancelar',
            customClass: { popup: 'rounded-3xl' }
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('bms_token');
                localStorage.removeItem('bms_user');
                localStorage.removeItem('bms_active_register');
                setUser(null);
            }
        });
    };

    // 3. El Portero: Mientras carga, mostramos el spinner
    if (checkingSession) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    // 4. El Portero: Si no hay usuario, mostramos el Login
    if (!user) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    // 🚀 MAGIA: Si el usuario existe, encendemos la aplicación principal.
    // Esto garantiza que todos tus Hooks (Cajas, Clientes) nazcan con el Token en mano.
    return <MainApp user={user} handleLogout={handleLogout} />;
}