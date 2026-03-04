
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ArchiveBoxIcon, ExclamationTriangleIcon, ShoppingCartIcon, ClockIcon, BanknotesIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { OrdenCompraEstado } from '../../types';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, onClick, description }) => (
  <button
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 shadow-md border border-slate-100 dark:border-slate-800 rounded-2xl p-4 transform transition-all duration-300 text-left w-full relative overflow-hidden group
      ${onClick ? 'hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] cursor-pointer' : 'cursor-default'}
    `}
  >
    <div className="flex items-center space-x-3 relative z-10">
      <div className={`p-2.5 rounded-xl ${color} text-white shadow-sm self-center transition-all duration-500 group-hover:scale-110`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-tight mb-0.5">{title}</p>
        <p className="text-xl font-display font-black text-slate-900 dark:text-white tabular-nums tracking-tight leading-none">{value}</p>
      </div>
    </div>
    {onClick && (
      <div className="mt-3 pt-2.5 border-t border-slate-50 dark:border-slate-800/50 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400 relative z-10">
        <span>{description || 'Ver más'}</span>
        <ArrowRightIcon className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
      </div>
    )}
  </button>
);


const InventoryStats: React.FC = () => {
  const navigate = useNavigate();
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

        // Consultamos productos con bajo stock comparando existencias vs stock_minimo del producto
        const { data: lowStockData, error: lowStockError } = await supabase
          .from('inventario')
          .select('existencias, producto:producto_id(stock_minimo)');

        if (lowStockError) throw lowStockError;

        const lowStockCount = (lowStockData as any[] || []).filter(item =>
          item.producto?.stock_minimo !== null &&
          item.existencias !== null &&
          item.existencias < item.producto.stock_minimo
        ).length;

        const { data: ordersData, error: ordersError } = await supabase
          .from('ordencompra')
          .select('estado, neto_a_pagar')
          .returns<{ estado: OrdenCompraEstado, neto_a_pagar: number | null }[]>();
        if (ordersError) throw ordersError;

        const totalOrders = ordersData?.length || 0;
        const pendingOrders = ordersData?.filter(order => order.estado === 'Pendiente').length || 0;
        const totalSpent = ordersData?.reduce((acc, order) => acc + (order.neto_a_pagar || 0), 0) || 0;

        setStats({
          totalProducts: totalProducts || 0,
          lowStockProducts: lowStockCount,
          totalOrders,
          pendingOrders,
          totalSpent,
        });
      } catch (error) {
        console.error('Error al obtener estadísticas:', error);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 animate-pulse h-[90px] flex flex-col justify-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-8">
      <StatCard
        title="Productos en Inventario"
        value={stats.totalProducts}
        icon={ArchiveBoxIcon}
        color="bg-blue-500"
        onClick={() => navigate('/inventory/view')}
        description="Ver listado completo"
      />
      <StatCard
        title="Productos Bajo Stock"
        value={stats.lowStockProducts}
        icon={ExclamationTriangleIcon}
        color="bg-yellow-500"
        onClick={() => navigate('/inventory/view', { state: { filterLowStock: true } })}
        description="Ver críticos"
      />
      <StatCard
        title="Órdenes Totales"
        value={stats.totalOrders}
        icon={ShoppingCartIcon}
        color="bg-green-500"
        onClick={() => navigate('/solicitudes', { state: { tab: 'ordenes' } })}
        description="Ver historial"
      />
      <StatCard
        title="Órdenes Pendientes"
        value={stats.pendingOrders}
        icon={ClockIcon}
        color="bg-red-500"
        onClick={() => navigate('/solicitudes', { state: { tab: 'ordenes', filterPending: true } })}
        description="Gestionar pendientes"
      />
      <StatCard
        title="Gasto Total (Bs)"
        value={stats.totalSpent.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        icon={BanknotesIcon}
        color="bg-purple-500"
        onClick={() => navigate('/inventory/stats')}
        description="Ver analíticas"
      />
    </div>
  );
};

export default InventoryStats;
