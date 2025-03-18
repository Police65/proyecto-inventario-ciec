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
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data: solicitudesData } = await supabase
          .from('solicitudcompra')
          .select(`
            id,
            empleado:empleado_id(nombre, apellido),
            detalles:solicitudcompra_detalle(
              producto_id,
              cantidad,
              producto:producto_id(descripcion)
            )
          `)
          .eq('estado', 'Pendiente');

        const { data: proveedoresData } = await supabase
          .from('proveedor')
          .select('id, nombre');

        setSolicitudesPendientes(solicitudesData || []);
        setProveedores(proveedoresData || []);

      } catch (err) {
        setError('Error cargando datos: ' + err.message);
      }
    };
    cargarDatos();
  }, []);

  const confirmarOrden = async () => {
    try {
      const solicitudesIds = ordenConsolidada.productos.flatMap(p => p.solicitudes);
      const primeraSolicitudId = solicitudesIds[0]; // Tomamos la primera solicitud como referencia

      const subtotal = ordenConsolidada.productos.reduce(
        (acc, p) => acc + (p.precio_unitario * p.cantidad), 
        0
      );

      // 1. Crear orden principal con referencia a la solicitud
      const { data: ordenCompra, error: ordenError } = await supabase
        .from('ordencompra')
        .insert({
          solicitud_compra_id: primeraSolicitudId,
          proveedor_id: ordenConsolidada.proveedor_id,
          estado: 'Pendiente',
          fecha_orden: new Date().toISOString(),
          empleado_id: 1,
          sub_total: subtotal,
          iva: subtotal * 0.16,
          ret_iva: subtotal * 0.16 * 0.75,
          neto_a_pagar: subtotal + (subtotal * 0.16) - (subtotal * 0.16 * 0.75),
          unidad: 'Bs'
        })
        .select('*')
        .single();

      if (ordenError) throw ordenError;

      // 2. Insertar detalles
      const { error: detalleError } = await supabase
        .from('ordencompra_detalle')
        .insert(ordenConsolidada.productos.map(p => ({
          orden_compra_id: ordenCompra.id,
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario
        })));

      if (detalleError) throw detalleError;

      // 3. Relacionar múltiples solicitudes con la orden
      const { error: linkError } = await supabase
        .from('orden_solicitud')
        .insert(solicitudesIds.map(solicitudId => ({
          orden_id: ordenCompra.id,
          solicitud_id: solicitudId
        })));

      if (linkError) throw linkError;

      // 4. Actualizar estado de las solicitudes
      const { error: updateError } = await supabase
        .from('solicitudcompra')
        .update({ estado: 'En Proceso' })
        .in('id', solicitudesIds);

      if (updateError) throw updateError;

      setSolicitudesPendientes(prev => prev.filter(s => !solicitudesIds.includes(s.id)));
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
                    <div className="text-success small">
                      Precio unitario: {p.precio_unitario} Bs
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <h6>Totales:</h6>
                <p>Subtotal: {ordenConsolidada.productos.reduce((acc, p) => acc + (p.precio_unitario * p.cantidad), 0).toFixed(2)} Bs</p>
              </div>
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