import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, request }) => {
  const [proveedores, setProveedores] = useState([]); // Lista de proveedores
  const [proveedorId, setProveedorId] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState(0);
  const [cantidad, setCantidad] = useState(request.cantidad); // Cantidad de la solicitud
  const [subTotal, setSubTotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [retIva, setRetIva] = useState(0);
  const [netoAPagar, setNetoAPagar] = useState(0);
  const [unidad, setUnidad] = useState('Bs');
  const [observaciones, setObservaciones] = useState('');

  // Obtener la lista de proveedores al cargar el formulario
  useEffect(() => {
    const fetchProveedores = async () => {
      const { data, error } = await supabase.from('proveedor').select('*');
      if (!error) setProveedores(data);
    };
    fetchProveedores();
  }, []);

  // Calcular el subtotal, IVA y neto a pagar
  useEffect(() => {
    const subtotal = precioUnitario * cantidad;
    const ivaCalculado = subtotal * 0.16; // Suponiendo un IVA del 16%
    const neto = subtotal + ivaCalculado - (retIva || 0);

    setSubTotal(subtotal);
    setIva(ivaCalculado);
    setNetoAPagar(neto);
  }, [precioUnitario, cantidad, retIva]);

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    try {
      const { data, error } = await supabase.from('ordencompra').insert([{
        solicitud_compra_id: request.id,
        proveedor_id: proveedorId,
        fecha_orden: new Date().toISOString(),
        estado: 'Pendiente',
        precio_unitario: precioUnitario,
        sub_total: subTotal,
        iva: iva,
        ret_iva: retIva,
        neto_a_pagar: netoAPagar,
        unidad: unidad,
        observaciones: observaciones,
        empleado_id: request.empleado_id,
      }]);
  
      if (error) {
        console.error('Error detallado:', error); // Imprime el error en la consola
        alert('Error al crear la orden de compra: ' + error.message);
      } else {
        alert('Orden de compra creada exitosamente');
        onHide(); // Cerrar el modal después de crear la orden
      }
    } catch (err) {
      console.error('Error inesperado:', err); // Captura errores inesperados
      alert('Error inesperado al crear la orden de compra');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {/* Campo para seleccionar proveedor */}
          <Form.Group className="mb-3">
            <Form.Label>Proveedor:</Form.Label>
            <Form.Control
              as="select"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              required
            >
              <option value="">Seleccione un proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </Form.Control>
          </Form.Group>

          {/* Campo para el precio unitario */}
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

          {/* Campo para la cantidad */}
          <Form.Group className="mb-3">
            <Form.Label>Cantidad:</Form.Label>
            <Form.Control
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value))}
              required
            />
          </Form.Group>

          {/* Campo para el subtotal (calculado automáticamente) */}
          <Form.Group className="mb-3">
            <Form.Label>Subtotal:</Form.Label>
            <Form.Control
              type="text"
              value={subTotal.toFixed(2)}
              readOnly
            />
          </Form.Group>

          {/* Campo para el IVA (calculado automáticamente) */}
          <Form.Group className="mb-3">
            <Form.Label>IVA (16%):</Form.Label>
            <Form.Control
              type="text"
              value={iva.toFixed(2)}
              readOnly
            />
          </Form.Group>

          {/* Campo para la retención de IVA */}
          <Form.Group className="mb-3">
            <Form.Label>Retención de IVA:</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              value={retIva}
              onChange={(e) => setRetIva(parseFloat(e.target.value))}
            />
          </Form.Group>

          {/* Campo para el neto a pagar (calculado automáticamente) */}
          <Form.Group className="mb-3">
            <Form.Label>Neto a Pagar:</Form.Label>
            <Form.Control
              type="text"
              value={netoAPagar.toFixed(2)}
              readOnly
            />
          </Form.Group>

          {/* Campo para la unidad (Bs o USD) */}
          <Form.Group className="mb-3">
            <Form.Label>Unidad:</Form.Label>
            <Form.Control
              as="select"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              required
            >
              <option value="Bs">Bolívares (Bs)</option>
              <option value="USD">Dólares (USD)</option>
            </Form.Control>
          </Form.Group>

          {/* Campo para observaciones */}
          <Form.Group className="mb-3">
            <Form.Label>Observaciones:</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Form.Group>

          {/* Botones para cancelar o crear la orden */}
          <div className="d-flex justify-content-between">
            <Button variant="secondary" onClick={onHide}>
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