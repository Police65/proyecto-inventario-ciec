import React, { useState } from 'react';
import { Modal, Form, Button, Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid'; // Para generar nombres únicos

const OrderCompletionForm = ({ show, onHide, order, onComplete }) => {
  const [productosRecibidos, setProductosRecibidos] = useState({});
  const [factura, setFactura] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Verificar autenticación
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Usuario no autenticado. Inicia sesión para subir facturas.');
      }

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
        const { error } = await supabase.from('productos_no_recibidos').insert(faltantes);
        if (error) throw error;
      }

      // Subir factura si existe
      let facturaUrl = null;
      if (factura) {
        // Verificar que es un archivo válido
        if (!(factura instanceof File)) {
          throw new Error('El objeto seleccionado no es un archivo válido');
        }

        // Generar nombre único con UUID
        const fileExtension = factura.name.split('.').pop() || 'pdf';
        const uniqueFileName = `factura_${order.id}_${uuidv4()}.${fileExtension}`;
        const filePath = uniqueFileName; // Subir directamente al bucket sin subcarpetas

        // Verificar tamaño (50MB límite)
        if (factura.size > 50 * 1024 * 1024) {
          throw new Error('El archivo excede el límite de 50MB');
        }

        console.log('Generando URL firmada para subir archivo a:', filePath);

        // Generar URL firmada para la subida
        const { data: signedData, error: signedError } = await supabase.storage
          .from('facturas')
          .createSignedUploadUrl(filePath);

        if (signedError) {
          console.error('Error al generar URL firmada:', signedError);
          throw signedError;
        }

        console.log('URL firmada generada:', signedData.signedUrl);

        // Subir el archivo usando la URL firmada
        const response = await fetch(signedData.signedUrl, {
          method: 'PUT',
          body: factura,
          headers: {
            'Content-Type': factura.type || 'application/octet-stream',
          },
        });

        if (!response.ok) {
          throw new Error(`Error al subir archivo: ${response.statusText}`);
        }

        console.log('Archivo subido con éxito mediante URL firmada');

        // Obtener URL pública (ya que el bucket es público)
        const { data: publicUrlData, error: urlError } = supabase.storage
          .from('facturas')
          .getPublicUrl(filePath);

        if (urlError) {
          console.error('Error al obtener URL pública:', urlError);
          throw urlError;
        }

        facturaUrl = publicUrlData.publicUrl;
        console.log('Factura subida con éxito:', facturaUrl);
      }

      // Actualizar estado de la orden
      const { error: updateError } = await supabase
        .from('ordencompra')
        .update({ 
          estado: 'Completada',
          documento_factura: facturaUrl 
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

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
            await supabase
              .from('inventario')
              .update({
                existencias: inventarioItem.existencias + cantidadRecibida,
                fecha_actualizacion: new Date().toISOString()
              })
              .eq('id', inventarioItem.id);
          } else {
            await supabase
              .from('inventario')
              .insert({
                producto_id: p.producto_id,
                ubicacion: 'Almacén principal',
                existencias: cantidadRecibida,
                fecha_actualizacion: new Date().toISOString()
              });
          }
        }
      });

      await Promise.all(updates);

      onComplete();
      onHide();
    } catch (error) {
      console.error('Error al completar la orden:', error);
      alert('Error al completar la orden: ' + (error.message || 'Error desconocido'));
    }
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
                  <td>{p.producto?.descripcion || 'N/A'}</td>
                  <td>{p.cantidad}</td>
                  <td>
                    <Form.Control
                      type="number"
                      min="0"
                      max={p.cantidad}
                      value={productosRecibidos[p.producto_id] || 0}
                      onChange={(e) => setProductosRecibidos(prev => ({
                        ...prev,
                        [p.producto_id]: parseInt(e.target.value) || 0
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