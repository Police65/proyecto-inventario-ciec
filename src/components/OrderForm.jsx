import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, request, onSuccess }) => {
  const [proveedores, setProveedores] = useState([]);
  const [formData, setFormData] = useState({
    proveedor_id: '',
    precio_unitario: 0,
    cantidad: request?.cantidad || 1,
    unidad: 'Bs',
    observaciones: ''
  });

  // Cargar proveedores
  useEffect(() => {
    const fetchProveedores = async () => {
      const { data } = await supabase.from('proveedor').select('*');
      setProveedores(data || []);
    };
    fetchProveedores();
  }, []);

  // Calcular totales
  useEffect(() => {
    const subtotal = formData.precio_unitario * formData.cantidad;
    const iva = subtotal * 0.16;
    const neto = subtotal + iva;
    
    setFormData(prev => ({
      ...prev,
      subtotal: subtotal.toFixed(2),
      iva: iva.toFixed(2),
      neto_a_pagar: neto.toFixed(2)
    }));
  }, [formData.precio_unitario, formData.cantidad]);

  // Enviar orden
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { error } = await supabase.from('ordencompra').insert([{
      solicitud_compra_id: request.id,
      ...formData,
      estado: 'Pendiente',
      empleado_id: request.empleado_id
    }]);

    if (!error) {
      await supabase
        .from('solicitudcompra')
        .update({ estado: 'Aprobada' })
        .eq('id', request.id);

      onSuccess();
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>📝 Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {/* Campos del formulario (proveedor, precios, etc.) */}
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

          {/* Resto de campos y cálculos */}
          {/* ... (mantener la lógica de cálculos anterior) ... */}

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