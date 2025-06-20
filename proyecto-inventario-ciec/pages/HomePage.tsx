import React, { useState, useEffect } from 'react'; // useCallback ya no se usa aquí
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Inventario, SolicitudCompra, ProductoRezagado, UserProfile, Departamento, SolicitudCompraEstado, SolicitudCompraDetalle as SolicitudCompraDetalleType, Producto } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
// Componentes específicos de Admin - considerar carga diferida (lazy loading) si son grandes y solo para admin
import ProviderManagement from '../components/inventory/ProviderManagement';
import ProductManagement from '../components/inventory/ProductManagement';
import RequestTable from '../components/requests/RequestTable'; // Para la vista de Admin de solicitudes por departamento
import { CheckCircleIcon, XCircleIcon, ListBulletIcon, ShoppingCartIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'; // ArchiveBoxIcon para productos rezagados

interface HomePageContext {
  userProfile: UserProfile;
  // setHasInteracted y setActiveUITab no se usan directamente en HomePage,
  // pero podrían pasarse si HomePage tuviera navegación interna que afectara al Layout.
}

// Tipos para las estadísticas
interface DepartmentStat extends Departamento {
  pendingCount: number;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
}

interface OverallStats {
  total: number;
  aprobadas: number;
  rechazadas: number;
  pendientes: number;
}

interface ProductStat {
  producto_id: number;
  descripcion: string;
  total_cantidad: number; // Suma de cantidades para este producto
  veces_solicitado: number; // En cuántas solicitudes distintas aparece
}

// Componente reutilizable para mostrar tarjetas de estadísticas
const StatCard: React.FC<{ title: string; value: string | number; icon?: React.ElementType; colorClass?: string }> = ({ title, value, icon: Icon, colorClass = "bg-primary-500" }) => (
  <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 transform hover:scale-105 transition-transform duration-300">
    <div className="flex items-center">
      {Icon && <div className={`p-3 rounded-full ${colorClass} text-white mr-4`}><Icon className="w-7 h-7" /></div>}
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);

// Componente reutilizable para listar productos (ej. más aprobados, más rechazados)
const ProductList: React.FC<{ title: string; products: ProductStat[]; icon: React.ElementType; iconColorClass: string }> = ({ title, products, icon: Icon, iconColorClass }) => (
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
                {product.total_cantidad} uds. {/* Unidades totales */}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Solicitado en {product.veces_solicitado} {product.veces_solicitado === 1 ? 'solicitud' : 'solicitudes'}</p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos para mostrar en esta categoría.</p>
    )}
  </div>
);


const HomePage: React.FC = () => {
  const { userProfile } = useOutletContext<HomePageContext>(); // Obtener perfil del usuario del contexto del Layout

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados específicos del ROL USUARIO
  const [userInventory, setUserInventory] = useState<Inventario[]>([]); // Inventario reciente (ej. últimas actualizaciones)
  const [userSummaryStats, setUserSummaryStats] = useState<OverallStats>({ total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0 }); // Estadísticas de sus solicitudes
  const [approvedProducts, setApprovedProducts] = useState<ProductStat[]>([]); // Productos más aprobados para este usuario
  const [rejectedProducts, setRejectedProducts] = useState<ProductStat[]>([]); // Productos más rechazados para este usuario

  // Estados específicos del ROL ADMIN
  const [departments, setDepartments] = useState<DepartmentStat[]>([]); // Estadísticas por departamento
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentStat | null>(null); // Para mostrar detalles de un depto
  const [departmentRequests, setDepartmentRequests] = useState<SolicitudCompra[]>([]); // Solicitudes del depto seleccionado
  const [adminRequestFilter, setAdminRequestFilter] = useState<'Pendiente' | 'Historial'>('Pendiente'); // Filtro para tabla de admin
  const [productosRezagados, setProductosRezagados] = useState<ProductoRezagado[]>([]); // Productos no incluidos en órdenes
  const [showRezagadosModal, setShowRezagadosModal] = useState(false);

  useEffect(() => {
    // TODO: Implement data fetching logic based on userProfile.rol
    // For now, just simulate loading completion
    const timer = setTimeout(() => {
      setLoading(false);
      // Example data for UI testing (replace with actual fetches)
      if (userProfile.rol === 'usuario') {
        setUserSummaryStats({ total: 5, aprobadas: 2, rechazadas: 1, pendientes: 2 });
        // setApprovedProducts([{ producto_id: 1, descripcion: "Papel Bond", total_cantidad: 10, veces_solicitado: 2 }]);
      } else if (userProfile.rol === 'admin') {
        // setDepartments([{ id: 1, nombre: "Ventas", created_at: "", updated_at: "", pendingCount: 3, totalCount: 10, approvedCount: 5, rejectedCount: 2 }]);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [userProfile.rol]);


  if (loading) return <LoadingSpinner message="Cargando datos del dashboard..." />;
  if (error) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {userProfile.rol === 'admin' ? 'Panel de Estadísticas Administrativas' : 'Resumen de Actividad'}
      </h1>

      {userProfile.rol === 'usuario' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Solicitudes" value={userSummaryStats.total} icon={ListBulletIcon} colorClass="bg-blue-500" />
            <StatCard title="Solicitudes Aprobadas" value={userSummaryStats.aprobadas} icon={CheckCircleIcon} colorClass="bg-green-500" />
            <StatCard title="Solicitudes Rechazadas" value={userSummaryStats.rechazadas} icon={XCircleIcon} colorClass="bg-red-500" />
            <StatCard title="Solicitudes Pendientes" value={userSummaryStats.pendientes} icon={ShoppingCartIcon} colorClass="bg-yellow-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProductList title="Productos Más Aprobados (Usuario)" products={approvedProducts} icon={CheckCircleIcon} iconColorClass="text-green-500" />
            <ProductList title="Productos Más Rechazados (Usuario)" products={rejectedProducts} icon={XCircleIcon} iconColorClass="text-red-500" />
          </div>
           <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Inventario Reciente (Usuario)</h3>
            {userInventory.length > 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Datos de inventario aquí...</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay información de inventario reciente para mostrar (funcionalidad pendiente).</p>
            )}
          </div>
        </div>
      )}

      {userProfile.rol === 'admin' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Estadísticas por Departamento</h2>
          {departments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map(dept => (
                <StatCard 
                  key={dept.id} 
                  title={dept.nombre} 
                  value={`${dept.pendingCount} Pendientes / ${dept.totalCount} Totales`} 
                  icon={ListBulletIcon}
                  colorClass="bg-indigo-500" 
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay estadísticas por departamento para mostrar (funcionalidad pendiente).</p>
          )}
          
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Solicitudes del Departamento Seleccionado</h3>
            {selectedDepartment ? (
                <RequestTable 
                    requests={departmentRequests} 
                    onRowClick={(req) => console.log("Ver detalle solicitud admin: ", req.id)} 
                    showStatus={true}
                />
            ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Seleccione un departamento para ver sus solicitudes (funcionalidad no implementada en este panel).</p>
            )}
          </div>

          <div className="mt-6">
            <button 
                onClick={() => setShowRezagadosModal(true)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md text-sm"
            >
                Ver Productos Rezagados ({productosRezagados.length})
            </button>
            {showRezagadosModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg">
                        <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Productos Rezagados</h3>
                        {productosRezagados.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {productosRezagados.map(p => {
                                    // Assuming ProductoRezagado has a 'producto' field that can be null/undefined
                                    const productoDescripcion = p.producto?.descripcion || 'Descripción no disponible';
                                    return (
                                        <li key={p.id} className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                                            {productoDescripcion} (Cant: {p.cantidad}) - Motivo: {p.motivo || 'N/D'}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos rezagados.</p>}
                        <button onClick={() => setShowRezagadosModal(false)} className="mt-4 px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 text-sm">Cerrar</button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
