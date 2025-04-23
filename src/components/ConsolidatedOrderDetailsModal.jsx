import React from 'react';
import { Modal, Table, Button } from 'react-bootstrap';

const ConsolidatedOrderDetailsModal = ({ show, onHide, order }) => {
  if (!order) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Detalles de la Orden Consolidada #{order.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <Table striped bordered hover variant="dark">
          <tbody>
            <tr>
              <td><strong>Proveedor:</strong></td>
              <td>{order.proveedor?.nombre || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Fecha de Creación:</strong></td>
              <td>{new Date(order.fecha_creacion).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td><strong>Estado:</strong></td>
              <td>{order.estado}</td>
            </tr>
            <tr>
              <td><strong>Solicitudes Vinculadas:</strong></td>
              <td>{order.solicitudes?.join(', ') || 'N/A'}</td>
            </tr>
          </tbody>
        </Table>
        <h5>Productos Consolidados</h5>
        <Table striped bordered hover variant="dark">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {order.productos?.map((p, i) => (
              <tr key={i}>
                <td>{p.descripcion || 'N/A'}</td>
                <td>{p.cantidad}</td>
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

export default ConsolidatedOrderDetailsModal;