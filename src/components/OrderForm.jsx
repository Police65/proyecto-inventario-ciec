import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, request, onSuccess }) => {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [items, setItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: 0 }]);
  const [formData, setFormData] = useState({
    proveedor_id: '',
    unidad: 'Bs', // Valor por defecto
    observaciones: ''
  });


  // Cargar proveedores y productos
  useEffect(() => {
    const fetchData = async () => {
      const { data: provData } = await supabase.from('proveedor').select('*');
      const { data: prodData } = await supabase.from('producto').select('*');
      setProveedores(provData || []);
      setProductos(prodData || []);
    };
    fetchData();
  }, []);

  // Calcular montos
  const calcularTotales = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
    const iva = subtotal * 0.16;
    const ret_iva = iva * 0.75; // Retención del 75% del IVA
    const neto = subtotal + iva - ret_iva;

    return { subtotal, iva, ret_iva, neto };
  };

  // Manejar envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { subtotal, iva, ret_iva, neto } = calcularTotales();

    // Insertar orden principal
    const { data: orden, error } = await supabase.from('ordencompra').insert([{
      solicitud_compra_id: request.id,
      proveedor_id: formData.proveedor_id,
      subtotal,
      iva,
      ret_iva,
      neto_a_pagar: neto,
      estado: 'Pendiente',
      empleado_id: request.empleado_id,
      unidad: formData.unidad
    }]).select('id');

    if (!error) {
      // Insertar detalles
      await supabase.from('ordencompra_detalle').insert(
        items.map(item => ({
          orden_compra_id: orden[0].id,
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        }))
      );

      await supabase.from('solicitudcompra').update({ estado: 'Aprobada' }).eq('id', request.id);
      onSuccess();
      onHide();
    }
  };

  // UI dinámica para productos
  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>📝 Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {/* Campo para proveedor */}
          <Form.Group className="mb-3">
            <Form.Label>Proveedor</Form.Label>
            <Form.Select
              value={formData.proveedor_id}
              onChange={e => setFormData({...formData, proveedor_id: e.target.value})}
              required
            >
              <option value="">Seleccionar proveedor</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Lista de productos */}
          {items.map((item, index) => (
            <div key={index} className="border p-3 mb-3">
              <Form.Group className="mb-3">
                <Form.Label>Producto</Form.Label>
                <Form.Select
                  value={item.producto_id}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].producto_id = e.target.value;
                    setItems(newItems);
                  }}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.descripcion}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Cantidad</Form.Label>
                <Form.Control
                  type="number"
                  value={item.cantidad}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].cantidad = e.target.value;
                    setItems(newItems);
                  }}
                  min="1"
                />
              </Form.Group>
              <Form.Group className="mb-3">
    <Form.Label>Moneda</Form.Label>
    <Form.Select
      value={formData.unidad}
      onChange={e => setFormData({...formData, unidad: e.target.value})}
      required
    >
      <option value="Bs">Bolívares (Bs)</option>
      <option value="USD">Dólares (USD)</option>
    </Form.Select>
  </Form.Group>


              <Form.Group className="mb-3">
                <Form.Label>Precio Unitario (USD)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={item.precio_unitario}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].precio_unitario = parseFloat(e.target.value);
                    setItems(newItems);
                  }}
                />
              </Form.Group>

              {items.length > 1 && (
                <Button variant="danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                  Eliminar
                </Button>
              )}
            </div>
          ))}

          <Button variant="outline-primary" onClick={() => setItems([...items, { producto_id: '', cantidad: 1, precio_unitario: 0 }])}>
            Añadir Producto
          </Button>

          {/* Resumen financiero */}
          <div className="mt-4 p-3 bg-light">
  <h5>Resumen ({formData.unidad})</h5>
  <p>Subtotal: {formData.unidad} {calcularTotales().subtotal.toFixed(2)}</p>
  <p>IVA (16%): {formData.unidad} {calcularTotales().iva.toFixed(2)}</p>
  <p>Ret. IVA (75%): {formData.unidad} {calcularTotales().ret_iva.toFixed(2)}</p>
  <p>Neto a Pagar: {formData.unidad} {calcularTotales().neto.toFixed(2)}</p>
</div>
          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button variant="secondary" onClick={onHide}>Cancelar</Button>
            <Button variant="primary" type="submit">Crear Orden</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderForm;