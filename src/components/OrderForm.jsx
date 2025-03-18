import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, InputGroup } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, ordenConsolidada, userProfile, onSuccess }) => {
  const [productos, setProductos] = useState([]);
  const [formData, setFormData] = useState({
    sub_total: 0,
    iva: 0,
    ret_iva: 0,
    retencion_porcentaje: 75,
    neto_a_pagar: 0,
    unidad: 'Bs',
    empleado_id: userProfile?.empleado_id || null
  });

  useEffect(() => {
    if (ordenConsolidada) {
      const productosIniciales = ordenConsolidada.productos.map(p => ({
        ...p,
        precio_unitario: p.precio_unitario || 0
      }));
      setProductos(productosIniciales);
      calcularTotales(productosIniciales);
    }
  }, [ordenConsolidada]);

  const calcularTotales = (productosActualizados) => {
    const subtotal = productosActualizados.reduce(
      (acc, p) => acc + (p.precio_unitario * p.cantidad),
      0
    );
    
    const iva = subtotal * 0.16;
    const retencion = iva * (formData.retencion_porcentaje / 100);
    const neto = subtotal + iva - retencion;

    setFormData(prev => ({
      ...prev,
      sub_total: subtotal,
      iva: iva,
      ret_iva: retencion,
      neto_a_pagar: neto,
      empleado_id: userProfile?.empleado_id
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (!formData.empleado_id) throw new Error("No se encontró el empleado");
      if (!ordenConsolidada?.proveedor_id) throw new Error("Proveedor no válido");

      const { data: orden, error } = await supabase
        .from('ordencompra')
        .insert([{
          ...formData,
          proveedor_id: Number(ordenConsolidada.proveedor_id),
          estado: 'Pendiente',
          fecha_orden: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (error) throw error;

      const detalles = productos.map(p => ({
        orden_compra_id: orden.id,
        producto_id: p.producto_id,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario
      }));

      await supabase.from('ordencompra_detalle').insert(detalles);

      const solicitudesIds = [...new Set(
        ordenConsolidada.productos.flatMap(p => p.solicitudes)
      )];

      await supabase.from('orden_solicitud').insert(
        solicitudesIds.map(solicitudId => ({
          orden_id: orden.id,
          solicitud_id: solicitudId
        }))
      );

      await supabase
        .from('solicitudcompra')
        .update({ estado: 'En Proceso' })
        .in('id', solicitudesIds);

      onSuccess();
      onHide();

    } catch (error) {
      alert('Error creando orden: ' + error.message);
    }
  };

  const simboloMoneda = formData.unidad === 'Bs' ? 'Bs' : '$';

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark text-light">
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-4">
            <Form.Label>Unidad Monetaria</Form.Label>
            <Form.Select
              value={formData.unidad}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                unidad: e.target.value,
              }))}
            >
              <option value="Bs">Bolívares (Bs)</option>
              <option value="USD">Dólares (USD)</option>
            </Form.Select>
          </Form.Group>

          <Table striped bordered hover variant="dark">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario ({simboloMoneda})</th>
                <th>Total ({simboloMoneda})</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={i}>
                  <td>{p.descripcion}</td>
                  <td>{p.cantidad}</td>
                  <td>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.precio_unitario}
                        onChange={(e) => {
                          const nuevosProductos = [...productos];
                          nuevosProductos[i].precio_unitario = parseFloat(e.target.value) || 0;
                          setProductos(nuevosProductos);
                          calcularTotales(nuevosProductos);
                        }}
                      />
                      <InputGroup.Text>{simboloMoneda}</InputGroup.Text>
                    </InputGroup>
                  </td>
                  <td>
                    {(p.precio_unitario * p.cantidad).toFixed(2)} {simboloMoneda}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="mt-4 p-3 bg-secondary rounded">
            <h5>Totales</h5>

            <Form.Group className="mb-3">
              <Form.Label>Porcentaje de Retención IVA</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formData.retencion_porcentaje}
                  onChange={(e) => {
                    const porcentaje = parseFloat(e.target.value) || 0;
                    setFormData(prev => ({
                      ...prev,
                      retencion_porcentaje: porcentaje,
                    }));
                    calcularTotales(productos);
                  }}
                />
                <InputGroup.Text>%</InputGroup.Text>
              </InputGroup>
            </Form.Group>

            <div className="d-flex justify-content-between">
              <span>Subtotal:</span>
              <span>{simboloMoneda} {formData.sub_total.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>IVA (16%):</span>
              <span>{simboloMoneda} {formData.iva.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>Retención IVA ({formData.retencion_porcentaje}%):</span>
              <span>{simboloMoneda} {formData.ret_iva.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between fw-bold">
              <span>Neto a Pagar:</span>
              <span>{simboloMoneda} {formData.neto_a_pagar.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="primary" type="submit" className="me-2">
              Crear Orden
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