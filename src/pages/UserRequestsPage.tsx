import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Path relative to src/pages
import { SolicitudCompra, UserProfile, Empleado, Departamento, Producto, SolicitudCompraDetalle as SolicitudCompraDetalleType, CategoriaProducto } from '../types'; // Path relative to src/pages
import LoadingSpinner from '../components/core/LoadingSpinner'; // Path relative to src/pages
import RequestTable from '../components/requests/RequestTable'; // Path relative to src/pages
import RequestDetailsModal from '../components/requests/RequestDetailsModal'; // Path relative to src/pages

interface UserRequestsPageContext {
  userProfile: UserProfile;
  activeUITab: string; 
}

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


export const UserRequestsPage: React.FC = () => {
  const { userProfile, activeUITab } = useOutletContext<UserRequestsPageContext>();
  
  const [requests, setRequests] = useState<SolicitudCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequestDetailsModal, setShowRequestDetailsModal] = useState(false);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<SolicitudCompra | null>(null);

  const mapSolicitudData = useCallback((req: RawSolicitudFromUserQuery): SolicitudCompra => ({
    ...req,
    empleado: req.empleado ? {
      ...req.empleado,
      cedula: '', 
      cargo_actual_id: null, 
      departamento_id: req.empleado_id || 0, 
      estado: 'activo', 
    } : undefined,
    departamento: req.departamento || undefined,
    detalles: req.detalles ? req.detalles.map(d => ({
      ...d,
      producto: d.producto ? {
        ...d.producto,
        categoria: d.producto.categoria || undefined,
      } : undefined,
    })) : [],
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

        if (activeUITab === 'solicitudes') {
          query = query.eq('estado', 'Pendiente');
        } else if (activeUITab === 'historial-solicitudes') {
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
          showStatus={true}
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

// Default export was removed, now it's a named export: export const UserRequestsPage
// If it's intended to be default, change to: export default UserRequestsPage;
// However, App.tsx now expects a named import.
