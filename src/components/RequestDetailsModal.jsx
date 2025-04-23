import React from 'react';
import { Modal, Table, Button } from 'react-bootstrap';

const RequestDetailsModal = ({ show, onHide, request }) => {
  if (!request) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Detalles de la Solicitud #{request.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <Table striped bordered hover variant="dark">
          <tbody>
            <tr>
              <td><strong>Descripción:</strong></td>
              <td>{request.descripcion || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Estado:</strong></td>
              <td>{request.estado}</td>
            </tr>
            <tr>
              <td><strong>Fecha de Creación:</strong></td>
              <td>{new Date(request.created_at).toLocaleDateString()}</td>
            </tr>
          </tbody>
        </Table>
        <h5>Productos Solicitados</h5>
        <Table striped bordered hover variant="dark">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {request.detalles?.map((detalle, i) => (
              <tr key={i}>
                <td>{detalle.producto?.descripcion || 'Producto no especificado'}</td>
                <td>{detalle.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
      <Modal.Footer className="bg-dark">
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RequestDetailsModal;