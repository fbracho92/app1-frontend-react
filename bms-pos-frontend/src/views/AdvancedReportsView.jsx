import React, { memo } from 'react';
import Swal from 'sweetalert2';

// 🚀 OPTIMIZACIÓN: Memoizado estricto. Al ser la vista más pesada (Gráficas + Tablas de miles de filas), esto evita congelamientos (lag) en la interfaz táctil.
export const AdvancedReportsView = memo(({
    // Estados y Datos
    reportTab, setReportTab,
    reportDateRange, setReportDateRange,
    analyticsData,
    detailedSales,
    salesSearch, setSalesSearch,
    isSearchingSales,
    salesReportPage, setSalesReportPage,
    inventoryFilteredData,
    inventorySearch, setInventorySearch,
    detailedInventory,
    topDebtors,
    closingsHistory,
    connectivityLogs,
    selectedAuditProduct, setSelectedAuditProduct,
    auditTab, setAuditTab,
    kardexHistory, setKardexHistory,
    products,

    // Funciones de Acción
    fetchAdvancedReport,
    exportReportToPDF,
    fetchSalesDetail,
    fetchInventoryDetail,
    fetchClosingsHistory,
    showSaleDetail,
    downloadCSV,
    printSalesBookPDF,
    printLegalDebtReport,
    printInventoryAuditPDF,
    printPhysicalCountReport,
    viewKardexHistory,
    printClosingReport,
    printReportX, // <-- NUEVO: Acción Reporte X
    printReportZ, // <-- NUEVO: Acción Reporte Z
    
    // Servicios y Utilidades
    InventoryService,
    bcvRate,
    formatBs,
    formatUSD,
    
    // Componentes de UI Base y Gráficas
    Button,
    Input,
    SimpleBarChart
}) => {
    return (
        /* --- VISTA: INTELIGENCIA DE NEGOCIOS (REDISEÑO PRO + DRILL DOWN + CIERRES) --- */
        <div className="p-4 md:p-8 overflow-y-auto h-full animate-slide-up bg-slate-50">

            {/* CABECERA Y NAVEGACIÓN */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Inteligencia de Negocios</h2>
                    <p className="text-slate-500 mt-1 font-medium">
                        {reportTab === 'DASHBOARD' ? 'Análisis de rendimiento y KPIs' :
                            reportTab === 'SALES' ? 'Explorador Detallado de Transacciones' :
                                reportTab === 'INVENTORY' ? 'Auditoría Completa de Inventario' : 'Historial de Cierres de Caja'}
                    </p>
                </div>

                {/* BARRA DE PESTAÑAS (TABS) */}
                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto max-w-full">
                    <Button
                        variant="ghost"
                        onClick={() => setReportTab('DASHBOARD')}
                        className={`!px-5 !py-2.5 text-sm whitespace-nowrap ${reportTab === 'DASHBOARD' ? '!bg-slate-800 !text-white !shadow-md' : '!text-slate-500 hover:!bg-slate-50'}`}
                    >
                        <span>📊</span> Dashboard
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={() => {
                            setReportTab('SALES');
                            fetchSalesDetail();
                        }}
                        className={`!px-5 !py-2.5 text-sm whitespace-nowrap ${reportTab === 'SALES' ? '!bg-higea-blue !text-white !shadow-md' : '!text-slate-500 hover:!bg-slate-50'}`}
                    >
                        <span>📑</span> Ventas
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={() => {
                            setReportTab('INVENTORY');
                            fetchInventoryDetail();
                        }}
                        className={`!px-5 !py-2.5 text-sm whitespace-nowrap ${reportTab === 'INVENTORY' ? '!bg-indigo-600 !text-white !shadow-md' : '!text-slate-500 hover:!bg-slate-50'}`}
                    >
                        <span>📦</span> Inventario
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={() => fetchClosingsHistory()}
                        className={`!px-5 !py-2.5 text-sm whitespace-nowrap ${reportTab === 'CLOSINGS' ? '!bg-emerald-600 !text-white !shadow-md' : '!text-slate-500 hover:!bg-slate-50'}`}
                    >
                        <span>🔐</span> Cierres
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={() => setReportTab('LEGAL')}
                        className={`!px-5 !py-2.5 text-sm whitespace-nowrap ${reportTab === 'LEGAL' ? '!bg-slate-900 !text-white !shadow-md' : '!text-slate-500 hover:!bg-slate-50'}`}
                    >
                        <span>⚖️</span> Legales
                    </Button>
                </div>
            </div>

            {/* --- CONTENIDO DINÁMICO (PESTAÑAS) --- */}

            {/* PESTAÑA 1: DASHBOARD */}
            {reportTab === 'DASHBOARD' && (
                <>
                    {/* CONTROL DE FECHAS */}
                    <div className="flex flex-wrap items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-8 w-fit ml-auto">
                        <div className="flex items-center bg-slate-100 rounded-xl px-4 py-2 border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-wider">Desde</span>
                            <input type="date" value={reportDateRange.start} onChange={(e) => setReportDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" />
                        </div>
                        <div className="text-slate-300 font-bold">→</div>
                        <div className="flex items-center bg-slate-100 rounded-xl px-4 py-2 border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-wider">Hasta</span>
                            <input type="date" value={reportDateRange.end} onChange={(e) => setReportDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" />
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-1"></div>

                        <Button
                            variant="secondary"
                            onClick={fetchAdvancedReport}
                            className="!px-4 !py-2.5 text-sm !shadow-sm !bg-white hover:!bg-slate-50 text-slate-600"
                        >
                            <span>🔄</span> <span className="hidden sm:inline">Actualizar</span>
                        </Button>

                        <Button
                            variant="danger"
                            onClick={exportReportToPDF}
                            className="!bg-higea-red hover:!bg-red-700 !px-4 !py-2.5 text-sm !shadow-md"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            <span>PDF Reporte</span>
                        </Button>

                        <Button
                            variant="primary"
                            onClick={() => downloadCSV(analyticsData.salesOverTime, 'Resumen_Gerencial')}
                            className="!bg-green-600 hover:!bg-green-700 !px-4 !py-2.5 text-sm !shadow-md"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="hidden sm:inline">Excel</span>
                        </Button>
                    </div>
                    {analyticsData ? (
                        <div className="space-y-8 pb-20">
                            {/* 1. SECCIÓN KPI */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* KPI 1: Ingresos */}
                                <div onClick={fetchSalesDetail} className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden group cursor-pointer active:scale-95 transition-all">
                                    <div className="absolute right-0 top-0 h-32 w-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            </div>
                                            <span className="text-blue-200 text-xs font-bold bg-blue-900/30 px-2 py-1 rounded-lg flex items-center gap-1">Ver Detalle <span className="text-lg">→</span></span>
                                        </div>
                                        <p className="text-4xl font-black tracking-tight mb-1">
                                            Ref {analyticsData.salesOverTime.reduce((acc, day) => acc + parseFloat(day.total_usd), 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-blue-200 text-sm font-medium">Dinero Recaudado (Caja)</p>
                                    </div>
                                </div>

                                {/* KPI 2: Transacciones */}
                                <div onClick={fetchSalesDetail} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg relative overflow-hidden group cursor-pointer active:scale-95 transition-all">
                                    <div className="absolute right-0 bottom-0 h-24 w-24 bg-purple-50 rounded-full -mr-5 -mb-5 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="bg-purple-100 p-3 rounded-2xl"><svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg></div>
                                            <span className="text-purple-600 text-xs font-bold bg-purple-50 px-2 py-1 rounded-lg">Ver Operaciones →</span>
                                        </div>
                                        <p className="text-4xl font-black text-slate-800 tracking-tight mb-1">{analyticsData.salesOverTime.reduce((acc, day) => acc + parseInt(day.tx_count || 0), 0)}</p>
                                        <p className="text-slate-400 text-sm font-medium">Operaciones Realizadas</p>
                                    </div>
                                </div>

                                {/* KPI 3: Promedio */}
                                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg relative overflow-hidden group">
                                    <div className="absolute right-0 bottom-0 h-24 w-24 bg-emerald-50 rounded-full -mr-5 -mb-5 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="bg-emerald-100 p-3 rounded-2xl"><svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg></div>
                                            <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">KPI Clave</span>
                                        </div>
                                        <p className="text-4xl font-black text-slate-800 tracking-tight mb-1">
                                            Ref {(() => {
                                                const total = analyticsData.salesOverTime.reduce((acc, day) => acc + parseFloat(day.total_usd), 0);
                                                const count = analyticsData.salesOverTime.reduce((acc, day) => acc + parseInt(day.tx_count || 0), 0);
                                                return count > 0 ? (total / count).toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '0.00';
                                            })()}
                                        </p>
                                        <p className="text-slate-400 text-sm font-medium">Promedio por Venta</p>
                                    </div>
                                </div>
                            </div>

                            {/* 2. GRÁFICAS */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div onClick={fetchInventoryDetail} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-200 transition-colors group">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                        <div className="bg-yellow-100 p-2 rounded-xl text-yellow-600 text-xl">🏆</div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">Productos Estrella</h3>
                                            <p className="text-xs text-slate-400">Clic para ver Inventario Completo</p>
                                        </div>
                                    </div>
                                    <SimpleBarChart data={analyticsData.topProducts} labelKey="name" valueKey="total_qty" colorClass="bg-yellow-400" formatMoney={false} />
                                </div>

                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                        <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 text-xl">🏷️</div>
                                        <div><h3 className="font-bold text-slate-800 text-lg">Rendimiento por Categoría</h3><p className="text-xs text-slate-400">Ingresos generados (Ref)</p></div>
                                    </div>
                                    <SimpleBarChart data={analyticsData.salesByCategory} labelKey="category" valueKey="total_usd" colorClass="bg-indigo-500" formatMoney={true} />
                                </div>
                            </div>

                            {/* 3. DEUDORES Y EVOLUCIÓN */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-red-100 p-2 rounded-xl text-red-600 text-lg">📉</div>
                                        <h3 className="font-bold text-slate-800">Top Deudores</h3>
                                    </div>
                                    <div className="space-y-4">
                                        {topDebtors.slice(0, 5).map((debtor, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{debtor.full_name.charAt(0)}</div>
                                                    <div><p className="text-xs font-bold text-slate-700 truncate w-24">{debtor.full_name}</p><p className="text-[10px] text-slate-400">Pendiente</p></div>
                                                </div>
                                                <span className="font-black text-red-500 text-sm">Ref {parseFloat(debtor.debt).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {topDebtors.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Sin deudas pendientes 🎉</p>}
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 overflow-hidden flex flex-col">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-slate-100 p-2 rounded-xl text-slate-600 text-lg">📅</div>
                                        <h3 className="font-bold text-slate-800 text-lg">Evolución Diaria Detallada</h3>
                                    </div>
                                    <div className="overflow-x-auto custom-scrollbar flex-1">
                                        <table className="w-full text-left text-sm text-slate-600">
                                            <thead>
                                                <tr className="border-b-2 border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                    <th className="px-4 py-3">Fecha</th>
                                                    <th className="px-4 py-3 text-center">Ops</th>
                                                    <th className="px-4 py-3 text-right">Total Ref</th>
                                                    <th className="px-4 py-3 text-right">Total Bs</th>
                                                    <th className="px-4 py-3 text-center hidden sm:table-cell">Volumen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {analyticsData.salesOverTime.map((day, idx) => {
                                                    const maxDay = Math.max(...analyticsData.salesOverTime.map(d => parseFloat(d.total_usd)));
                                                    const percent = maxDay > 0 ? (parseFloat(day.total_usd) / maxDay) * 100 : 0;
                                                    return (
                                                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                                            <td className="px-4 py-3 font-medium text-slate-800">{new Date(day.sale_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-4 py-3 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold">{day.tx_count}</span></td>
                                                            <td className="px-4 py-3 text-right font-black text-higea-blue">Ref {parseFloat(day.total_usd).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                                            <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">Bs {parseFloat(day.total_ves).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                                                            <td className="px-4 py-3 align-middle hidden sm:table-cell w-32">
                                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                                    <div className={`h-full rounded-full ${percent > 80 ? 'bg-green-500' : percent > 40 ? 'bg-blue-500' : 'bg-slate-400'}`} style={{ width: `${percent}%` }}></div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                            <div className="w-16 h-16 border-4 border-slate-200 border-t-higea-blue rounded-full animate-spin mb-6"></div>
                            <p className="font-bold text-lg text-slate-500 animate-pulse">Procesando Inteligencia de Negocios...</p>
                        </div>
                    )}
                </>
            )}
            
            {/* PESTAÑA 2: DETALLE DE VENTAS */}
            {reportTab === 'SALES' && (
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in flex flex-col h-[80vh]">
                    {/* BARRA DE HERRAMIENTAS */}
                    <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-50">
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto">
                            <span className="text-xs font-bold text-gray-400 pl-2">Rango:</span>
                            <input type="date" value={reportDateRange.start} onChange={(e) => setReportDateRange(prev => ({ ...prev, start: e.target.value }))} className="text-xs font-bold text-gray-700 outline-none bg-transparent px-1 py-1 cursor-pointer" />
                            <span className="text-gray-400 font-bold">→</span>
                            <input type="date" value={reportDateRange.end} min={reportDateRange.start} onChange={(e) => setReportDateRange(prev => ({ ...prev, end: e.target.value }))} className="text-xs font-bold text-gray-700 outline-none bg-transparent px-1 py-1 cursor-pointer" />

                            <Button
                                variant="primary"
                                onClick={() => fetchSalesDetail()}
                                className="!bg-higea-blue hover:!bg-blue-700 !p-2 !rounded-lg !shadow-sm"
                                title="Buscar ventas en este rango"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </Button>
                        </div>

                        {/* Buscador de Ventas */}
                        <div className="relative w-full md:w-80">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none">🔍</span>

                            <Input
                                placeholder="Buscar (Cliente, ID, Ref)..."
                                value={salesSearch}
                                onChange={(e) => setSalesSearch(e.target.value)}
                                className="w-full [&_input]:!pl-10 [&_input]:!py-2.5 [&_input]:!text-sm [&_input]:!shadow-sm [&_input]:!bg-white"
                            />

                            {isSearchingSales && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                                    <div className="w-4 h-4 border-2 border-higea-blue border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <span className="text-xs font-bold text-slate-500 uppercase bg-white px-3 py-1.5 rounded-lg border border-slate-200 hidden md:block">
                                {detailedSales.length} Reg
                            </span>
                            <Button
                                variant="primary"
                                onClick={() => downloadCSV(detailedSales, 'Reporte_Ventas')}
                                className="!bg-green-600 hover:!bg-green-700 !px-4 !py-2.5 text-sm whitespace-nowrap w-full md:w-auto"
                            >
                                <span>📥</span> Exportar Excel (.csv)
                            </Button>
                        </div>
                    </div>

                    {/* TABLA DE VENTAS */}
                    <div className="overflow-x-auto flex-1 custom-scrollbar bg-slate-50/50">
                        <table className="w-full text-left text-xs text-gray-600">
                            <thead className="bg-white text-gray-500 font-bold uppercase sticky top-0 shadow-sm z-10 text-[11px] tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 bg-slate-50 border-b border-slate-100">Fecha / Hora</th>
                                    {/* 🚨 Doc. Legal / Control */}
                                    <th className="px-6 py-4 bg-slate-50 border-b border-slate-100">Doc. Legal / Control</th>
                                    <th className="px-6 py-4 bg-slate-50 border-b border-slate-100">Cliente</th>
                                    <th className="px-6 py-4 bg-slate-50 border-b border-slate-100 text-center">Método</th>
                                    <th className="px-6 py-4 bg-slate-50 border-b border-slate-100 text-right">Total Bs</th>
                                    <th className="px-6 py-4 bg-slate-50 border-b border-slate-100 text-right">Total Ref</th>
                                    <th className="px-6 py-4 bg-slate-50 border-b border-slate-100 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {(() => {
                                    const ITEMS_PER_PAGE = 50;
                                    const filteredData = detailedSales;
                                    const indexOfLast = salesReportPage * ITEMS_PER_PAGE;
                                    const indexOfFirst = indexOfLast - ITEMS_PER_PAGE;
                                    const currentData = filteredData.slice(indexOfFirst, indexOfLast);
                                    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

                                    if (currentData.length === 0) return <tr><td colSpan="7" className="p-10 text-center italic text-gray-400">Sin resultados</td></tr>;

                                    return (
                                        <>
                                            {currentData.map((sale) => {
                                                // 🚨 Lógica Dinámica de Documentos
                                                const isFisc = ['FISCAL', 'FORMA_LIBRE', 'ELECTRONIC', 'ELECTRONIC_BILLING'].includes(sale.invoice_type);
                                                const isCN = sale.invoice_type === 'NOTA_CREDITO' || (isFisc && (sale.status === 'ANULADO' || sale["Estado"] === 'ANULADO'));

                                                // 🚨 NUEVO: Detección para Forma Libre e inyección de la Serie
                                                const isFormaLibreDoc = sale.invoice_type === 'FORMA_LIBRE';
                                                
                                                // 🛡️ CAMBIO CERTIFICADO 4: EXTRACCIÓN INTELIGENTE DE LA SERIE DE LA VENTA
                                                let extractedSerie = sale.register_serie || sale.serie; // Prioriza la caja real del backend
                                                
                                                // Si no vino directo de la BD, intentamos rescatar la letra del número de control
                                                if (!extractedSerie && sale.fiscal_control_number) {
                                                    const match = sale.fiscal_control_number.match(/^[a-zA-Z]+/);
                                                    if (match) extractedSerie = match[0].toUpperCase();
                                                }
                                                
                                                // Formateamos visualmente la serie si existe (ej: "SERIE - B"), sino marcamos 'S/S' (Sin Serie)
                                                const docSerie = extractedSerie ? `SERIE - ${extractedSerie}` : "S/S"; 
                                                
                                                // 🛡️ SE MANTIENEN TODOS LOS FALLBACKS HISTÓRICOS INTACTOS
                                                const baseDocNum = sale.fiscal_invoice_number || sale.control_number || sale["Nro Factura"] || sale.id;

                                                // La Formato Libre exige la Serie concatenada con el número rellenado con ceros
                                                const finalFiscalDisplay = isFormaLibreDoc ? `${docSerie} ${String(baseDocNum).replace(/[^0-9]/g, '').padStart(8, '0')}` : baseDocNum;

                                                return (
                                                    <tr key={sale.id} onClick={() => showSaleDetail(sale)} className="hover:bg-blue-50 transition-colors cursor-pointer group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                            {new Date(sale.created_at || sale["Fecha Hora"]).toLocaleDateString()} <span className="text-[10px] text-gray-400 ml-1">{new Date(sale.created_at || sale["Fecha Hora"]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </td>
                                                        
                                                        {/* 🚨 COLUMNA INTELIGENTE CON RESPALDOS (FALLBACKS) PARA DATA HISTÓRICA */}
                                                        <td className="px-6 py-4">
                                                            {isCN ? (
                                                                <div className="flex flex-col">
                                                                    <span className="font-mono font-bold text-rose-600 text-[11px] whitespace-nowrap" title="Nota de Crédito">
                                                                        NC: {sale.credit_note_number || sale.control_number || sale["Nro Factura"] || sale.id}
                                                                    </span>
                                                                    {(sale.credit_note_control || sale.fiscal_control_number || sale["Nro Control"]) && (
                                                                        <span className="font-mono text-slate-400 text-[9px] whitespace-nowrap">
                                                                            C: {sale.credit_note_control || sale.fiscal_control_number || sale["Nro Control"]}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : isFisc ? (
                                                                <div className="flex flex-col">
                                                                    <span className="font-mono font-bold text-higea-blue text-[11px] whitespace-nowrap" title="Factura Fiscal">
                                                                        {/* 🚨 AQUÍ APLICAMOS LA VARIABLE QUE INYECTA LA SERIE BLINDADA */}
                                                                        F: {finalFiscalDisplay}
                                                                    </span>
                                                                    <span className="font-mono text-slate-400 text-[9px] whitespace-nowrap">
                                                                        C: {sale.fiscal_control_number || sale["Nro Control"] || 'S/A'}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="font-mono font-bold text-slate-600 text-sm">
                                                                    #{sale.control_number || sale["Nro Factura"] || sale.id}
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-gray-700 text-sm">{sale.client_name || sale.full_name || sale["Cliente"]}</div>
                                                            <div className="text-[10px] text-gray-400">{sale.client_id || sale.id_number || sale["Documento"]}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[10px] font-medium text-gray-500 truncate max-w-[100px] inline-block">
                                                                {sale.payment_method || sale["Metodo Pago"]}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-500">Bs {parseFloat(sale.total_ves || sale["Total Bs"]).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-6 py-4 text-right"><span className="font-black text-slate-800 text-sm bg-slate-100 px-2 py-1 rounded">Ref {parseFloat(sale.total_usd || sale["Total USD"]).toFixed(2)}</span></td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${(sale.status || sale["Estado"]) === 'PAGADO' ? 'bg-green-100 text-green-700' : (sale.status || sale["Estado"]) === 'PENDIENTE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {sale.status || sale["Estado"]}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {totalPages > 1 && (
                                                <tr>
                                                    <td colSpan="7" className="p-4 bg-slate-50 border-t border-slate-200">
                                                        <div className="flex justify-center items-center gap-4">
                                                            <button onClick={(e) => { e.stopPropagation(); setSalesReportPage(p => Math.max(1, p - 1)); }} disabled={salesReportPage === 1} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-50">Anterior</button>
                                                            <span className="text-xs font-bold text-gray-600">Página {salesReportPage} de {totalPages}</span>
                                                            <button onClick={(e) => { e.stopPropagation(); setSalesReportPage(p => Math.min(totalPages, p + 1)); }} disabled={salesReportPage === totalPages} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-50">Siguiente</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- 3. TABLA DE AUDITORÍA DE INVENTARIO --- */}
            {reportTab === 'INVENTORY' && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">

                    {/* Encabezado: Título + Buscador + Botones */}
                    <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-4 bg-gray-50">

                        <div className="flex flex-col">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                📦 Auditoría de Existencias
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                                    {inventoryFilteredData.length} Ítems
                                </span>
                            </h3>
                            <p className="text-xs text-gray-500">Valorización en tiempo real (Bs y Ref)</p>
                        </div>

                        <div className="flex-1 max-w-md w-full relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none">🔍</span>

                            <Input
                                placeholder="Buscar por nombre, código o categoría..."
                                value={inventorySearch}
                                onChange={(e) => setInventorySearch(e.target.value)}
                                className="w-full [&_input]:!pl-9 [&_input]:!pr-16 [&_input]:!py-2 [&_input]:!text-sm [&_input]:!bg-white focus:[&_input]:!border-blue-400 focus:[&_input]:!ring-2 focus:[&_input]:!ring-blue-50"
                            />

                            {inventorySearch && (
                                <button
                                    onClick={() => setInventorySearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold z-10"
                                >
                                    BORRAR
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="danger"
                                onClick={() => printInventoryAuditPDF(detailedInventory)}
                                className="!px-4 !py-2 text-xs !bg-red-600 hover:!bg-red-700 !shadow-md"
                            >
                                <span>📄</span> PDF Legal
                            </Button>

                            <Button
                                variant="primary"
                                onClick={() => downloadCSV(inventoryFilteredData, 'Auditoria_Inventario')}
                                className="!px-4 !py-2 text-xs !bg-green-600 hover:!bg-green-700 !shadow-md"
                            >
                                <span>📊</span> Excel / CSV
                            </Button>

                            <Button
                                variant="primary"
                                onClick={printPhysicalCountReport}
                                className="!px-4 !py-2 text-xs !bg-slate-700 hover:!bg-slate-800 !shadow-md"
                                title="Imprimir formato para contar manualmente en almacén"
                            >
                                <span>📋</span> Conteo Físico
                            </Button>
                        </div>
                    </div>

                    {/* Tabla de Datos */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-slate-100 text-gray-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="px-6 py-3">Producto</th>
                                    <th className="px-6 py-3">Categoría</th>
                                    <th className="px-6 py-3 text-center">Stock</th>
                                    <th className="px-6 py-3 text-right">Costo Unit. (Bs)</th>
                                    <th className="px-6 py-3 text-right">Valor Total (Bs)</th>
                                    <th className="px-6 py-3 text-right">Valor Total (Ref)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {inventoryFilteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-400 italic">
                                            No se encontraron productos con esa búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    inventoryFilteredData.map((item) => {
                                        const stock = parseInt(item.stock) || 0;
                                        const price = parseFloat(item.price_usd) || 0;
                                        const totalRef = parseFloat(item.total_value_usd) || 0;
                                        const totalBs = totalRef * bcvRate;
                                        const unitBs = price * bcvRate;

                                        return (
                                            <tr
                                                key={item.id}
                                                onClick={() => viewKardexHistory(item)}
                                                className="hover:bg-blue-50 transition-colors cursor-pointer group"
                                                title="🖱️ Clic para ver Movimientos y Kardex"
                                            >
                                                <td className="px-6 py-3 font-bold text-gray-800">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl group-hover:scale-125 transition-transform">{item.icon_emoji}</span>
                                                        <div>
                                                            {item.name}
                                                            <div className="text-[10px] text-gray-400 font-mono flex gap-2">
                                                                <span>{item.barcode || 'S/C'}</span>
                                                                <span className="text-blue-400 opacity-0 group-hover:opacity-100 font-bold transition-opacity">Ver Detalle ➜</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-xs">{item.category}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${stock <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                                        {stock}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono text-xs">
                                                    Bs {formatBs(unitBs)}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-gray-800">
                                                    Bs {formatBs(totalBs)}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-blue-600">
                                                    Ref {formatUSD(totalRef)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PESTAÑA 4: CIERRES */}
            {reportTab === 'CLOSINGS' && (
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden animate-fade-in flex flex-col h-[80vh]">
                    {/* HEADER PREMIUM */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                        <div>
                            <h3 className="font-black text-slate-800 text-xl tracking-tight">Historial de Auditoría</h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">Control Fiscal de Cajas • Bases, Ventas y Avances</p>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={fetchClosingsHistory}
                            className="!bg-white !text-slate-400 hover:!text-blue-600 hover:!border-blue-200 !px-4 !py-2 text-xs !shadow-sm hover:!shadow-md"
                        >
                            <span>🔄</span> Sincronizar
                        </Button>
                    </div>

                    <div className="overflow-x-auto flex-1 custom-scrollbar p-2">
                        <table className="w-full text-left text-sm text-slate-600 border-collapse">
                            <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="px-6 py-4 rounded-l-xl">ID / Estado</th>
                                    <th className="px-6 py-4">Responsable / Fecha</th>
                                    <th className="px-6 py-4">Flujo de Caja (Base - Avances)</th>
                                    <th className="px-6 py-4 text-right">Sistema (Esperado)</th>
                                    <th className="px-6 py-4 text-right">Conteos (Real)</th>
                                    <th className="px-6 py-4 text-center">Diferencia</th>
                                    <th className="px-6 py-4 text-center rounded-r-xl">Interno</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {closingsHistory.map((shift) => (
                                    <tr key={shift.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-black text-slate-700 text-lg">#{shift.id}</span>
                                                {shift.status === 'ABIERTA'
                                                    ? <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold w-fit">🟢 ABIERTA</span>
                                                    : <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold w-fit">🔒 CERRADA</span>
                                                }
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-600 text-xs uppercase">{shift.cashier_name || 'Cajero'}</span>
                                                <span className="text-[10px] text-slate-400 mt-0.5">
                                                    {new Date(shift.opened_at).toLocaleDateString()} • {new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {shift.closed_at && (
                                                    <span className="text-[9px] text-slate-300">
                                                        Cierre: {new Date(shift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-2 text-xs">
                                                <div className="flex justify-between items-center text-slate-500">
                                                    <span>📥 Base:</span>
                                                    <span className="font-bold">Bs {parseFloat(shift.initial_cash_ves || 0).toLocaleString('es-VE', { compactDisplay: 'short' })}</span>
                                                </div>
                                                {(parseFloat(shift.cash_outflows_ves || 0) > 0 || parseFloat(shift.cash_outflows_usd || 0) > 0) && (
                                                    <div className="flex justify-between items-center text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                                                        <span>📤 Avances:</span>
                                                        <span className="font-bold">- Bs {parseFloat(shift.cash_outflows_ves || 0).toLocaleString('es-VE')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-slate-700 font-bold text-sm">
                                                    Bs {((parseFloat(shift.initial_cash_ves || 0) + parseFloat(shift.system_cash_ves || 0)) - parseFloat(shift.cash_outflows_ves || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                    Ref {((parseFloat(shift.initial_cash_usd || 0) + parseFloat(shift.system_cash_usd || 0)) - parseFloat(shift.cash_outflows_usd || 0)).toFixed(2)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 text-sm">Bs {parseFloat(shift.real_cash_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded self-end mt-0.5">
                                                    Ref {parseFloat(shift.real_cash_usd || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {Math.abs(parseFloat(shift.diff_ves)) < 1
                                                    ? <span className="text-[10px] font-black text-emerald-500">✨ OK</span>
                                                    : <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${parseFloat(shift.diff_ves) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {parseFloat(shift.diff_ves) > 0 ? '+' : ''}Bs {parseFloat(shift.diff_ves).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                                                    </span>
                                                }
                                                {Math.abs(parseFloat(shift.diff_usd)) >= 0.5 && (
                                                    <span className={`text-[9px] font-bold ${parseFloat(shift.diff_usd) > 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                                                        {parseFloat(shift.diff_usd) > 0 ? '+' : ''}Ref {parseFloat(shift.diff_usd).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <Button
                                                onClick={() => printClosingReport(shift)}
                                                className="!bg-slate-800 hover:!bg-black text-white !p-2 !rounded-xl !shadow-lg hover:!shadow-xl hover:scale-105"
                                                title="Descargar Reporte Interno PDF"
                                            >
                                                📄
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {closingsHistory.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center opacity-50">
                                                <span className="text-4xl mb-2">📂</span>
                                                <span className="text-slate-500 font-medium">No hay historial de cierres disponible.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- PESTAÑA 5: LEGALES (ACTUALIZADA CON IMPRESORA FISCAL) --- */}
            {reportTab === 'LEGAL' && (
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 p-8 animate-fade-in h-auto flex flex-col">
                    <div className="border-b border-slate-100 pb-6 mb-6">
                        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <span className="text-3xl">🇻🇪</span> Reportes Fiscales y Legales
                        </h3>
                        <p className="text-slate-500 mt-1">Documentación y mandos adaptados a providencias del SENIAT y Normas Contables.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                        {/* TARJETA 1: LIBRO DE VENTAS */}
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 w-full hover:shadow-lg transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-blue-600 text-white p-3 rounded-2xl text-2xl">📘</div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800">Libro de Ventas</h4>
                                    <p className="text-xs text-slate-500">Providencia 0071</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-4">
                                <div className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-400">PERÍODO:</span>
                                    <div className="flex items-center justify-between">
                                        <input type="date" value={reportDateRange.start} onChange={(e) => setReportDateRange({ ...reportDateRange, start: e.target.value })} className="outline-none text-xs font-bold text-slate-700 bg-transparent" />
                                        <span className="text-slate-300">➜</span>
                                        <input type="date" value={reportDateRange.end} onChange={(e) => setReportDateRange({ ...reportDateRange, end: e.target.value })} className="outline-none text-xs font-bold text-slate-700 bg-transparent" />
                                    </div>
                                </div>
                            </div>
                            
                            <button onClick={printSalesBookPDF} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all mt-auto">
                                Descargar Libro PDF
                            </button>
                        </div>

                        {/* TARJETA 2: ESTADO DE CUENTA */}
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 w-full hover:shadow-lg transition-all flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-emerald-600 text-white p-3 rounded-2xl text-2xl">📋</div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800">Relación de Cobranza</h4>
                                    <p className="text-xs text-slate-500">Vencimiento y Deuda</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 mb-6 leading-relaxed flex-1">
                                Genera un reporte detallado de las cuentas por cobrar pendientes, clasificadas por vencimiento y valorizadas en Bolívares.
                            </p>

                            <button onClick={printLegalDebtReport} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-all mt-auto">
                                Descargar Reporte Deuda
                            </button>
                        </div>

                        {/* TARJETA 3: COMANDOS MÁQUINA FISCAL (NUEVO) */}
                        <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-800 w-full hover:shadow-lg transition-all flex flex-col h-full relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-800 opacity-5 rounded-full -mr-10 -mt-10"></div>
                            <div className="flex items-center gap-4 mb-4 relative z-10">
                                <div className="bg-slate-800 text-white p-3 rounded-2xl text-2xl">🖨️</div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800">Máquina Fiscal</h4>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Comandos Directos</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 mb-6 leading-relaxed flex-1 relative z-10">
                                Emite los reportes de auditoría obligatorios directamente a tu impresora fiscal física conectada.
                            </p>

                            <div className="flex flex-col gap-3 mt-auto relative z-10">
                                <button onClick={printReportX} className="w-full bg-white border-2 border-slate-300 hover:border-slate-800 text-slate-800 font-bold py-2.5 rounded-xl active:scale-95 transition-all flex justify-center items-center gap-2">
                                    <span>📄</span> Imprimir Reporte X (Lectura)
                                </button>
                                <button onClick={printReportZ} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all flex justify-center items-center gap-2">
                                    <span>🔒</span> Emitir Reporte Z (Cierre)
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* --- 🛡️ SECCIÓN: TRAZABILIDAD BCV (CERTIFICADO DE HONESTIDAD TÉCNICA) --- */}
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-[2rem] border border-blue-100 p-6 shadow-inner">
                            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-blue-900 text-base uppercase tracking-tight">Trazabilidad Cambiaria</h3>
                                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                                            Certificado de Honestidad Técnica (SUNDDE/SENIAT)
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Badge de Estatus de Integridad */}
                                <div className="bg-white px-4 py-2 rounded-xl border border-blue-100 shadow-sm">
                                    <span className="text-[9px] font-black text-slate-400 uppercase block leading-none mb-1">Estatus del Sistema</span>
                                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L9.03 9.122a2 2 0 001.938 0L17.834 4.9A2 2 0 0016 1.5H4a2 2 0 00-1.834 3.4zM18 8.11l-7.031 4.328a4 4 0 01-3.938 0L0 8.11V14a2 2 0 002 2h16a2 2 0 002-2V8.11z" clipRule="evenodd" /></svg>
                                        DATOS INTEGROS
                                    </span>
                                </div>
                            </div>

                            {/* CONTENEDOR CON SCROLL INTEGRADO */}
                            <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-sm">
                                <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-100">
                                    <table className="w-full text-left text-[11px] relative border-separate border-spacing-0">
                                        <thead className="sticky top-0 z-10 bg-blue-600 text-white font-black uppercase tracking-widest shadow-md">
                                            <tr>
                                                <th className="px-5 py-4 text-center">Fecha y Hora del Suceso</th>
                                                <th className="px-5 py-4 text-center">Tasa Aplicada (Respaldo)</th>
                                                <th className="px-5 py-4">Evidencia Técnica del Error (Origen)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-50">
                                            {connectivityLogs?.length > 0 ? connectivityLogs.map((log, index) => (
                                                <tr key={log.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-blue-50/20'} hover:bg-blue-50 transition-colors`}>
                                                    <td className="px-5 py-4 font-bold text-slate-600 text-center border-r border-blue-50">{log.fecha}</td>
                                                    <td className="px-5 py-4 text-center font-black text-blue-700 bg-blue-50/30 border-r border-blue-50">
                                                        {parseFloat(log.tasa_aplicada).toFixed(2)} Bs
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-400 italic font-medium leading-relaxed">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-blue-300">#</span>
                                                            {log.detalle_tecnico}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="3" className="px-5 py-12 text-center bg-slate-50/50">
                                                        <div className="flex flex-col items-center gap-2 opacity-40">
                                                            <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                            </svg>
                                                            <p className="text-xs font-black uppercase tracking-tighter">Sincronización BCV 100% íntegra</p>
                                                            <p className="text-[10px] font-bold">No se registran eventos de contingencia en el historial.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-3 italic font-medium text-right uppercase tracking-wider">
                                Este log es generado automáticamente por el sistema y no permite edición manual.
                            </p>
                        </div>
                    </div>
                    
                </div>
            )}

            {/* MODAL DETALLE PRODUCTO */}
            {selectedAuditProduct && (
                <div className="fixed inset-0 z-[90] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-fade-in">

                    {/* CONTENEDOR PRINCIPAL */}
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] w-full max-w-5xl h-[90vh] md:h-[85vh] shadow-2xl relative animate-scale-up flex flex-col md:flex-row overflow-hidden">

                        {/* Botón Cerrar */}
                        <button
                            onClick={() => setSelectedAuditProduct(null)}
                            className="absolute top-2 right-2 md:top-4 md:right-4 bg-white hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-full p-2 z-30 transition-all shadow-md border border-slate-100"
                        >
                            ✕
                        </button>

                        {/* --- PANEL IZQUIERDO (IDENTIDAD) --- */}
                        <div className="w-full md:w-4/12 bg-slate-50 p-4 md:p-6 flex flex-row md:flex-col items-center justify-between md:justify-center border-b md:border-b-0 md:border-r border-slate-200 relative shrink-0 gap-3">
                            <div className="absolute top-0 left-0 w-full md:h-1.5 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>

                            {/* 1. INFO VISUAL */}
                            <div className="relative z-10 flex flex-row md:flex-col items-center gap-4 md:gap-0 flex-1 md:flex-none overflow-hidden">
                                <div className="relative shrink-0">
                                    <div className="h-16 w-16 md:h-28 md:w-28 bg-white rounded-2xl md:rounded-[2rem] border-2 md:border-4 border-white shadow-md md:shadow-xl flex items-center justify-center text-3xl md:text-6xl relative z-10">
                                        {products.find(p => p.id === selectedAuditProduct.id)?.icon_emoji || '📦'}
                                    </div>
                                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 md:-bottom-3 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest shadow-sm border border-white whitespace-nowrap z-20 ${selectedAuditProduct.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}>
                                        {selectedAuditProduct.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
                                    </div>
                                </div>
                                <div className="text-left md:text-center min-w-0 pl-1 md:pl-0 pt-1 md:pt-4">
                                    <h3 className="font-black text-lg md:text-2xl text-slate-800 leading-tight mb-0.5 md:mb-1 truncate md:whitespace-normal">
                                        {selectedAuditProduct.name}
                                    </h3>
                                    <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block truncate">
                                        {selectedAuditProduct.category}
                                    </span>
                                </div>
                            </div>

                            {/* 2. CARD STOCK */}
                            <div className={`hidden md:flex w-full max-w-[220px] p-4 rounded-2xl border-2 flex-col items-center justify-center bg-white ${selectedAuditProduct.stock < 5 ? 'border-red-100 shadow-sm shadow-red-100' : 'border-slate-200 shadow-sm'}`}>
                                <span className="text-[10px] font-bold uppercase text-slate-400">Existencia Total</span>
                                <span className={`text-4xl font-black ${selectedAuditProduct.stock < 5 ? 'text-red-500' : 'text-slate-800'}`}>{selectedAuditProduct.stock}</span>
                                <span className="text-xs font-bold opacity-50 mt-1">Unidades</span>
                            </div>
                            <div className="md:hidden flex flex-col items-end pr-8">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Stock</span>
                                <span className={`text-2xl font-black ${selectedAuditProduct.stock < 5 ? 'text-red-500' : 'text-slate-800'}`}>{selectedAuditProduct.stock}</span>
                            </div>
                        </div>

                        {/* --- PANEL DERECHO: CONTENIDO --- */}
                        <div className="w-full md:w-8/12 bg-white flex flex-col h-full overflow-hidden">

                            {/* PESTAÑAS */}
                            <div className="flex border-b border-slate-100 px-4 md:px-8 pt-2 md:pt-6 gap-6 shrink-0 bg-white z-20 overflow-x-auto no-scrollbar">
                                <button
                                    onClick={() => setAuditTab('INFO')}
                                    className={`pb-3 md:pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-[3px] whitespace-nowrap ${auditTab === 'INFO' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    📊 Finanzas
                                </button>
                                <button
                                    onClick={() => {
                                        setAuditTab('HISTORY');
                                        InventoryService.getHistory(selectedAuditProduct.id)
                                            .then(res => setKardexHistory(res.data))
                                            .catch(err => {
                                                console.error("Error en auditoría:", err);
                                                Swal.fire('Error', 'No se pudo cargar el historial del producto', 'error');
                                            });
                                    }}
                                    className={`pb-3 md:pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-[3px] whitespace-nowrap ${auditTab === 'HISTORY' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    📜 Movimientos
                                </button>
                            </div>

                            {/* ÁREA DE SCROLL */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative h-full">

                                {/* VISTA 1: FINANZAS ADAPTADAS A VENEZUELA */}
                                {auditTab === 'INFO' && (
                                    <div className="flex flex-col h-full animate-fade-in space-y-4 md:space-y-6">

                                        {/* 1. Datos Técnicos */}
                                        <div className="grid grid-cols-2 gap-3 md:gap-6">
                                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Código de Barras</p>
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="text-xl opacity-20">|||</span>
                                                    <p className="font-mono text-sm md:text-base font-black text-slate-700 truncate">
                                                        {selectedAuditProduct.barcode || 'NO REGISTRADO'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`p-4 rounded-2xl border flex flex-col justify-center ${selectedAuditProduct.is_taxable ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                                <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${selectedAuditProduct.is_taxable ? 'text-blue-400' : 'text-emerald-400'}`}>Régimen Fiscal</p>
                                                <p className={`text-sm md:text-base font-black ${selectedAuditProduct.is_taxable ? 'text-blue-700' : 'text-emerald-700'}`}>
                                                    {selectedAuditProduct.is_taxable ? 'GRAVADO (IVA 16%)' : 'EXENTO (E)'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 2. COSTO UNITARIO */}
                                        <div className="p-5 md:p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 bg-white relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <span className="text-6xl">📈</span>
                                            </div>
                                            <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Costo Unitario de Reposición</h4>

                                            <div className="flex flex-col md:flex-row items-baseline gap-2 md:gap-8">
                                                <div>
                                                    <span className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">
                                                        <span className="text-sm md:text-lg text-slate-400 font-bold mr-1 align-top">Ref</span>
                                                        {parseFloat(selectedAuditProduct.price_usd).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="h-px w-full md:w-px md:h-12 bg-slate-100"></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Costo en Bolívares</p>
                                                    <span className="text-2xl md:text-3xl font-bold text-slate-600">
                                                        Bs {(parseFloat(selectedAuditProduct.price_usd) * bcvRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. VALOR TOTAL */}
                                        <div className="mt-auto bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 rounded-2xl md:rounded-[2rem] p-6 md:p-8 text-white shadow-2xl shadow-indigo-300/50 relative overflow-hidden">
                                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse-slow"></div>
                                            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-900/20 rounded-full blur-3xl"></div>

                                            <div className="relative z-10">
                                                <p className="text-[10px] md:text-xs font-bold opacity-80 uppercase tracking-[0.2em] mb-4 border-b border-white/20 pb-2 inline-block">Valor Total del Inventario</p>

                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                                                    <div>
                                                        <p className="text-4xl md:text-6xl font-black tracking-tight drop-shadow-md">
                                                            <span className="text-lg md:text-2xl opacity-60 font-bold mr-2 align-top">Ref</span>
                                                            {parseFloat(selectedAuditProduct.total_value_usd).toFixed(2)}
                                                        </p>
                                                        <p className="text-xs font-medium opacity-60 mt-1">Calculado en base al stock actual</p>
                                                    </div>

                                                    <div className="w-full md:w-auto bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-4 border border-white/10">
                                                        <p className="text-[9px] font-bold opacity-70 uppercase mb-1">Total en Bolívares</p>
                                                        <p className="text-xl md:text-2xl font-bold">
                                                            Bs {(parseFloat(selectedAuditProduct.total_value_usd) * bcvRate).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* VISTA 2: HISTORIAL (TIMELINE) */}
                                {auditTab === 'HISTORY' && (
                                    <div className="animate-fade-in pb-16 md:pb-10">
                                        {kardexHistory.length === 0 ? (
                                            <div className="h-40 md:h-64 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl mt-4">
                                                <span className="text-3xl md:text-5xl mb-2 opacity-50">📜</span>
                                                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider">No hay historial disponible</p>
                                            </div>
                                        ) : (
                                            <div className="relative border-l-2 border-indigo-50 ml-2 md:ml-3 space-y-4 md:space-y-8 mt-2">
                                                {kardexHistory.map((mov, idx) => (
                                                    <div key={idx} className="relative pl-4 md:pl-8 group">
                                                        <div className={`absolute -left-[9px] md:-left-[11px] top-0 w-4 h-4 md:w-6 md:h-6 rounded-full border-2 md:border-4 border-white shadow-md flex items-center justify-center text-[8px] md:text-[10px] z-10 ${mov.type === 'IN' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                                            }`}>
                                                            {mov.type === 'IN' ? '↓' : '↑'}
                                                        </div>

                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 md:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                                                            <div className="mb-2 sm:mb-0 w-full sm:w-auto">
                                                                <div className="flex items-center justify-between sm:justify-start gap-2 mb-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${mov.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                                                            }`}>
                                                                            {mov.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                                                                        </span>
                                                                        <span className="text-[9px] md:text-[10px] text-slate-400 font-mono font-medium">
                                                                            {new Date(mov.created_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[9px] text-slate-300 font-mono md:hidden">
                                                                        {new Date(mov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>

                                                                <p className="text-xs md:text-sm font-bold text-slate-700 line-clamp-1">
                                                                    {mov.reason.replace(/_/g, ' ')}
                                                                </p>

                                                                {(mov.document_ref || (mov.type === 'IN' && mov.cost_usd)) && (
                                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                                        {mov.document_ref && (
                                                                            <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate max-w-[120px]">
                                                                                📄 {mov.document_ref}
                                                                            </span>
                                                                        )}
                                                                        {mov.type === 'IN' && mov.cost_usd && (
                                                                            <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                                                                Ref {parseFloat(mov.cost_usd).toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="text-right pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-50 pt-2 md:pt-0 mt-2 md:mt-0 w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end">
                                                                <span className={`block text-base md:text-xl font-black ${mov.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                    {mov.type === 'IN' ? '+' : '-'}{mov.quantity}
                                                                </span>
                                                                <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-bold uppercase mt-0 md:mt-0.5">
                                                                    <span>Saldo:</span>
                                                                    <span className="text-slate-600 text-[10px] md:text-xs">{mov.new_stock}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-8 md:h-12 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});