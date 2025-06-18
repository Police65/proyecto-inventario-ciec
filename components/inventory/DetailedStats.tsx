import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import LoadingSpinner from '../core/LoadingSpinner';
import { OrdenCompra, OrdenCompraDetalle, SolicitudCompra, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, ConsumoHistoricoProducto } from '../../types';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale/es';


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
  solicitudcompra: (Pick<SolicitudCompra, 'id'> & { // solicitudcompra can be null if direct order
    departamento: Pick<Departamento, 'id' | 'nombre'> | null; // departamento can be null if not joined properly
  }) | null;
};


type OrderDetailWithProductInfo = Pick<OrdenCompraDetalle, 'cantidad'> & {
  producto: Pick<Producto, 'id' | 'descripcion'> | null; // producto can be null
};

type RequestDetailWithProductInfo = Pick<SolicitudCompraDetalleType, 'cantidad'> & {
  producto: Pick<Producto, 'id' | 'descripcion'> | null; // producto can be null
};

type ConsumoHistoricoWithProduct = ConsumoHistoricoProducto & {
    producto: Pick<Producto, 'id' | 'descripcion'> | null;
};

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
  const [departmentExpenses, setDepartmentExpenses] = useState<DepartmentExpense[]>([]);
  const [topOrderProducts, setTopOrderProducts] = useState<ProductFrequency[]>([]);
  const [topRequestProducts, setTopRequestProducts] = useState<ProductFrequency[]>([]);
  const [topConsumedProducts, setTopConsumedProducts] = useState<ProductFrequency[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyTotalExpense[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Gastos por Departamento
        const { data: orders, error: ordersError } = await supabase
          .from('ordencompra')
          .select('neto_a_pagar, solicitud_compra_id, solicitudcompra!ordencompra_solicitud_compra_id_fkey(id, departamento_id, departamento!inner(id, nombre))')
          .eq('estado', 'Completada') // Solo órdenes completadas para gastos reales
          .returns<OrderWithNestedInfo[]>();

        if (ordersError) throw new Error(`Error en órdenes para gastos por depto: ${ordersError.message}`);
        
        const expenses: { [key: string]: number } = {};
        (orders || []).forEach(order => {
          const deptName = order.solicitudcompra?.departamento?.nombre || 'Departamento Desconocido'; // Handle direct orders or missing links
          expenses[deptName] = (expenses[deptName] || 0) + (order.neto_a_pagar || 0);
        });
        setDepartmentExpenses(Object.entries(expenses).map(([dept, total]) => ({ dept, total })).sort((a,b) => b.total - a.total));

        // Top Productos en Órdenes
        const { data: orderDetails, error: orderDetailsError } = await supabase
          .from('ordencompra_detalle')
          .select('cantidad, producto:producto_id!inner(id, descripcion)')
          .returns<OrderDetailWithProductInfo[]>();
        if (orderDetailsError) throw new Error(`Error en detalles de orden: ${orderDetailsError.message}`);
        const orderProductsCount: { [key: string]: number } = {};
        (orderDetails || []).forEach(detail => {
            if (detail.producto?.descripcion) {
                 orderProductsCount[detail.producto.descripcion] = (orderProductsCount[detail.producto.descripcion] || 0) + (detail.cantidad || 0);
            }
        });
        setTopOrderProducts(
          Object.entries(orderProductsCount).map(([product, quantity]) => ({ product, quantity }))
            .sort((a, b) => b.quantity - a.quantity).slice(0, 5) 
        );

        // Top Productos en Solicitudes
        const { data: requestDetails, error: requestDetailsError } = await supabase
          .from('solicitudcompra_detalle')
          .select('cantidad, producto:producto_id!inner(id, descripcion)')
          .returns<RequestDetailWithProductInfo[]>();
        if (requestDetailsError) throw new Error(`Error en detalles de solicitud: ${requestDetailsError.message}`);
        const requestProductsCount: { [key: string]: number } = {};
         (requestDetails || []).forEach(detail => {
            if (detail.producto?.descripcion) {
                requestProductsCount[detail.producto.descripcion] = (requestProductsCount[detail.producto.descripcion] || 0) + (detail.cantidad || 0);
            }
        });
        setTopRequestProducts(
          Object.entries(requestProductsCount).map(([product, quantity]) => ({ product, quantity }))
            .sort((a, b) => b.quantity - a.quantity).slice(0, 5) 
        );
        
        // Top Productos Consumidos
        const { data: consumoData, error: consumoError } = await supabase
            .from('consumo_historico_producto')
            .select('cantidad_consumida, producto:producto_id(id, descripcion)')
            .returns<ConsumoHistoricoWithProduct[]>();
        if (consumoError) throw new Error(`Error en consumo histórico: ${consumoError.message}`);
        const consumedProductsCount: { [key: string]: number } = {};
        (consumoData || []).forEach(consumo => {
            if (consumo.producto?.descripcion && consumo.cantidad_consumida > 0) { // Solo contar salidas positivas
                consumedProductsCount[consumo.producto.descripcion] = (consumedProductsCount[consumo.producto.descripcion] || 0) + consumo.cantidad_consumida;
            }
        });
        setTopConsumedProducts(
            Object.entries(consumedProductsCount).map(([product, quantity]) => ({ product, quantity }))
                .sort((a, b) => b.quantity - a.quantity).slice(0, 5)
        );

        // Tendencias de Gasto Mensual (Gasto total en órdenes completadas)
        // Si metricas_producto_mensual se llena, usarla. Sino, calcular a partir de ordencompra.
        const { data: metricasMensuales, error: metricasError } = await supabase
            .from('metricas_producto_mensual')
            .select('mes, gasto_total_producto');
        
        let formattedMonthlyExpenses: MonthlyTotalExpense[] = [];
        if (!metricasError && metricasMensuales && metricasMensuales.length > 0) {
            const monthlyAgg: { [key: string]: { gastoTotal: number, originalDate: Date } } = {};
            metricasMensuales.forEach(m => {
                const originalDate = parseISO(m.mes);
                const monthYearKey = format(originalDate, 'yyyy-MM'); // Usar yyyy-MM para agrupar correctamente
                if (!monthlyAgg[monthYearKey]) {
                    monthlyAgg[monthYearKey] = { gastoTotal: 0, originalDate: startOfMonth(originalDate) };
                }
                monthlyAgg[monthYearKey].gastoTotal += (m.gasto_total_producto || 0);
            });
            formattedMonthlyExpenses = Object.values(monthlyAgg)
                .map(data => ({ mes: format(data.originalDate, 'MMM yyyy', { locale: es }), gastoTotal: data.gastoTotal, originalDate: data.originalDate }))
                .sort((a, b) => a.originalDate.getTime() - b.originalDate.getTime());

        } else { // Fallback: Calcular desde ordencompra
            console.warn("No se encontraron datos en metricas_producto_mensual o hubo un error. Calculando desde ordencompra.");
            const { data: ordenesParaMetricas, error: ordenesMetricasError } = await supabase
              .from('ordencompra')
              .select('fecha_orden, neto_a_pagar')
              .eq('estado', 'Completada');
            if (ordenesMetricasError) throw new Error(`Error en órdenes para métricas: ${ordenesMetricasError.message}`);
            
            const monthlyData: { [key: string]: { gastoTotal: number, originalDate: Date } } = {};
            (ordenesParaMetricas || []).forEach(orden => {
                if (!orden.fecha_orden || !orden.neto_a_pagar) return;
                try {
                    const originalDate = parseISO(orden.fecha_orden);
                    const monthYearKey = format(originalDate, 'yyyy-MM');
                    if (!monthlyData[monthYearKey]) {
                        monthlyData[monthYearKey] = { gastoTotal: 0, originalDate: startOfMonth(originalDate) };
                    }
                    monthlyData[monthYearKey].gastoTotal += (orden.neto_a_pagar || 0);
                } catch (dateError) {
                    console.error("Error al parsear fecha_orden:", orden.fecha_orden, dateError);
                }
            });
            formattedMonthlyExpenses = Object.values(monthlyData)
                .map(data => ({ mes: format(data.originalDate, 'MMM yyyy', { locale: es }), gastoTotal: data.gastoTotal, originalDate: data.originalDate }))
                .sort((a, b) => a.originalDate.getTime() - b.originalDate.getTime());
        }
        setMonthlyExpenses(formattedMonthlyExpenses);

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

  if (loading) return <LoadingSpinner message="Cargando estadísticas detalladas..." />;
  if (error) return <p className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</p>;

  return (
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
  );
};

export default DetailedStats;