import React from 'react';
import { Table, Button } from 'react-bootstrap';

const AdminDashboard = ({ requests, isSidebarVisible }) => {
  const handleCreateOrder = (requestId) => {
    // Lógica para crear una orden de compra basada en la solicitud
    console.log('Crear orden de compra para la solicitud:', requestId);
  };

  return (
    <div style={{ 
      marginLeft: isSidebarVisible ? '80px' : '0', // Margen izquierdo para la sidebar
      marginTop: '56px',   // Margen superior para la navbar
      padding: '20px',     // Espaciado interno
      width: isSidebarVisible ? 'calc(100% - 250px)' : '100%', // Ancho total menos el ancho de la sidebar
      maxWidth: isSidebarVisible ? 'calc(100% - 250px)' : '100%', // Máximo ancho posible
      overflowX: 'auto',   // Scroll horizontal si es necesario
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
                  <Button variant="primary" onClick={() => handleCreateOrder(request.id)}>
                    Crear Orden
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default AdminDashboard;