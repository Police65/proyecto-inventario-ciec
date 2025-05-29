
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LoadingSpinner from '../core/LoadingSpinner';
import { OrdenCompra, OrdenCompraDetalle, SolicitudCompra, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType } from '../../types'; // Import necessary types

interface DepartmentExpense {
  dept: string;
  total: number;
}

interface ProductFrequency {
  product: string;
  quantity: number;
}


type OrderWithNestedInfo = Pick<OrdenCompra, 'neto_a_pagar'> & {
  solicitudcompra: Pick<SolicitudCompra, 'id'> & { 
    departamento: Pick<Departamento, 'id' | 'nombre'>; 
  }; 
};


type OrderDetailWithProductInfo = Pick<OrdenCompraDetalle, 'cantidad'> & {
  producto: Pick<Producto, 'id' | 'descripcion'>; 
};


type RequestDetailWithProductInfo = Pick<SolicitudCompraDetalleType, 'cantidad'> & {
  producto: Pick<Producto, 'id' | 'descripcion'>; 
};


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-700 p-2 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
        <p className="label text-sm text-gray-800 dark:text-gray-200">{`${label} : ${payload[0].value.toLocaleString('es-VE', { style: 'currency', currency: 'VES' })}`}</p>
      </div>
    );
  }
  return null;
};

const DetailedStats: React.FC = () => {
  const [departmentExpenses, setDepartmentExpenses] = useState<DepartmentExpense[]>([]);
  const [topOrderProducts, setTopOrderProducts] = useState<ProductFrequency[]>([]);
  const [topRequestProducts, setTopRequestProducts] = useState<ProductFrequency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: orders, error: ordersError } = await supabase
          .from('ordencompra')
          .select('neto_a_pagar, solicitudcompra!ordencompra_solicitud_compra_id_fkey!inner(id, departamento!inner(id, nombre))')
          .returns<OrderWithNestedInfo[]>();
        if (ordersError) {
          console.error("Error fetching orders for stats:", ordersError.message, ordersError.details, ordersError.code, ordersError);
          throw new Error(`Error en consulta de órdenes: ${ordersError.message}`);
        }

        const expenses: { [key: string]: number } = {};
        (orders || []).forEach(order => {
          const deptName = order.solicitudcompra.departamento.nombre;
          expenses[deptName] = (expenses[deptName] || 0) + (order.neto_a_pagar || 0);
        });
        setDepartmentExpenses(Object.entries(expenses).map(([dept, total]) => ({ dept, total })).sort((a,b) => b.total - a.total));

        const { data: orderDetails, error: orderDetailsError } = await supabase
          .from('ordencompra_detalle')
          .select('cantidad, producto:producto_id!inner(id, descripcion)')
          .returns<OrderDetailWithProductInfo[]>(); // Use stricter type
        if (orderDetailsError) {
          console.error("Error fetching order details for stats:", orderDetailsError.message, orderDetailsError.details, orderDetailsError.code, orderDetailsError);
          throw new Error(`Error en consulta de detalles de orden: ${orderDetailsError.message}`);
        }
        
        const orderProductsCount: { [key: string]: number } = {};
        (orderDetails || []).forEach(detail => {
           orderProductsCount[detail.producto.descripcion] = (orderProductsCount[detail.producto.descripcion] || 0) + (detail.cantidad || 0);
        });
        setTopOrderProducts(
          Object.entries(orderProductsCount)
            .map(([product, quantity]) => ({ product, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5) 
        );

        const { data: requestDetails, error: requestDetailsError } = await supabase
          .from('solicitudcompra_detalle')
          .select('cantidad, producto:producto_id!inner(id, descripcion)')
          .returns<RequestDetailWithProductInfo[]>(); // Use stricter type
        if (requestDetailsError) {
          console.error("Error fetching request details for stats:", requestDetailsError.message, requestDetailsError.details, requestDetailsError.code, requestDetailsError);
          throw new Error(`Error en consulta de detalles de solicitud: ${requestDetailsError.message}`);
        }

        const requestProductsCount: { [key: string]: number } = {};
         (requestDetails || []).forEach(detail => {

            requestProductsCount[detail.producto.descripcion] = (requestProductsCount[detail.producto.descripcion] || 0) + (detail.cantidad || 0);
        });
        setTopRequestProducts(
          Object.entries(requestProductsCount)
            .map(([product, quantity]) => ({ product, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5) 
        );

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching detailed stats:", errorMessage, err);
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Gastos por Departamento (Bs)</h3>
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Productos en Órdenes</h3>
        {topOrderProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={topOrderProducts}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="quantity"
                nameKey="product"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {topOrderProducts.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value} unidades`} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de productos en órdenes.</p>}
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md lg:col-span-2"> 
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 5 Productos en Solicitudes</h3>
         {topRequestProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topRequestProducts} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} className="dark:stroke-gray-600"/>
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} className="dark:fill-gray-400"/>
                <YAxis dataKey="product" type="category" width={100} tick={{ fill: '#6b7280', fontSize: 12,  }} className="dark:fill-gray-400 truncate"/>
                <Tooltip formatter={(value: number) => `${value} unidades`} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}/>
                <Legend wrapperStyle={{ fontSize: '12px' }}/>
                <Bar dataKey="quantity" name="Cantidad Solicitada" fill="#82ca9d" radius={[0, 4, 4, 0]} barSize={20}/>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de productos en solicitudes.</p>}
      </div>
    </div>
  );
};

export default DetailedStats;
