import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SolicitudCompra, UserProfile, Empleado, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, CategoriaProducto } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import RequestTable from '../components/requests/RequestTable';
import RequestDetailsModal from '../components/requests/RequestDetailsModal';

interface UserRequestsPageContext {
  userProfile: UserProfile;
  activeUITab: string; // From Outlet context
}

// Fixed type definition
type RawSolicitudFromUserQuery = Omit<SolicitudCompra, 'empleado' | 'departamento' | 'detalles'> & {
  empleado: Pick<Empleado, 'id' | 'nombre' | 'apellido'> | null;
  departamento: Pick<Departamento, 'id' | 'nombre' | 'estado'> | null;
  detalles: Array<
    Pick<SolicitudCompraDetalleType, 'id' | 'solicitud_compra_id' | 'producto_id' | 'cantidad'> & {
      producto: (Pick<Producto, 'id' | 'descripcion' | 'categoria_id'> & {
          categoria: Pick<CategoriaProducto, 'id' | 'nombre'> | null;
      }) | null;
    }
  > | null;
};

// Data mapping function, similar to AdminDashboardPage
const mapSolicitudData = (req: RawSolicitudFromUserQuery): SolicitudCompra => ({
  id: req.id,
  descripcion: req.descripcion,
  fecha_solicitud: req.fecha_solicitud,
  estado: req.estado,
  empleado_id: req.empleado_id,
  departamento_id: req.departamento_id,
  created_at: new Date().toISOString(), 
  updated_at: new Date().toISOString(),
  empleado: req.empleado ? { 
    id: req.empleado.id, nombre: req.empleado.nombre, apellido: req.empleado.apellido,
    cedula: '', cargo_actual_id: null, departamento_id: req.empleado_id, estado: 'activo',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } : undefined,
  departamento: req.departamento ? { 
    id: req.departamento.id, nombre: req.departamento.nombre,
    estado: req.departamento.estado,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } : undefined,
  detalles: req.detalles ? req.detalles.map(d => ({ 
    id: d.id, solicitud_compra_id: d.solicitud_compra_id, producto_id: d.producto_id,
    cantidad: d.cantidad, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    producto: d.producto ? { 
      id: d.producto.id, descripcion: d.producto.descripcion, categoria_id: d.producto.categoria_id,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      categoria: d.producto.categoria ? { ...d.producto.categoria, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } : undefined,
    } : undefined,
  })) : [], 
});

export const UserRequestsPage: React.FC = () => {
  const { userProfile, activeUITab } = useOutletContext<UserRequestsPageContext>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudCompra[]>([]);
  const [solicitudesHistorial, setSolicitudesHistorial] = useState<SolicitudCompra[]>([]);
  
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<SolicitudCompra | null>(null);
  const [showRequestDetailsModal, setShowRequestDetailsModal] = useState(false);

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
        id, descripcion, fecha_solicitud, estado, empleado_id, departamento_id,
        detalles:solicitudcompra_detalle(id, solicitud_compra_id, producto_id, cantidad, producto:producto_id(id, descripcion, categoria_id, categoria:categoria_id(id, nombre))),
        empleado:empleado_id(id, nombre, apellido),
        departamento:departamento_id(id, nombre, estado)
      `;

      const { data: pendingRaw, error: pendingError } = await supabase
        .from('solicitudcompra')
        .select(commonSelectSolicitud)
        .eq('empleado_id', userProfile.empleado_id)
        .eq('estado', 'Pendiente')
        .order('fecha_solicitud', { ascending: false })
        .returns<RawSolicitudFromUserQuery[]>();
      if (pendingError) throw pendingError;
      setSolicitudesPendientes((pendingRaw || []).map(mapSolicitudData));

      const { data: historyRaw, error: historyError } = await supabase
        .from('solicitudcompra')
        .select(commonSelectSolicitud)
        .eq('empleado_id', userProfile.empleado_id)
        .in('estado', ['Aprobada', 'Rechazada'])
        .order('fecha_solicitud', { ascending: false })
        .returns<RawSolicitudFromUserQuery[]>();
      if (historyError) throw historyError;
      setSolicitudesHistorial((historyRaw || []).map(mapSolicitudData));

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
        />
      )}
    </div>
  );
};
