import React from 'react';
import { Table } from 'react-bootstrap';

const RequestTable = ({ requests }) => {
  return (
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
  );
};

export default RequestTable;