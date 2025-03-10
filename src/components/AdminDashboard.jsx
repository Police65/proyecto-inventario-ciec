import React, { useState, useEffect } from 'react';
import { Table, Button } from 'react-bootstrap';
import OrderForm from './OrderForm';
import OrderPDF from './OrderPDF';
import { supabase } from '../supabaseClient';

const AdminDashboard = ({ isSidebarVisible }) => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('solicitudes');
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [solicitudesRechazadas, setSolicitudesRechazadas] = useState([]);
  const [solicitudesAprobadas, setSolicitudesAprobadas] = useState([]);
  const [ordenesCompra, setOrdenesCompra] = useState([]);

  // Cargar datos iniciales
  useEffect(() => {
    fetchSolicitudes();
    fetchOrdenesCompra();
  }, []);

  const fetchSolicitudes = async () => {
    const { data: pendientes } = await supabase.from('SolicitudCompra').select('*').eq('estado', 'Pendiente');
    const { data: rechazadas } = await supabase.from('SolicitudCompra').select('*').eq('estado', 'Rechazada');
    const { data: aprobadas } = await supabase.from('SolicitudCompra').select('*').eq('estado', 'Aprobada');

    setSolicitudesPendientes(pendientes);
    setSolicitudesRechazadas(rechazadas);
    setSolicitudesAprobadas(aprobadas);
  };

  const fetchOrdenesCompra = async () => {
    const { data } = await supabase.from('OrdenCompra').select('*');
    setOrdenesCompra(data);
  };

  const handleCreateOrder = (request) => {
    setSelectedRequest(request);
    setShowOrderForm(true);
  };

  const handleRejectRequest = async (requestId) => {
    const { error } = await supabase
      .from('SolicitudCompra')
      .update({ estado: 'Rechazada' })
      .eq('id', requestId);

    if (!error) {
      fetchSolicitudes(); // Recargar las solicitudes
    }
  };

  const handleOrderCreated = (order) => {
    if (order) {
      setOrdenesCompra([...ordenesCompra, order]); // Agregar la nueva orden
    }
    setShowOrderForm(false); // Cerrar el formulario
  };

  const renderTable = (data, showActions = true) => {
    return (
      <Table striped bordered hover className="table-dark w-100">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Descripción</th>
            <th scope="col">Producto ID</th>
            <th scope="col">Cantidad</th>
            <th scope="col">Estado</th>
            <th scope="col">Empleado ID</th>
            <th scope="col">Departamento ID</th>
            {showActions && <th scope="col">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <th scope="row">{item.id}</th>
              <td>{item.descripcion}</td>
              <td>{item.producto_id}</td>
              <td>{item.cantidad}</td>
              <td>{item.estado}</td>
              <td>{item.empleado_id}</td>
              <td>{item.departamento_id}</td>
              {showActions && (
                <td>
                  {item.estado === 'Pendiente' && (
                    <>
                      <Button variant="primary" onClick={() => handleCreateOrder(item)}>
                        Crear Orden
                      </Button>
                      <Button variant="danger" onClick={() => handleRejectRequest(item.id)}>
                        Rechazar
                      </Button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div style={{ 
      marginLeft: isSidebarVisible ? '250px' : '0',
      marginTop: '56px',
      padding: '20px',
      width: isSidebarVisible ? 'calc(100% - 250px)' : '100%',
      maxWidth: isSidebarVisible ? 'calc(100% - 250px)' : '100%',
      overflowX: 'auto',
    }}>
      <h2>Panel de Administración</h2>

      {/* Mostrar la tabla según la pestaña activa */}
      {activeTab === 'solicitudes' && renderTable(solicitudesPendientes)}
      {activeTab === 'rechazadas' && renderTable(solicitudesRechazadas, false)}
      {activeTab === 'aprobadas' && renderTable(solicitudesAprobadas, false)}
      {activeTab === 'ordenes' && (
        <>
          {ordenesCompra.map((orden) => (
            <div key={orden.id} style={{ marginBottom: '20px' }}>
              <OrderPDF order={orden} />
            </div>
          ))}
        </>
      )}

      {/* Mostrar el formulario de creación de órdenes */}
      {selectedRequest && (
        <OrderForm
          show={showOrderForm}
          onHide={handleOrderCreated}
          request={selectedRequest}
        />
      )}
    </div>
  );
};

export default AdminDashboard;