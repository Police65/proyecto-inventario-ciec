
import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SolicitudCompra, UserProfile, Empleado, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, CategoriaProducto, OrdenCompra } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import RequestTable from '../components/requests/RequestTable';
import RequestDetailsModal from '../components/requests/RequestDetailsModal';
import SimplifiedOrderViewModal from '../components/orders/SimplifiedOrderViewModal'; // Importar nuevo modal

interface UserRequestsPageContext {
  userProfile: UserProfile;
  activeUITab: string; // From Outlet context
}

export const UserRequestsPage: React.FC = () => {
  const { userProfile, activeUITab } = useOutletContext<UserRequestsPageContext>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudCompra[]>([]);
  const [solicitudesHistorial, setSolicitudesHistorial] = useState<SolicitudCompra[]>([]);
  
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<SolicitudCompra | null>(null);
  const [showRequestDetailsModal, setShowRequestDetailsModal] = useState(false);
  
  const [selectedOrderForSummary, setSelectedOrderForSummary] = useState<OrdenCompra | null>(null);
  const [showOrderSummaryModal, setShowOrderSummaryModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userProfile?.empleado_id) {
      setError("No se pudo identificar al empleado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const commonSelectSolicitud = `
        id, codigo_visible, descripcion, fecha_solicitud, estado, empleado_id, departamento_id, created_at, updated_at,
        detalles:solicitudcompra_detalle(id, solicitud_compra_id, producto_id, cantidad, descripcion_producto_personalizado, categoria_producto_sugerida_id, categoria_sugerida_nombre, producto:producto_id(id, descripcion, categoria_id, categoria:categoria_id(id, nombre))),
        empleado:empleado_id(id, nombre, apellido),
        departamento:departamento_id(id, nombre, estado)
      `;

      // FIX: Explicitly type the return to avoid 'never' type issues.
      const { data: requestsRaw, error: requestsError } = await supabase
        .from('solicitudcompra')
        .select(commonSelectSolicitud)
        .eq('empleado_id', userProfile.empleado_id)
        .not('descripcion', 'ilike', 'Orden Directa%') // FILTRO AGREGADO: Excluir órdenes directas
        .order('fecha_solicitud', { ascending: false })
        .returns<any[]>(); // Use any[] for complex select

      if (requestsError) throw requestsError;
      if (!requestsRaw) {
        setSolicitudesPendientes([]);
        setSolicitudesHistorial([]);
        return;
      }

      // Obtener órdenes vinculadas
      const requestIds = requestsRaw.map(r => r.id);
      // FIX: Explicitly type the return to avoid 'never' type issues.
      const { data: links, error: linkError } = await supabase
        .from('orden_solicitud').select('solicitud_id, ordencompra_id').in('solicitud_id', requestIds)
        .returns<{solicitud_id: number, ordencompra_id: number}[]>();
      if (linkError) throw linkError;

      const orderIds = Array.from(new Set(links?.map(l => l.ordencompra_id) || []));
      let orders: OrdenCompra[] = [];
      if (orderIds.length > 0) {
        const { data: ordersData, error: orderError } = await supabase
          .from('ordencompra')
          .select('*, proveedor:proveedor_id(*), detalles:ordencompra_detalle(*, producto:producto_id(*))')
          .in('id', orderIds);
        if (orderError) throw orderError;
        orders = ordersData || [];
      }
      
      const ordersMap = new Map(orders.map(o => [o.id, o]));
      const linksMap = new Map<number, number[]>();
      links?.forEach(link => {
        if (!linksMap.has(link.solicitud_id)) linksMap.set(link.solicitud_id, []);
        linksMap.get(link.solicitud_id)!.push(link.ordencompra_id);
      });
      
      const requestsWithOrders: SolicitudCompra[] = (requestsRaw as any[]).map(req => {
        const linkedOrderIds = linksMap.get(req.id) || [];
        const reqOrders = linkedOrderIds.map(oid => ordersMap.get(oid)).filter((o): o is OrdenCompra => !!o);
        return { ...req, ordenes: reqOrders };
      });
      
      setSolicitudesPendientes(requestsWithOrders.filter(r => r.estado === 'Pendiente'));
      setSolicitudesHistorial(requestsWithOrders.filter(r => r.estado === 'Aprobada' || r.estado === 'Rechazada'));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error al obtener solicitudes del usuario:", errorMessage, err);
      setError(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [userProfile.empleado_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleShowDetails = (request: SolicitudCompra) => {
    setSelectedRequestDetail(request);
    setShowRequestDetailsModal(true);
  };
  
  const handleShowOrderSummary = (order: OrdenCompra) => {
    setSelectedOrderForSummary(order);
    setShowOrderSummaryModal(true);
  };

  const handleCloneRequest = (request: SolicitudCompra) => {
    if (window.confirm(`¿Desea clonar la solicitud #${request.codigo_visible || request.id} para crear una nueva?`)) {
      navigate('/new-request', { state: { requestToClone: request } });
    }
  };

  const handleEditRequest = (request: SolicitudCompra) => {
    // Navegar a la página de formulario con la solicitud a editar en el estado
    navigate('/new-request', { state: { requestToEdit: request } });
  };

  const renderContent = () => {
    if (loading) {
      return <LoadingSpinner message="Cargando tus solicitudes..." />;
    }
    if (error) {
      return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;
    }
    
    // The sidebar controls which tab is active via 'activeUITab'
    if (activeUITab === 'historial-solicitudes') {
      return (
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Historial de Solicitudes</h2>
          <RequestTable
            requests={solicitudesHistorial}
            showStatus={true}
            userActions={true} // Habilitar acciones de usuario (clonar)
            onClone={handleCloneRequest} // Pasar la función de clonar
            onRowClick={handleShowDetails}
          />
        </div>
      );
    }
    
    // Default tab is pending requests
    return (
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Mis Solicitudes Pendientes</h2>
        <RequestTable
          requests={solicitudesPendientes}
          showStatus={true}
          userActions={true}
          onEdit={handleEditRequest} // Permitir editar si está pendiente
          onRowClick={handleShowDetails}
        />
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      {renderContent()}
      
      {showRequestDetailsModal && selectedRequestDetail && (
        <RequestDetailsModal
          show={showRequestDetailsModal}
          onHide={() => setShowRequestDetailsModal(false)}
          request={selectedRequestDetail}
          onViewOrder={handleShowOrderSummary}
        />
      )}

      {showOrderSummaryModal && selectedOrderForSummary && (
        <SimplifiedOrderViewModal
          show={showOrderSummaryModal}
          onHide={() => setShowOrderSummaryModal(false)}
          order={selectedOrderForSummary}
        />
      )}
    </div>
  );
};
