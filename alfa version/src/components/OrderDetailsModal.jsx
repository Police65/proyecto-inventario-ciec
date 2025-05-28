import React from 'react';
import { Modal, Table, Button } from 'react-bootstrap';
import OrderPDF from './OrderPDF';

const OrderDetailsModal = ({ show, onHide, order }) => {
  if (!order) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Detalles de la Orden #{order.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <Table striped bordered hover variant="dark">
          <tbody>
            <tr>
              <td><strong>Proveedor:</strong></td>
              <td>{order.proveedor?.nombre || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Fecha:</strong></td>
              <td>{new Date(order.fecha_orden).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td><strong>Estado:</strong></td>
              <td>{order.estado}</td>
            </tr>
            <tr>
              <td><strong>Subtotal:</strong></td>
              <td>{order.sub_total?.toFixed(2)} {order.unidad}</td>
            </tr>
            <tr>
              <td><strong>IVA:</strong></td>
              <td>{order.iva?.toFixed(2)} {order.unidad}</td>
            </tr>
            <tr>
              <td><strong>Retención IVA:</strong></td>
              <td>{order.ret_iva?.toFixed(2)} {order.unidad}</td>
            </tr>
            <tr>
              <td><strong>Neto a Pagar:</strong></td>
              <td>{order.neto_a_pagar?.toFixed(2)} {order.unidad}</td>
            </tr>
          </tbody>
        </Table>
        <h5>Productos</h5>
        <Table striped bordered hover variant="dark">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio Unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.productos?.map((p, i) => (
              <tr key={i}>
                <td>{p.producto?.descripcion || 'N/A'}</td>
                <td>{p.cantidad}</td>
                <td>{p.precio_unitario?.toFixed(2)} {order.unidad}</td>
                <td>{(p.cantidad * p.precio_unitario).toFixed(2)} {order.unidad}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="d-flex justify-content-end">
          <OrderPDF order={order} />
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default OrderDetailsModal;