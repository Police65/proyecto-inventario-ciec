import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Path relative to src/pages
import { SolicitudCompra, OrdenCompra, UserProfile, OrdenConsolidada, Empleado, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, Proveedor, OrdenCompraDetalle as OrdenCompraDetalleType, CategoriaProducto } from '../types'; // Path relative to src/pages
import LoadingSpinner from '../components/core/LoadingSpinner'; // Path relative to src/pages

import RequestTable from '../components/requests/RequestTable';
import OrderTable from '../components/orders/OrderTable';
import UserManagement from '../components/admin/UserManagement';
import ConsolidatedOrderTable from '../components/orders/ConsolidatedOrderTable';

import OrderForm from '../components/orders/OrderForm';
import DirectOrderForm from '../components/orders/DirectOrderForm';
import ConsolidationModal from '../components/orders/ConsolidationModal';
import OrderDetailsModal from '../components/orders/OrderDetailsModal';
import RequestDetailsModal from '../components/requests/RequestDetailsModal';
import ConsolidatedOrderDetailsModal from '../components/orders/ConsolidatedOrderDetailsModal';
import { OrderCompletionForm } from '../components/orders/OrderCompletionForm';


interface AdminDashboardContext {
  userProfile: UserProfile;
  activeUITab: string;
  setActiveUITab: (tab: string) => void;
}

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
  proveedor: Pick<Proveedor, 'id' | 'nombre' | 'rif' | 'direccion'> | null;
  detalles: Array<
    Pick<OrdenCompraDetalleType, 'id' | 'producto_id' | 'cantidad' | 'precio_unitario'> & {
      producto: Pick<Producto, 'id' | 'descripcion'> | null;
    }
  > | null;
  empleado: Pick<Empleado, 'id' | 'nombre' | 'apellido'> | null;
  solicitud_compra: Pick<SolicitudCompra, 'id' | 'descripcion'> | null;
};


export const AdminDashboardPage = (): JSX.Element => {
  const { userProfile, activeUITab, setActiveUITab } = useOutletContext<AdminDashboardContext>();

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
    ...req, // Spread raw data
    // Ensure related objects are correctly typed or undefined if null/not present
    empleado: req.empleado ? {
      ...req.empleado,
      // Fill in required Empleado fields not present in Pick if necessary
      cedula: '', 
      cargo_actual_id: null, 
      departamento_id: req.empleado_id || 0, // Example default
      estado: 'activo', // Example default
    } : undefined,
    departamento: req.departamento || undefined,
    detalles: req.detalles ? req.detalles.map(d => ({
      ...d,
      producto: d.producto ? {
        ...d.producto,
        categoria: d.producto.categoria || undefined,
      } : undefined,
    })) : [], 
  });
  
  const mapOrdenData = (order: RawOrdenFromQuery): OrdenCompra => ({
    ...order, // Spread raw data
    // Ensure related objects are correctly typed or undefined
    proveedor: order.proveedor || undefined,
    empleado: order.empleado ? {
      ...order.empleado,
       cedula: '', cargo_actual_id: null, departamento_id: 0, estado: 'activo', // Example defaults
    } : undefined,
    solicitud_compra: order.solicitud_compra ? { 
        ...order.solicitud_compra,
        fecha_solicitud: '', estado: 'Pendiente', empleado_id:0, departamento_id:0, // Example defaults
    } : undefined,
    detalles: order.detalles ? order.detalles.map(d => ({
      ...d,
      producto: d.producto || undefined,
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

      const commonSelectOrden = `
          id, solicitud_compra_id, proveedor_id, fecha_orden, estado, precio_unitario, sub_total, iva, ret_iva, neto_a_pagar, unidad, observaciones, empleado_id, changed_by, fecha_modificacion, retencion_porcentaje,
          proveedor:proveedor_id(id, nombre, rif, direccion),
          detalles:ordencompra_detalle(id, producto_id, cantidad, precio_unitario, producto:producto_id(id, descripcion)),
          empleado:empleado_id(id, nombre, apellido),
          solicitud_compra:solicitudcompra!ordencompra_solicitud_compra_id_fkey(id, descripcion)
        `;

      const { data: ordersRaw, error: ordersError } = await supabase
        .from('ordencompra')
        .select(commonSelectOrden)
        .order('fecha_orden', { ascending: false })
        .returns<RawOrdenFromQuery[]>();
      if (ordersError) {
        console.error("Error fetching admin dashboard data (orders):", ordersError.message, ordersError.details, ordersError.code, ordersError);
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
      const errorMessage = `Error: ${typedError.message}${typedError.details ? ` Details: ${typedError.details}` : ''}${typedError.code ? ` Code: ${typedError.code}` : ''}`;
      console.error("Error fetching admin dashboard data:", errorMessage, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAllData = () => {
    fetchData();
  };

  const handleApproveRequest = (request: SolicitudCompra) => {
    const initialProducts = request.detalles?.map(d => ({
      producto_id: d.producto_id,
      descripcion: d.producto?.descripcion || 'Producto sin nombre',
      quantity: d.cantidad,
      precio_unitario: 0 
    })) || [];

    setSelectedRequestForOrder({
      initialProducts: initialProducts,
      solicitudes: [request.id], 
      proveedor_id: null 
    });
    setShowOrderForm(true);
  };

  const handleRejectRequest = async (requestId: number) => {
    if (!window.confirm(`¿Está seguro de rechazar la solicitud #${requestId}?`)) return;
    try {
      const { error } = await supabase
        .from('solicitudcompra')
        .update({ estado: 'Rechazada' })
        .eq('id', requestId);
      if (error) throw error;

      const requestToNotify = solicitudesPendientes.find(req => req.id === requestId) ||
                              solicitudesHistorial.find(req => req.id === requestId);
      
      if (requestToNotify && requestToNotify.empleado_id) {
        const {data: profileForNotif, error: profileError} = await supabase
            .from('user_profile')
            .select('id')
            .eq('empleado_id', requestToNotify.empleado_id)
            .single();

        if(profileError) {
            console.warn("Could not fetch profile for notification:", profileError.message, profileError.details);
        }

        if (profileForNotif) {
            const { error: insertNotifError } = await supabase.from('notificaciones').insert([{
            user_id: profileForNotif.id, 
            title: 'Solicitud Rechazada',
            description: `Tu solicitud #${requestId} (${requestToNotify.descripcion || ''}) ha sido rechazada.`,
            created_at: new Date().toISOString(),
            read: false,
            type: 'solicitud_rechazada',
            related_id: requestId
            }]);
            if (insertNotifError) {
                console.error("Error inserting notification for rejection:", insertNotifError.message, insertNotifError.details, insertNotifError.code);
            }
        } else {
             console.warn("No se pudo enviar notificación de rechazo: perfil de usuario no encontrado para empleado ID", requestToNotify.empleado_id);
        }
      } else {
        console.warn("No se pudo enviar notificación de rechazo: datos de empleado faltantes para solicitud ID", requestId);
      }
      refreshAllData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error rejecting request:", errorMessage, err);
      alert("Error al rechazar la solicitud.");
    }
  };

  const handleCreateDirectOrder = () => {
    setShowDirectOrderForm(true);
  };

  const handleOrderCreated = (createdOrder: OrdenCompra) => {
    setNewlyCreatedOrder(createdOrder);
    setShowOrderForm(false);
    setShowDirectOrderForm(false); 
    setShowPDFConfirmationModal(true); 
    refreshAllData();
  };
  
  const handleConsolidationComplete = (newConsolidatedOrder: OrdenConsolidada) => {
    setOrdenesConsolidadas(prev => [newConsolidatedOrder, ...prev]);
    setShowConsolidationModal(false);
    refreshAllData(); 
  };

  const handleConvertToRegularOrder = (consolidatedOrder: OrdenConsolidada) => {
     const initialProducts = (consolidatedOrder.productos as Array<{producto_id: number, descripcion: string, cantidad: number}>).map(p => ({
      producto_id: p.producto_id,
      descripcion: p.descripcion,
      quantity: p.cantidad,
      precio_unitario: 0 
    }));
    setSelectedRequestForOrder({
      initialProducts: initialProducts,
      solicitudes: consolidatedOrder.solicitudes as number[],
      proveedor_id: consolidatedOrder.proveedor_id
    });
    setShowOrderForm(true);
  };


  const renderActiveTabContent = () => {
    switch (activeUITab) {
      case 'solicitudes':
        return (
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Solicitudes Pendientes</h2>
              <div className="flex flex-wrap gap-2">
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
        return <p className="text-gray-600 dark:text-gray-400">Selecciona una pestaña del menú lateral.</p>;
    }
  };
  
  if (loading) return <LoadingSpinner message="Cargando dashboard de administrador..." />;
  if (error) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;

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
              La orden #{newlyCreatedOrder.id} ha sido creada.
            </p>
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