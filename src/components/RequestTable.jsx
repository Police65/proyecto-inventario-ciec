import React from 'react';
import { Table } from 'react-bootstrap';

const RequestTable = ({ requests }) => {
  return (
    <div style={{ 
      marginLeft: '250px', // Margen izquierdo para la sidebar
      marginTop: '56px',   // Margen superior para la navbar
      padding: '20px',     // Espaciado interno
      width: 'calc(100% - 250px)', // Ancho total menos el ancho de la sidebar
      maxWidth: 'calc(100% - 250px)', // Máximo ancho posible
      overflowX: 'auto',   // Scroll horizontal si es necesario
    }}>
      <div className="card shadow mb-4">
        <div className="card-header py-3">
          <h6 className="m-0 font-weight-bold text-primary">Solicitudes de Compra</h6>
        </div>
        <div className="card-body">
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
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestTable;