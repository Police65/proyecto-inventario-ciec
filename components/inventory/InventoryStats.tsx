
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ArchiveBoxIcon, ExclamationTriangleIcon, ShoppingCartIcon, ClockIcon, BanknotesIcon } from '@heroicons/react/24/outline';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string; // e.g., 'bg-blue-500'
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5 transform hover:scale-105 transition-transform duration-300">
    <div className="flex items-center">
      <div className={`p-3 rounded-full ${color} text-white mr-4`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);


const InventoryStats: React.FC = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { count: totalProducts, error: invError } = await supabase
          .from('inventario')
          .select('*', { count: 'exact', head: true });
        if (invError) throw invError;

        const { count: lowStockProducts, error: lowStockError } = await supabase
          .from('inventario')
          .select('*', { count: 'exact', head: true })
          .lt('existencias', 10); // Assuming low stock is less than 10
        if (lowStockError) throw lowStockError;
        
        const { data: ordersData, error: ordersError } = await supabase
          .from('ordencompra')
          .select('estado, neto_a_pagar');
        if (ordersError) throw ordersError;

        const totalOrders = ordersData?.length || 0;
        const pendingOrders = ordersData?.filter(order => order.estado === 'Pendiente').length || 0;
        const totalSpent = ordersData?.reduce((acc, order) => acc + (order.neto_a_pagar || 0), 0) || 0;

        setStats({
          totalProducts: totalProducts || 0,
          lowStockProducts: lowStockProducts || 0,
          totalOrders,
          pendingOrders,
          totalSpent,
        });
      } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        // Optionally set an error state to display to the user
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5 animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }


  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-8">
      <StatCard title="Productos en Inventario" value={stats.totalProducts} icon={ArchiveBoxIcon} color="bg-blue-500" />
      <StatCard title="Productos Bajo Stock (<10)" value={stats.lowStockProducts} icon={ExclamationTriangleIcon} color="bg-yellow-500" />
      <StatCard title="Órdenes Totales" value={stats.totalOrders} icon={ShoppingCartIcon} color="bg-green-500" />
      <StatCard title="Órdenes Pendientes" value={stats.pendingOrders} icon={ClockIcon} color="bg-red-500" />
      <StatCard title="Gasto Total (Bs)" value={stats.totalSpent.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} icon={BanknotesIcon} color="bg-purple-500" />
    </div>
  );
};

export default InventoryStats;