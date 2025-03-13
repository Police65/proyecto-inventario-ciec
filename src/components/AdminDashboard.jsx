import React, { useState } from 'react'; 
import { Button, Row, Col } from 'react-bootstrap';
import OrderForm from './OrderForm';
import RequestTable from './RequestTable';
import { supabase } from '../supabaseClient';

const AdminDashboard = ({ activeTab, solicitudesPendientes, solicitudesHistorial, ordenesHistorial }) => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Función para cargar solicitudes pendientes con detalles
  const fetchSolicitudesPendientes = async () => {
    const { data, error } = await supabase
      .from('solicitudcompra')
      .select(`
        *,
        detalles:solicitudcompra_detalle(producto_id, cantidad),
        empleado:empleado_id(nombre, apellido)
      `)
      .eq('estado', 'Pendiente')
      .order('fecha_solicitud', { ascending: false });

    return data || [];
  };

  // Función para cargar historial con detalles
  const fetchSolicitudesHistorial = async () => {
    const { data, error } = await supabase
      .from('solicitudcompra')
      .select(`
        *,
        detalles:solicitudcompra_detalle(producto_id, cantidad),
        empleado:empleado_id(nombre, apellido)
      `)
      .neq('estado', 'Pendiente')
      .order('fecha_solicitud', { ascending: false });

    return data || [];
  };

  // Actualizado para manejar el rechazo
  const handleReject = async (id) => {
    const { error } = await supabase
      .from('solicitudcompra')
      .update({ estado: 'Rechazada' })
      .eq('id', id);

    if (!error) window.location.reload();
  };

  return (
    <>
      {/* SOLICITUDES PENDIENTES */}
      {activeTab === 'solicitudes' && (
        <div className="bg-white rounded-3 p-4 shadow-sm">
          <h4 className="mb-4 text-dark">🔄 Solicitudes Pendientes</h4>
          <RequestTable 
            requests={solicitudesPendientes} 
            withActions={true}
            onApprove={(request) => {
              setSelectedRequest(request);
              setShowOrderForm(true);
            }}
            onReject={handleReject}
          />
        </div>
      )}

      {/* HISTORIAL DE SOLICITUDES */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-3 p-4 shadow-sm">
          <h4 className="mb-4 text-dark">📚 Historial de Solicitudes</h4>
          <RequestTable 
            requests={solicitudesHistorial}
            showDetails={true} 
          />
        </div>
      )}

      {/* FORMULARIO DE ORDEN */}
      {showOrderForm && (
        <OrderForm
          show={showOrderForm}
          onHide={() => setShowOrderForm(false)}
          request={selectedRequest}
          onSuccess={() => window.location.reload()}
        />
      )}
    </>
  );
};

export default AdminDashboard;