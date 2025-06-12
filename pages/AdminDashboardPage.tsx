
import React, { useState, useEffect } from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SolicitudCompra, OrdenCompra, UserProfile, OrdenConsolidada, Empleado, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, Proveedor, OrdenCompraDetalle as OrdenCompraDetalleType, CategoriaProducto } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';

// Importar componentes individuales que conforman el dashboard
import RequestTable from '../components/requests/RequestTable';
import OrderTable from '../components/orders/OrderTable';
import UserManagement from '../components/admin/UserManagement';
import ConsolidatedOrderTable from '../components/orders/ConsolidatedOrderTable';

// Modales
import OrderForm from '../components/orders/OrderForm';
import DirectOrderForm from '../components/orders/DirectOrderForm';
import ConsolidationModal from '../components/orders/ConsolidationModal';
import OrderDetailsModal from '../components/orders/OrderDetailsModal';
import RequestDetailsModal from '../components/requests/RequestDetailsModal';
import ConsolidatedOrderDetailsModal from '../components/orders/ConsolidatedOrderDetailsModal';

interface AdminDashboardContext {
  userProfile: UserProfile; // Perfil del administrador logueado
  activeUITab: string; // Pestaña activa actualmente en la UI (ej. 'solicitudes', 'ordenes')
  setActiveUITab: (tab: string) => void; // Función para cambiar la pestaña activa
}

// --- Definiciones de tipo para datos crudos de consultas Supabase ---
// Ayudan a mapear correctamente los datos, especialmente con relaciones anidadas.
type RawSolicitudFromQuery = Omit<SolicitudCompra, 'empleado' | 'departamento' | 'detalles'> & {
  empleado: Pick<Empleado, 'id' | 'nombre' | 'apellido'> | null;
  departamento: Pick<Departamento, 'id' | 'nombre'> | null;
  detalles: Array<
    Pick<SolicitudCompraDetalleType, 'id' | 'solicitud_compra_id' | 'producto_id' | 'cantidad'> & {
      producto: (Pick<Producto, 'id' | 'descripcion' | 'categoria_id'> & {
          categoria: Pick<CategoriaProducto, 'id' | 'nombre'> | null; // Categoría del producto
      }) | null; // Producto puede ser null si es un item personalizado
    }
  > | null; // Detalles puede ser null si la solicitud no tiene
};

type RawOrdenFromQuery = Omit<OrdenCompra, 'proveedor' | 'detalles' | 'empleado' | 'solicitud_compra'> & {
  proveedor: Pick<Proveedor, 'id' | 'nombre' | 'rif' | 'direccion'> | null;
  detalles: Array<
    Pick<OrdenCompraDetalleType, 'id' | 'producto_id' | 'cantidad' | 'precio_unitario'> & {
      producto: Pick<Producto, 'id' | 'descripcion'> | null;
    }
  > | null;
  empleado: Pick<Empleado, 'id' | 'nombre' | 'apellido'> | null;
  // El campo solicitud_compra se poblará con el select aliasado de la FK
  solicitud_compra: Pick<SolicitudCompra, 'id' | 'descripcion'> | null; 
};


export const AdminDashboardPage = (): JSX.Element => {
  const { userProfile, activeUITab, setActiveUITab } = useOutletContext<AdminDashboardContext>();

  const [loading, setLoading] = useState(true); // Estado de carga general para la página
  const [error, setError] = useState<string | null>(null); // Mensaje de error general

  // Listas de datos para las tablas
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudCompra[]>([]);
  const [solicitudesHistorial, setSolicitudesHistorial] = useState<SolicitudCompra[]>([]);
  const [ordenesHistorial, setOrdenesHistorial] = useState<OrdenCompra[]>([]);
  const [ordenesConsolidadas, setOrdenesConsolidadas] = useState<OrdenConsolidada[]>([]);

  // Estados para controlar la visibilidad de los modales
  const [showOrderForm, setShowOrderForm] = useState(false); // Modal para crear orden desde solicitud
  const [showDirectOrderForm, setShowDirectOrderForm] = useState(false); // Modal para crear orden directa
  const [showConsolidationModal, setShowConsolidationModal] = useState(false); // Modal para consolidar solicitudes
  
  // Datos para pasar al formulario de orden (productos iniciales, IDs de solicitudes, proveedor)
  const [selectedRequestForOrder, setSelectedRequestForOrder] = useState<{initialProducts: any[], solicitudes: number[], proveedor_id: number | null} | null>(null);

  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false); // Modal para ver detalles de orden
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrdenCompra | null>(null); // Orden seleccionada para detalles

  const [showRequestDetailsModal, setShowRequestDetailsModal] = useState(false); // Modal para ver detalles de solicitud
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<SolicitudCompra | null>(null); // Solicitud seleccionada

  const [showConsolidatedOrderDetailsModal, setShowConsolidatedOrderDetailsModal] = useState(false); // Modal para detalles de orden consolidada
  const [selectedConsolidatedOrderDetail, setSelectedConsolidatedOrderDetail] = useState<OrdenConsolidada | null>(null);

  // Estado para la orden recién creada, para mostrar confirmación de PDF
  const [newlyCreatedOrder, setNewlyCreatedOrder] = useState<OrdenCompra | null>(null);
  const [showPDFConfirmationModal, setShowPDFConfirmationModal] = useState(false);

  // --- Funciones para mapear datos crudos de Supabase a las interfaces de la aplicación ---
  // Esto es crucial porque Supabase puede devolver relaciones anidadas como arrays de un solo elemento.
  const mapSolicitudData = (req: RawSolicitudFromQuery): SolicitudCompra => ({
    id: req.id,
    descripcion: req.descripcion,
    fecha_solicitud: req.fecha_solicitud,
    estado: req.estado,
    empleado_id: req.empleado_id,
    departamento_id: req.departamento_id,
    created_at: new Date().toISOString(), // Valor por defecto, la DB tiene el real
    updated_at: new Date().toISOString(), // Valor por defecto
    empleado: req.empleado ? { // Mapear empleado si existe
      id: req.empleado.id,
      nombre: req.empleado.nombre,
      apellido: req.empleado.apellido,
      // Campos de relleno para Empleado, ya que la consulta no los trae todos
      cedula: '', cargo_actual_id: null, departamento_id: req.empleado_id, estado: 'activo', 
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_profile: undefined,
    } : undefined,
    departamento: req.departamento ? { // Mapear departamento si existe
      id: req.departamento.id, nombre: req.departamento.nombre,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
    } : undefined,
    detalles: req.detalles ? req.detalles.map(d => ({ // Mapear detalles de solicitud
      id: d.id,
      solicitud_compra_id: d.solicitud_compra_id,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
      producto: d.producto ? { // Mapear producto dentro del detalle
        id: d.producto.id,
        descripcion: d.producto.descripcion,
        categoria_id: d.producto.categoria_id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
        categoria: d.producto.categoria ? { // Mapear categoría del producto
            ...d.producto.categoria,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
        } : undefined,
      } : undefined,
    })) : [], // Asegurar que detalles sea siempre un array, incluso si es vacío
  });
  
  const mapOrdenData = (order: RawOrdenFromQuery): OrdenCompra => ({
    id: order.id,
    solicitud_compra_id: order.solicitud_compra_id,
    proveedor_id: order.proveedor_id,
    fecha_orden: order.fecha_orden,
    estado: order.estado,
    precio_unitario: order.precio_unitario, // Campo en cabecera, podría ser un default o agregado.
    sub_total: order.sub_total,
    iva: order.iva,
    ret_iva: order.ret_iva,
    neto_a_pagar: order.neto_a_pagar,
    unidad: order.unidad,
    observaciones: order.observaciones,
    empleado_id: order.empleado_id,
    changed_by: order.changed_by,
    fecha_modificacion: order.fecha_modificacion,
    retencion_porcentaje: order.retencion_porcentaje,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
    proveedor: order.proveedor ? { // Mapear proveedor
      id: order.proveedor.id, nombre: order.proveedor.nombre, rif: order.proveedor.rif, direccion: order.proveedor.direccion,
      estado: 'activo', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
    } : undefined,
    empleado: order.empleado ? { // Mapear empleado
      id: order.empleado.id, nombre: order.empleado.nombre, apellido: order.empleado.apellido,
      cedula: '', cargo_actual_id: null, departamento_id: 0, estado: 'activo',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
    } : undefined,
    solicitud_compra: order.solicitud_compra ? { // Mapear solicitud de compra vinculada (usando el alias 'solicitud_compra')
        id: order.solicitud_compra.id,
        descripcion: order.solicitud_compra.descripcion,
        // Campos de relleno para SolicitudCompra
        fecha_solicitud: '', estado: 'Pendiente', empleado_id:0, departamento_id:0, 
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
    } : undefined,
    detalles: order.detalles ? order.detalles.map(d => ({ // Mapear detalles de la orden
      id: d.id, 
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      orden_compra_id: order.id, 
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
      producto: d.producto ? { // Mapear producto del detalle
        id: d.producto.id,
        descripcion: d.producto.descripcion,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), 
      } : undefined,
    })) : [], // Asegurar que detalles sea un array
  });

  // Función principal para cargar todos los datos necesarios para el panel de admin
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Definición común para la consulta de solicitudes (para pendientes e historial)
      const commonSelectSolicitud = `
        id, descripcion, fecha_solicitud, estado, empleado_id, departamento_id,
        detalles:solicitudcompra_detalle(id, solicitud_compra_id, producto_id, cantidad, producto:producto_id(id, descripcion, categoria_id, categoria:categoria_id(id, nombre))),
        empleado:empleado_id(id, nombre, apellido), 
        departamento:departamento_id(id, nombre)
      `;

      // Obtener solicitudes pendientes
      const { data: pendingRaw, error: pendingError } = await supabase
        .from('solicitudcompra')
        .select(commonSelectSolicitud)
        .eq('estado', 'Pendiente')
        .order('fecha_solicitud', { ascending: false }) // Más recientes primero
        .returns<RawSolicitudFromQuery[]>(); // Tipar el retorno
      if (pendingError) throw pendingError;
      setSolicitudesPendientes((pendingRaw || []).map(mapSolicitudData));

      // Obtener historial de solicitudes (Aprobadas, Rechazadas)
      const { data: historyRaw, error: historyError } = await supabase
        .from('solicitudcompra')
        .select(commonSelectSolicitud)
        .in('estado', ['Aprobada', 'Rechazada'])
        .order('fecha_solicitud', { ascending: false })
        .returns<RawSolicitudFromQuery[]>();
      if (historyError) throw historyError;
      setSolicitudesHistorial((historyRaw || []).map(mapSolicitudData));

      // Definición común para la consulta de órdenes
      const commonSelectOrden = `
          id, solicitud_compra_id, proveedor_id, fecha_orden, estado, precio_unitario, sub_total, iva, ret_iva, neto_a_pagar, unidad, observaciones, empleado_id, changed_by, fecha_modificacion, retencion_porcentaje,
          proveedor:proveedor_id(id, nombre, rif, direccion),
          detalles:ordencompra_detalle(id, producto_id, cantidad, precio_unitario, producto:producto_id(id, descripcion)),
          empleado:empleado_id(id, nombre, apellido),
          solicitud_compra:solicitudcompra!ordencompra_solicitud_compra_id_fkey(id, descripcion) /* Uso explícito de la FK para la relación con solicitudcompra */
        `;

      // Obtener historial de órdenes
      const { data: ordersRaw, error: ordersError } = await supabase
        .from('ordencompra')
        .select(commonSelectOrden)
        .order('fecha_orden', { ascending: false })
        .returns<RawOrdenFromQuery[]>();
      if (ordersError) {
        console.error("Error al obtener órdenes (AdminDashboard):", ordersError.message, ordersError.details, ordersError.code, ordersError);
        throw ordersError;
      }
      setOrdenesHistorial((ordersRaw || []).map(mapOrdenData));

      // Obtener órdenes consolidadas
      const { data: consolidated, error: consolidatedError } = await supabase
        .from('ordenes_consolidadas')
        .select('*, proveedor:proveedor_id(id, nombre)') // Incluir nombre del proveedor
        .order('fecha_creacion', { ascending: false });
      if (consolidatedError) throw consolidatedError;
       setOrdenesConsolidadas((consolidated || []).map((oc: any) => ({ 
        ...oc,
        // Asegurar que 'productos' y 'solicitudes' sean arrays, parseando si es JSON string
        // Esto es importante si la BD guarda estos campos como JSON string y no como JSONB nativo bien estructurado.
        productos: Array.isArray(oc.productos) ? oc.productos : JSON.parse(oc.productos || '[]'),
        solicitudes: Array.isArray(oc.solicitudes) ? oc.solicitudes : JSON.parse(oc.solicitudes || '[]'),
        proveedor: oc.proveedor ? { // Mapear proveedor si existe
            id: oc.proveedor.id,
            nombre: oc.proveedor.nombre,
        } : undefined,
      })));
    } catch (err) {
      // Manejo de errores más detallado
      const typedError = err as { message: string, details?: string, code?: string };
      const errorMessage = `Error: ${typedError.message}${typedError.details ? ` Detalles: ${typedError.details}` : ''}${typedError.code ? ` Código: ${typedError.code}` : ''}`;
      console.error("Error al obtener datos del panel de administrador:", errorMessage, err);
      setError(errorMessage); // Mostrar error al usuario
    } finally {
      setLoading(false); // Finalizar estado de carga
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependencias vacías para ejecutar solo una vez

  // Función para refrescar todos los datos
  const refreshAllData = () => {
    fetchData();
  };

  // --- Manejadores de Acciones ---
  // Aprobar una solicitud: abre el formulario para crear una orden
  const handleApproveRequest = (request: SolicitudCompra) => {
    const initialProducts = request.detalles?.map(d => ({
      producto_id: d.producto_id,
      descripcion: d.producto?.descripcion || 'Producto sin nombre',
      quantity: d.cantidad,
      precio_unitario: 0 // El admin llenará esto en OrderForm
    })) || [];

    setSelectedRequestForOrder({ // Preparar datos para OrderForm
      initialProducts: initialProducts,
      solicitudes: [request.id], // Vincular esta orden a la solicitud de origen
      proveedor_id: null // El admin seleccionará proveedor en OrderForm
    });
    setShowOrderForm(true); // Mostrar modal de creación de orden
  };

  // Rechazar una solicitud
  const handleRejectRequest = async (requestId: number) => {
    if (!window.confirm(`¿Está seguro de rechazar la solicitud #${requestId}? Esta acción no se puede deshacer.`)) return;
    try {
      // Actualizar estado de la solicitud a 'Rechazada'
      const { error } = await supabase
        .from('solicitudcompra')
        .update({ estado: 'Rechazada' })
        .eq('id', requestId);
      if (error) throw error;

      // Notificar al usuario que creó la solicitud
      const requestToNotify = solicitudesPendientes.find(req => req.id === requestId) ||
                              solicitudesHistorial.find(req => req.id === requestId); // Buscarla en ambas listas
      
      if (requestToNotify && requestToNotify.empleado_id) {
        // Obtener el user_id (Auth ID) del perfil del empleado para enviar la notificación
        const {data: profileForNotif, error: profileError} = await supabase
            .from('user_profile')
            .select('id') // Seleccionar solo el ID del perfil (que es el auth.users.id)
            .eq('empleado_id', requestToNotify.empleado_id)
            .single(); // Asumimos que un empleado solo tiene un perfil

        if(profileError) {
            // No es un error fatal, solo advertir
            console.warn("No se pudo obtener el perfil para la notificación de rechazo:", profileError.message, profileError.details);
        }

        if (profileForNotif) { // Si se encontró el perfil del usuario
            const { error: insertNotifError } = await supabase.from('notificaciones').insert([{
            user_id: profileForNotif.id, 
            title: 'Solicitud Rechazada',
            description: `Tu solicitud #${requestId} ("${requestToNotify.descripcion || 'Sin descripción adicional'}") ha sido rechazada.`,
            created_at: new Date().toISOString(),
            read: false,
            type: 'solicitud_rechazada',
            related_id: requestId // ID de la solicitud rechazada
            }]);
            if (insertNotifError) {
                console.error("Error al insertar notificación por rechazo:", insertNotifError.message, insertNotifError.details, insertNotifError.code);
            }
        } else {
             console.warn("No se pudo enviar notificación de rechazo: perfil de usuario no encontrado para empleado ID", requestToNotify.empleado_id);
        }
      } else {
        console.warn("No se pudo enviar notificación de rechazo: datos de empleado faltantes para solicitud ID", requestId);
      }
      refreshAllData(); // Recargar datos para reflejar el cambio
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error al rechazar solicitud:", errorMessage, err);
      alert("Error al rechazar la solicitud.");
    }
  };

  // Crear una orden directa (sin solicitud previa)
  const handleCreateDirectOrder = () => {
    setShowDirectOrderForm(true); // Mostrar modal de orden directa
  };

  // Callback que se ejecuta después de crear una orden (desde OrderForm o DirectOrderForm)
  const handleOrderCreated = (createdOrder: OrdenCompra) => {
    setNewlyCreatedOrder(createdOrder); // Guardar la orden creada
    setShowOrderForm(false); // Ocultar modal de orden
    setShowDirectOrderForm(false); // Ocultar modal de orden directa
    setShowPDFConfirmationModal(true); // Mostrar modal de confirmación de PDF (opcional, podría ser solo un mensaje)
    refreshAllData(); // Recargar todos los datos
  };
  
  // Callback tras completar una consolidación de solicitudes
  const handleConsolidationComplete = (newConsolidatedOrder: OrdenConsolidada) => {
    // Añadir la nueva orden consolidada al principio de la lista local para UI inmediata
    setOrdenesConsolidadas(prev => [newConsolidatedOrder, ...prev]);
    setShowConsolidationModal(false); // Ocultar modal de consolidación
    refreshAllData(); // Recargar datos (especialmente solicitudes pendientes)
  };

  // Convertir una orden consolidada a una orden de compra regular (abrir OrderForm)
  const handleConvertToRegularOrder = (consolidatedOrder: OrdenConsolidada) => {
     // Extraer productos de la orden consolidada para pasarlos a OrderForm
     const initialProducts = (consolidatedOrder.productos as Array<{producto_id: number, descripcion: string, cantidad: number}>).map(p => ({
      producto_id: p.producto_id,
      descripcion: p.descripcion,
      quantity: p.cantidad,
      precio_unitario: 0 // El admin llenará el precio en OrderForm
    }));
    setSelectedRequestForOrder({ // Preparar datos para OrderForm
      initialProducts: initialProducts,
      solicitudes: consolidatedOrder.solicitudes as number[], // IDs de las solicitudes originales
      proveedor_id: consolidatedOrder.proveedor_id // Pre-seleccionar proveedor si está en la consolidada
    });
    setShowOrderForm(true); // Mostrar modal de creación de orden
    // Opcionalmente, se podría actualizar el estado de la orden consolidada a 'Procesada' en la BD aquí.
    // Ej: supabase.from('ordenes_consolidadas').update({ estado: 'Procesada' }).eq('id', consolidatedOrder.id);
  };

  // --- Renderizado de Pestañas ---
  const renderActiveTabContent = () => {
    switch (activeUITab) {
      case 'solicitudes': // Pestaña de Solicitudes Pendientes
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Solicitudes Pendientes</h2>
              <div className="flex flex-wrap gap-2"> {/* Botones de acción */}
                <button
                  onClick={() => setShowConsolidationModal(true)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-sm whitespace-nowrap"
                >
                  Consolidar Solicitudes
                </button>
                <button
                  onClick={handleCreateDirectOrder}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm whitespace-nowrap"
                >
                  Crear Orden Directa
                </button>
              </div>
            </div>
            <RequestTable // Tabla de solicitudes
              requests={solicitudesPendientes}
              withActions={true} // Mostrar botones de aprobar/rechazar
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
              onRowClick={(req) => { setSelectedRequestDetail(req); setShowRequestDetailsModal(true); }} // Mostrar detalles al hacer clic en fila
            />
          </div>
        );
      case 'historial-solicitudes': // Pestaña de Historial de Solicitudes
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Historial de Solicitudes</h2>
            <RequestTable
              requests={solicitudesHistorial}
              showStatus={true} // Mostrar columna de estado
              onRowClick={(req) => { setSelectedRequestDetail(req); setShowRequestDetailsModal(true); }}
            />
          </div>
        );
      case 'ordenes': // Pestaña de Historial de Órdenes
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Historial de Órdenes</h2>
            <OrderTable
              orders={ordenesHistorial}
              onOrderClick={(order) => { setSelectedOrderDetail(order); setShowOrderDetailsModal(true); }} // Mostrar detalles de orden
              onUpdate={refreshAllData} // Para refrescar tras acciones en la tabla (ej. cambiar estado)
            />
          </div>
        );
      case 'ordenes-consolidadas': // Pestaña de Órdenes Consolidadas
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Órdenes Consolidadas</h2>
            <ConsolidatedOrderTable
              orders={ordenesConsolidadas}
              onOrderClick={(order) => { setSelectedConsolidatedOrderDetail(order); setShowConsolidatedOrderDetailsModal(true); }}
              onConvertToRegularOrder={handleConvertToRegularOrder} // Acción para convertir a orden normal
              onUpdate={refreshAllData} // Para refrescar tras acciones
            />
          </div>
        );
      case 'usuarios': // Pestaña de Gestión de Usuarios
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            {/* El componente UserManagement es autocontenido y maneja su propia obtención de datos */}
            <UserManagement /> 
          </div>
        );
      default: // Contenido por defecto si no hay pestaña activa o es desconocida
        return <p className="text-gray-600 dark:text-gray-400">Selecciona una pestaña del menú lateral para comenzar.</p>;
    }
  };
  
  if (loading) return <LoadingSpinner message="Cargando panel de administrador..." />;
  if (error) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;

  // Renderizado principal del panel
  return (
    <div className="space-y-6">
      {renderActiveTabContent()} {/* Renderizar contenido de la pestaña activa */}

      {/* --- Modales --- */}
      {showOrderForm && selectedRequestForOrder && ( // Modal para crear orden desde solicitud
        <OrderForm
          show={showOrderForm}
          onHide={() => setShowOrderForm(false)}
          userProfile={userProfile} // Pasar perfil del admin
          onSuccess={handleOrderCreated} // Callback tras éxito
          initialProducts={selectedRequestForOrder.initialProducts}
          proveedorId={selectedRequestForOrder.proveedor_id}
          solicitudesIds={selectedRequestForOrder.solicitudes}
        />
      )}
      
      {showDirectOrderForm && ( // Modal para crear orden directa
        <DirectOrderForm
            show={showDirectOrderForm}
            onHide={() => setShowDirectOrderForm(false)}
            userProfile={userProfile}
            onSuccess={handleOrderCreated}
        />
      )}

      {showConsolidationModal && ( // Modal para consolidar solicitudes
        <ConsolidationModal
          show={showConsolidationModal}
          onHide={() => setShowConsolidationModal(false)}
          onConsolidate={handleConsolidationComplete} // Callback tras consolidar
        />
      )}

      {showRequestDetailsModal && selectedRequestDetail && ( // Modal para detalles de solicitud
        <RequestDetailsModal
          show={showRequestDetailsModal}
          onHide={() => setShowRequestDetailsModal(false)}
          request={selectedRequestDetail}
        />
      )}

      {showOrderDetailsModal && selectedOrderDetail && ( // Modal para detalles de orden
        <OrderDetailsModal
          show={showOrderDetailsModal}
          onHide={() => setShowOrderDetailsModal(false)}
          order={selectedOrderDetail}
        />
      )}

      {showConsolidatedOrderDetailsModal && selectedConsolidatedOrderDetail && ( // Modal para detalles de orden consolidada
        <ConsolidatedOrderDetailsModal
          show={showConsolidatedOrderDetailsModal}
          onHide={() => setShowConsolidatedOrderDetailsModal(false)}
          order={selectedConsolidatedOrderDetail}
        />
      )}

      {/* Modal de confirmación tras crear una orden (para generar PDF) */}
      {showPDFConfirmationModal && newlyCreatedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Orden Creada Exitosamente</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              La orden de compra #{newlyCreatedOrder.id} ha sido creada correctamente.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowPDFConfirmationModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md"
              >
                Cerrar
              </button>
              <button
                onClick={() => { // Abrir modal de detalles de orden para que el PDF se pueda generar desde allí
                  setSelectedOrderDetail(newlyCreatedOrder); 
                  setShowOrderDetailsModal(true); // Mostrar modal de detalles de la orden
                  setShowPDFConfirmationModal(false); // Ocultar este modal de confirmación
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
              >
                Ver Detalles y PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};