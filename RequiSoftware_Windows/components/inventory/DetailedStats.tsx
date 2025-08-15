import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import LoadingSpinner from '../core/LoadingSpinner';
import { OrdenCompra, OrdenCompraDetalle, SolicitudCompra, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, ConsumoHistoricoProducto, Proveedor, CategoriaProducto, RendimientoProveedor, SolicitudCompraEstado } from '../../types';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { es } from 'date-fns/locale/es';
import { MagnifyingGlassIcon, ShieldCheckIcon, DocumentTextIcon, TagIcon } from '@heroicons/react/24/outline';


interface DepartmentExpense {
  dept: string;
  total: number;
}

interface ProductFrequency {
  product: string;
  quantity: number;
}

interface MonthlyTotalExpense {
    mes: string; // Formato 'MMM yyyy' para XAxis
    gastoTotal: number;
    originalDate: Date; // Para ordenar correctamente
}

type OrderWithNestedInfo = Pick<OrdenCompra, 'neto_a_pagar'> & {
  solicitudcompra: (Pick<SolicitudCompra, 'id'> & {
    departamento: Pick<Departamento, 'id' | 'nombre'> | null;
  }) | null;
};


type OrderDetailWithProductInfo = Pick<OrdenCompraDetalle, 'cantidad'> & {
  producto: Pick<Producto, 'id' | 'descripcion'> | null;
};

type RequestDetailWithProductInfo = Pick<SolicitudCompraDetalleType, 'cantidad'> & {
  producto: Pick<Producto, 'id' | 'descripcion'> | null;
};

type ConsumoHistoricoWithProduct = ConsumoHistoricoProducto & {
    producto: Pick<Producto, 'id' | 'descripcion'> | null;
};

// Tipos para consultas específicas
type ProductExpenseResult = { totalSpent: number; totalQuantity: number; orderCount: number; orders: { id: number; fecha_orden: string }[] };
type ProductConsumptionResult = { totalConsumed: number; requestCount: number };
type ProductPriceHistoryResult = { fecha_orden: string; precio_unitario: number; orden_id: number }[];
type SupplierPerformanceResult = { avgQuality: number; avgCompliance: number; avgPrice: number; avgCommunication: number; avgDeliveryDaysDiff: number; evaluationCount: number; };
type ProductRequestHistoryItem = { fecha_solicitud: string; cantidad: number; estado: string; solicitante: string; departamento: string; solicitud_id: number; };
type CategoryExpenseResult = { totalSpent: number; orderCount: number; topProducts: { name: string; value: number }[] };


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#FF5733', '#C70039', '#900C3F', '#581845'];

const CustomTooltip = ({ active, payload, label, currency = 'VES' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-700 p-2 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
        <p className="label text-sm text-gray-800 dark:text-gray-200">{`${label} : ${payload[0].value.toLocaleString('es-VE', { style: 'currency', currency: currency })}`}</p>
      </div>
    );
  }
  return null;
};
const CustomQuantityTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-700 p-2 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
        <p className="label text-sm text-gray-800 dark:text-gray-200">{`${label} : ${payload[0].value.toLocaleString('es-VE')} unidades`}</p>
      </div>
    );
  }
  return null;
};


const DetailedStats: React.FC = () => {
  // States for general charts
  const [departmentExpenses, setDepartmentExpenses] = useState<DepartmentExpense[]>([]);
  const [topOrderProducts, setTopOrderProducts] = useState<ProductFrequency[]>([]);
  const [topRequestProducts, setTopRequestProducts] = useState<ProductFrequency[]>([]);
  const [topConsumedProducts, setTopConsumedProducts] = useState<ProductFrequency[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyTotalExpense[]>([]);
  
  // States for specific query filters and data
  const [allProducts, setAllProducts] = useState<Pick<Producto, 'id' | 'descripcion'>[]>([]);
  const [allDepartments, setAllDepartments] = useState<Pick<Departamento, 'id' | 'nombre'>[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Pick<Proveedor, 'id' | 'nombre'>[]>([]);
  const [allProductCategories, setAllProductCategories] = useState<Pick<CategoriaProducto, 'id' | 'nombre'>[]>([]);

  // States for "Gasto por Producto" query
  const [expenseQuery, setExpenseQuery] = useState({ product: '', startDate: '', endDate: '' });
  const [expenseResult, setExpenseResult] = useState<ProductExpenseResult | null>(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  
  // States for "Consumo por Departamento" query
  const [consumptionQuery, setConsumptionQuery] = useState({ product: '', department: '', startDate: '', endDate: '' });
  const [consumptionResult, setConsumptionResult] = useState<ProductConsumptionResult | null>(null);
  const [consumptionLoading, setConsumptionLoading] = useState(false);
  const [consumptionError, setConsumptionError] = useState<string | null>(null);

  // States for "Historial de Precios" query
  const [priceHistoryQuery, setPriceHistoryQuery] = useState({ product: '' });
  const [priceHistoryResult, setPriceHistoryResult] = useState<ProductPriceHistoryResult | null>(null);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<string | null>(null);
  
  // States for "Rendimiento de Proveedor" query
  const [supplierPerformanceQuery, setSupplierPerformanceQuery] = useState({ supplier: '', startDate: '', endDate: '' });
  const [supplierPerformanceResult, setSupplierPerformanceResult] = useState<SupplierPerformanceResult | null>(null);
  const [supplierPerformanceLoading, setSupplierPerformanceLoading] = useState(false);
  const [supplierPerformanceError, setSupplierPerformanceError] = useState<string | null>(null);

  // States for "Historial de Solicitudes por Producto" query
  const [productRequestHistoryQuery, setProductRequestHistoryQuery] = useState({ product: '', startDate: '', endDate: '' });
  const [productRequestHistoryResult, setProductRequestHistoryResult] = useState<ProductRequestHistoryItem[] | null>(null);
  const [productRequestHistoryLoading, setProductRequestHistoryLoading] = useState(false);
  const [productRequestHistoryError, setProductRequestHistoryError] = useState<string | null>(null);

  // States for "Gasto por Categoría de Producto" query
  const [categoryExpenseQuery, setCategoryExpenseQuery] = useState({ category: '', startDate: '', endDate: '' });
  const [categoryExpenseResult, setCategoryExpenseResult] = useState<CategoryExpenseResult | null>(null);
  const [categoryExpenseLoading, setCategoryExpenseLoading] = useState(false);
  const [categoryExpenseError, setCategoryExpenseError] = useState<string | null>(null);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return "todos los tiempos";
    const start = startDate ? format(parseISO(startDate), 'dd/MM/yy', { locale: es }) : 'inicio';
    const end = endDate ? format(parseISO(endDate), 'dd/MM/yy', { locale: es }) : 'hoy';
    return `${start} - ${end}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: orders } = await supabase.from('ordencompra').select('neto_a_pagar, solicitud_compra_id, solicitudcompra!ordencompra_solicitud_compra_id_fkey(id, departamento_id, departamento!inner(id, nombre))').eq('estado', 'Completada').returns<OrderWithNestedInfo[]>();
        const expenses: { [key: string]: number } = {};
        (orders || []).forEach(order => {
          const deptName = order.solicitudcompra?.departamento?.nombre || 'Departamento Desconocido';
          expenses[deptName] = (expenses[deptName] || 0) + (order.neto_a_pagar || 0);
        });
        setDepartmentExpenses(Object.entries(expenses).map(([dept, total]) => ({ dept, total })).sort((a,b) => b.total - a.total));
        
         const { data: orderDetails } = await supabase.from('ordencompra_detalle').select('cantidad, producto:producto_id!inner(id, descripcion)').returns<any[]>();
        const orderProductsCount: { [key: string]: number } = {};
        (orderDetails || []).forEach(detail => {
            const productoData = detail.producto && (Array.isArray(detail.producto) ? detail.producto[0] : detail.producto);
            if (productoData?.descripcion) {
                orderProductsCount[productoData.descripcion] = (orderProductsCount[productoData.descripcion] || 0) + (detail.cantidad || 0);
            }
        });
        setTopOrderProducts(Object.entries(orderProductsCount).map(([product, quantity]) => ({ product, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5));
        
        const { data: requestDetails } = await supabase.from('solicitudcompra_detalle').select('cantidad, producto:producto_id!inner(id, descripcion)').returns<any[]>();
        const requestProductsCount: { [key: string]: number } = {};
        (requestDetails || []).forEach(detail => {
            const productoData = detail.producto && (Array.isArray(detail.producto) ? detail.producto[0] : detail.producto);
            if (productoData?.descripcion) {
                requestProductsCount[productoData.descripcion] = (requestProductsCount[productoData.descripcion] || 0) + (detail.cantidad || 0);
            }
        });
        setTopRequestProducts(Object.entries(requestProductsCount).map(([product, quantity]) => ({ product, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5));
        
        const { data: consumoData } = await supabase.from('consumo_historico_producto').select('cantidad_consumida, producto:producto_id(id, descripcion)').returns<any[]>();
        const consumedProductsCount: { [key: string]: number } = {};
        (consumoData || []).forEach(consumo => {
            const productoData = consumo.producto && (Array.isArray(consumo.producto) ? consumo.producto[0] : consumo.producto);
            if (productoData?.descripcion && consumo.cantidad_consumida > 0) {
                consumedProductsCount[productoData.descripcion] = (consumedProductsCount[productoData.descripcion] || 0) + consumo.cantidad_consumida;
            }
        });
        setTopConsumedProducts(Object.entries(consumedProductsCount).map(([product, quantity]) => ({ product, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5));

        const { data: metricasMensuales } = await supabase.from('metricas_producto_mensual').select('mes, gasto_total_producto');
        let formattedMonthlyExpenses: MonthlyTotalExpense[] = [];
        if (metricasMensuales && metricasMensuales.length > 0) {
            const monthlyAgg: { [key: string]: { gastoTotal: number, originalDate: Date } } = {};
            metricasMensuales.forEach(m => { const originalDate = parseISO(m.mes); const monthYearKey = format(originalDate, 'yyyy-MM'); if (!monthlyAgg[monthYearKey]) { monthlyAgg[monthYearKey] = { gastoTotal: 0, originalDate: startOfMonth(originalDate) }; } monthlyAgg[monthYearKey].gastoTotal += (m.gasto_total_producto || 0); });
            formattedMonthlyExpenses = Object.values(monthlyAgg).map(data => ({ mes: format(data.originalDate, 'MMM yyyy', { locale: es }), gastoTotal: data.gastoTotal, originalDate: data.originalDate })).sort((a, b) => a.originalDate.getTime() - b.originalDate.getTime());
        } else {
             const { data: ordenesParaMetricas } = await supabase.from('ordencompra').select('fecha_orden, neto_a_pagar').eq('estado', 'Completada');
             const monthlyData: { [key: string]: { gastoTotal: number, originalDate: Date } } = {};
             (ordenesParaMetricas || []).forEach(orden => { if (!orden.fecha_orden || !orden.neto_a_pagar) return; try { const originalDate = parseISO(orden.fecha_orden); const monthYearKey = format(originalDate, 'yyyy-MM'); if (!monthlyData[monthYearKey]) { monthlyData[monthYearKey] = { gastoTotal: 0, originalDate: startOfMonth(originalDate) }; } monthlyData[monthYearKey].gastoTotal += (orden.neto_a_pagar || 0); } catch (e) {} });
             formattedMonthlyExpenses = Object.values(monthlyData).map(data => ({ mes: format(data.originalDate, 'MMM yyyy', { locale: es }), gastoTotal: data.gastoTotal, originalDate: data.originalDate })).sort((a, b) => a.originalDate.getTime() - b.originalDate.getTime());
        }
        setMonthlyExpenses(formattedMonthlyExpenses);

        const { data: productList } = await supabase.from('producto').select('id, descripcion').order('descripcion');
        setAllProducts(productList || []);
        const { data: departmentList } = await supabase.from('departamento').select('id, nombre').order('nombre');
        setAllDepartments(departmentList || []);
        const { data: supplierList } = await supabase.from('proveedor').select('id, nombre').order('nombre');
        setAllSuppliers(supplierList || []);
        const { data: categoryList } = await supabase.from('categoria_producto').select('id, nombre').order('nombre');
        setAllProductCategories(categoryList || []);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error al obtener estadísticas detalladas:", errorMessage, err);
        setError("Error al cargar estadísticas detalladas: " + errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExpenseQuery = async () => {
    if (!expenseQuery.product) { setExpenseError("Por favor, seleccione un producto."); return; }
    setExpenseLoading(true); setExpenseError(null); setExpenseResult(null);
    try {
      let query = supabase.from('ordencompra_detalle')
        .select('cantidad, precio_unitario, ordencompra:ordencompra!inner(id, fecha_orden, estado)')
        .eq('producto_id', expenseQuery.product)
        .eq('ordencompra.estado', 'Completada');
      if (expenseQuery.startDate) query = query.gte('ordencompra.fecha_orden', expenseQuery.startDate);
      if (expenseQuery.endDate) query = query.lte('ordencompra.fecha_orden', expenseQuery.endDate);
      const { data, error } = await query;
      if (error) throw error;
      const totalSpent = data.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);
      const totalQuantity = data.reduce((acc, item) => acc + item.cantidad, 0);
      
      const ordersMap = new Map<number, { id: number; fecha_orden: string }>();
      data.forEach((item: any) => {
        const ordencompraData = Array.isArray(item.ordencompra) ? item.ordencompra[0] : item.ordencompra;
        if (ordencompraData && !ordersMap.has(ordencompraData.id)) {
            ordersMap.set(ordencompraData.id, {
                id: ordencompraData.id,
                fecha_orden: ordencompraData.fecha_orden,
            });
        }
      });
      const uniqueOrders = Array.from(ordersMap.values());

      setExpenseResult({ totalSpent, totalQuantity, orderCount: uniqueOrders.length, orders: uniqueOrders });
    } catch (err) { setExpenseError(err instanceof Error ? err.message : "Error al realizar la consulta.");
    } finally { setExpenseLoading(false); }
  };
  
  const handleConsumptionQuery = async () => {
    if (!consumptionQuery.product || !consumptionQuery.department) { setConsumptionError("Por favor, seleccione producto y departamento."); return; }
    setConsumptionLoading(true); setConsumptionError(null); setConsumptionResult(null);
    try {
      let query = supabase.from('consumo_historico_producto')
        .select('cantidad_consumida', { count: 'exact' })
        .eq('producto_id', consumptionQuery.product)
        .eq('departamento_id', consumptionQuery.department)
        .gt('cantidad_consumida', 0);
      if (consumptionQuery.startDate) query = query.gte('fecha_consumo', consumptionQuery.startDate);
      if (consumptionQuery.endDate) query = query.lte('fecha_consumo', consumptionQuery.endDate);
      const { data, error, count } = await query;
      if (error) throw error;
      const totalConsumed = data.reduce((acc, item) => acc + item.cantidad_consumida, 0);
      setConsumptionResult({ totalConsumed, requestCount: count || 0 });
    } catch (err) { setConsumptionError(err instanceof Error ? err.message : "Error al realizar la consulta.");
    } finally { setConsumptionLoading(false); }
  };
  
  const handlePriceHistoryQuery = async () => {
    if (!priceHistoryQuery.product) { setPriceHistoryError("Por favor, seleccione un producto."); return; }
    setPriceHistoryLoading(true); setPriceHistoryError(null); setPriceHistoryResult(null);
    try {
      const { data, error } = await supabase.from('ordencompra_detalle')
        .select('precio_unitario, ordencompra:ordencompra!inner(id, fecha_orden)')
        .eq('producto_id', priceHistoryQuery.product)
        .order('fecha_orden', { foreignTable: 'ordencompra', ascending: false });
      if (error) throw error;
      setPriceHistoryResult(data.map((d: any) => {
          const ordencompraData = Array.isArray(d.ordencompra) ? d.ordencompra[0] : d.ordencompra;
          return { orden_id: ordencompraData!.id, fecha_orden: ordencompraData!.fecha_orden, precio_unitario: d.precio_unitario };
      }));
    } catch (err) { setPriceHistoryError(err instanceof Error ? err.message : "Error al realizar la consulta.");
    } finally { setPriceHistoryLoading(false); }
  };

  const handleSupplierPerformanceQuery = async () => {
    if (!supplierPerformanceQuery.supplier) { setSupplierPerformanceError("Por favor, seleccione un proveedor."); return; }
    setSupplierPerformanceLoading(true); setSupplierPerformanceError(null); setSupplierPerformanceResult(null);
    try {
        let query = supabase.from('rendimiento_proveedor')
            .select('*')
            .eq('proveedor_id', supplierPerformanceQuery.supplier);
        if (supplierPerformanceQuery.startDate) query = query.gte('fecha_evaluacion', supplierPerformanceQuery.startDate);
        if (supplierPerformanceQuery.endDate) query = query.lte('fecha_evaluacion', supplierPerformanceQuery.endDate);

        const { data, error } = await query;
        if (error) throw error;
        if (data.length === 0) { setSupplierPerformanceResult({ avgQuality: 0, avgCompliance: 0, avgPrice: 0, avgCommunication: 0, avgDeliveryDaysDiff: 0, evaluationCount: 0 }); return; }

        const calcAvg = (field: keyof RendimientoProveedor) => data.reduce((acc, item) => acc + (Number(item[field]) || 0), 0) / data.length;
        const deliveryDiffs = data.map(item => (item.tiempo_entrega_real_dias || 0) - (item.tiempo_entrega_estimado_dias || 0));
        const avgDeliveryDaysDiff = deliveryDiffs.reduce((a, b) => a + b, 0) / deliveryDiffs.length;

        setSupplierPerformanceResult({
            avgQuality: calcAvg('calidad_producto_evaluacion'),
            avgCompliance: calcAvg('cumplimiento_pedido_evaluacion'),
            avgPrice: calcAvg('precio_competitividad_evaluacion'),
            avgCommunication: calcAvg('comunicacion_evaluacion'),
            avgDeliveryDaysDiff,
            evaluationCount: data.length,
        });
    } catch (err) { setSupplierPerformanceError(err instanceof Error ? err.message : "Error al realizar la consulta.");
    } finally { setSupplierPerformanceLoading(false); }
  };

  const handleProductRequestHistoryQuery = async () => {
    if (!productRequestHistoryQuery.product) { setProductRequestHistoryError("Por favor, seleccione un producto."); return; }
    setProductRequestHistoryLoading(true); setProductRequestHistoryError(null); setProductRequestHistoryResult(null);
    try {
        let query = supabase.from('solicitudcompra_detalle')
            .select('cantidad, solicitud:solicitud_compra_id!inner(id, fecha_solicitud, estado, empleado:empleado_id(nombre, apellido), departamento:departamento_id(nombre))')
            .eq('producto_id', productRequestHistoryQuery.product);
        if (productRequestHistoryQuery.startDate) query = query.gte('solicitud.fecha_solicitud', productRequestHistoryQuery.startDate);
        if (productRequestHistoryQuery.endDate) query = query.lte('solicitud.fecha_solicitud', productRequestHistoryQuery.endDate);
        const { data, error } = await query.order('fecha_solicitud', { foreignTable: 'solicitud', ascending: false });
        if (error) throw error;
        const result: ProductRequestHistoryItem[] = data.map((item: any) => {
            const solicitudData = Array.isArray(item.solicitud) ? item.solicitud[0] : item.solicitud;
            const empleadoData = solicitudData.empleado && (Array.isArray(solicitudData.empleado) ? solicitudData.empleado[0] : solicitudData.empleado);
            const departamentoData = solicitudData.departamento && (Array.isArray(solicitudData.departamento) ? solicitudData.departamento[0] : solicitudData.departamento);
            return {
                solicitud_id: solicitudData.id,
                fecha_solicitud: solicitudData.fecha_solicitud,
                cantidad: item.cantidad,
                estado: solicitudData.estado,
                solicitante: `${empleadoData?.nombre || ''} ${empleadoData?.apellido || ''}`.trim() || 'N/A',
                departamento: departamentoData?.nombre || 'N/A',
            };
        });
        setProductRequestHistoryResult(result);
    } catch (err) { setProductRequestHistoryError(err instanceof Error ? err.message : "Error al realizar la consulta.");
    } finally { setProductRequestHistoryLoading(false); }
  };

  const handleCategoryExpenseQuery = async () => {
    if (!categoryExpenseQuery.category) { setCategoryExpenseError("Por favor, seleccione una categoría."); return; }
    setCategoryExpenseLoading(true); setCategoryExpenseError(null); setCategoryExpenseResult(null);
    try {
        const { data: productIds, error: productIdsError } = await supabase.from('producto').select('id').eq('categoria_id', categoryExpenseQuery.category);
        if (productIdsError) throw productIdsError;
        if (productIds.length === 0) { setCategoryExpenseResult({ totalSpent: 0, orderCount: 0, topProducts: [] }); return; }
        
        const ids = productIds.map(p => p.id);
        let query = supabase.from('ordencompra_detalle')
            .select('cantidad, precio_unitario, producto:producto_id!inner(descripcion), ordencompra!inner(fecha_orden, estado)')
            .in('producto_id', ids)
            .eq('ordencompra.estado', 'Completada');
        if (categoryExpenseQuery.startDate) query = query.gte('ordencompra.fecha_orden', categoryExpenseQuery.startDate);
        if (categoryExpenseQuery.endDate) query = query.lte('ordencompra.fecha_orden', categoryExpenseQuery.endDate);
        
        const { data, error } = await query;
        if (error) throw error;

        const productExpenses: { [name: string]: number } = {};
        data.forEach((item: any) => {
            const total = item.cantidad * item.precio_unitario;
            const productoData = item.producto && (Array.isArray(item.producto) ? item.producto[0] : item.producto);
            const name = productoData!.descripcion;
            productExpenses[name] = (productExpenses[name] || 0) + total;
        });

        const totalSpent = Object.values(productExpenses).reduce((sum, val) => sum + val, 0);
        const topProducts = Object.entries(productExpenses).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, value]) => ({ name, value }));
        
        setCategoryExpenseResult({ totalSpent, orderCount: data.length, topProducts });
    } catch (err) { setCategoryExpenseError(err instanceof Error ? err.message : "Error al realizar la consulta.");
    } finally { setCategoryExpenseLoading(false); }
  };

  const inputClasses = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
  const buttonClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-300 dark:disabled:bg-primary-800";


  if (loading) return <LoadingSpinner message="Cargando estadísticas detalladas..." />;
  if (error) return <p className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</p>;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Consultas Específicas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Card: Gasto por Producto */}
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-3 flex flex-col">
            <h4 className="font-semibold text-gray-800 dark:text-white">Gasto por Producto</h4>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Producto</label><select value={expenseQuery.product} onChange={(e) => setExpenseQuery(p => ({...p, product: e.target.value}))} className={inputClasses}><option value="">Seleccionar...</option>{allProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Inicio</label><input type="date" value={expenseQuery.startDate} onChange={(e) => setExpenseQuery(p => ({...p, startDate: e.target.value}))} className={inputClasses}/></div><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Fin</label><input type="date" value={expenseQuery.endDate} onChange={(e) => setExpenseQuery(p => ({...p, endDate: e.target.value}))} className={inputClasses}/></div></div>
            <button onClick={handleExpenseQuery} disabled={expenseLoading} className={buttonClasses}><MagnifyingGlassIcon className="w-4 h-4 mr-2"/>Consultar Gasto</button>
            <div className="flex-grow">
              {expenseLoading ? <LoadingSpinner size="sm"/> : expenseError ? <p className="text-xs text-red-500">{expenseError}</p> : expenseResult && (
                <div className="text-sm bg-gray-100 dark:bg-gray-700/50 p-2 rounded mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Resultados para {formatDateRange(expenseQuery.startDate, expenseQuery.endDate)}:</p>
                  <p>Total Gastado: <strong>{expenseResult.totalSpent.toLocaleString('es-VE')} Bs.</strong> en {expenseResult.totalQuantity} uds.</p>
                  {expenseResult.orders.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <h5 className="text-xs font-semibold">Órdenes ({expenseResult.orderCount}):</h5>
                          <ul className="text-xs list-disc list-inside max-h-24 overflow-y-auto space-y-1">
                              {expenseResult.orders.map(order => (
                                  <li key={order.id}>
                                      Orden #{order.id} - {format(parseISO(order.fecha_orden), 'dd/MM/yy', { locale: es })}
                                  </li>
                              ))}
                          </ul>
                      </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No se encontraron órdenes para este producto en el período seleccionado.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card: Consumo por Departamento */}
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-3 flex flex-col">
            <h4 className="font-semibold text-gray-800 dark:text-white">Consumo por Departamento</h4>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Producto</label><select value={consumptionQuery.product} onChange={(e) => setConsumptionQuery(p => ({...p, product: e.target.value}))} className={inputClasses}><option value="">Seleccionar...</option>{allProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}</select></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Departamento</label><select value={consumptionQuery.department} onChange={(e) => setConsumptionQuery(p => ({...p, department: e.target.value}))} className={inputClasses}><option value="">Seleccionar...</option>{allDepartments.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Inicio</label><input type="date" value={consumptionQuery.startDate} onChange={(e) => setConsumptionQuery(p => ({...p, startDate: e.target.value}))} className={inputClasses}/></div><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Fin</label><input type="date" value={consumptionQuery.endDate} onChange={(e) => setConsumptionQuery(p => ({...p, endDate: e.target.value}))} className={inputClasses}/></div></div>
            <button onClick={handleConsumptionQuery} disabled={consumptionLoading} className={buttonClasses}><MagnifyingGlassIcon className="w-4 h-4 mr-2"/>Consultar Consumo</button>
            <div className="flex-grow">{consumptionLoading ? <LoadingSpinner size="sm"/> : consumptionError ? <p className="text-xs text-red-500">{consumptionError}</p> : consumptionResult && <div className="text-sm bg-gray-100 dark:bg-gray-700/50 p-2 rounded mt-2"><p className="text-xs text-gray-500 dark:text-gray-400">Resultados para {formatDateRange(consumptionQuery.startDate, consumptionQuery.endDate)}:</p><p>Total Consumido: <strong>{consumptionResult.totalConsumed} uds.</strong> en {consumptionResult.requestCount} registros.</p></div>}</div>
          </div>
          
          {/* Card: Historial de Precios */}
           <div className="p-4 border dark:border-gray-700 rounded-lg space-y-3 flex flex-col">
            <h4 className="font-semibold text-gray-800 dark:text-white">Historial de Precios</h4>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Producto</label><select value={priceHistoryQuery.product} onChange={(e) => setPriceHistoryQuery(p => ({...p, product: e.target.value}))} className={inputClasses}><option value="">Seleccionar...</option>{allProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}</select></div>
            <button onClick={handlePriceHistoryQuery} disabled={priceHistoryLoading} className={buttonClasses}><MagnifyingGlassIcon className="w-4 h-4 mr-2"/>Consultar Precios</button>
            <div className="flex-grow">{priceHistoryLoading ? <LoadingSpinner size="sm"/> : priceHistoryError ? <p className="text-xs text-red-500">{priceHistoryError}</p> : priceHistoryResult && <div className="text-sm bg-gray-100 dark:bg-gray-700/50 p-2 rounded mt-2 max-h-40 overflow-y-auto"><ul className="space-y-1">{priceHistoryResult.length > 0 ? priceHistoryResult.map((item, i) => (<li key={i}>{format(parseISO(item.fecha_orden), 'dd/MM/yy', { locale: es })}: <strong>{item.precio_unitario.toLocaleString('es-VE')} Bs.</strong> (Orden #{item.orden_id})</li>)) : <li>No hay historial de precios.</li>}</ul></div>}</div>
          </div>

           {/* Card: Rendimiento de Proveedor */}
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-3 flex flex-col">
            <h4 className="font-semibold text-gray-800 dark:text-white flex items-center"><ShieldCheckIcon className="w-5 h-5 mr-2 text-blue-500"/>Rendimiento de Proveedor</h4>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Proveedor</label><select value={supplierPerformanceQuery.supplier} onChange={(e) => setSupplierPerformanceQuery(p => ({...p, supplier: e.target.value}))} className={inputClasses}><option value="">Seleccionar...</option>{allSuppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Inicio</label><input type="date" value={supplierPerformanceQuery.startDate} onChange={(e) => setSupplierPerformanceQuery(p => ({...p, startDate: e.target.value}))} className={inputClasses}/></div><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Fin</label><input type="date" value={supplierPerformanceQuery.endDate} onChange={(e) => setSupplierPerformanceQuery(p => ({...p, endDate: e.target.value}))} className={inputClasses}/></div></div>
            <button onClick={handleSupplierPerformanceQuery} disabled={supplierPerformanceLoading} className={buttonClasses}><MagnifyingGlassIcon className="w-4 h-4 mr-2"/>Consultar Rendimiento</button>
            <div className="flex-grow">{supplierPerformanceLoading ? <LoadingSpinner size="sm"/> : supplierPerformanceError ? <p className="text-xs text-red-500">{supplierPerformanceError}</p> : supplierPerformanceResult && <div className="text-sm bg-gray-100 dark:bg-gray-700/50 p-2 rounded mt-2"><p className="text-xs text-gray-500 dark:text-gray-400">Resultados para {formatDateRange(supplierPerformanceQuery.startDate, supplierPerformanceQuery.endDate)} ({supplierPerformanceResult.evaluationCount} evaluac.):</p><ul className="text-xs list-disc list-inside"><li>Calidad: {supplierPerformanceResult.avgQuality.toFixed(2)}/5</li><li>Cumplimiento: {supplierPerformanceResult.avgCompliance.toFixed(2)}/5</li><li>Precio: {supplierPerformanceResult.avgPrice.toFixed(2)}/5</li><li>Comunicación: {supplierPerformanceResult.avgCommunication.toFixed(2)}/5</li><li>Desv. Entrega: {supplierPerformanceResult.avgDeliveryDaysDiff.toFixed(1)} días</li></ul></div>}</div>
          </div>

          {/* Card: Historial de Solicitudes por Producto */}
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-3 flex flex-col">
            <h4 className="font-semibold text-gray-800 dark:text-white flex items-center"><DocumentTextIcon className="w-5 h-5 mr-2 text-green-500"/>Historial de Solicitudes por Producto</h4>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Producto</label><select value={productRequestHistoryQuery.product} onChange={(e) => setProductRequestHistoryQuery(p => ({...p, product: e.target.value}))} className={inputClasses}><option value="">Seleccionar...</option>{allProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Inicio</label><input type="date" value={productRequestHistoryQuery.startDate} onChange={(e) => setProductRequestHistoryQuery(p => ({...p, startDate: e.target.value}))} className={inputClasses}/></div><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Fin</label><input type="date" value={productRequestHistoryQuery.endDate} onChange={(e) => setProductRequestHistoryQuery(p => ({...p, endDate: e.target.value}))} className={inputClasses}/></div></div>
            <button onClick={handleProductRequestHistoryQuery} disabled={productRequestHistoryLoading} className={buttonClasses}><MagnifyingGlassIcon className="w-4 h-4 mr-2"/>Consultar Historial</button>
            <div className="flex-grow">{productRequestHistoryLoading ? <LoadingSpinner size="sm"/> : productRequestHistoryError ? <p className="text-xs text-red-500">{productRequestHistoryError}</p> : productRequestHistoryResult && <div className="text-sm bg-gray-100 dark:bg-gray-700/50 p-2 rounded mt-2 max-h-48 overflow-y-auto"><p className="text-xs text-gray-500 dark:text-gray-400">Resultados para {formatDateRange(productRequestHistoryQuery.startDate, productRequestHistoryQuery.endDate)}:</p><ul className="space-y-1 text-xs">{productRequestHistoryResult.length > 0 ? productRequestHistoryResult.map(r => (<li key={r.solicitud_id}>{format(parseISO(r.fecha_solicitud), 'dd/MM/yy')}: {r.solicitante} pidió {r.cantidad} uds. ({r.estado})</li>)) : <li>No hay historial de solicitudes.</li>}</ul></div>}</div>
          </div>
          
          {/* Card: Gasto por Categoría de Producto */}
          <div className="p-4 border dark:border-gray-700 rounded-lg space-y-3 flex flex-col">
            <h4 className="font-semibold text-gray-800 dark:text-white flex items-center"><TagIcon className="w-5 h-5 mr-2 text-purple-500"/>Gasto por Categoría</h4>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Categoría</label><select value={categoryExpenseQuery.category} onChange={(e) => setCategoryExpenseQuery(p => ({...p, category: e.target.value}))} className={inputClasses}><option value="">Seleccionar...</option>{allProductCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Inicio</label><input type="date" value={categoryExpenseQuery.startDate} onChange={(e) => setCategoryExpenseQuery(p => ({...p, startDate: e.target.value}))} className={inputClasses}/></div><div><label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha Fin</label><input type="date" value={categoryExpenseQuery.endDate} onChange={(e) => setCategoryExpenseQuery(p => ({...p, endDate: e.target.value}))} className={inputClasses}/></div></div>
            <button onClick={handleCategoryExpenseQuery} disabled={categoryExpenseLoading} className={buttonClasses}><MagnifyingGlassIcon className="w-4 h-4 mr-2"/>Consultar Gasto</button>
            <div className="flex-grow">{categoryExpenseLoading ? <LoadingSpinner size="sm"/> : categoryExpenseError ? <p className="text-xs text-red-500">{categoryExpenseError}</p> : categoryExpenseResult && <div className="text-sm bg-gray-100 dark:bg-gray-700/50 p-2 rounded mt-2"><p className="text-xs text-gray-500 dark:text-gray-400">Resultados para {formatDateRange(categoryExpenseQuery.startDate, categoryExpenseQuery.endDate)}:</p><p>Total Gastado: <strong>{categoryExpenseResult.totalSpent.toLocaleString('es-VE')} Bs.</strong></p>{categoryExpenseResult.topProducts.length > 0 && <details className="text-xs mt-1"><summary className="cursor-pointer">Top productos</summary><ul className="list-disc list-inside">{categoryExpenseResult.topProducts.map(p => <li key={p.name}>{p.name}: {p.value.toLocaleString('es-VE')} Bs.</li>)}</ul></details>}</div>}</div>
          </div>

        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Gastos por Departamento (Órdenes Completadas)</h3>
          {departmentExpenses.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentExpenses} margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} className="dark:stroke-gray-600"/>
                <XAxis dataKey="dept" tick={{ fill: '#6b7280', fontSize: 12 }} className="dark:fill-gray-400" />
                <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}k`} tick={{ fill: '#6b7280', fontSize: 12 }} className="dark:fill-gray-400"/>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}/>
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="total" name="Gasto Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de gastos por departamento.</p>}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Productos en Órdenes (Cantidad)</h3>
          {topOrderProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={topOrderProducts} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="quantity" nameKey="product" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {topOrderProducts.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString('es-VE')} unidades`} /> <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de productos en órdenes.</p>}
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"> 
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Productos en Solicitudes (Cantidad)</h3>
          {topRequestProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topRequestProducts} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} className="dark:stroke-gray-600"/>
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} className="dark:fill-gray-400"/>
                  <YAxis dataKey="product" type="category" width={100} tick={{ fill: '#6b7280', fontSize: 12,  }} className="dark:fill-gray-400 truncate"/>
                  <Tooltip content={<CustomQuantityTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}/>
                  <Legend wrapperStyle={{ fontSize: '12px' }}/>
                  <Bar dataKey="quantity" name="Cantidad Solicitada" fill="#82ca9d" radius={[0, 4, 4, 0]} barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de productos en solicitudes.</p>}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Productos Consumidos (Cantidad)</h3>
          {topConsumedProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                      <Pie data={topConsumedProducts} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#FF8042" dataKey="quantity" nameKey="product" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {topConsumedProducts.map((_, index) => (<Cell key={`cell-consumed-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toLocaleString('es-VE')} unidades`} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
              </ResponsiveContainer>
          ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de consumo de productos. Registre salidas de inventario para ver esta gráfica.</p>}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tendencia de Gasto Mensual (Órdenes Completadas)</h3>
          {monthlyExpenses.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyExpenses} margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} className="dark:stroke-gray-600"/>
                      <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 12 }} className="dark:fill-gray-400"/>
                      <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}k`} tick={{ fill: '#6b7280', fontSize: 12 }} className="dark:fill-gray-400"/>
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FF5733', strokeWidth: 1, fill: 'rgba(255, 87, 51, 0.05)' }}/>
                      <Legend wrapperStyle={{ fontSize: '12px' }}/>
                      <Line type="monotone" dataKey="gastoTotal" name="Gasto Total Mensual" stroke="#FF5733" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
              </ResponsiveContainer>
          ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de gasto mensual para mostrar. Complete órdenes para ver esta tendencia.</p>}
        </div>

      </div>
    </>
  );
};

export default DetailedStats;