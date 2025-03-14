import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const OrderForm = ({ show, onHide, request, onSuccess }) => {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    proveedor_id: '',
    unidad: 'Bs',
    observaciones: ''
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: provData } = await supabase.from('proveedor').select('*');
      const { data: prodData } = await supabase.from('producto').select('*');
      setProveedores(provData || []);
      setProductos(prodData || []);
      
      if (request) {
        const { data: detalles } = await supabase
          .from('solicitudcompra_detalle')
          .select('producto_id, cantidad')
          .eq('solicitud_compra_id', request.id);
          
        const initialItems = detalles?.map(detalle => ({
          producto_id: detalle.producto_id,
          cantidad_solicitada: detalle.cantidad,
          cantidad: detalle.cantidad,
          precio_unitario: 0
        })) || [];
        
        setItems(initialItems);
      }
    };
    fetchData();
  }, [request]);

  const calcularTotales = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
    const iva = subtotal * 0.16;
    const ret_iva = iva * 0.75;
    const neto = subtotal + iva - ret_iva;
    return { subtotal, iva, ret_iva, neto };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { subtotal, iva, ret_iva, neto } = calcularTotales();
    
    try {
      if (items.some(item => item.precio_unitario <= 0)) {
        throw new Error('Todos los productos deben tener un precio unitario válido');
      }

      const { data: orden, error } = await supabase.from('ordencompra').insert([{
        solicitud_compra_id: request.id,
        proveedor_id: formData.proveedor_id,
        sub_total: subtotal,
        iva: iva,
        ret_iva: ret_iva,
        neto_a_pagar: neto,
        estado: 'Pendiente',
        empleado_id: request.empleado_id,
        unidad: formData.unidad,
        observaciones: formData.observaciones
      }]).select('id');

      if (error) throw error;

      const detallesInsert = items.map(item => {
        if (!item.producto_id || item.precio_unitario <= 0) {
          throw new Error('Datos incompletos en los productos');
        }
        return {
          orden_compra_id: orden[0].id,
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        };
      });

      const { error: detalleError } = await supabase.from('ordencompra_detalle').insert(detallesInsert);
      if (detalleError) throw detalleError;

      await supabase.from('solicitudcompra').update({ estado: 'Aprobada' }).eq('id', request.id);
      onSuccess(orden[0]);
      navigate('/');
    } catch (error) {
      alert('Error al crear la orden: ' + error.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" contentClassName="bg-dark text-light">
      <Modal.Header closeButton className="bg-dark border-secondary">
        <Modal.Title className="text-light">Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark">
        <Form onSubmit={handleSubmit}>
          {/* Campo para seleccionar proveedor */}
          <Form.Group className="mb-3">
            <Form.Label className="text-light">Proveedor</Form.Label>
            <Form.Select
              value={formData.proveedor_id}
              onChange={e => setFormData({ ...formData, proveedor_id: e.target.value })}
              required
              className="bg-secondary text-light border-dark"
            >
              <option value="">Seleccionar proveedor</option>
              {proveedores.map(proveedor => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Campo para observaciones */}
          <Form.Group className="mb-3">
            <Form.Label className="text-light">Observaciones</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={formData.observaciones}
              onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
              className="bg-secondary text-light border-dark"
            />
          </Form.Group>

          {/* Lista de productos */}
          {items.map((item, index) => (
            <div key={index} className="border border-secondary p-3 mb-3 rounded">
              {/* Selección de producto */}
              <Form.Group className="mb-3">
                <Form.Label className="text-light">Producto</Form.Label>
                <Form.Select
                  value={item.producto_id}
                  onChange={e => {
                    const newItems = [...items];
                    newItems[index].producto_id = e.target.value;
                    setItems(newItems);
                  }}
                  required
                  className="bg-secondary text-light border-dark"
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.descripcion}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {/* Cantidad solicitada */}
              <Form.Group className="mb-3">
                <Form.Label className="text-light">Cantidad Solicitada</Form.Label>
                <Form.Control
                  type="number"
                  value={item.cantidad_solicitada}
                  readOnly
                  className="bg-secondary text-light border-dark"
                />
              </Form.Group>

              {/* Cantidad a ordenar */}
              <Form.Group className="mb-3">
                <Form.Label className="text-light">Cantidad a Ordenar</Form.Label>
                <Form.Control
                  type="number"
                  value={item.cantidad}
                  onChange={e => {
                    const newItems = [...items];
                    newItems[index].cantidad = e.target.value;
                    setItems(newItems);
                  }}
                  min="1"
                  required
                  className="bg-secondary text-light border-dark"
                />
              </Form.Group>

              {/* Precio unitario */}
              <Form.Group className="mb-3">
                <Form.Label className="text-light">Precio Unitario</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={item.precio_unitario}
                  onChange={e => {
                    const newItems = [...items];
                    newItems[index].precio_unitario = parseFloat(e.target.value || 0);
                    setItems(newItems);
                  }}
                  required
                  className="bg-secondary text-light border-dark"
                />
              </Form.Group>

              {/* Botón para eliminar producto */}
              {items.length > 1 && (
                <Button
                  variant="danger"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                >
                  Eliminar
                </Button>
              )}
            </div>
          ))}

          {/* Botón para añadir más productos */}
          <Form.Group className="mb-3">
            <Button
              variant="outline-primary"
              onClick={() => setItems([...items, {
                producto_id: '',
                cantidad_solicitada: 0,
                cantidad: 1,
                precio_unitario: 0
              }])}
              className="mb-3"
            >
              Añadir Producto
            </Button>
          </Form.Group>

          {/* Selector de moneda */}
          <Form.Group className="mb-3">
            <Form.Label className="text-light">Moneda</Form.Label>
            <Form.Select
              value={formData.unidad}
              onChange={e => setFormData({ ...formData, unidad: e.target.value })}
              required
              className="bg-secondary text-light border-dark"
            >
              <option value="Bs">Bolívares (Bs)</option>
              <option value="USD">Dólares (USD)</option>
            </Form.Select>
          </Form.Group>

          {/* Resumen financiero con tema oscuro */}
          <div className="mt-4 p-3 bg-secondary text-light rounded">
            <h5>Resumen ({formData.unidad})</h5>
            <p>Subtotal: {formData.unidad} {calcularTotales().subtotal.toFixed(2)}</p>
            <p>IVA (16%): {formData.unidad} {calcularTotales().iva.toFixed(2)}</p>
            <p>Ret. IVA (75%): {formData.unidad} {calcularTotales().ret_iva.toFixed(2)}</p>
            <p>Neto a Pagar: {formData.unidad} {calcularTotales().neto.toFixed(2)}</p>
          </div>

          {/* Botones de acción */}
          <div className="d-flex justify-content-end gap-2 mt-4">
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