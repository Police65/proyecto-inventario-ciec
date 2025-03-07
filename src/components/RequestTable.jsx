import React from 'react';
import { Table } from 'react-bootstrap';

const RequestTable = ({ requests }) => {
  return (
    <Table striped bordered hover className="bg-white shadow-md rounded">
      <thead className="bg-dark text-white">
        <tr>
          <th>Código</th>
          <th>Descripción</th>
          <th>Cantidad</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((request, index) => (
          <tr key={index}>
            <td>{request.id}</td>
            <td>{request.descripcion || "Producto seleccionado"}</td>
            <td>{request.cantidad}</td>
            <td>{request.estado}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default RequestTable;