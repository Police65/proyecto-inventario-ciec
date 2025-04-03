import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, InputGroup } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, ordenConsolidada, userProfile, onSuccess, selectedRequest }) => {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [inicializado, setInicializado] = useState(false);
  const [formData, setFormData] = useState({
    sub_total: 0,
    iva: 0,
    ret_iva: 0,
    retencion_porcentaje: 75,
    neto_a_pagar: 0,
    unidad: 'Bs',
    empleado_id: userProfile?.empleado_id || null,
    proveedor_id: ordenConsolidada?.proveedor_id || null
  });

  useEffect(() => {
    const cargarDatos = async () => {
      console.log('UserProfile en OrderForm:', userProfile);  
      console.log('Empleado ID:', userProfile?.empleado_id); 
      if (!userProfile?.empleado_id) {
        alert("Error: El usuario no tiene un empleado asociado");
        onHide();
        return;
      }

      const { data: proveedoresData } = await supabase
        .from('proveedor')
        .select('id, nombre');
      
      if (proveedoresData) setProveedores(proveedoresData);

      if (ordenConsolidada && !inicializado) {
        const productosIniciales = ordenConsolidada.productos.map(p => ({
          ...p,
          cantidad: Number(p.cantidad) || 0,
          precio_unitario: Number(p.precio_unitario) || 0
        }));
        setProductos(productosIniciales);
        calcularTotales(productosIniciales);
        setInicializado(true);
      } else if (selectedRequest?.detalles && !inicializado) {
        const productosIniciales = selectedRequest.detalles.map(d => ({
          producto_id: d.producto_id,
          descripcion: d.producto?.descripcion || 'Producto sin nombre',
          cantidad: Number(d.cantidad) || 0,
          precio_unitario: 0
        }));
        setProductos(productosIniciales);
        calcularTotales(productosIniciales);
        setInicializado(true);
      }
    };

    if (show) {
      cargarDatos();
    } else {
      setInicializado(false);
      setProductos([]);
    }
  }, [show, ordenConsolidada, userProfile, onHide, inicializado, selectedRequest]);

  const calcularTotales = (productosActualizados) => {
    const productosValidos = productosActualizados.map(p => ({
      ...p,
      cantidad: Number(p.cantidad) || 0,
      precio_unitario: Number(p.precio_unitario) || 0
    }));

    const subtotal = productosValidos.reduce(
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
      neto_a_pagar: neto
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (!formData.proveedor_id) throw new Error("¡Seleccione un proveedor!");
      if (!userProfile?.empleado_id) throw new Error("Error de autenticación");
      if (productos.length === 0) throw new Error("No hay productos");

      const solicitudesIds = ordenConsolidada?.solicitudes || 
        (selectedRequest?.id ? [selectedRequest.id] : []);
      
      console.log('Solicitudes IDs:', solicitudesIds);
      
      if (solicitudesIds.length === 0) {
        throw new Error("No hay solicitudes vinculadas");
      }

      const preciosInvalidos = productos.some(p => 
        isNaN(p.precio_unitario) || p.precio_unitario <= 0
      );
      if (preciosInvalidos) throw new Error("Precios unitarios inválidos");

      const { data: orden, error } = await supabase
        .from('ordencompra')
        .insert([{
          ...formData,
          proveedor_id: Number(formData.proveedor_id),
          empleado_id: userProfile.empleado_id,
          estado: 'Pendiente',
          fecha_orden: new Date().toISOString(),
          solicitud_compra_id: Number(solicitudesIds[0])
        }])
        .select(`
          *,
          proveedor:proveedor_id(*),
          productos:ordencompra_detalle(
            *,
            producto:producto_id(*)
          ),
          empleado:empleado_id(*),
          solicitud_compra:solicitud_compra_id(*)
        `)
        .single();

      if (error) throw error;

      const detalles = productos.map(p => ({
        orden_compra_id: orden.id,
        producto_id: p.producto_id,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario
      }));

      await supabase.from('ordencompra_detalle').insert(detalles);

      await supabase.from('orden_solicitud').insert(
        solicitudesIds.map(solicitudId => ({
          ordencompra_id: Number(orden.id),
          solicitud_id: Number(solicitudId)
        }))
      );

      await supabase
        .from('solicitudcompra')
        .update({ estado: 'Aprobada' })
        .in('id', solicitudesIds);

      onSuccess(orden); // Pasamos la orden creada
      onHide();

    } catch (error) {
      alert('❌ Error: ' + error.message);
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
          <div className="row mb-4">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Proveedor</Form.Label>
                <Form.Select
                  value={formData.proveedor_id || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    proveedor_id: Number(e.target.value)
                  }))}
                  required
                  className="bg-secondary text-light"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(proveedor => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
            
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Unidad Monetaria</Form.Label>
                <Form.Select
                  value={formData.unidad}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    unidad: e.target.value
                  }))}
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
                <th>Producto</th>
                <th>Cantidad Consolidada</th>
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
                        value={productos[i].precio_unitario === '' ? '' : productos[i].precio_unitario}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numericValue = parseFloat(value);
                          
                          const nuevosProductos = [...productos];
                          nuevosProductos[i].precio_unitario = value === '' ? '' : numericValue;
                          
                          setProductos(nuevosProductos);
                          calcularTotales(nuevosProductos);
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '') {
                            const nuevosProductos = [...productos];
                            nuevosProductos[i].precio_unitario = 0;
                            setProductos(nuevosProductos);
                            calcularTotales(nuevosProductos);
                          }
                        }}
                      />
                      <InputGroup.Text>{simboloMoneda}</InputGroup.Text>
                    </InputGroup>
                  </td>
                  <td>
                    {((p.precio_unitario || 0) * p.cantidad).toFixed(2)}
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
                    const porcentaje = Math.min(100, Math.max(0, Number(e.target.value)));
                    setFormData(prev => ({
                      ...prev,
                      retencion_porcentaje: porcentaje
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

          <div className="mt-4 d-grid gap-2">
            <Button variant="success" type="submit" size="lg">
              🚀 Crear Orden
            </Button>
            <Button variant="secondary" onClick={onHide} size="lg">
              ❌ Cancelar
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderForm;