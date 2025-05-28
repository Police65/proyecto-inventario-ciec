import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Button, Table, InputGroup } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ 
  show, 
  onHide, 
  userProfile, 
  onSuccess,
  initialProducts = [],
  proveedorId = null,
  solicitudesIds = []
}) => {
  const [productosSeleccionados, setProductosSeleccionados] = useState(
    initialProducts.map(p => ({ 
      ...p, 
      seleccionado: true, 
      motivo: '' 
    }))
  );
  const [proveedores, setProveedores] = useState([]);
  const [formData, setFormData] = useState({
    sub_total: 0,
    iva: 0,
    ret_iva: 0,
    retencion_porcentaje: 75,
    neto_a_pagar: 0,
    unidad: 'Bs',
    empleado_id: userProfile?.empleado_id || null,
    proveedor_id: proveedorId || null
  });

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: proveedoresData } = await supabase.from('proveedor').select('id, nombre');
      setProveedores(proveedoresData || []);

      if (initialProducts.length > 0) {
        const formattedProducts = initialProducts.map(p => ({
          id: p.producto_id || Date.now(),
          productId: p.producto_id,
          descripcion: p.descripcion,
          quantity: Number(p.cantidad) || 0,
          precio_unitario: Number(p.precio_unitario) || 0,
          seleccionado: true,
          motivo: ''
        }));
        setProductosSeleccionados(formattedProducts);
        calcularTotales(formattedProducts);
      }
    };

    if (show) cargarDatos();
  }, [show, initialProducts]);

  const calcularTotales = useCallback((productosActualizados) => {
    const subtotal = productosActualizados
      .filter(p => p.seleccionado)
      .reduce(
        (acc, p) => acc + (Number(p.quantity || 0) * Number(p.precio_unitario || 0)),
        0
      );
    const iva = subtotal * 0.16;
    const retencion = iva * (Number(formData.retencion_porcentaje) / 100);
    const neto = subtotal + iva - retencion;
    
    setFormData(prev => ({ 
      ...prev, 
      sub_total: subtotal,
      iva: iva,
      ret_iva: retencion,
      neto_a_pagar: neto
    }));
  }, [formData.retencion_porcentaje]);

  const handleProductChange = useCallback((id, field, value) => {
    setProductosSeleccionados(prev => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      );
      calcularTotales(updated);
      return updated;
    });
  }, [calcularTotales]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.proveedor_id) throw new Error("¡Seleccione un proveedor!");
      const productosAOrdenar = productosSeleccionados.filter(p => p.seleccionado);
      if (productosAOrdenar.some(p => !p.productId || p.quantity <= 0 || p.precio_unitario <= 0)) {
        throw new Error("Complete todos los campos de productos seleccionados correctamente");
      }

      const { data: orden, error } = await supabase
        .from('ordencompra')
        .insert([{
          ...formData,
          sub_total: Number(formData.sub_total),
          iva: Number(formData.iva),
          ret_iva: Number(formData.ret_iva),
          neto_a_pagar: Number(formData.neto_a_pagar),
          proveedor_id: Number(formData.proveedor_id),
          empleado_id: userProfile.empleado_id,
          estado: 'Pendiente',
          fecha_orden: new Date().toISOString(),
          solicitud_compra_id: solicitudesIds?.[0]
        }])
        .select()
        .single();

      if (error) throw error;

      const detalles = productosAOrdenar.map(p => ({
        orden_compra_id: orden.id,
        producto_id: p.productId,
        cantidad: Number(p.quantity),
        precio_unitario: Number(p.precio_unitario)
      }));
      await supabase.from('ordencompra_detalle').insert(detalles);

      const productosRezagados = productosSeleccionados.filter(p => !p.seleccionado);
      if (productosRezagados.length > 0) {
        const rezagadosInserts = productosRezagados.map(p => ({
          orden_compra_id: orden.id,
          producto_id: p.productId,
          cantidad: p.quantity,
          motivo: p.motivo || 'No especificado',
          solicitud_id: solicitudesIds[0]
        }));
        await supabase.from('productos_rezagados').insert(rezagadosInserts);

        const { data: empleadoSolicitud } = await supabase
          .from('solicitudcompra')
          .select('empleado_id')
          .eq('id', solicitudesIds[0])
          .single();

        await supabase.from('notificaciones').insert(
          productosRezagados.map(p => ({
            user_id: empleadoSolicitud.empleado_id,
            title: 'Producto Rezagado',
            description: `El producto ${p.descripcion} de tu solicitud #${solicitudesIds[0]} fue rezagado. Motivo: ${p.motivo || 'No especificado'}`,
            created_at: new Date().toISOString(),
            read: false
          }))
        );
      }

      if (solicitudesIds?.length > 0) {
        await supabase.from('orden_solicitud').insert(
          solicitudesIds.map(solicitudId => ({
            ordencompra_id: orden.id,
            solicitud_id: solicitudId
          }))
        );
        
        await supabase
          .from('solicitudcompra')
          .update({ estado: productosRezagados.length > 0 && productosAOrdenar.length === 0 ? 'Rechazada' : 'Aprobada' })
          .in('id', solicitudesIds);
      }

      onSuccess(orden);
      onHide();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark text-light">
        <Form onSubmit={handleSubmit}>
          <div className="row mb-4">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Proveedor</Form.Label>
                <Form.Select
                  value={formData.proveedor_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, proveedor_id: e.target.value }))}
                  required
                  className="bg-secondary text-light"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(proveedor => (
                    <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
            
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Unidad Monetaria</Form.Label>
                <Form.Select
                  value={formData.unidad}
                  onChange={(e) => setFormData(prev => ({ ...prev, unidad: e.target.value }))}
                  className="bg-secondary text-light"
                >
                  <option value="Bs">Bolívares (Bs)</option>
                  <option value="USD">Dólares (USD)</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>

          <Table striped bordered hover variant="dark">
            <thead>
              <tr>
                <th>Seleccionar</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Total</th>
                <th>Motivo (si no seleccionado)</th>
              </tr>
            </thead>
            <tbody>
              {productosSeleccionados.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Form.Check
                      checked={p.seleccionado}
                      onChange={(e) => {
                        const updated = [...productosSeleccionados];
                        const index = updated.findIndex(item => item.id === p.id);
                        updated[index].seleccionado = e.target.checked;
                        setProductosSeleccionados(updated);
                        calcularTotales(updated);
                      }}
                    />
                  </td>
                  <td>{p.descripcion || 'Producto no disponible'}</td>
                  <td>
                    <Form.Control
                      type="number"
                      min="1"
                      value={p.quantity}
                      onChange={(e) => handleProductChange(p.id, 'quantity', Number(e.target.value) || 1)}
                    />
                  </td>
                  <td>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.precio_unitario}
                        onChange={(e) => handleProductChange(p.id, 'precio_unitario', Number(e.target.value) || 0)}
                      />
                      <InputGroup.Text>{formData.unidad}</InputGroup.Text>
                    </InputGroup>
                  </td>
                  <td>
                    {p.seleccionado ? (Number(p.quantity || 0) * Number(p.precio_unitario || 0)).toFixed(2) : 'N/A'}
                  </td>
                  <td>
                    {!p.seleccionado && (
                      <Form.Control
                        type="text"
                        value={p.motivo}
                        onChange={(e) => handleProductChange(p.id, 'motivo', e.target.value)}
                        placeholder="Motivo del rechazo"
                      />
                    )}
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
                  min="0"
                  max="100"
                  value={formData.retencion_porcentaje}
                  onChange={(e) => {
                    const value = Math.min(100, Math.max(0, Number(e.target.value)));
                    setFormData(prev => ({ ...prev, retencion_porcentaje: value }));
                    calcularTotales(productosSeleccionados);
                  }}
                />
                <InputGroup.Text>%</InputGroup.Text>
              </InputGroup>
            </Form.Group>
            <div className="d-flex justify-content-between">
              <span>Subtotal:</span>
              <span>{formData.unidad} {Number(formData.sub_total).toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>IVA (16%):</span>
              <span>{formData.unidad} {Number(formData.iva).toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>Retención IVA ({formData.retencion_porcentaje}%):</span>
              <span>{formData.unidad} {Number(formData.ret_iva).toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between fw-bold">
              <span>Neto a Pagar:</span>
              <span>{formData.unidad} {Number(formData.neto_a_pagar).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 d-grid gap-2">
            <Button variant="success" type="submit" size="lg">
              Crear Orden
            </Button>
            <Button variant="secondary" onClick={onHide} size="lg">
              Cancelar
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderForm;