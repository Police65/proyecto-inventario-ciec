import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import OrderForm from './OrderForm';
import RequestTable from './RequestTable';
import { supabase } from '../supabaseClient';
import OrderPDF from './OrderPDF';
import OrderActions from './OrderActions';

const AdminDashboard = ({ activeTab, solicitudesPendientes, solicitudesHistorial, ordenesHistorial }) => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [solicitudesPendientesState, setSolicitudesPendientesState] = useState(solicitudesPendientes);

  useEffect(() => {
    setSolicitudesPendientesState(solicitudesPendientes);
  }, [solicitudesPendientes]);

  const handleReject = async (id) => {
    const { error } = await supabase
      .from('solicitudcompra')
      .update({ estado: 'Rechazada' })
      .eq('id', id);
  
    if (!error) {
      const updatedRequests = solicitudesPendientesState.filter(req => req.id !== id);
      setSolicitudesPendientesState(updatedRequests);
    }
  };

  return (
    <>
      {activeTab === 'solicitudes' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <h4 className="mb-4 text-light">🔄 Solicitudes Pendientes</h4>
          <RequestTable
            requests={solicitudesPendientesState}
            withActions={true}
            onApprove={(request) => {
              setSelectedRequest(request);
              setShowOrderForm(true);
            }}
            onReject={handleReject}
          />
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <h4 className="mb-4 text-light">📚 Historial de Solicitudes</h4>
          <RequestTable
            requests={solicitudesHistorial}
            showStatus={true}
          />
        </div>
      )}

      {activeTab === 'ordenes' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <h4 className="mb-4 text-light">📦 Historial de Órdenes</h4>
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle">
              <thead className="table-dark">
                <tr>
                  <th>ID</th><th>Proveedor</th><th>Solicitud Relacionada</th>
                  <th>Fecha</th><th>Total</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesHistorial?.map(orden => {
                  const statusColor = {
                    'Pendiente': 'warning',
                    'Completada': 'success',
                    'Anulada': 'secondary'
                  }[orden.estado];

                  return (
                    <tr key={orden.id}>
                      <td>{orden.id}</td>
                      <td>{orden.proveedor?.nombre || 'N/A'}</td>
                      <td>{orden.solicitud_compra?.descripcion || 'N/A'}</td>
                      <td>{new Date(orden.fecha_orden).toLocaleDateString()}</td>
                      <td>{orden.neto_a_pagar?.toFixed(2)} {orden.unidad}</td>
                      <td>
                        <span className={`badge bg-${statusColor}`}>{orden.estado}</span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <OrderPDF order={orden} key={orden.id} />
                          <OrderActions 
                            order={orden}
                            onUpdate={() => window.location.reload()}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {ordenesHistorial?.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-4">
                      No hay órdenes registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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