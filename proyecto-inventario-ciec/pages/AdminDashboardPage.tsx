import { useState, useEffect } from 'react';
// @ts-ignore: Ignorar error de tipo para react-router-dom si es necesario por el entorno de esm.sh
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SolicitudCompra, OrdenCompra, UserProfile, OrdenConsolidada, Empleado, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, Proveedor, OrdenCompraDetalle as OrdenCompraDetalleType, CategoriaProducto, NotificacionInsert } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { THRESHOLD_ORDEN_GRANDE } from '../config'; // Importar umbral de valor
import { createNotifications, fetchAdminUserIds, fetchUserAuthIdByEmpleadoId } from '../services/notificationService'; // Importar servicio de notificaciones

// Importar componentes individuales que conforman el dashboard
import RequestTable from '../components/requests/RequestTable';
import OrderTable from '../components/orders/OrderTable';
import UserManagement from '../components/admin/UserManagement';
import ConsolidatedOrderTable from '../components/orders/ConsolidatedOrderTable';

// Modales
import { OrderForm } from '@/components/orders/OrderForm'; 
import { DirectOrderForm } from '@/components/orders/DirectOrderForm'; 
import ConsolidationModal from '../components/orders/ConsolidationModal';
import OrderDetailsModal from '../components/orders/OrderDetailsModal';
import RequestDetailsModal from '../components/requests/RequestDetailsModal';
import ConsolidatedOrderDetailsModal from '../components/orders/ConsolidatedOrderDetailsModal';

interface AdminDashboardContext {
  userProfile: UserProfile; // Perfil del administrador logueado
  activeUITab: string; // Pestaña activa actualmente en la UI (ej. 'solicitudes', 'ordenes')
  setActiveUITab: (tab: string) => void; // Función para cambiar la pestaña activa
}

// Definiciones de tipo para datos crudos de consultas Supabase
type RawSolicitudFromQuery = Omit<SolicitudCompra, 'empleado' | 'departamento' | 'detalles'> & {
  empleado: Pick<Empleado, 'id' | 'nombre' | 'apellido'> | null;
  departamento: Pick<Departamento, 'id' | 'nombre'> | null;
  detalles: Array<
    Pick<SolicitudCompraDetalleType, 'id' | 'solicitud_compra_id' | 'producto_id' | 'cantidad'> & {
      producto: (Pick<Producto, 'id' | 'descripcion' | 'categoria_id'> & {
          categoria: Pick<CategoriaProducto, 'id' | 'nombre'> | null; 
      }) | null; 
    }
  > | null; 
};

type RawOrdenFromQuery = Omit<OrdenCompra, 'proveedor' | 'detalles' | 'empleado' | 'solicitud_compra'> & {
  proveedor: Pick<Proveedor, 'id' | 'nombre' | 'rif' | 'direccion' | 'tipo_contribuyente' | 'porcentaje_retencion_iva' | 'estado'> | null;
  detalles: Array<
    Pick<OrdenCompraDetalleType, 'id' | 'producto_id' | 'cantidad' | 'precio_unitario'> & {
      producto: Pick<Producto, 'id' | 'descripcion'> | null;
    }
  > | null;
  empleado: Pick<Empleado, 'id' | 'nombre' | 'apellido'> | null;
  solicitud_compra: Pick<SolicitudCompra, 'id' | 'descripcion' | 'empleado_id'> | null; // Se añadió empleado_id
};

const commonSelectOrden = `
    id, solicitud_compra_id, proveedor_id, fecha_orden, estado, precio_unitario, sub_total, iva, ret_iva, neto_a_pagar, unidad, observaciones, empleado_id, changed_by, fecha_modificacion, retencion_porcentaje, fecha_entrega_estimada, fecha_entrega_real,
    proveedor:proveedor_id(id, nombre, rif, direccion, estado, tipo_contribuyente, porcentaje_retencion_iva),
    detalles:ordencompra_detalle(id, producto_id, cantidad, precio_unitario, producto:producto_id(id, descripcion)),
    empleado:empleado_id(id, nombre, apellido),
    solicitud_compra:solicitudcompra!ordencompra_solicitud_compra_id_fkey(id, descripcion, empleado_id)
  `;

export const AdminDashboardPage = (): React.ReactElement => {
  const { userProfile, activeUITab } = useOutletContext<AdminDashboardContext>();

  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null); 

  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudCompra[]>([]);
  const [solicitudesHistorial, setSolicitudesHistorial] = useState<SolicitudCompra[]>([]);
  const [ordenesHistorial, setOrdenesHistorial] = useState<OrdenCompra[]>([]);
  const [ordenesConsolidadas, setOrdenesConsolidadas] = useState<OrdenConsolidada[]>([]);

  const [showOrderForm, setShowOrderForm] = useState(false); 
  const [showDirectOrderForm, setShowDirectOrderForm] = useState(false); 
  const [showConsolidationModal, setShowConsolidationModal] = useState(false); 

  const [selectedRequestForOrder, setSelectedRequestForOrder] = useState<{initialProducts: any[], solicitudes: number[], proveedor_id: number | null} | null>(null);

  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false); 
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrdenCompra | null>(null); 

  const [showRequestDetailsModal, setShowRequestDetailsModal] = useState(false); 
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<SolicitudCompra | null>(null); 

  const [showConsolidatedOrderDetailsModal, setShowConsolidatedOrderDetailsModal] = useState(false); 
  const [selectedConsolidatedOrderDetail, setSelectedConsolidatedOrderDetail] = useState<OrdenConsolidada | null>(null);

  const [newlyCreatedOrder, setNewlyCreatedOrder] = useState<OrdenCompra | null>(null);
  const [showPDFConfirmationModal, setShowPDFConfirmationModal] = useState(false);

  const mapSolicitudData = (req: RawSolicitudFromQuery): SolicitudCompra => ({
    id: req.id,
    descripcion: req.descripcion,
    fecha_solicitud: req.fecha_solicitud,
    estado: req.estado,
    empleado_id: req.empleado_id,
    departamento_id: req.departamento_id,
    created_at: new Date().toISOString(), 
    updated_at: new Date().toISOString(), 
    empleado: req.empleado ? { 
      id: req.empleado.id,
      nombre: req.empleado.nombre,
      apellido: req.empleado.apellido,
      cedula: '', cargo_actual_id: null, departamento_id: req.empleado_id, estado: 'activo',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_profile: undefined,
    } : undefined,
    departamento: req.departamento ? { 
      id: req.departamento.id, nombre: req.departamento.nombre,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } : undefined,
    detalles: req.detalles ? req.detalles.map(d => ({ 
      id: d.id,
      solicitud_compra_id: d.solicitud_compra_id,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      producto: d.producto ? { 
        id: d.producto.id,
        descripcion: d.producto.descripcion,
        categoria_id: d.producto.categoria_id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        categoria: d.producto.categoria ? { 
            ...d.producto.categoria,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        } : undefined,
      } : undefined,
    })) : [], 
  });

  const mapOrdenData = (order: RawOrdenFromQuery): OrdenCompra => ({
    id: order.id,
    solicitud_compra_id: order.solicitud_compra_id,
    proveedor_id: order.proveedor_id,
    fecha_orden: order.fecha_orden,
    estado: order.estado,
    precio_unitario: order.precio_unitario, 
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
    fecha_entrega_estimada: order.fecha_entrega_estimada,
    fecha_entrega_real: order.fecha_entrega_real,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    proveedor: order.proveedor ? { 
      id: order.proveedor.id, nombre: order.proveedor.nombre, rif: order.proveedor.rif, direccion: order.proveedor.direccion,
      estado: order.proveedor.estado,
      tipo_contribuyente: order.proveedor.tipo_contribuyente,
      porcentaje_retencion_iva: order.proveedor.porcentaje_retencion_iva,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } : undefined,
    empleado: order.empleado ? { 
      id: order.empleado.id, nombre: order.empleado.nombre, apellido: order.empleado.apellido,
      cedula: '', cargo_actual_id: null, departamento_id: 0, estado: 'activo',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } : undefined,
    solicitud_compra: order.solicitud_compra ? { 
        id: order.solicitud_compra.id,
        descripcion: order.solicitud_compra.descripcion,
        fecha_solicitud: '', estado: 'Pendiente', empleado_id: order.solicitud_compra.empleado_id, departamento_id:0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } : undefined,
    detalles: order.detalles ? order.detalles.map(d => ({ 
      id: d.id,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      orden_compra_id: order.id,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      producto: d.producto ? { 
        id: d.producto.id,
        descripcion: d.producto.descripcion,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } : undefined,
    })) : [], 
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const commonSelectSolicitud = `
        id, descripcion, fecha_solicitud, estado, empleado_id, departamento_id,
        detalles:solicitudcompra_detalle(id, solicitud_compra_id, producto_id, cantidad, producto:producto_id(id, descripcion, categoria_id, categoria:categoria_id(id, nombre))),
        empleado:empleado_id(id, nombre, apellido),
        departamento:departamento_id(id, nombre)
      `;

      const { data: pendingRaw, error: pendingError } = await supabase
        .from('solicitudcompra')
        .select(commonSelectSolicitud)
        .eq('estado', 'Pendiente')
        .order('fecha_solicitud', { ascending: false }) 
        .returns<RawSolicitudFromQuery[]>(); 
      if (pendingError) throw pendingError;
      setSolicitudesPendientes((pendingRaw || []).map(mapSolicitudData));

      const { data: historyRaw, error: historyError } = await supabase
        .from('solicitudcompra')
        .select(commonSelectSolicitud)
        .in('estado', ['Aprobada', 'Rechazada'])
        .order('fecha_solicitud', { ascending: false })
        .returns<RawSolicitudFromQuery[]>();
      if (historyError) throw historyError;
      setSolicitudesHistorial((historyRaw || []).map(mapSolicitudData));

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

      const { data: consolidated, error: consolidatedError } = await supabase
        .from('ordenes_consolidadas')
        .select('*, proveedor:proveedor_id(id, nombre)') 
        .order('fecha_creacion', { ascending: false });
      if (consolidatedError) throw consolidatedError;
       setOrdenesConsolidadas((consolidated || []).map((oc: any) => ({
        ...oc,
        productos: Array.isArray(oc.productos) ? oc.productos : JSON.parse(oc.productos || '[]'),
        solicitudes: Array.isArray(oc.solicitudes) ? oc.solicitudes : JSON.parse(oc.solicitudes || '[]'),
        proveedor: oc.proveedor ? {
            id: oc.proveedor.id,
            nombre: oc.proveedor.nombre,
        } : undefined,
      })));
    } catch (err) {
      const typedError = err as { message: string, details?: string, code?: string };
      const errorMessage = `Error: ${typedError.message}${typedError.details ? ` Detalles: ${typedError.details}` : ''}${typedError.code ? ` Código: ${typedError.code}` : ''}`;
      console.error("Error al obtener datos del panel de administrador:", errorMessage, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refreshAllData = () => {
    fetchData();
  };

  const handleApproveRequest = (request: SolicitudCompra) => {
    const initialProducts = request.detalles?.map(d => ({
      id: d.producto_id, 
      producto_id: d.producto_id,
      descripcion: d.producto?.descripcion || 'Producto sin nombre',
      quantity: d.cantidad,
      precio_unitario: 0,
      selected: true, 
      isNewProduct: false, 
      categoria_id: d.producto?.categoria_id,
      codigo_interno: d.producto?.codigo_interno,
      unidad_medida: d.producto?.unidad_medida,
    })) || [];

    setSelectedRequestForOrder({
      initialProducts: initialProducts,
      solicitudes: [request.id],
      proveedor_id: null
    });
    setShowOrderForm(true);
  };

  const handleRejectRequest = async (requestId: number) => {
    if (!window.confirm(`¿Está seguro de rechazar la solicitud #${requestId}? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase
        .from('solicitudcompra')
        .update({ estado: 'Rechazada' })
        .eq('id', requestId);
      if (error) throw error;

      const requestToNotify = solicitudesPendientes.find(req => req.id === requestId) ||
                              solicitudesHistorial.find(req => req.id === requestId);

      if (requestToNotify && requestToNotify.empleado_id) {
        const userAuthId = await fetchUserAuthIdByEmpleadoId(requestToNotify.empleado_id);
        if(userAuthId) {
            const notifPayload: NotificacionInsert = {
                user_id: userAuthId,
                title: 'Solicitud Rechazada',
                description: `Tu solicitud #${requestId} ("${requestToNotify.descripcion || 'Sin descripción adicional'}") ha sido rechazada.`,
                type: 'solicitud_rechazada',
            };
            await createNotifications([notifPayload]);
        } else {
             console.warn("No se pudo enviar notificación de rechazo: perfil de usuario no encontrado para empleado ID", requestToNotify.empleado_id);
        }
      } else {
        console.warn("No se pudo enviar notificación de rechazo: datos de empleado faltantes para solicitud ID", requestId);
      }
      refreshAllData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error al rechazar solicitud:", errorMessage, err);
      alert("Error al rechazar la solicitud.");
    }
  };

  const handleCreateDirectOrder = () => {
    setShowDirectOrderForm(true);
  };

  const handleOrderCreated = async (createdOrderInfo: Pick<OrdenCompra, 'id'>) => {
    setShowOrderForm(false);
    setShowDirectOrderForm(false);
    setLoading(true);
    setError(null);
    let fullOrderData: OrdenCompra | null = null;

    try {
      const { data: rawFullOrder, error: fetchError } = await supabase
          .from('ordencompra')
          .select(commonSelectOrden) // Uses the detailed select string
          .eq('id', createdOrderInfo.id)
          .single<RawOrdenFromQuery>();

      if (fetchError || !rawFullOrder) {
          console.error("Error fetching full order details after creation in AdminDashboardPage:", fetchError);
          setError(fetchError?.message || "No se pudo obtener los detalles completos de la orden creada.");
          fullOrderData = { id: createdOrderInfo.id } as OrdenCompra; // Fallback for PDF modal
      } else {
          fullOrderData = mapOrdenData(rawFullOrder);
      }
      setNewlyCreatedOrder(fullOrderData);

      const notificationsToCreate: NotificacionInsert[] = [];
      const adminUserIds = await fetchAdminUserIds();

      // Notificar a los administradores sobre la nueva orden
      if (adminUserIds.length > 0) {
        notificationsToCreate.push(...adminUserIds.map(adminId => ({
          user_id: adminId,
          title: 'Nueva Orden de Compra Creada',
          description: `Se ha creado la orden de compra #${fullOrderData!.id}. Proveedor: ${fullOrderData!.proveedor?.nombre || 'N/D'}.`,
          type: 'orden_creada',
        })));

        // Verificar si la orden tiene un valor elevado
        if (fullOrderData!.neto_a_pagar > THRESHOLD_ORDEN_GRANDE) {
          notificationsToCreate.push(...adminUserIds.map(adminId => ({
            user_id: adminId,
            title: 'Alerta de Gasto Elevado en Orden',
            description: `La orden de compra #${fullOrderData!.id} supera el umbral de gasto (${THRESHOLD_ORDEN_GRANDE.toLocaleString('es-VE')} Bs) con un total de ${fullOrderData!.neto_a_pagar.toLocaleString('es-VE')} Bs.`,
            type: 'alerta_gasto_orden',
          })));
        }
      }

      // Notificar al usuario si la orden proviene de su(s) solicitud(es)
      if (fullOrderData?.solicitud_compra_id && fullOrderData.solicitud_compra?.empleado_id) {
          const requesterAuthId = await fetchUserAuthIdByEmpleadoId(fullOrderData.solicitud_compra.empleado_id);
          if (requesterAuthId) {
            notificationsToCreate.push({
              user_id: requesterAuthId,
              title: 'Solicitud Aprobada y Orden Creada',
              description: `Tu solicitud #${fullOrderData.solicitud_compra_id} ha sido aprobada y se generó la orden de compra #${fullOrderData.id}.`,
              type: 'solicitud_aprobada',
            });
          }
      }
      // Nota: esta parte necesita ajustarse si handleOrderCreated se llama también desde un flujo de consolidación que pasa múltiples solicitud_ids.
      // Por ahora, asume una única solicitud_compra_id vinculada a la orden, o una orden directa.

      if(notificationsToCreate.length > 0) {
        await createNotifications(notificationsToCreate);
      }

    } catch (e) {
        const catchedError = e as Error;
        console.error("Exception fetching full order details or sending notifications:", catchedError);
        setError(catchedError.message || "Excepción al obtener detalles de la orden o enviar notificaciones.");
        if (!newlyCreatedOrder) setNewlyCreatedOrder({ id: createdOrderInfo.id } as OrdenCompra); // Fallback para PDF
    } finally {
        setLoading(false);
        setShowPDFConfirmationModal(true);
        refreshAllData();
    }
  };


  const handleConsolidationComplete = (newConsolidatedOrder: OrdenConsolidada) => {
    setOrdenesConsolidadas(prev => [newConsolidatedOrder, ...prev]);
    setShowConsolidationModal(false);
    refreshAllData();
  };

  const handleConvertToRegularOrder = (consolidatedOrder: OrdenConsolidada) => {
     const initialProducts = (consolidatedOrder.productos as Array<{producto_id: number, descripcion: string, cantidad: number}>).map(p => ({
      id: p.producto_id, 
      producto_id: p.producto_id,
      descripcion: p.descripcion,
      quantity: p.cantidad,
      precio_unitario: 0,
      selected: true,
      isNewProduct: false,
    }));
    setSelectedRequestForOrder({
      initialProducts: initialProducts,
      solicitudes: consolidatedOrder.solicitudes as number[],
      proveedor_id: consolidatedOrder.proveedor_id ?? null
    });
    setShowOrderForm(true);
  };

  const renderActiveTabContent = () => {
    switch (activeUITab) {
      case 'solicitudes':
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white shrink-0">Solicitudes Pendientes</h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full">
                <button
                  onClick={() => setShowConsolidationModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-sm whitespace-nowrap shadow-sm"
                >
                  Consolidar Solicitudes
                </button>
                <button
                  onClick={handleCreateDirectOrder}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm whitespace-nowrap shadow-sm"
                >
                  Crear Orden Directa
                </button>
              </div>
            </div>
            <RequestTable
              requests={solicitudesPendientes}
              withActions={true}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
              onRowClick={(req) => { setSelectedRequestDetail(req); setShowRequestDetailsModal(true); }}
            />
          </div>
        );
      case 'historial-solicitudes':
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Historial de Solicitudes</h2>
            <RequestTable
              requests={solicitudesHistorial}
              showStatus={true}
              onRowClick={(req) => { setSelectedRequestDetail(req); setShowRequestDetailsModal(true); }}
            />
          </div>
        );
      case 'ordenes':
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Historial de Órdenes</h2>
            <OrderTable
              orders={ordenesHistorial}
              onOrderClick={(order) => { setSelectedOrderDetail(order); setShowOrderDetailsModal(true); }}
              onUpdate={refreshAllData}
            />
          </div>
        );
      case 'ordenes-consolidadas':
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Órdenes Consolidadas</h2>
            <ConsolidatedOrderTable
              orders={ordenesConsolidadas}
              onOrderClick={(order) => { setSelectedConsolidatedOrderDetail(order); setShowConsolidatedOrderDetailsModal(true); }}
              onConvertToRegularOrder={handleConvertToRegularOrder}
              onUpdate={refreshAllData}
            />
          </div>
        );
      case 'usuarios':
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <UserManagement />
          </div>
        );
      default:
        return <p className="text-gray-600 dark:text-gray-400">Selecciona una pestaña del menú lateral para comenzar.</p>;
    }
  };

  if (loading && !showPDFConfirmationModal) return <LoadingSpinner message="Cargando panel de administrador..." />;
  if (error && !newlyCreatedOrder) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;


  return (
    <div className="space-y-6">
      {renderActiveTabContent()}

      {showOrderForm && selectedRequestForOrder && (
        <OrderForm
          show={showOrderForm}
          onHide={() => setShowOrderForm(false)}
          userProfile={userProfile}
          onSuccess={handleOrderCreated}
          initialProducts={selectedRequestForOrder.initialProducts}
          proveedorId={selectedRequestForOrder.proveedor_id}
          solicitudesIds={selectedRequestForOrder.solicitudes}
        />
      )}

      {showDirectOrderForm && (
        <DirectOrderForm
            show={showDirectOrderForm}
            onHide={() => setShowDirectOrderForm(false)}
            userProfile={userProfile}
            onSuccess={handleOrderCreated}
        />
      )}

      {showConsolidationModal && (
        <ConsolidationModal
          show={showConsolidationModal}
          onHide={() => setShowConsolidationModal(false)}
          onConsolidate={handleConsolidationComplete}
        />
      )}

      {showRequestDetailsModal && selectedRequestDetail && (
        <RequestDetailsModal
          show={showRequestDetailsModal}
          onHide={() => setShowRequestDetailsModal(false)}
          request={selectedRequestDetail}
        />
      )}

      {showOrderDetailsModal && selectedOrderDetail && (
        <OrderDetailsModal
          show={showOrderDetailsModal}
          onHide={() => setShowOrderDetailsModal(false)}
          order={selectedOrderDetail}
        />
      )}

      {showConsolidatedOrderDetailsModal && selectedConsolidatedOrderDetail && (
        <ConsolidatedOrderDetailsModal
          show={showConsolidatedOrderDetailsModal}
          onHide={() => setShowConsolidatedOrderDetailsModal(false)}
          order={selectedConsolidatedOrderDetail}
        />
      )}

      {showPDFConfirmationModal && newlyCreatedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Orden Creada Exitosamente</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              La orden de compra #{newlyCreatedOrder.id} ha sido creada correctamente.
            </p>
            {error && <p className="mt-2 text-sm text-red-500 dark:text-red-300">Advertencia: {error}</p>}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowPDFConfirmationModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setSelectedOrderDetail(newlyCreatedOrder);
                  setShowOrderDetailsModal(true);
                  setShowPDFConfirmationModal(false);
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