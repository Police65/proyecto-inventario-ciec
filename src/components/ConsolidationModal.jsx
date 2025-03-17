import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, Row, Col, InputGroup, Alert } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const ConsolidationModal = ({ show, onHide, onConsolidate }) => {
  const [todasSolicitudes, setTodasSolicitudes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [selectedSolicitudes, setSelectedSolicitudes] = useState(new Set());
  const [selectedProductos, setSelectedProductos] = useState(new Map());
  const [proveedorId, setProveedorId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data: solicitudesData, error: errSolicitudes } = await supabase
          .from('solicitudcompra')
          .select(`
            id,
            detalles:solicitudcompra_detalle(
              producto_id,
              cantidad,
              producto:producto_id(
                id,
                descripcion,
                categoria_id
              )
            )
          `)
          .eq('estado', 'Pendiente');

        const { data: proveedoresData, error: errProveedores } = await supabase
          .from('proveedor')
          .select(`
            id,
            nombre,
            categorias:proveedor_categoria(
              categoria:categoria_id(nombre)
          `);

        if (errSolicitudes) throw new Error('Error cargando solicitudes: ' + errSolicitudes.message);
        if (errProveedores) throw new Error('Error cargando proveedores: ' + errProveedores.message);

        setTodasSolicitudes(solicitudesData || []);
        setProveedores(proveedoresData || []);

      } catch (err) {
        setError(err.message);
      }
    };

    if (show) cargarDatos();
  }, [show]);

  const productosConsolidados = Array.from(selectedSolicitudes)
    .flatMap(solicitudId => {
      const solicitud = todasSolicitudes.find(s => s.id === solicitudId);
      return solicitud?.detalles || [];
    })
    .reduce((acc, detalle) => {
      const existente = acc.find(p => p.producto.id === detalle.producto.id);
      if (existente) {
        existente.cantidad += detalle.cantidad;
      } else {
        acc.push({
          producto: detalle.producto,
          cantidad: detalle.cantidad,
          cantidadOrdenar: detalle.cantidad
        });
      }
      return acc;
    }, []);

  const handleCrearOrden = async () => {
    try {
      // Validación básica
      if (!proveedorId) throw new Error('Seleccione un proveedor');
      if (productosConsolidados.length === 0) throw new Error('No hay productos seleccionados');

      const ordenData = {
        proveedor_id: proveedorId,
        productos: productosConsolidados.map(p => ({
          producto_id: p.producto.id,
          cantidad: selectedProductos.get(p.producto.id) || p.cantidad
        })),
        solicitudes_ids: Array.from(selectedSolicitudes)
      };

      onConsolidate(ordenData);
      onHide();

    } catch (err) {
      setError('Error al crear orden: ' + err.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Consolidar Solicitudes</Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark text-light" style={{ minHeight: '60vh' }}>
        {error && <Alert variant="danger">{error}</Alert>}
        
        <Row>
          <Col md={8}>
            <h5>Seleccionar Solicitudes</h5>
            <Table striped bordered hover variant="dark">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}></th>
                  <th>ID</th>
                  <th>Productos</th>
                </tr>
              </thead>
              <tbody>
                {todasSolicitudes.map(solicitud => (
                  <tr key={solicitud.id}>
                    <td>
                      <Form.Check 
                        type="checkbox"
                        checked={selectedSolicitudes.has(solicitud.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedSolicitudes);
                          e.target.checked 
                            ? newSet.add(solicitud.id)
                            : newSet.delete(solicitud.id);
                          setSelectedSolicitudes(newSet);
                        }}
                      />
                    </td>
                    <td>#{solicitud.id}</td>
                    <td>
                      {solicitud.detalles?.map((d, i) => (
                        <div key={i} className="mb-1">
                          <small>
                            {d.producto.descripcion} 
                            <span className="ms-2 text-muted">(x{d.cantidad})</span>
                          </small>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Col>

          <Col md={4}>
            <div className="sticky-top" style={{ top: '20px' }}>
              <h5>Productos Consolidados</h5>
              <Table striped bordered hover variant="dark">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Total</th>
                    <th>A Ordenar</th>
                  </tr>
                </thead>
                <tbody>
                  {productosConsolidados.map((p, i) => (
                    <tr key={i}>
                      <td>{p.producto.descripcion}</td>
                      <td>{p.cantidad}</td>
                      <td>
                        <InputGroup>
                          <Form.Control
                            type="number"
                            min="0"
                            max={p.cantidad}
                            value={selectedProductos.get(p.producto.id) || p.cantidad}
                            onChange={(e) => {
                              const value = Math.min(p.cantidad, Math.max(0, e.target.value));
                              setSelectedProductos(prev => new Map(prev.set(p.producto.id, value)));
                            }}
                          />
                        </InputGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <h5 className="mt-4">Proveedor</h5>
              <Form.Select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="bg-secondary text-light"
              >
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map(proveedor => (
                  <option key={proveedor.id} value={proveedor.id}>
                    {proveedor.nombre} - 
                    {proveedor.categorias?.map(c => c.categoria.nombre).join(', ')}
                  </option>
                ))}
              </Form.Select>

              <Button
                variant="success"
                className="mt-3 w-100"
                onClick={handleCrearOrden}
                disabled={!proveedorId || productosConsolidados.length === 0}
              >
                Generar Orden Consolidada
              </Button>
            </div>
          </Col>
        </Row>
      </Modal.Body>
    </Modal>
  );
};

export default ConsolidationModal;