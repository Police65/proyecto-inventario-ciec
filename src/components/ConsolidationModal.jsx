import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, Row, Col, InputGroup, Alert, Badge } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const ConsolidationModal = ({ show, onHide, onConsolidate }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [selectedSolicitudes, setSelectedSolicitudes] = useState(new Set());
  const [cantidades, setCantidades] = useState(new Map());
  const [proveedorId, setProveedorId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Cargar solicitudes pendientes
        const { data: solicitudesData } = await supabase
          .from('solicitudcompra')
          .select(`
            id,
            empleado:empleado_id(nombre, apellido),
            detalles:solicitudcompra_detalle(
              producto_id,
              cantidad,
              producto:producto_id(descripcion, categoria_id)
            )
          `)
          .eq('estado', 'Pendiente');

        // Cargar proveedores con categorías
        const { data: proveedoresData } = await supabase
          .from('proveedor')
          .select(`
            id,
            nombre,
            categorias:proveedor_categoria(
              categoria:categoria_id(nombre)
            )
          `);

        setSolicitudes(solicitudesData || []);
        setProveedores(proveedoresData || []);
      } catch (err) {
        setError('Error cargando datos: ' + err.message);
      }
    };

    if (show) cargarDatos();
  }, [show]);

  const productosConsolidados = Array.from(selectedSolicitudes)
    .flatMap(solicitudId => {
      const solicitud = solicitudes.find(s => s.id === solicitudId);
      return solicitud?.detalles?.map(d => ({
        ...d,
        solicitudId: solicitud.id,
      })) || [];
    })
    .reduce((acc, item) => {
      const existente = acc.find(p => p.producto_id === item.producto_id);
      if (existente) {
        existente.cantidad += item.cantidad;
        existente.solicitudes.add(item.solicitudId);
      } else {
        acc.push({
          producto_id: item.producto_id,
          descripcion: item.producto.descripcion,
          cantidad: item.cantidad,
          solicitudes: new Set([item.solicitudId]),
          cantidadOrdenar: item.cantidad,
        });
      }
      return acc;
    }, []);

  const handleCrearOrden = async () => {
    try {
      const ordenData = {
        proveedor_id: Number(proveedorId),
        productos: productosConsolidados.map(p => ({
          ...p,
          solicitudes: Array.from(p.solicitudes), // Convertir Set a Array
        })),
        estado: 'Pendiente',
        fecha_creacion: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('ordenes_consolidadas')
        .insert([ordenData])
        .select('id, proveedor_id, productos'); // Selección específica

      if (error) throw error;

      onConsolidate(data[0]);
      onHide();
    } catch (err) {
      setError('Error al crear consolidación: ' + err.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered className="bg-dark text-light">
      <Modal.Header closeButton className="bg-dark border-secondary">
        <Modal.Title>Consolidar Solicitudes</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Row>
          <Col md={7}>
            <h5>Solicitudes Pendientes</h5>
            <Table striped bordered hover variant="dark">
              <thead>
                <tr>
                  <th></th>
                  <th>ID</th>
                  <th>Productos Solicitados</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(solicitud => (
                  <tr key={solicitud.id}>
                    <td>
                      <Form.Check
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
                        <Badge key={i} bg="secondary" className="me-1">
                          {d.producto.descripcion} (x{d.cantidad})
                        </Badge>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Col>

          <Col md={5} className="border-start">
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
                    <td>{p.descripcion}</td>
                    <td>{p.cantidad}</td>
                    <td>
                      <InputGroup>
                        <Form.Control
                          type="number"
                          min="0"
                          max={p.cantidad}
                          value={cantidades.get(p.producto_id) || p.cantidad}
                          onChange={(e) => {
                            const newCantidades = new Map(cantidades);
                            newCantidades.set(p.producto_id, Math.min(p.cantidad, Number(e.target.value)));
                            setCantidades(newCantidades);
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
                  {proveedor.categorias?.map(c => c.categoria.nombre).join(', ') || 'Sin categorías'}
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
          </Col>
        </Row>
      </Modal.Body>
    </Modal>
  );
};

export default ConsolidationModal;