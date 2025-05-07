import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import OrderForm from './OrderForm';
import DirectOrderForm from './DirectOrderForm';
import RequestTable from './RequestTable';
import { supabase } from '../supabaseClient';
import OrderPDF from './OrderPDF';
import OrderActions from './OrderActions';
import UserManagement from './UserManagement';
import ConsolidationModal from './ConsolidationModal';
import OrderDetailsModal from './OrderDetailsModal';
import RequestDetailsModal from './RequestDetailsModal';
import ConsolidatedOrderDetailsModal from './ConsolidatedOrderDetailsModal';

const AdminDashboard = ({ activeTab, solicitudesPendientes, solicitudesHistorial, ordenesHistorial, userProfile }) => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
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
  const [showConsolidatedOrderDetails, setShowConsolidatedOrderDetails] = useState(false);
  const [selectedConsolidatedOrder, setSelectedConsolidatedOrder] = useState(null);

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

      if (!error) setOrdenesConsolidadas(data);
    };
    fetchOrdenesConsolidadas();
  }, []);

  const handleReject = async (id) => {
    const { error } = await supabase
      .from('solicitudcompra')
      .update({ estado: 'Rechazada' })
      .eq('id', id);
  
    if (!error) {
      const request = solicitudesPendientesState.find(req => req.id === id);
      await supabase.from('notificaciones').insert([{
        user_id: request.empleado_id,
        title: 'Solicitud Rechazada',
        description: `Tu solicitud #${id} ha sido rechazada.`,
        created_at: new Date().toISOString(),
        read: false
      }]);
      setSolicitudesPendientesState(solicitudesPendientesState.filter(req => req.id !== id));
    }
  };

  const handleEliminarConsolidacion = async (id) => {
    try {
      await supabase.from('ordenes_consolidadas').delete().eq('id', id);
      setOrdenesConsolidadas(prev => prev.filter(oc => oc.id !== id));
    } catch (err) {
      console.error('Error eliminando consolidación:', err);
    }
  };

  const handleConsolidatedOrderClick = (order) => {
    setSelectedConsolidatedOrder(order);
    setShowConsolidatedOrderDetails(true);
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

  const handleApproveRequest = (request) => {
    const initialProducts = request.detalles.map(d => ({
      producto_id: d.producto_id,
      descripcion: d.producto?.descripcion || 'Producto sin nombre',
      cantidad: d.cantidad,
      precio_unitario: 0
    }));
    
    setSelectedRequest({
      initialProducts: initialProducts,
      solicitudes: [request.id],
      proveedor_id: null
    });
    
    supabase.from('notificaciones').insert([{
      user_id: request.empleado_id,
      title: 'Solicitud Aprobada',
      description: `Tu solicitud #${request.id} ha sido aprobada.`,
      created_at: new Date().toISOString(),
      read: false
    }]);
    
    setIsDirectOrder(false);
    setShowOrderForm(true);
  };

  const handleCreateDirectOrder = () => {
    setSelectedRequest(null);
    setIsDirectOrder(true);
    setShowOrderForm(true);
  };

  return (
    <>
      {activeTab === 'solicitudes' && (
        <div className="bg-dark rounded-3 p-4 border border-secondary">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="text-light mb-0">🔄 Solicitudes Pendientes</h4>
            <div>
              <Button variant="primary" onClick={() => setShowConsolidationModal(true)} className="me-2">
                <i className="bi bi-archive me-2"></i>Consolidar Solicitudes
              </Button>
              <Button variant="success" onClick={handleCreateDirectOrder}>
                <i className="bi bi-plus-circle me-2"></i>Crear Orden Directa
              </Button>
            </div>
          </div>
          <RequestTable
            requests={solicitudesPendientesState}
            withActions={true}
            onApprove={handleApproveRequest}
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
                    <tr 
                      key={orden.id} 
                      onClick={() => handleConsolidatedOrderClick(orden)} 
                      style={{ cursor: 'pointer' }}
                    >
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
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => {
                              const initialProducts = orden.productos.map(p => ({
                                producto_id: p.producto_id,
                                descripcion: p.descripcion,
                                cantidad: p.cantidad,
                                precio_unitario: 0
                              }));
                              
                              setSelectedRequest({
                                initialProducts: initialProducts,
                                solicitudes: orden.solicitudes,
                                proveedor_id: orden.proveedor_id
                              });
                              setIsDirectOrder(false);
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
                      <td>{orden.id}</td>
                      <td>{orden.proveedor?.nombre || 'N/A'}</td>
                      <td>{orden.solicitud_compra?.descripcion || 'N/A'}</td>
                      <td>{new Date(orden.fecha_orden).toLocaleDateString()}</td>
                      <td>{orden.neto_a_pagar?.toFixed(2)} {orden.unidad}</td>
                      <td>
                        <span className={`badge bg-${statusColor}`}>{orden.estado}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex gap-2">
                          <OrderPDF order={orden} />
                          <OrderActions order={orden} onUpdate={() => window.location.reload()} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showOrderForm && isDirectOrder ? (
        <DirectOrderForm
          show={showOrderForm}
          onHide={() => setShowOrderForm(false)}
          userProfile={userProfile}
          onSuccess={handleOrderCreated}
        />
      ) : (
        <OrderForm
          show={showOrderForm}
          onHide={() => setShowOrderForm(false)}
          userProfile={userProfile}
          onSuccess={handleOrderCreated}
          initialProducts={selectedRequest?.initialProducts || []}
          proveedorId={selectedRequest?.proveedor_id}
          solicitudesIds={selectedRequest?.solicitudes}
        />
      )}

      {showOrderDetails && <OrderDetailsModal show={showOrderDetails} onHide={() => setShowOrderDetails(false)} order={selectedOrder} />}
      {showRequestDetails && <RequestDetailsModal show={showRequestDetails} onHide={() => setShowRequestDetails(false)} request={selectedRequestDetails} />}
      {showConsolidatedOrderDetails && (
        <ConsolidatedOrderDetailsModal
          show={showConsolidatedOrderDetails}
          onHide={() => setShowConsolidatedOrderDetails(false)}
          order={selectedConsolidatedOrder}
        />
      )}

      {showPDFConfirmation && (
        <Modal show={showPDFConfirmation} onHide={() => setShowPDFConfirmation(false)} centered>
          <Modal.Header closeButton className="bg-dark text-light">
            <Modal.Title>Orden Creada</Modal.Title>
          </Modal.Header>
          <Modal.Body className="bg-dark text-light">
            <p>La orden #{newOrder?.id} ha sido creada exitosamente.</p>
            <div className="d-flex justify-content-end">
              <Button variant="secondary" onClick={() => setShowPDFConfirmation(false)} className="me-2">
                Cerrar
              </Button>
              <Button variant="primary" onClick={() => handleOrderClick(newOrder)}>
                Generar PDF
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default AdminDashboard;