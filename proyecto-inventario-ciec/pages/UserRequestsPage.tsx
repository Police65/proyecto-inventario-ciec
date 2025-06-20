
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
  activeUITab: string; // From Layout's Outlet context
}

// Type definitions for raw data from Supabase queries to help with mapping
// Similar to AdminDashboardPage's RawSolicitudFromQuery
type RawSolicitudFromUserQuery = Omit<SolicitudCompra, 'empleado' | 'departamento' | 'detalles'> & {
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


const UserRequestsPage: React.FC = () => {
  const { userProfile, activeUITab } = useOutletContext<UserRequestsPageContext>();
  
  const [requests, setRequests] = useState<SolicitudCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequestDetailsModal, setShowRequestDetailsModal] = useState(false);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<SolicitudCompra | null>(null);

  const mapSolicitudData = useCallback((req: RawSolicitudFromUserQuery): SolicitudCompra => ({
    id: req.id,
    descripcion: req.descripcion,
    fecha_solicitud: req.fecha_solicitud,
    estado: req.estado,
    empleado_id: req.empleado_id,
    departamento_id: req.departamento_id,
    created_at: new Date().toISOString(), // Added default
    updated_at: new Date().toISOString(), // Added default
    empleado: req.empleado ? {
      id: req.empleado.id,
      nombre: req.empleado.nombre,
      apellido: req.empleado.apellido,
      cedula: '', 
      cargo_actual_id: null, 
      departamento_id: req.empleado_id, 
      estado: 'activo', 
      created_at: new Date().toISOString(), // Added default
      updated_at: new Date().toISOString(), // Added default
      user_profile: undefined, 
    } : undefined,
    departamento: req.departamento ? { 
      id: req.departamento.id, 
      nombre: req.departamento.nombre,
      created_at: new Date().toISOString(), // Added default
      updated_at: new Date().toISOString(), // Added default
    } : undefined,
    detalles: req.detalles ? req.detalles.map(d => ({
      id: d.id,
      solicitud_compra_id: d.solicitud_compra_id,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      created_at: new Date().toISOString(), // Added default
      updated_at: new Date().toISOString(), // Added default
      producto: d.producto ? {
        id: d.producto.id,
        descripcion: d.producto.descripcion,
        categoria_id: d.producto.categoria_id,
        created_at: new Date().toISOString(), // Added default
        updated_at: new Date().toISOString(), // Added default
        categoria: d.producto.categoria ? {
            ...d.producto.categoria,
            created_at: new Date().toISOString(), // Added default
            updated_at: new Date().toISOString(), // Added default
        } : undefined,
      } : undefined,
    })) : undefined,
  }), []);

  useEffect(() => {
    const fetchUserRequests = async () => {
      if (!userProfile?.empleado_id) {
        setError("Perfil de empleado no encontrado.");
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
            departamento:departamento_id(id, nombre)
        `;

        let query = supabase
          .from('solicitudcompra')
          .select(commonSelectSolicitud)
          .eq('empleado_id', userProfile.empleado_id);

        if (activeUITab === 'solicitudes') { // Pending requests for "Solicitudes" tab
          query = query.eq('estado', 'Pendiente');
        } else if (activeUITab === 'historial-solicitudes') { // History for "Historial Solicitudes" tab
          query = query.in('estado', ['Aprobada', 'Rechazada']);
        }
        
        query = query.order('fecha_solicitud', { ascending: false });

        const { data: rawRequests, error: fetchError } = await query.returns<RawSolicitudFromUserQuery[]>();

        if (fetchError) {
          console.error("Error fetching user requests:", fetchError.message, fetchError.details, fetchError.code, fetchError);
          throw fetchError;
        }
        setRequests((rawRequests || []).map(mapSolicitudData));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError("Error al cargar solicitudes: " + errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRequests();
  }, [userProfile, activeUITab, mapSolicitudData]);

  const handleRowClick = (request: SolicitudCompra) => {
    setSelectedRequestDetail(request);
    setShowRequestDetailsModal(true);
  };
  
  const getPageTitle = () => {
    if (activeUITab === 'solicitudes') return "Mis Solicitudes Pendientes";
    if (activeUITab === 'historial-solicitudes') return "Mi Historial de Solicitudes";
    return "Mis Solicitudes";
  };

  if (loading) return <LoadingSpinner message="Cargando tus solicitudes..." />;
  if (error) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">{getPageTitle()}</h2>
        <RequestTable
          requests={requests}
          showStatus={true} // Always show status for user's own requests
          onRowClick={handleRowClick}
        />
      </div>

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

export default UserRequestsPage;
