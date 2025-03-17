import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, ordenConsolidada, onSuccess }) => {
  const [proveedor, setProveedor] = useState(null);
  const [productos, setProductos] = useState([]);
  const [formData, setFormData] = useState({
    unidad: 'Bs',
    observaciones: ''
  });

  useEffect(() => {
    const cargarDatos = async () => {
      if (!ordenConsolidada) return;
      
      const { data } = await supabase
        .from('proveedor')
        .select('*')
        .eq('id', ordenConsolidada.proveedor_id)
        .single();

      setProveedor(data);
      setProductos(ordenConsolidada.productos);
    };

    cargarDatos();
  }, [ordenConsolidada]);

  const calcularTotales = () => {
    return productos.reduce((acc, p) => {
      const subtotal = p.cantidad * (p.precio_unitario || 0);
      const iva = subtotal * 0.16;
      return {
        subtotal: acc.subtotal + subtotal,
        iva: acc.iva + iva,
        ret_iva: acc.ret_iva + (iva * 0.75)
      };
    }, { subtotal: 0, iva: 0, ret_iva: 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const totales = calcularTotales();

    try {
      // Crear orden principal
      const { data: orden, error } = await supabase
        .from('ordencompra')
        .insert([{
          proveedor_id: ordenConsolidada.proveedor_id,
          sub_total: totales.subtotal,
          iva: totales.iva,
          ret_iva: totales.ret_iva,
          neto_a_pagar: totales.subtotal + totales.iva - totales.ret_iva,
          unidad: formData.unidad,
          observaciones: formData.observaciones,
          estado: 'Borrador'
        }])
        .select('id')
        .single();

      // Crear detalles de la orden
      await supabase
        .from('ordencompra_detalle')
        .insert(productos.map(p => ({
          orden_compra_id: orden.id,
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario || 0
        })));

      // Vincular solicitudes
      await supabase
        .from('orden_solicitud')
        .insert(ordenConsolidada.solicitudes_ids.map(solicitudId => ({
          orden_id: orden.id,
          solicitud_id: solicitudId
        })));

      // Actualizar estado de las solicitudes
      await supabase
        .from('solicitudcompra')
        .update({ estado: 'En Proceso' })
        .in('id', ordenConsolidada.solicitudes_ids);

      onSuccess();
      onHide();
    } catch (error) {
      alert('Error al crear orden: ' + error.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Orden Consolidada</Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark text-light">
        <Form onSubmit={handleSubmit}>
          <div className="mb-4">
            <h4>Proveedor: {proveedor?.nombre}</h4>
            <p>RIF: {proveedor?.rif} | Teléfono: {proveedor?.telefono}</p>
          </div>

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
              {productos.map((p, i) => (
                <tr key={i}>
                  <td>{p.producto?.descripcion}</td>
                  <td>{p.cantidad}</td>
                  <td>
                    <Form.Control
                      type="number"
                      step="0.01"
                      value={p.precio_unitario || 0}
                      onChange={(e) => {
                        const nuevosProductos = [...productos];
                        nuevosProductos[i].precio_unitario = parseFloat(e.target.value);
                        setProductos(nuevosProductos);
                      }}
                      required
                    />
                  </td>
                  <td>{(p.cantidad * (p.precio_unitario || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="mt-4 p-3 bg-secondary rounded">
            <h5>Totales ({formData.unidad})</h5>
            <div className="d-flex justify-content-between">
              <span>Subtotal:</span>
              <span>{calcularTotales().subtotal.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>IVA (16%):</span>
              <span>{calcularTotales().iva.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>Retención IVA:</span>
              <span>{calcularTotales().ret_iva.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between fw-bold">
              <span>Neto a Pagar:</span>
              <span>
                {(calcularTotales().subtotal + 
                  calcularTotales().iva - 
                  calcularTotales().ret_iva).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="primary" type="submit" className="me-2">
              Guardar Orden
            </Button>
            <Button variant="secondary" onClick={onHide}>
              Cancelar
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderForm;