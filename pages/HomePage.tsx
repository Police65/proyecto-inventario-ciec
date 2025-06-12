
import React, { useState, useEffect } from 'react'; // useCallback ya no se usa aquí
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Inventario, SolicitudCompra, ProductoRezagado, UserProfile, Departamento, SolicitudCompraEstado, Empleado, SolicitudCompraDetalle as SolicitudCompraDetalleType, Producto, CategoriaProducto } from '../types';
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
  const [showRezagadosModal, setShowRezagadosModal] = useState(false); // Modal de productos rezagados

  // Efecto para cargar datos según el rol del usuario
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (userProfile.rol === 'usuario') {
          // --- Lógica para ROL USUARIO ---
          // 1. Obtener inventario reciente (ej. últimos 10 actualizados)
          const { data: invData, error: invError } = await supabase
            .from('inventario')
            .select('*, producto:producto_id(descripcion, categoria:categoria_id(nombre))') // Incluir info de producto y categoría
            .order('fecha_actualizacion', { ascending: false })
            .limit(10);
          if (invError) {
            console.error("Error al obtener inventario para usuario:", invError.message);
            throw invError; // Lanzar para ser capturado por el catch general
          }
          setUserInventory(invData || []);

          // 2. Obtener estadísticas generales de solicitudes para el usuario
          if (userProfile.empleado_id) { // Asegurar que hay un empleado_id
            const { data: reqsData, error: reqsError } = await supabase
              .from('solicitudcompra')
              .select('id, estado') // Solo necesitamos ID y estado para contar
              .eq('empleado_id', userProfile.empleado_id);
            if (reqsError) {
                console.error("Error al obtener estadísticas de solicitudes del usuario:", reqsError.message);
                throw reqsError;
            }

            const summary: OverallStats = { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0 };
            (reqsData || []).forEach(req => {
                summary.total++;
                if (req.estado === 'Aprobada') summary.aprobadas++;
                else if (req.estado === 'Rechazada') summary.rechazadas++;
                else if (req.estado === 'Pendiente') summary.pendientes++;
            });
            setUserSummaryStats(summary);

            // 3. Obtener estadísticas de productos para el usuario (ej. más aprobados/rechazados)
            type SolicitudDetalleConProducto = SolicitudCompraDetalleType & {
                // Supabase puede devolver un array o un objeto para relaciones anidadas, normalizar a objeto.
                producto: ({ id: number; descripcion: string; } | null); 
            };
            type SolicitudConDetallesProd = Pick<SolicitudCompra, 'id'> & {
                detalles: SolicitudDetalleConProducto[] | null;
            };

            // Función auxiliar para obtener estadísticas de productos por estado de solicitud
            const fetchProductStats = async (status: SolicitudCompraEstado): Promise<ProductStat[]> => {
              const { data: requestsWithDetails, error: detailsError } = await supabase
                .from('solicitudcompra')
                .select('id, detalles:solicitudcompra_detalle(cantidad, producto:producto_id(id, descripcion))')
                .eq('empleado_id', userProfile.empleado_id!) // Filtrar por empleado
                .eq('estado', status) // Filtrar por estado (Aprobada, Rechazada)
                .returns<SolicitudConDetallesProd[]>(); // Tipar explícitamente el retorno

              if (detailsError) {
                console.error(`Error al obtener detalles de productos para solicitudes ${status}:`, detailsError); return [];
              }
              
              // Mapear y agregar cantidades por producto
              const productMap = new Map<number, { descripcion: string; total_cantidad: number; solicitud_ids: Set<number> }>();
              (requestsWithDetails || []).forEach(req => {
                req.detalles?.forEach(detalle => {
                  if (detalle.producto && detalle.producto.id && detalle.cantidad) {
                    const existing = productMap.get(detalle.producto.id);
                    if (existing) {
                      existing.total_cantidad += detalle.cantidad;
                      existing.solicitud_ids.add(req.id); // Contar en cuántas solicitudes diferentes aparece
                    } else {
                      productMap.set(detalle.producto.id, {
                        descripcion: detalle.producto.descripcion,
                        total_cantidad: detalle.cantidad,
                        solicitud_ids: new Set([req.id]),
                      });
                    }
                  }
                });
              });
              // Convertir mapa a array, ordenar y tomar top N (ej. 10)
              return Array.from(productMap.entries())
                .map(([producto_id, data]) => ({ producto_id, descripcion: data.descripcion, total_cantidad: data.total_cantidad, veces_solicitado: data.solicitud_ids.size }))
                .sort((a, b) => b.total_cantidad - a.total_cantidad).slice(0, 10); 
            };
            // Obtener productos para solicitudes aprobadas y rechazadas
            const [approved, rejected] = await Promise.all([
              fetchProductStats('Aprobada'),
              fetchProductStats('Rechazada'),
            ]);
            setApprovedProducts(approved);
            setRejectedProducts(rejected);
          }

        } else if (userProfile.rol === 'admin') {
          // --- Lógica para ROL ADMIN ---
          // 1. Obtener todos los departamentos
          const { data: deptsData, error: deptError } = await supabase
            .from('departamento')
            .select('id, nombre');
          if (deptError) throw deptError;

          // 2. Obtener todas las solicitudes con detalles anidados
          const { data: allReqsData, error: allReqsError } = await supabase
            .from('solicitudcompra')
            .select('id, empleado_id, estado, departamento_id, descripcion, fecha_solicitud, empleado:empleado_id(nombre,apellido), departamento:departamento_id(nombre), detalles:solicitudcompra_detalle(*, producto:producto_id(descripcion))');
          if (allReqsError) throw allReqsError;

          // Procesar datos crudos de Supabase que pueden tener relaciones como arrays o objetos únicos
          const rawReqs: any[] = allReqsData || [];
           const processedReqs: SolicitudCompra[] = rawReqs.map(req => ({
            ...req,
            // Normalizar 'empleado' y 'departamento' para que sean objetos o undefined
            empleado: req.empleado && Array.isArray(req.empleado) && req.empleado.length > 0
                      ? req.empleado[0]
                      : (req.empleado && !Array.isArray(req.empleado) ? req.empleado : undefined),
            departamento: req.departamento && Array.isArray(req.departamento) && req.departamento.length > 0
                          ? req.departamento[0]
                          : (req.departamento && !Array.isArray(req.departamento) ? req.departamento : undefined),
            // Normalizar 'producto' dentro de 'detalles'
            detalles: (req.detalles || []).map((detalle: any) => ({
              ...detalle,
              producto: detalle.producto && Array.isArray(detalle.producto) && detalle.producto.length > 0
                        ? detalle.producto[0]
                        : (detalle.producto && !Array.isArray(detalle.producto) ? detalle.producto : undefined),
            })),
          }));
          setDepartmentRequests(processedReqs); // Guardar todas las solicitudes para filtrar después

          // 3. Calcular estadísticas por departamento
          const deptStatsArray = (deptsData || []).map(dept => ({
            ...dept, // Esto incluye id, nombre de deptsData
            totalCount: processedReqs.filter(r => r.departamento_id === dept.id).length,
            pendingCount: processedReqs.filter(r => r.departamento_id === dept.id && r.estado === 'Pendiente').length,
            approvedCount: processedReqs.filter(r => r.departamento_id === dept.id && r.estado === 'Aprobada').length,
            rejectedCount: processedReqs.filter(r => r.departamento_id === dept.id && r.estado === 'Rechazada').length,
            // Añadir campos faltantes para que coincida con DepartmentStat si es necesario
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString(), 
          }));
          setDepartments(deptStatsArray);

          // 4. Obtener productos rezagados (no incluidos en órdenes)
          const { data: rezagadosData, error: rezagadosError } = await supabase
            .from('productos_rezagados')
            .select('*, producto:producto_id(descripcion), solicitud:solicitud_id(descripcion), orden_compra:orden_compra_id(id)'); // Asumir que 'orden_compra_id' es el nombre del campo en 'productos_rezagados'
          if (rezagadosError) throw rezagadosError;
          setProductosRezagados(rezagadosData || []);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error al obtener datos de inicio para HomePage:", errorMessage, err);
        setError("Error al cargar datos de inicio: " + errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile) { // Solo ejecutar si hay perfil de usuario
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]); // Dependencia en userProfile


  // Manejador para eliminar un producto rezagado (solo admin)
  const handleDeleteRezagado = async (id: number) => {
    if (!userProfile || userProfile.rol !== 'admin') return; // Doble check de seguridad
    if (window.confirm('¿Está seguro de eliminar este registro de producto rezagado? Esta acción es permanente.')) {
      try {
        const { error } = await supabase.from('productos_rezagados').delete().eq('id', id);
        if (error) throw error;
        // Actualizar lista local de productos rezagados
        setProductosRezagados(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error al eliminar producto rezagado:", errorMessage, err);
        alert("Error al eliminar el registro de producto rezagado.");
      }
    }
  };

  // --- Renderizado ---
  if (loading) return <LoadingSpinner message="Cargando datos de inicio..." />;
  if (error) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;
  if (!userProfile) return null; // No debería pasar si App.tsx maneja la redirección

  // --- VISTA DEL ADMINISTRADOR ---
  if (userProfile.rol === 'admin') {
    // Si un departamento está seleccionado, mostrar su tabla de solicitudes
    if (selectedDepartment) {
      const filteredDeptRequests = departmentRequests.filter(r =>
        r.departamento_id === selectedDepartment.id &&
        (adminRequestFilter === 'Historial' ? ['Aprobada', 'Rechazada'].includes(r.estado) : r.estado === adminRequestFilter)
      );

      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
              Solicitudes de {selectedDepartment.nombre}
            </h2>
            <div className="flex space-x-2"> {/* Botones de filtro */}
              <button
                onClick={() => setAdminRequestFilter('Pendiente')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${adminRequestFilter === 'Pendiente' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setAdminRequestFilter('Historial')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${adminRequestFilter === 'Historial' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                Historial
              </button>
              <button // Botón para volver al resumen de departamentos
                onClick={() => setSelectedDepartment(null)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-gray-500 hover:bg-gray-600 text-white"
              >
                Volver
              </button>
            </div>
          </div>
          {/* Tabla de solicitudes para el departamento seleccionado */}
          <RequestTable requests={filteredDeptRequests} showStatus={true} />
        </div>
      );
    }

    // Vista principal del admin: resumen por departamentos y acceso a gestión
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Panel de Administrador</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Resumen general y gestión por departamento.</p>
        </div>

        {/* Grid de tarjetas de departamentos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map(dept => (
            <div
              key={dept.id}
              onClick={() => setSelectedDepartment(dept)} // Seleccionar depto al hacer clic
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            >
              <h3 className="text-xl font-semibold text-primary-600 dark:text-primary-400">{dept.nombre}</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Total Solicitudes: {dept.totalCount}</p>
              <div className="mt-3 space-y-1">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Pendientes: <span className="font-bold">{dept.pendingCount}</span></p>
                <p className="text-sm text-green-600 dark:text-green-400">Aprobadas: <span className="font-bold">{dept.approvedCount}</span></p>
                <p className="text-sm text-red-600 dark:text-red-400">Rechazadas: <span className="font-bold">{dept.rejectedCount}</span></p>
              </div>
            </div>
          ))}
           {departments.length === 0 && <p className="col-span-full text-center text-gray-500 dark:text-gray-400">No hay departamentos para mostrar.</p>}
        </div>

        {/* Sección de Productos Rezagados */}
        <div className="mt-8">
          <button
            onClick={() => setShowRezagadosModal(true)}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-md flex items-center"
          >
            <ArchiveBoxIcon className="w-5 h-5 mr-2"/> Ver Productos Rezagados ({productosRezagados.length})
          </button>
        </div>

        {/* Modal de Productos Rezagados */}
        {showRezagadosModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Productos Rezagados</h3>
                <button onClick={() => setShowRezagadosModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cantidad</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Motivo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Solicitud Orig.</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Orden Rel.</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {productosRezagados.length > 0 ? productosRezagados.map(p => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{p.producto?.descripcion || 'N/D'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{p.cantidad}</td>
                        <td className="px-4 py-2 whitespace-normal text-sm text-gray-500 dark:text-gray-300 max-w-xs">{p.motivo || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{p.solicitud_id ? `#${p.solicitud_id}` : 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{p.orden_compra_id || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          <button
                            onClick={() => p.id && handleDeleteRezagado(p.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">No hay productos rezagados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Secciones de Gestión de Proveedores y Productos (si se decide incluirlas aquí directamente) */}
        {/* Nota: Actualmente estas se acceden desde /inventory. Se podrían replicar o enlazar desde aquí. */}
        <div className="mt-12 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Gestión de Proveedores</h2>
            <ProviderManagement />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Gestión de Productos</h2>
            <ProductManagement />
          </div>
        </div>

      </div>
    );
  }

  // --- VISTA DEL USUARIO REGULAR ---
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bienvenido, {userProfile.empleado?.nombre || 'Usuario'}</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Aquí puedes ver un resumen de tu actividad y el estado del inventario.</p>
      </div>

      {/* Tarjetas de estadísticas para el usuario */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Solicitudes Totales" value={userSummaryStats.total} icon={ListBulletIcon} colorClass="bg-blue-500" />
        <StatCard title="Pendientes" value={userSummaryStats.pendientes} icon={ShoppingCartIcon} colorClass="bg-yellow-500" />
        <StatCard title="Aprobadas" value={userSummaryStats.aprobadas} icon={CheckCircleIcon} colorClass="bg-green-500" />
        <StatCard title="Rechazadas" value={userSummaryStats.rechazadas} icon={XCircleIcon} colorClass="bg-red-500" />
      </div>

      {/* Listas de productos más aprobados/rechazados para el usuario */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Productos Destacados en tus Solicitudes</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ProductList
            title="Productos Más Aprobados (Top 10 por cantidad)"
            products={approvedProducts}
            icon={CheckCircleIcon}
            iconColorClass="text-green-500"
            />
            <ProductList
            title="Productos Más Rechazados (Top 10 por cantidad)"
            products={rejectedProducts}
            icon={XCircleIcon}
            iconColorClass="text-red-500"
            />
        </div>
      </div>

      {/* Tabla de inventario reciente para el usuario */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Inventario Reciente</h2>
        {userInventory.length > 0 ? (
          <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ubicación</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Existencias</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Últ. Actualización</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {userInventory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.producto?.descripcion || 'N/D'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{item.producto?.categoria?.nombre || 'N/D'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{item.ubicacion || 'N/D'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{item.existencias ?? '0'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(item.fecha_actualizacion).toLocaleDateString('es-VE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No hay datos de inventario para mostrar en este momento.</p>
        )}
      </div>
    </div>
  );
};

export default HomePage;