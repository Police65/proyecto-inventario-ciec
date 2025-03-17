import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table, Alert } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const ConsolidationModal = ({ show, onHide, solicitud, onConsolidate }) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [selected, setSelected] = useState({});
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [productosConsolidados, setProductosConsolidados] = useState({});

  useEffect(() => {
    const cargarDatos = async () => {
      if (!show || !solicitud) return;

      // Cargar proveedores
      const { data: provData } = await supabase.from('proveedor').select('*');
      setProveedores(provData || []);

      // Cargar solicitudes agrupables
      const { data: agrupables } = await supabase
        .from('solicitudcompra')
        .select(`
          *,
          detalles:solicitudcompra_detalle(producto_id, cantidad)
        `)
        .eq('estado', 'Pendiente')
        .in('id', 
          supabase
            .from('solicitudcompra_detalle')
            .select('solicitud_compra_id')
            .in('producto_id', solicitud.detalles.map(d => d.producto_id))
        );

      // Calcular productos consolidados
      const productosMap = agrupables.reduce((acc, s) => {
        s.detalles.forEach(d => {
          acc[d.producto_id] = (acc[d.producto_id] || 0) + d.cantidad;
        });
        return acc;
      }, {});

      setProductosConsolidados(productosMap);
      setSolicitudes(agrupables);
      setSelected({ [solicitud.id]: true });
    };

    cargarDatos();
  }, [show, solicitud]);

  const handleToggleSolicitud = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirmarConsolidacion = async () => {
    const solicitudesSeleccionadas = solicitudes.filter(s => selected[s.id]);
    onConsolidate(solicitudesSeleccionadas, proveedorId);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Consolidar Solicitudes</Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="bg-dark text-light">
        <Form.Group className="mb-4">
          <Form.Label>Seleccionar Proveedor</Form.Label>
          <Form.Select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="bg-secondary text-light"
            required
          >
            <option value="">Seleccionar proveedor...</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <div className="mb-4">
          <h5>Resumen Consolidado</h5>
          <Table striped bordered hover variant="dark">
            <thead>
              <tr>
                <th>Producto ID</th>
                <th>Cantidad Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(productosConsolidados).map(([id, cantidad]) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>{cantidad}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <h5>Solicitudes Disponibles</h5>
        <Table striped bordered hover variant="dark">
          <thead>
            <tr>
              <th></th>
              <th>ID Solicitud</th>
              <th>Productos</th>
              <th>Cantidad Total</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map(s => (
              <tr key={s.id}>
                <td>
                  <Form.Check 
                    type="checkbox"
                    checked={!!selected[s.id]}
                    onChange={() => handleToggleSolicitud(s.id)}
                  />
                </td>
                <td>#{s.id}</td>
                <td>
                  {s.detalles.map((d, i) => (
                    <div key={i}>Producto {d.producto_id} x {d.cantidad}</div>
                  ))}
                </td>
                <td>{s.detalles.reduce((sum, d) => sum + d.cantidad, 0)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
      
      <Modal.Footer className="bg-dark">
        <Button variant="secondary" onClick={onHide}>Cancelar</Button>
        <Button variant="primary" onClick={handleConfirmarConsolidacion}>
          Crear Orden Consolidada
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConsolidationModal;