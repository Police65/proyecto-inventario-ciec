
import React, { useState, useEffect, useCallback, useMemo } from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Inventario, SolicitudCompra, ProductoRezagado, UserProfile, Departamento, SolicitudCompraEstado, SolicitudCompraDetalle as SolicitudCompraDetalleType, Producto, OrdenCompra, Proveedor } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import RequestTable from '../components/requests/RequestTable';
import RequestDetailsModal from '../components/requests/RequestDetailsModal';
import OrderDetailsModal from '../components/orders/OrderDetailsModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import { 
    CheckCircleIcon, XCircleIcon, ListBulletIcon, ShoppingCartIcon, ArchiveBoxIcon, BanknotesIcon, BuildingOffice2Icon, BuildingStorefrontIcon, UsersIcon, ClipboardDocumentListIcon, ArrowRightIcon, ChartPieIcon, ClockIcon, AdjustmentsHorizontalIcon, DocumentTextIcon, ChevronLeftIcon, ChevronRightIcon
} from '@heroicons/react/24/outline';

interface HomePageContext {
  userProfile: UserProfile;
  setActiveUITab: (tab: string) => void; 
  setHasInteracted: (interacted: boolean) => void; 
}

interface DepartmentStatsRow {
  id: number;
  nombre: string;
  sol_pendientes: number;
  sol_aprobadas: number;
  sol_rechazadas: number;
  gasto_total: number;
}

interface OverallSystemStats {
  pendingRequests: number;
  totalOrders: number;
  completedOrdersValue: number;
  activeSuppliers: number;
}

interface RecentRequestSummary extends Pick<SolicitudCompra, 'id' | 'descripcion' | 'estado' | 'fecha_solicitud'> {
  solicitante_nombre?: string;
  departamento_nombre?: string;
  fullRequestData?: SolicitudCompra; 
}

interface RecentOrderSummary extends Pick<OrdenCompra, 'id' | 'fecha_orden' | 'estado' | 'neto_a_pagar' | 'unidad'> {
  proveedor_nombre?: string;
  fullOrderData?: OrdenCompra;
}

interface RequestStatusChartData {
  name: SolicitudCompraEstado;
  value: number;
}

const COLORS_PIE = ['#FFBB28', '#00C49F', '#FF8042']; 
const PAGE_SIZE = 6;

const StatCard: React.FC<{ title: string; value: string | number; icon?: React.ElementType; colorClass?: string; onClick?: () => void; ctaText?: string }> = ({ title, value, icon: Icon, colorClass = "bg-primary-500", onClick, ctaText }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`group bg-white dark:bg-gray-800 shadow-lg rounded-xl p-5 transform transition-transform duration-300 w-full text-left
                ${onClick ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}
              `}
  >
    <div className="flex items-center">
      {Icon && <div className={`p-3 rounded-full ${colorClass} text-white mr-4`}><Icon className="w-7 h-7" /></div>}
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
    {onClick && ctaText && (
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-primary-600 dark:text-primary-400 font-medium group-hover:underline">
                {ctaText} <ArrowRightIcon className="w-3 h-3 inline ml-1 transform group-hover:translate-x-0.5 transition-transform" />
            </p>
        </div>
    )}
  </button>
);

const ProductList: React.FC<{ title: string; products: { producto_id: number; descripcion: string; total_cantidad: number; veces_solicitado: number}[]; icon: React.ElementType; iconColorClass: string }> = ({ title, products, icon: Icon, iconColorClass }) => (
  <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
    <div className="flex items-center mb-4">
      <Icon className={`w-6 h-6 ${iconColorClass} mr-3`} />
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
    </div>
    {products.length > 0 ? (
      <ul className="space-y-3 max-h-80 overflow-y-auto">
        {products.map(product => (
          <li key={product.producto_id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate" title={product.descripcion}>{product.descripcion}</span>
              <span className="text-sm text-primary-600 dark:text-primary-400 font-semibold">
                {product.total_cantidad} uds.
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Solicitado en {product.veces_solicitado} {product.veces_solicitado === 1 ? 'solicitud' : 'solicitudes'}</p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos para mostrar.</p>
    )}
  </div>
);

interface QuickNavButtonProps {
  title: string;
  icon: React.ElementType;
  onClick: () => void;
  color?: string;
}
const QuickNavButton: React.FC<QuickNavButtonProps> = ({ title, icon: Icon, onClick, color = "bg-primary-500 hover:bg-primary-600" }) => (
    <button
        onClick={onClick}
        className={`p-4 rounded-lg shadow-md text-white font-semibold text-center transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50 flex flex-col items-center justify-center min-h-[100px] ${color}`}
    >
        <Icon className="w-8 h-8 mb-2" />
        <span className="text-sm">{title}</span>
    </button>
);

const CustomBarChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-700 p-2 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
        <p className="label text-sm text-gray-800 dark:text-gray-200">{`${label} : ${payload[0].value.toLocaleString('es-VE', { style: 'currency', currency: 'VES' })}`}</p>
      </div>
    );
  }
  return null;
};

const CustomPieChartLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="10px" fontWeight="bold">
      {`${value} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({ currentPage, totalPages, onPageChange, itemName = "elementos" }) => {
  if (totalPages <= 1) return null;

  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };
  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="mt-3 flex items-center justify-between text-xs px-2">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        <ChevronLeftIcon className="w-3.5 h-3.5 mr-1" />
        Anterior
      </button>
      <span className="text-gray-700 dark:text-gray-300">
        Página {currentPage} de {totalPages}
      </span>
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        Siguiente
        <ChevronRightIcon className="w-3.5 h-3.5 ml-1" />
      </button>
    </div>
  );
};


const HomePage: React.FC = () => {
  const { userProfile, setActiveUITab, setHasInteracted } = useOutletContext<HomePageContext>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para ROL USUARIO
  const [userSummaryStats, setUserSummaryStats] = useState<{ total: number; aprobadas: number; rechazadas: number; pendientes: number }>({ total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0 });
  const [approvedProducts, setApprovedProducts] = useState<{ producto_id: number; descripcion: string; total_cantidad: number; veces_solicitado: number}[]>([]);
  const [rejectedProducts, setRejectedProducts] = useState<{ producto_id: number; descripcion: string; total_cantidad: number; veces_solicitado: number}[]>([]);

  // Estados para ROL ADMIN
  const [departmentalStats, setDepartmentalStats] = useState<DepartmentStatsRow[]>([]);
  const [overallSystemStats, setOverallSystemStats] = useState<OverallSystemStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequestSummary[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrderSummary[]>([]);
  const [requestStatusChartData, setRequestStatusChartData] = useState<RequestStatusChartData[]>([]);
  
  const [allAdminViewableRequests, setAllAdminViewableRequests] = useState<SolicitudCompra[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<SolicitudCompraEstado | 'Todas'>('Todas');

  const [selectedRequestDetail, setSelectedRequestDetail] = useState<SolicitudCompra | null>(null);
  const [showRequestDetailsModal, setShowRequestDetailsModal] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrdenCompra | null>(null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);

  // Estados de paginación para ADMIN
  const [currentPageDeptStats, setCurrentPageDeptStats] = useState(1);
  const [currentPageDeptRequests, setCurrentPageDeptRequests] = useState(1);
  const [currentPageRecentRequests, setCurrentPageRecentRequests] = useState(1);
  const [currentPageRecentOrders, setCurrentPageRecentOrders] = useState(1);


  const fetchAdminDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { count: pendingReqCount, error: prError } = await supabase.from('solicitudcompra').select('*', { count: 'exact', head: true }).eq('estado', 'Pendiente');
      const { count: totalOrdCount, error: toError } = await supabase.from('ordencompra').select('*', { count: 'exact', head: true });
      const { data: completedOrdersValData, error: covError } = await supabase.from('ordencompra').select('neto_a_pagar').eq('estado', 'Completada');
      const { count: activeSupCount, error: asError } = await supabase.from('proveedor').select('*', { count: 'exact', head: true }).eq('estado', 'activo');
      if (prError || toError || covError || asError) console.warn("Error fetching overall stats parts", {prError, toError, covError, asError});
      
      setOverallSystemStats({
        pendingRequests: pendingReqCount || 0,
        totalOrders: totalOrdCount || 0,
        completedOrdersValue: completedOrdersValData?.reduce((sum, o) => sum + (o.neto_a_pagar || 0), 0) || 0,
        activeSuppliers: activeSupCount || 0,
      });

      const { data: depts, error: deptsError } = await supabase.from('departamento').select('*');
      if (deptsError) throw deptsError;
      const statsPromises = (depts || []).map(async (dept: Departamento) => {
        const { count: pend } = await supabase.from('solicitudcompra').select('id', { count: 'exact', head: true }).match({ departamento_id: dept.id, estado: 'Pendiente' });
        const { count: aprob } = await supabase.from('solicitudcompra').select('id', { count: 'exact', head: true }).match({ departamento_id: dept.id, estado: 'Aprobada' });
        const { count: rech } = await supabase.from('solicitudcompra').select('id', { count: 'exact', head: true }).match({ departamento_id: dept.id, estado: 'Rechazada' });
        const { data: ordenesDept } = await supabase.from('ordencompra').select('neto_a_pagar, solicitud_compra_id!inner(departamento_id)').eq('solicitud_compra_id.departamento_id', dept.id).eq('estado', 'Completada');
        const gasto_total = ordenesDept?.reduce((sum, o) => sum + (o.neto_a_pagar || 0), 0) || 0;
        return { id: dept.id, nombre: dept.nombre, sol_pendientes: pend || 0, sol_aprobadas: aprob || 0, sol_rechazadas: rech || 0, gasto_total };
      });
      const calculatedDeptStats = await Promise.all(statsPromises);
      setDepartmentalStats(calculatedDeptStats.sort((a,b) => a.nombre.localeCompare(b.nombre)));

      const { data: allReqsForChart, error: chartReqsError } = await supabase.from('solicitudcompra').select('estado');
      if (chartReqsError) throw chartReqsError;
      const statusCounts = (allReqsForChart || []).reduce((acc, req) => {
        acc[req.estado] = (acc[req.estado] || 0) + 1;
        return acc;
      }, {} as Record<SolicitudCompraEstado, number>);
      setRequestStatusChartData([
        { name: 'Pendiente', value: statusCounts.Pendiente || 0 },
        { name: 'Aprobada', value: statusCounts.Aprobada || 0 },
        { name: 'Rechazada', value: statusCounts.Rechazada || 0 },
      ]);

      const { data: recentReqsData, error: recentReqsError } = await supabase
        .from('solicitudcompra')
        .select('*, empleado:empleado_id(id, nombre, apellido), departamento:departamento_id(id, nombre), detalles:solicitudcompra_detalle(id, cantidad, producto:producto_id(id, descripcion))')
        .order('fecha_solicitud', { ascending: false })
        .limit(20); // Fetch more for pagination demonstration
      if (recentReqsError) throw recentReqsError;
      setRecentRequests((recentReqsData || []).map(r => ({
        id: r.id, descripcion: r.descripcion, estado: r.estado, fecha_solicitud: r.fecha_solicitud,
        solicitante_nombre: `${r.empleado?.nombre || ''} ${r.empleado?.apellido || ''}`.trim() || 'N/A',
        departamento_nombre: r.departamento?.nombre || 'N/A',
        fullRequestData: r as SolicitudCompra 
      })));

      const { data: recentOrdsData, error: recentOrdsError } = await supabase
        .from('ordencompra')
        .select('*, proveedor:proveedor_id(id, nombre, rif, direccion), empleado:empleado_id(id, nombre, apellido), detalles:ordencompra_detalle(id, producto_id, cantidad, precio_unitario, producto:producto_id(id, descripcion)), solicitud_compra:solicitud_compra_id(id,descripcion,empleado_id)')
        .order('fecha_orden', { ascending: false })
        .limit(20); // Fetch more for pagination
      if (recentOrdsError) throw recentOrdsError;
       setRecentOrders((recentOrdsData || []).map(o => ({
        id: o.id, fecha_orden: o.fecha_orden, estado: o.estado, neto_a_pagar: o.neto_a_pagar, unidad: o.unidad,
        proveedor_nombre: o.proveedor?.nombre || 'N/A',
        fullOrderData: o as OrdenCompra 
      })));
      
      const { data: allRequestsData, error: allRequestsError } = await supabase
        .from('solicitudcompra')
        .select('*, empleado:empleado_id(id, nombre, apellido), departamento:departamento_id(id, nombre), detalles:solicitudcompra_detalle(id, cantidad, producto:producto_id(id, descripcion))')
        .order('fecha_solicitud', { ascending: false });
      if (allRequestsError) throw allRequestsError;
      setAllAdminViewableRequests((allRequestsData as SolicitudCompra[]) || []);

    } catch (err) {
      console.error("Error fetching admin dashboard data:", err);
      setError(err instanceof Error ? err.message : "Error desconocido al cargar datos del dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
     if (!userProfile?.empleado_id) {
        setError("Perfil de empleado no encontrado."); setLoading(false); return;
      }
    setLoading(true); setError(null);
    try {
        const { count: total } = await supabase.from('solicitudcompra').select('*', { count: 'exact', head: true }).eq('empleado_id', userProfile.empleado_id);
        const { count: aprobadas } = await supabase.from('solicitudcompra').select('*', { count: 'exact', head: true }).eq('empleado_id', userProfile.empleado_id).eq('estado', 'Aprobada');
        const { count: rechazadas } = await supabase.from('solicitudcompra').select('*', { count: 'exact', head: true }).eq('empleado_id', userProfile.empleado_id).eq('estado', 'Rechazada');
        const { count: pendientes } = await supabase.from('solicitudcompra').select('*', { count: 'exact', head: true }).eq('empleado_id', userProfile.empleado_id).eq('estado', 'Pendiente');
        setUserSummaryStats({ total: total || 0, aprobadas: aprobadas || 0, rechazadas: rechazadas || 0, pendientes: pendientes || 0 });

        const { data: approvedDetails } = await supabase.from('solicitudcompra_detalle').select('cantidad, producto:producto_id!inner(id, descripcion), solicitud:solicitud_compra_id!inner(empleado_id, estado)').eq('solicitud.empleado_id', userProfile.empleado_id).eq('solicitud.estado', 'Aprobada');
        const approvedProdMap: Map<number, { producto_id: number; descripcion: string; total_cantidad: number; veces_solicitado: number}> = new Map();
        (approvedDetails || []).forEach((d: any) => { 
            if(d.producto && d.producto.id) {
                const existing = approvedProdMap.get(d.producto.id);
                if (existing) { existing.total_cantidad += d.cantidad; existing.veces_solicitado +=1; } 
                else { approvedProdMap.set(d.producto.id, { producto_id: d.producto.id, descripcion: d.producto.descripcion, total_cantidad: d.cantidad, veces_solicitado: 1 }); }
            }
        });
        setApprovedProducts(Array.from(approvedProdMap.values()).sort((a,b) => b.total_cantidad - a.total_cantidad).slice(0,5));
        
        const { data: rejectedDetails } = await supabase.from('solicitudcompra_detalle').select('cantidad, producto:producto_id!inner(id, descripcion), solicitud:solicitud_compra_id!inner(empleado_id, estado)').eq('solicitud.empleado_id', userProfile.empleado_id).eq('solicitud.estado', 'Rechazada');
        const rejectedProdMap: Map<number, { producto_id: number; descripcion: string; total_cantidad: number; veces_solicitado: number}> = new Map();
         (rejectedDetails || []).forEach((d: any) => {
            if(d.producto && d.producto.id) {
                const existing = rejectedProdMap.get(d.producto.id);
                if (existing) { existing.total_cantidad += d.cantidad; existing.veces_solicitado +=1; }
                else { rejectedProdMap.set(d.producto.id, { producto_id: d.producto.id, descripcion: d.producto.descripcion, total_cantidad: d.cantidad, veces_solicitado: 1 }); }
            }
        });
        setRejectedProducts(Array.from(rejectedProdMap.values()).sort((a,b) => b.total_cantidad - a.total_cantidad).slice(0,5));
    } catch (err) {
      console.error("Error fetching user dashboard data:", err);
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally { setLoading(false); }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile.rol === 'admin') {
      fetchAdminDashboardData();
    } else if (userProfile.rol === 'usuario') {
      fetchUserData();
    }
  }, [userProfile, fetchAdminDashboardData, fetchUserData]);

  const handleNavigation = (path: string, tabKey?: string) => {
    setHasInteracted(true);
    if (tabKey) setActiveUITab(tabKey);
    navigate(path);
  };
  
  const handleRecentRequestClick = (reqSummary: RecentRequestSummary) => {
    if(reqSummary.fullRequestData) {
        setSelectedRequestDetail(reqSummary.fullRequestData);
        setShowRequestDetailsModal(true);
    }
  };
  const handleRecentOrderClick = (ordSummary: RecentOrderSummary) => {
    if(ordSummary.fullOrderData) {
        setSelectedOrderDetail(ordSummary.fullOrderData);
        setShowOrderDetailsModal(true);
    }
  };

  const handleDepartmentSelect = (deptId: number, deptName: string) => {
    setSelectedDepartmentId(deptId);
    setSelectedDepartmentName(deptName);
    setActiveStatusFilter('Todas'); 
    setCurrentPageDeptRequests(1); // Reset page for new selection
  };

  const handleDeptRequestFilterChange = (newFilter: SolicitudCompraEstado | 'Todas') => {
    setActiveStatusFilter(newFilter);
    setCurrentPageDeptRequests(1); // Reset page on filter change
  };
  
  // Paginación para Estadísticas por Departamento
  const totalPagesDeptStats = Math.ceil(departmentalStats.length / PAGE_SIZE);
  const paginatedDeptStats = useMemo(() => {
    const startIndex = (currentPageDeptStats - 1) * PAGE_SIZE;
    return departmentalStats.slice(startIndex, startIndex + PAGE_SIZE);
  }, [departmentalStats, currentPageDeptStats]);

  // Paginación para Solicitudes del Departamento
  const filteredDepartmentRequests = useMemo(() => {
    if (!selectedDepartmentId) return [];
    return allAdminViewableRequests.filter(req => 
      req.departamento_id === selectedDepartmentId &&
      (activeStatusFilter === 'Todas' || req.estado === activeStatusFilter)
    );
  }, [allAdminViewableRequests, selectedDepartmentId, activeStatusFilter]);

  const totalPagesDeptRequests = Math.ceil(filteredDepartmentRequests.length / PAGE_SIZE);
  const paginatedDeptRequests = useMemo(() => {
    const startIndex = (currentPageDeptRequests - 1) * PAGE_SIZE;
    return filteredDepartmentRequests.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredDepartmentRequests, currentPageDeptRequests]);
  
  // Paginación para Últimas Solicitudes
  const totalPagesRecentRequests = Math.ceil(recentRequests.length / PAGE_SIZE);
  const paginatedRecentRequests = useMemo(() => {
    const startIndex = (currentPageRecentRequests - 1) * PAGE_SIZE;
    return recentRequests.slice(startIndex, startIndex + PAGE_SIZE);
  }, [recentRequests, currentPageRecentRequests]);

  // Paginación para Últimas Órdenes
  const totalPagesRecentOrders = Math.ceil(recentOrders.length / PAGE_SIZE);
  const paginatedRecentOrders = useMemo(() => {
    const startIndex = (currentPageRecentOrders - 1) * PAGE_SIZE;
    return recentOrders.slice(startIndex, startIndex + PAGE_SIZE);
  }, [recentOrders, currentPageRecentOrders]);


  if (loading) return <LoadingSpinner message="Cargando datos del dashboard..." />;
  if (error) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;

  if (userProfile.rol === 'admin') {
    const topSpendingDepartments = [...departmentalStats].sort((a, b) => b.gasto_total - a.gasto_total).slice(0, 5);
    const filterButtonClasses = (filter: SolicitudCompraEstado | 'Todas') => 
        `px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-opacity-50 whitespace-nowrap ${
        activeStatusFilter === filter 
        ? 'bg-primary-600 text-white shadow-md focus:ring-primary-500' 
        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-gray-400'
    }`;

    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Administrativo</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Solicitudes Pendientes" value={overallSystemStats?.pendingRequests || 0} icon={ListBulletIcon} colorClass="bg-yellow-500" onClick={() => handleNavigation('/solicitudes', 'solicitudes')} ctaText="Ver Solicitudes"/>
          <StatCard title="Órdenes Generadas" value={overallSystemStats?.totalOrders || 0} icon={ArchiveBoxIcon} colorClass="bg-blue-500" onClick={() => handleNavigation('/solicitudes', 'ordenes')} ctaText="Ver Órdenes"/>
          <StatCard title="Gasto Total (Completadas)" value={`${overallSystemStats?.completedOrdersValue.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2}) || '0,00'} Bs.`} icon={BanknotesIcon} colorClass="bg-green-500" />
          <StatCard title="Proveedores Activos" value={overallSystemStats?.activeSuppliers || 0} icon={BuildingStorefrontIcon} colorClass="bg-indigo-500" onClick={() => handleNavigation('/inventory', 'add-provider')} ctaText="Gestionar Proveedores"/>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Accesos Rápidos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <QuickNavButton title="Gestionar Solicitudes" icon={AdjustmentsHorizontalIcon} onClick={() => handleNavigation('/solicitudes', 'solicitudes')} color="bg-sky-500 hover:bg-sky-600" />
                <QuickNavButton title="Historial Órdenes" icon={ClockIcon} onClick={() => handleNavigation('/solicitudes', 'ordenes')} color="bg-teal-500 hover:bg-teal-600" />
                <QuickNavButton title="Órdenes Consolidadas" icon={ArchiveBoxIcon} onClick={() => handleNavigation('/solicitudes', 'ordenes-consolidadas')} color="bg-purple-500 hover:bg-purple-600" />
                <QuickNavButton title="Gestión Inventario" icon={BuildingStorefrontIcon} onClick={() => handleNavigation('/inventory')} color="bg-lime-500 hover:bg-lime-600" />
                <QuickNavButton title="Gestión Usuarios" icon={UsersIcon} onClick={() => handleNavigation('/solicitudes', 'usuarios')} color="bg-pink-500 hover:bg-pink-600" />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-1 sm:p-2 md:p-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 px-2 pt-2">Estadísticas por Departamento</h2>
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        {["DEPARTAMENTO", "SOL. PENDIENTES", "SOL. APROBADAS", "SOL. RECHAZADAS", "GASTO TOTAL (BS.)"].map(header => (
                        <th key={header} scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{header}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedDeptStats.map((dept) => (
                        <tr key={dept.id} 
                            onClick={() => handleDepartmentSelect(dept.id, dept.nombre)}
                            className={`cursor-pointer transition-colors duration-150 ${selectedDepartmentId === dept.id ? 'bg-primary-600 text-white dark:bg-primary-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}>
                        <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${selectedDepartmentId === dept.id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{dept.nombre}</td>
                        <td className={`px-3 py-3 whitespace-nowrap text-sm text-center ${selectedDepartmentId === dept.id ? 'text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{dept.sol_pendientes}</td>
                        <td className={`px-3 py-3 whitespace-nowrap text-sm text-center ${selectedDepartmentId === dept.id ? 'text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{dept.sol_aprobadas}</td>
                        <td className={`px-3 py-3 whitespace-nowrap text-sm text-center ${selectedDepartmentId === dept.id ? 'text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{dept.sol_rechazadas}</td>
                        <td className={`px-3 py-3 whitespace-nowrap text-sm text-right ${selectedDepartmentId === dept.id ? 'text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{dept.gasto_total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
                <PaginationControls currentPage={currentPageDeptStats} totalPages={totalPagesDeptStats} onPageChange={setCurrentPageDeptStats} itemName="departamentos" />
            </div>

            {selectedDepartmentId && (
                <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Solicitudes del Departamento de {selectedDepartmentName}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {(['Todas', 'Pendiente', 'Aprobada', 'Rechazada'] as const).map(status => (
                            <button key={status} onClick={() => handleDeptRequestFilterChange(status)} className={filterButtonClasses(status)}>
                                {status}
                            </button>
                        ))}
                    </div>
                    <RequestTable
                        requests={paginatedDeptRequests}
                        showStatus={true}
                        onRowClick={(req) => { setSelectedRequestDetail(req); setShowRequestDetailsModal(true); }}
                    />
                    <PaginationControls currentPage={currentPageDeptRequests} totalPages={totalPagesDeptRequests} onPageChange={setCurrentPageDeptRequests} itemName="solicitudes" />
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Top 5 Departamentos por Gasto</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topSpendingDepartments} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} className="dark:stroke-gray-600"/>
                        <XAxis type="number" tickFormatter={(value) => `${(value/1000).toFixed(0)}k`} tick={{ fill: '#6b7280', fontSize: 10 }} className="dark:fill-gray-400"/>
                        <YAxis dataKey="nombre" type="category" width={80} tick={{ fill: '#6b7280', fontSize: 10 }} className="dark:fill-gray-400 truncate"/>
                        <Tooltip content={<CustomBarChartTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}/>
                        <Bar dataKey="gasto_total" name="Gasto Total" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20}/>
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Estado General de Solicitudes</h2>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie data={requestStatusChartData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={<CustomPieChartLabel />}>
                            {requestStatusChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value} solicitudes`} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Últimas Solicitudes</h2>
                <div className="overflow-x-auto max-h-[calc(6*2.75rem+3rem)]"> {/* Approx height for 6 rows + header */}
                    {paginatedRecentRequests.length > 0 ? (
                    <table className="min-w-full text-sm">
                        <thead><tr className="border-b dark:border-gray-700"><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">ID</th><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Solicitante</th><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Depto.</th><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Estado</th></tr></thead>
                        <tbody>{paginatedRecentRequests.map(req => (<tr key={req.id} onClick={() => handleRecentRequestClick(req)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b dark:border-gray-700/50"><td className="py-2 px-2 text-gray-700 dark:text-gray-200">#{req.id}</td><td className="py-2 px-2 text-gray-700 dark:text-gray-200 truncate max-w-[100px]" title={req.solicitante_nombre}>{req.solicitante_nombre}</td><td className="py-2 px-2 text-gray-700 dark:text-gray-200 truncate max-w-[100px]" title={req.departamento_nombre}>{req.departamento_nombre}</td><td className="py-2 px-2"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${req.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : req.estado === 'Aprobada' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>{req.estado}</span></td></tr>))}</tbody>
                    </table>
                    ) : <p className="text-sm text-gray-500 dark:text-gray-400 p-3">No hay solicitudes recientes.</p>}
                </div>
                <PaginationControls currentPage={currentPageRecentRequests} totalPages={totalPagesRecentRequests} onPageChange={setCurrentPageRecentRequests} itemName="solicitudes recientes" />
            </div>
             <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Últimas Órdenes</h2>
                 <div className="overflow-x-auto max-h-[calc(6*2.75rem+3rem)]">
                    {paginatedRecentOrders.length > 0 ? (
                    <table className="min-w-full text-sm">
                        <thead><tr className="border-b dark:border-gray-700"><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">ID</th><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Proveedor</th><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Total</th><th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Estado</th></tr></thead>
                        <tbody>{paginatedRecentOrders.map(ord => (<tr key={ord.id} onClick={() => handleRecentOrderClick(ord)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b dark:border-gray-700/50"><td className="py-2 px-2 text-gray-700 dark:text-gray-200">#{ord.id}</td><td className="py-2 px-2 text-gray-700 dark:text-gray-200 truncate max-w-[120px]" title={ord.proveedor_nombre}>{ord.proveedor_nombre}</td><td className="py-2 px-2 text-gray-700 dark:text-gray-200">{ord.neto_a_pagar?.toLocaleString('es-VE') || '0,00'} {ord.unidad}</td><td className="py-2 px-2"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ord.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : ord.estado === 'Completada' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>{ord.estado}</span></td></tr>))}</tbody>
                    </table>
                    ) : <p className="text-sm text-gray-500 dark:text-gray-400 p-3">No hay órdenes recientes.</p>}
                </div>
                <PaginationControls currentPage={currentPageRecentOrders} totalPages={totalPagesRecentOrders} onPageChange={setCurrentPageRecentOrders} itemName="órdenes recientes" />
            </div>
          </div>
        </div>
         {showRequestDetailsModal && selectedRequestDetail && (
            <RequestDetailsModal show={showRequestDetailsModal} onHide={() => setShowRequestDetailsModal(false)} request={selectedRequestDetail} />
        )}
        {showOrderDetailsModal && selectedOrderDetail && (
            <OrderDetailsModal show={showOrderDetailsModal} onHide={() => setShowOrderDetailsModal(false)} order={selectedOrderDetail} />
        )}
      </div>
    );
  }

  // RENDERIZACIÓN PARA USUARIO (existente)
  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Resumen de Actividad
        </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Solicitudes" value={userSummaryStats.total} icon={ListBulletIcon} colorClass="bg-blue-500" />
        <StatCard title="Aprobadas" value={userSummaryStats.aprobadas} icon={CheckCircleIcon} colorClass="bg-green-500" />
        <StatCard title="Rechazadas" value={userSummaryStats.rechazadas} icon={XCircleIcon} colorClass="bg-red-500" />
        <StatCard title="Pendientes" value={userSummaryStats.pendientes} icon={ShoppingCartIcon} colorClass="bg-yellow-500" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductList title="Productos Más Aprobados (Top 5)" products={approvedProducts} icon={CheckCircleIcon} iconColorClass="text-green-500" />
        <ProductList title="Productos Más Rechazados (Top 5)" products={rejectedProducts} icon={XCircleIcon} iconColorClass="text-red-500" />
      </div>
    </div>
  );
};

export default HomePage;
