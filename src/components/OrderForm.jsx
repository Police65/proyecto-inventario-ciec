import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, request }) => {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState(0);
  const [cantidad, setCantidad] = useState(request.cantidad);
  const [subTotal, setSubTotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [retIva, setRetIva] = useState(0);
  const [netoAPagar, setNetoAPagar] = useState(0);
  const [unidad, setUnidad] = useState('Bs');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    const fetchProveedores = async () => {
      const { data, error } = await supabase.from('proveedor').select('*');
      if (!error) setProveedores(data);
    };
    fetchProveedores();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const order = {
      solicitud_compra_id: request.id,
      proveedor_id: proveedorId,
      fecha_orden: new Date().toISOString(),
      estado: 'Pendiente',
      precio_unitario: precioUnitario,
      sub_total: subTotal,
      IVA: iva,
      ret_iva: retIva,
      neto_a_pagar: netoAPagar,
      unidad: unidad,
      observaciones: observaciones,
      empleado_id: request.empleado_id,
    };

    const { data, error } = await supabase.from('OrdenCompra').insert([order]);

    if (!error) {
      onHide(data[0]); // Pasar la orden creada al componente padre
    }
  };

  return (
    <Modal show={show} onHide={() => onHide(null)} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {/* Campos del formulario */}
          <Form.Group className="mb-3">
            <Form.Label>Proveedor:</Form.Label>
            <Form.Control as="select" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
              <option value="">Seleccione un proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </Form.Control>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Precio Unitario:</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              value={precioUnitario}
              onChange={(e) => setPrecioUnitario(parseFloat(e.target.value))}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Cantidad:</Form.Label>
            <Form.Control
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value))}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Retención de IVA:</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              value={retIva}
              onChange={(e) => setRetIva(parseFloat(e.target.value))}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Observaciones:</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Form.Group>

          <div className="d-flex justify-content-between">
            <Button variant="secondary" onClick={() => onHide(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Crear Orden
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderForm;