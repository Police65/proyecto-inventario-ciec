import React, { useState } from 'react';
import { Table, Button } from 'react-bootstrap';
import OrderForm from './OrderForm';
import OrderPDF from './OrderPDF';

const AdminDashboard = ({ requests, isSidebarVisible }) => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleCreateOrder = (request) => {
    setSelectedRequest(request);
    setShowOrderForm(true);
  };

  const handleRejectRequest = async (requestId) => {
    const { error } = await supabase
      .from('SolicitudCompra')
      .update({ estado: 'Rechazada' })
      .eq('id', requestId);

    if (error) {
      alert('Error al rechazar la solicitud: ' + error.message);
    } else {
      alert('Solicitud rechazada exitosamente');
      // Actualizar la lista de solicitudes (puedes recargar las solicitudes o actualizar el estado local)
    }
  };

  return (
    <div style={{ 
      marginLeft: isSidebarVisible ? '250px' : '0',
      marginTop: '56px',
      padding: '20px',
      width: isSidebarVisible ? 'calc(100% - 250px)' : '100%',
      maxWidth: isSidebarVisible ? 'calc(100% - 250px)' : '100%',
      overflowX: 'auto',
    }}>
      <h2>Panel de Administración</h2>
      <div className="table-responsive">
        <Table striped bordered hover className="table-dark w-100">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Descripción</th>
              <th scope="col">Producto ID</th>
              <th scope="col">Cantidad</th>
              <th scope="col">Estado</th>
              <th scope="col">Empleado ID</th>
              <th scope="col">Departamento ID</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <th scope="row">{request.id}</th>
                <td>{request.descripcion}</td>
                <td>{request.producto_id}</td>
                <td>{request.cantidad}</td>
                <td>{request.estado}</td>
                <td>{request.empleado_id}</td>
                <td>{request.departamento_id}</td>
                <td>
                  <Button variant="primary" onClick={() => handleCreateOrder(request)}>
                    Aprobar
                  </Button>
                  <Button variant="danger" onClick={() => handleRejectRequest(request.id)}>
                    Rechazar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Mostrar el formulario de creación de órdenes */}
      {selectedRequest && (
        <OrderForm
          show={showOrderForm}
          onHide={() => setShowOrderForm(false)}
          request={selectedRequest}
        />
      )}

      {/* Mostrar el PDF de la orden */}
      {selectedOrder && (
        <OrderPDF order={selectedOrder} />
      )}
    </div>
  );
};

export default AdminDashboard;