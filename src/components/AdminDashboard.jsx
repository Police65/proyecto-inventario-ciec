import React, { useState, useEffect } from 'react';
import { Button, Table, Badge, Alert, Modal } from 'react-bootstrap';
import ConsolidationModal from './ConsolidationModal';
import { supabase } from '../supabaseClient';

const AdminDashboard = () => {
  const [showConsolidacion, setShowConsolidacion] = useState(false);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [ordenConsolidada, setOrdenConsolidada] = useState(null);
  const [showConfirmacion, setShowConfirmacion] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarSolicitudes = async () => {
      try {
        const { data, error } = await supabase
          .from('solicitudcompra')
          .select(`
            id,
            empleado:empleado_id(nombre, apellido),
            detalles:solicitudcompra_detalle(
              producto_id,
              cantidad,
              producto:producto_id(descripcion)
          `)
          .eq('estado', 'Pendiente');

        if (error) throw error;
        setSolicitudesPendientes(data || []);
      } catch (err) {
        setError('Error cargando solicitudes: ' + err.message);
      }
    };
    cargarSolicitudes();
  }, []);

  const confirmarOrden = async () => {
    try {
      const { data: nuevaOrden, error } = await supabase
        .from('ordencompra')
        .insert({
          proveedor_id: ordenConsolidada.proveedor_id,
          fecha_orden: new Date().toISOString(),
          estado: 'Pendiente',
          empleado_id: 1, // ID del usuario logueado
          productos: ordenConsolidada.productos
        })
        .select('*');

      if (error) throw error;

      // Crear relaciones orden_solicitud
      const relaciones = ordenConsolidada.productos
        .flatMap(p => Array.from(p.solicitudes).map(solicitud_id => ({
          orden_id: nuevaOrden[0].id,
          solicitud_id
        })));

      await supabase.from('orden_solicitud').insert(relaciones);

      // Actualizar estado de las solicitudes
      await supabase
        .from('solicitudcompra')
        .update({ estado: 'En Proceso' })
        .in('id', [...new Set(ordenConsolidada.productos.flatMap(p => Array.from(p.solicitudes)))]);

      setSolicitudesPendientes(prev => 
        prev.filter(s => !ordenConsolidada.productos.some(p => Array.from(p.solicitudes).includes(s.id))
      );

      setShowConfirmacion(false);
      setOrdenConsolidada(null);

    } catch (err) {
      setError('Error confirmando orden: ' + err.message);
    }
  };

  return (
    <div className="p-4 bg-dark text-light" style={{ minHeight: '100vh' }}>
      <h2 className="mb-4">Panel de Administración</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>ID</th>
            <th>Solicitante</th>
            <th>Productos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {solicitudesPendientes.map(solicitud => (
            <tr key={solicitud.id}>
              <td>#{solicitud.id}</td>
              <td>{solicitud.empleado?.nombre} {solicitud.empleado?.apellido}</td>
              <td>
                {solicitud.detalles?.map((d, i) => (
                  <Badge key={i} bg="info" className="me-1">
                    {d.producto.descripcion} (x{d.cantidad})
                  </Badge>
                ))}
              </td>
              <td>
                <Button 
                  variant="success" 
                  size="sm"
                  onClick={() => setShowConsolidacion(true)}
                >
                  Consolidar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <ConsolidationModal
        show={showConsolidacion}
        onHide={() => setShowConsolidacion(false)}
        onConsolidate={(ordenData) => {
          setOrdenConsolidada(ordenData);
          setShowConfirmacion(true);
        }}
      />

      <Modal show={showConfirmacion} onHide={() => setShowConfirmacion(false)} centered className="dark-modal">
        <Modal.Header closeButton className="bg-dark border-secondary">
          <Modal.Title>Confirmar Orden</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark">
          {ordenConsolidada && (
            <>
              <h5>Proveedor: {
                proveedores.find(p => p.id === ordenConsolidada.proveedor_id)?.nombre
              }</h5>
              
              <h6 className="mt-3">Productos:</h6>
              <ul>
                {ordenConsolidada.productos.map((p, i) => (
                  <li key={i}>
                    {p.descripcion} - {p.cantidad} unidades
                    <div className="text-muted small">
                      (Solicitudes: {Array.from(p.solicitudes).join(', ')})
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-dark border-secondary">
          <Button variant="secondary" onClick={() => setShowConfirmacion(false)}>
            Cancelar
          </Button>
          <Button variant="success" onClick={confirmarOrden}>
            Confirmar Orden
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;