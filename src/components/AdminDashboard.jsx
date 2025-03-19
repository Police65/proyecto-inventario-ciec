import React, { useState, useEffect } from 'react';
import { Button, Table, Badge, Alert, Modal } from 'react-bootstrap';
import ConsolidationModal from './ConsolidationModal';
import OrderForm from './OrderForm';
import { supabase } from '../supabaseClient';

const AdminDashboard = ({ userProfile }) => {
  const [showConsolidacion, setShowConsolidacion] = useState(false);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [ordenesConsolidadas, setOrdenesConsolidadas] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [error, setError] = useState('');

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

        const { data: ordenesData } = await supabase
          .from('ordenes_consolidadas')
          .select(`
            id,
            proveedor:proveedor_id(nombre),
            productos,
            fecha_creacion
          `)
          .order('fecha_creacion', { ascending: false });

        setSolicitudesPendientes(solicitudesData || []);
        setOrdenesConsolidadas(ordenesData || []);
      } catch (err) {
        setError('Error cargando datos: ' + err.message);
      }
    };
    cargarDatos();
  }, []);

  const handleEliminarConsolidacion = async (id) => {
    try {
      await supabase
        .from('ordenes_consolidadas')
        .delete()
        .eq('id', id);
      setOrdenesConsolidadas(prev => prev.filter(oc => oc.id !== id));
    } catch (err) {
      setError('Error eliminando consolidación: ' + err.message);
    }
  };

  return (
    <div className="p-4 bg-dark text-light" style={{ minHeight: '100vh' }}>
      <h2 className="mb-4">Panel de Administración</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4>Órdenes Consolidadas</h4>
          <Button variant="primary" onClick={() => setShowConsolidacion(true)}>
            Nueva Consolidación
          </Button>
        </div>

        <Table striped bordered hover variant="dark">
          <thead>
            <tr>
              <th>ID</th>
              <th>Proveedor</th>
              <th>Productos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenesConsolidadas.map(orden => (
              <tr key={orden.id}>
                <td>#{orden.id}</td>
                <td>{orden.proveedor?.nombre}</td>
                <td>
                  {orden.productos.map((p, i) => (
                    <Badge key={i} bg="secondary" className="me-1 mb-1">
                      {p.descripcion} (x{p.cantidad})
                    </Badge>
                  ))}
                </td>
                <td>
                  <Button
                    variant="success"
                    size="sm"
                    className="me-2"
                    onClick={() => {
                      setOrdenSeleccionada(orden);
                      setShowOrderForm(true);
                    }}
                  >
                    Crear Orden
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleEliminarConsolidacion(orden.id)}
                  >
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <ConsolidationModal
        show={showConsolidacion}
        onHide={() => setShowConsolidacion(false)}
        onConsolidate={async (ordenData) => {
          try {
            const { data, error } = await supabase
              .from('ordenes_consolidadas')
              .insert([ordenData])
              .select('*');

            if (!error) setOrdenesConsolidadas(prev => [...prev, ...data]);
          } catch (err) {
            setError('Error guardando consolidación: ' + err.message);
          }
        }}
      />

      <OrderForm
        show={showOrderForm}
        onHide={() => setShowOrderForm(false)}
        ordenConsolidada={ordenSeleccionada}
        userProfile={userProfile}
        onSuccess={() => {
          setOrdenesConsolidadas(prev => 
            prev.filter(oc => oc.id !== ordenSeleccionada.id)
          );
          setOrdenSeleccionada(null);
        }}
      />

      <div className="mt-5">
        <h4>Solicitudes Pendientes</h4>
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
      </div>
    </div>
  );
};

export default AdminDashboard;