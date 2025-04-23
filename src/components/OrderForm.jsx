import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, InputGroup } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ 
  show, 
  onHide, 
  userProfile, 
  onSuccess,
  initialProducts = [],
  proveedorId = null,
  solicitudesIds = [],
  isDirectOrder = false
}) => {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [fetchedProducts, setFetchedProducts] = useState([]);
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
      const { data: productsData } = await supabase.from('producto').select('*');
      
      setProveedores(proveedoresData || []);
      setFetchedProducts(productsData || []);

      if (!isDirectOrder && initialProducts.length > 0) {
        const formattedProducts = initialProducts.map(p => ({
          id: p.producto_id || Date.now(),
          productId: p.producto_id,
          descripcion: p.descripcion,
          quantity: Number(p.cantidad) || 0,
          precio_unitario: Number(p.precio_unitario) || 0
        }));
        setProductos(formattedProducts);
        calcularTotales(formattedProducts);
      } else if (isDirectOrder) {
        setProductos([{ id: Date.now(), productId: '', quantity: 1, precio_unitario: 0 }]);
      }
    };

    if (show) cargarDatos();
  }, [show, initialProducts, isDirectOrder]);

  const handleAddProduct = () => {
    setProductos([...productos, { 
      id: Date.now(), 
      productId: '', 
      quantity: 1, 
      precio_unitario: 0 
    }]);
  };

  const calcularTotales = (productosActualizados) => {
    const subtotal = productosActualizados.reduce(
      (acc, p) => acc + (Number(p.quantity || 0) * Number(p.precio_unitario || 0)),
      0
    );
    const iva = subtotal * 0.16;
    const retencion = iva * (Number(formData.retencion_porcentaje) / 100);
    const neto = subtotal + iva - retencion;
    
    setFormData(prev => ({ 
      ...prev, 
      sub_total: Number(subtotal),
      iva: Number(iva),
      ret_iva: Number(retencion),
      neto_a_pagar: Number(neto)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.proveedor_id) throw new Error("¡Seleccione un proveedor!");
      if (productos.some(p => !p.productId || p.quantity <= 0 || p.precio_unitario <= 0)) {
        throw new Error("Complete todos los campos de productos correctamente");
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
          solicitud_compra_id: isDirectOrder ? null : solicitudesIds?.[0]
        }])
        .single();

      if (error) throw error;

      const detalles = productos.map(p => ({
        orden_compra_id: orden.id,
        producto_id: p.productId,
        cantidad: Number(p.quantity),
        precio_unitario: Number(p.precio_unitario)
      }));
      await supabase.from('ordencompra_detalle').insert(detalles);

      if (solicitudesIds?.length > 0) {
        await supabase.from('orden_solicitud').insert(
          solicitudesIds.map(solicitudId => ({
            ordencompra_id: orden.id,
            solicitud_id: solicitudId
          }))
        );
        
        await supabase
          .from('solicitudcompra')
          .update({ estado: 'Aprobada' })
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
        <Modal.Title>
          {isDirectOrder ? 'Crear Orden Directa' : 'Crear Orden de Compra'}
        </Modal.Title>
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
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Total</th>
                {isDirectOrder && <th>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td>
                    {isDirectOrder ? (
                      <Form.Select
                        value={p.productId}
                        onChange={(e) => {
                          const product = fetchedProducts.find(prod => prod.id === e.target.value);
                          const updated = productos.map(item => 
                            item.id === p.id ? { 
                              ...item, 
                              productId: e.target.value,
                              descripcion: product?.descripcion 
                            } : item
                          );
                          setProductos(updated);
                          calcularTotales(updated);
                        }}
                      >
                        <option value="">Seleccionar</option>
                        {fetchedProducts.map(prod => (
                          <option key={prod.id} value={prod.id}>{prod.descripcion}</option>
                        ))}
                      </Form.Select>
                    ) : (
                      p.descripcion || 'Producto no disponible'
                    )}
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      min="1"
                      value={p.quantity}
                      onChange={(e) => {
                        const updated = productos.map(item => 
                          item.id === p.id ? { ...item, quantity: Number(e.target.value) } : item
                        );
                        setProductos(updated);
                        calcularTotales(updated);
                      }}
                    />
                  </td>
                  <td>
                    <InputGroup>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.precio_unitario}
                        onChange={(e) => {
                          const updated = productos.map(item => 
                            item.id === p.id ? { ...item, precio_unitario: Number(e.target.value) } : item
                          );
                          setProductos(updated);
                          calcularTotales(updated);
                        }}
                      />
                      <InputGroup.Text>{formData.unidad}</InputGroup.Text>
                    </InputGroup>
                  </td>
                  <td>
                    {(Number(p.quantity) * Number(p.precio_unitario)).toFixed(2)}
                  </td>
                  {isDirectOrder && (
                    <td>
                      <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={() => setProductos(productos.filter(item => item.id !== p.id))}
                      >
                        Eliminar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>

          {isDirectOrder && (
            <Button variant="outline-primary" onClick={handleAddProduct} className="mb-3">
              Añadir Producto
            </Button>
          )}

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
                    calcularTotales(productos);
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