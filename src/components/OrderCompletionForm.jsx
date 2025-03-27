import React, { useState } from 'react';
import { Modal, Form, Button, Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderCompletionForm = ({ show, onHide, order }) => {
  const [productosRecibidos, setProductosRecibidos] = useState({});
  const [factura, setFactura] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Registrar productos faltantes
    const faltantes = order.productos
      .filter(p => (productosRecibidos[p.producto_id] || 0) < p.cantidad)
      .map(p => ({
        orden_compra_id: order.id,
        producto_id: p.producto_id,
        cantidad_faltante: p.cantidad - (productosRecibidos[p.producto_id] || 0),
        motivo: 'No entregado'
      }));

    if (faltantes.length > 0) {
      await supabase.from('productos_no_recibidos').insert(faltantes);
    }

    // Subir factura si existe
    let facturaUrl = null;
    if (factura) {
      const { data, error } = await supabase.storage
        .from('facturas')
        .upload(`orden_${order.id}/${factura.name}`, factura);

      if (data) facturaUrl = data.path;
    }

    // Actualizar estado de la orden
    await supabase
      .from('ordencompra')
      .update({ 
        estado: 'Completada',
        documento_factura: facturaUrl 
      })
      .eq('id', order.id);

    // Actualizar inventario
    const updates = order.productos.map(async (p) => {
      const cantidadRecibida = productosRecibidos[p.producto_id] || 0;
      if (cantidadRecibida > 0) {
        const { data: inventarioItem } = await supabase
          .from('inventario')
          .select('id, existencias')
          .eq('producto_id', p.producto_id)
          .single();

        if (inventarioItem) {
          // Si el producto ya existe en inventario, incrementar existencias
          await supabase
            .from('inventario')
            .update({
              existencias: inventarioItem.existencias + cantidadRecibida,
              fecha_actualizacion: new Date().toISOString()
            })
            .eq('id', inventarioItem.id);
        } else {
          // Si no existe, crear un nuevo registro en inventario
          await supabase
            .from('inventario')
            .insert({
              producto_id: p.producto_id,
              ubicacion: 'Almacén principal', // Ajusta según tu lógica
              existencias: cantidadRecibida,
              fecha_actualizacion: new Date().toISOString()
            });
        }
      }
    });

    await Promise.all(updates);

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Completar Orden #{order.id}</Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark text-light">
        <Form onSubmit={handleSubmit}>
          <Table striped bordered hover variant="dark">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad Solicitada</th>
                <th>Cantidad Recibida</th>
              </tr>
            </thead>
            <tbody>
              {order.productos.map((p, i) => (
                <tr key={i}>
                  <td>{p.producto.descripcion}</td>
                  <td>{p.cantidad}</td>
                  <td>
                    <Form.Control
                      type="number"
                      min="0"
                      max={p.cantidad}
                      value={productosRecibidos[p.producto_id] || 0}
                      onChange={(e) => setProductosRecibidos(prev => ({
                        ...prev,
                        [p.producto_id]: parseInt(e.target.value)
                      }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Form.Group className="mt-3">
            <Form.Label>Documento de Factura</Form.Label>
            <Form.Control
              type="file"
              accept=".pdf,.jpg,.png"
              onChange={(e) => setFactura(e.target.files[0])}
            />
          </Form.Group>

          <div className="mt-4 d-flex justify-content-end">
            <Button variant="primary" type="submit">
              Finalizar Recepción
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderCompletionForm;