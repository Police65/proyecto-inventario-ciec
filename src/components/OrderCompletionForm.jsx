import React, { useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderCompletionForm = ({ show, onHide, orden, onSuccess }) => {
  const [formData, setFormData] = useState({
    numero_factura: '',
    fecha_recepcion: '',
    documento_factura: null,
    total_recepcionado: 0
  });
  const [productosFaltantes, setProductosFaltantes] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Registrar factura
      const { error: facturaError } = await supabase
        .from('facturas_orden')
        .insert([{
          ...formData,
          orden_compra_id: orden.id
        }]);

      if (facturaError) throw facturaError;

      // Registrar productos faltantes
      if (productosFaltantes.length > 0) {
        const { error: faltantesError } = await supabase
          .from('productos_no_recibidos')
          .insert(productosFaltantes.map(p => ({
            orden_compra_id: orden.id,
            producto_id: p.producto_id,
            cantidad_faltante: p.faltante,
            motivo: p.motivo
          })));

        if (faltantesError) throw faltantesError;
      }

      // Actualizar estado de la orden
      const { error: ordenError } = await supabase
        .from('ordencompra')
        .update({ estado_orden: 'completada' })
        .eq('id', orden.id);

      if (ordenError) throw ordenError;

      onSuccess();
      onHide();
    } catch (error) {
      alert(`Error al completar orden: ${error.message}`);
    }
  };

  const handleCantidadRecibida = (productoId, recibida) => {
    const detalle = orden.detalles.find(d => d.producto_id === productoId);
    const faltante = detalle.cantidad - recibida;
    
    if (faltante > 0) {
      setProductosFaltantes(prev => [
        ...prev.filter(p => p.producto_id !== productoId),
        { producto_id: productoId, faltante, motivo: '' }
      ]);
    } else {
      setProductosFaltantes(prev => prev.filter(p => p.producto_id !== productoId));
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Completar Orden #{orden.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <Form onSubmit={handleSubmit}>
          <h5>Detalles de Recepción</h5>
          <Form.Group className="mb-3">
            <Form.Label>Número de Factura</Form.Label>
            <Form.Control
              required
              value={formData.numero_factura}
              onChange={e => setFormData({...formData, numero_factura: e.target.value})
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Fecha de Recepción</Form.Label>
            <Form.Control
              type="date"
              required
              value={formData.fecha_recepcion}
              onChange={e => setFormData({...formData, fecha_recepcion: e.target.value})
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Documento de Factura</Form.Label>
            <Form.Control
              type="file"
              onChange={async (e) => {
                const file = e.target.files[0];
                const { data, error } = await supabase.storage
                  .from('facturas')
                  .upload(`orden_${orden.id}/${file.name}`, file);
                
                if (data) setFormData({...formData, documento_factura: data.path});
              }}
            />
          </Form.Group>

          <h5 className="mt-4">Recepción de Productos</h5>
          {orden.detalles?.map((detalle, index) => (
            <div key={index} className="mb-3 p-3 border rounded">
              <Form.Group>
                <Form.Label>{detalle.producto?.descripcion || `Producto ${detalle.producto_id}`}</Form.Label>
                <div className="d-flex gap-3">
                  <Form.Control
                    type="number"
                    placeholder="Cantidad recibida"
                    min="0"
                    max={detalle.cantidad}
                    onChange={(e) => handleCantidadRecibida(detalle.producto_id, parseInt(e.target.value))}
                  />
                  <span className="align-self-center">
                    / {detalle.cantidad} unidades
                  </span>
                </div>
              </Form.Group>
              
              {productosFaltantes.some(p => p.producto_id === detalle.producto_id) && (
                <Form.Group className="mt-2">
                  <Form.Label>Motivo de falta</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    onChange={(e) => setProductosFaltantes(prev => 
                      prev.map(p => p.producto_id === detalle.producto_id 
                        ? {...p, motivo: e.target.value} 
                        : p
                      )
                    )}
                  />
                </Form.Group>
              )}
            </div>
          ))}

          <div className="mt-4">
            <Button variant="primary" type="submit">
              Marcar Orden como Completada
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderCompletionForm;