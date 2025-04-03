import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import OrderForm from './OrderForm';
import RequestTable from './RequestTable';
import { supabase } from '../supabaseClient';
import OrderPDF from './OrderPDF';
import OrderActions from './OrderActions';
import UserManagement from './UserManagement';
import ConsolidationModal from './ConsolidationModal';
import OrderDetailsModal from './OrderDetailsModal';
import RequestDetailsModal from './RequestDetailsModal';

const AdminDashboard = ({ activeTab, solicitudesPendientes, solicitudesHistorial, ordenesHistorial, userProfile }) => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showConsolidationModal, setShowConsolidationModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [solicitudesPendientesState, setSolicitudesPendientesState] = useState(solicitudesPendientes);
  const [ordenesConsolidadas, setOrdenesConsolidadas] = useState([]);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPDFConfirmation, setShowPDFConfirmation] = useState(false);
  const [newOrder, setNewOrder] = useState(null);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);

  useEffect(() => {
    setSolicitudesPendientesState(solicitudesPendientes);
  }, [solicitudesPendientes]);

  useEffect(() => {
    const fetchOrdenesConsolidadas = async () => {
      const { data, error } = await supabase
        .from('ordenes_consolidadas')
        .select(`
          *,
          proveedor:proveedor_id(nombre),
          productos,
          solicitudes
        `)
        .order('fecha_creacion', { ascending: false });

      if (!error) {
        setOrdenesConsolidadas(data);
      }
    };

    fetchOrdenesConsolidadas();
  }, []);

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

  const handleEliminarConsolidacion = async (id) => {
    try {
      await supabase
        .from('ordenes_consolidadas')
        .delete()
        .eq('id', id);
      setOrdenesConsolidadas(prev => prev.filter(oc => oc.id !== id));
    } catch (err) {
      console.error('Error eliminando consolidación:', err);
    }
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const handleRequestClick = (request) => {
    setSelectedRequestDetails(request);
    setShowRequestDetails(true);
  };

  const handleOrderCreated = (createdOrder) => {
    setNewOrder(createdOrder);
    setShowPDFConfirmation(true);
    setShowOrderForm(false);
  };

  return (
    <>
      {activeTab === 'solicitudes' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="text-light mb-0">🔄 Solicitudes Pendientes</h4>
            <Button 
              variant="primary"
              onClick={() => setShowConsolidationModal(true)}
            >
              <i className="bi bi-archive me-2"></i>
              Consolidar Solicitudes
            </Button>
          </div>
          <RequestTable
            requests={solicitudesPendientesState}
            withActions={true}
            onApprove={(request) => {
              setSelectedRequest({
                productos: request.detalles.map(d => ({
                  producto_id: d.producto_id,
                  descripcion: d.producto?.descripcion || 'Producto sin nombre',
                  cantidad: d.cantidad
                })),
                solicitudes: [request.id]
              });
              setShowOrderForm(true);
            }}
            onReject={handleReject}
          />
        </div>
      )}

      {activeTab === 'usuarios' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <h4 className="mb-4 text-light">👥 Gestión de Usuarios</h4>
          <UserManagement />
        </div>
      )}

      {showConsolidationModal && (
        <ConsolidationModal
          show={showConsolidationModal}
          onHide={() => setShowConsolidationModal(false)}
          onConsolidate={(consolidatedOrder) => {
            setOrdenesConsolidadas(prev => [consolidatedOrder, ...prev]);
            setShowConsolidationModal(false);
          }}
          solicitudes={solicitudesPendientesState} 
        />
      )}

      {activeTab === 'historial-solicitudes' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <h4 className="mb-4 text-light">📚 Historial de Solicitudes</h4>
          <RequestTable
            requests={solicitudesHistorial}
            showStatus={true}
            onRowClick={handleRequestClick}
          />
        </div>
      )}

      {activeTab === 'ordenes-consolidadas' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <h4 className="mb-4 text-light">📦 Historial de Órdenes Consolidadas</h4>
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>Proveedor</th>
                  <th>Productos</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesConsolidadas?.map(orden => {
                  const statusColor = {
                    'Pendiente': 'warning',
                    'Completada': 'success',
                    'Anulada': 'secondary'
                  }[orden.estado];

                  return (
                    <tr key={orden.id}>
                      <td>{orden.id}</td>
                      <td>{orden.proveedor?.nombre || 'N/A'}</td>
                      <td>
                        {orden.productos?.map((p, i) => (
                          <Badge key={i} bg="info" className="me-1">
                            {p.descripcion} (x{p.cantidad})
                          </Badge>
                        ))}
                      </td>
                      <td>{new Date(orden.fecha_creacion).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge bg-${statusColor}`}>{orden.estado}</span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(orden);
                              setShowOrderForm(true);
                            }}
                          >
                            Crear Orden
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleEliminarConsolidacion(orden.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {ordenesConsolidadas?.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      No hay órdenes consolidadas registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ordenes' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <h4 className="mb-4 text-light">📦 Historial de Órdenes</h4>
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>Proveedor</th>
                  <th>Solicitud Relacionada</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
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
                    <tr key={orden.id} onClick={() => handleOrderClick(orden)} style={{ cursor: 'pointer' }}>
                      <td>
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Ver detalles de la orden</Tooltip>}
                        >
                          <span>{orden.id}</span>
                        </OverlayTrigger>
                      </td>
                      <td>{orden.proveedor?.nombre || 'N/A'}</td>
                      <td>{orden.solicitud_compra?.descripcion || 'N/A'}</td>
                      <td>{new Date(orden.fecha_orden).toLocaleDateString()}</td>
                      <td>{orden.neto_a_pagar?.toFixed(2)} {orden.unidad}</td>
                      <td>
                        <span className={`badge bg-${statusColor}`}>{orden.estado}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
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
          ordenConsolidada={selectedRequest}
          userProfile={userProfile} 
          onSuccess={handleOrderCreated}
          selectedRequest={selectedRequest}
        />
      )}

      {showOrderDetails && (
        <OrderDetailsModal
          show={showOrderDetails}
          onHide={() => setShowOrderDetails(false)}
          order={selectedOrder}
        />
      )}

      {showRequestDetails && (
        <RequestDetailsModal
          show={showRequestDetails}
          onHide={() => setShowRequestDetails(false)}
          request={selectedRequestDetails}
        />
      )}

      {showPDFConfirmation && (
        <Modal show={showPDFConfirmation} onHide={() => setShowPDFConfirmation(false)} centered>
          <Modal.Header closeButton className="bg-dark text-light">
            <Modal.Title>Orden Creada</Modal.Title>
          </Modal.Header>
          <Modal.Body className="bg-dark text-light">
            <p>La orden #{newOrder.id} ha sido creada exitosamente.</p>
            <p>¿Desea generar el PDF de la orden?</p>
            <div className="d-flex justify-content-end">
              <Button variant="secondary" onClick={() => {
                setShowPDFConfirmation(false);
                window.location.reload();
              }} className="me-2">
                No
              </Button>
              <Button variant="primary" onClick={() => {
                setShowPDFConfirmation(false);
                handleOrderClick(newOrder);
              }}>
                Sí
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default AdminDashboard;