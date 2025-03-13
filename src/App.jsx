import React, { useState, useEffect } from 'react';
import { Container } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import CustomNavbar from './components/Navbar';
import RequestForm from './components/RequestForm';
import RequestTable from './components/RequestTable';
import AdminDashboard from './components/AdminDashboard';
import Login from './Login';
import { supabase } from './supabaseClient';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('solicitudes');
  const [userProfile, setUserProfile] = useState(null);

  const fetchRequests = async () => {
    const baseQuery = supabase
      .from('solicitudcompra')
      .select(`
        *,
        detalles:solicitudcompra_detalle(producto_id, cantidad),
        empleado:empleado_id(nombre, apellido)
      `)
      .order('fecha_solicitud', { ascending: false });

    if (userProfile?.rol === 'admin') {
      const { data, error } = await baseQuery;
      if (!error) setRequests(data || []);
    } else {
      const { data, error } = await baseQuery
        .eq('empleado_id', userProfile?.empleado_id);
      if (!error) setRequests(data || []);
    }
  };

  const fetchOrders = async () => {
    if (userProfile?.rol === 'admin') {
      const { data, error } = await supabase
        .from('ordencompra')
        .select('*, proveedor:proveedor_id(nombre)')
        .order('fecha_orden', { ascending: false });
      if (!error) setOrders(data || []);
    }
  };

  useEffect(() => {
    if (userProfile) {
      fetchRequests();
      fetchOrders();
    }
  }, [userProfile]);

  const handleSubmitRequest = async (requestData) => {
    try {
      const { data: solicitud, error } = await supabase
        .from('solicitudcompra')
        .insert([{
          descripcion: requestData.description || 'Solicitud múltiple',
          estado: 'Pendiente',
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id
        }])
        .select('id');

      if (error) throw error;

      if (!requestData.customRequest && requestData.products) {
        const inserts = requestData.products.map(product => ({
          solicitud_compra_id: solicitud[0].id,
          producto_id: product.productId,
          cantidad: product.quantity
        }));

        const { error: detalleError } = await supabase
          .from('solicitudcompra_detalle')
          .insert(inserts);
          
        if (detalleError) throw detalleError;
      }

      await fetchRequests();
      setShowForm(false);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const getFilteredRequests = (estados) => {
    return requests.filter(request => 
      estados.includes(request.estado) &&
      (userProfile?.rol === 'admin' || request.empleado_id === userProfile?.empleado_id)
    );
  };

  return (
    <div>
      {!userProfile && <Login onLogin={setUserProfile} />}
      
      {userProfile && (
        <>
          <CustomNavbar onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)} />
          
          <Sidebar
            isVisible={isSidebarVisible}
            onNewRequest={() => setShowForm(true)}
            onSelectTab={setActiveTab}
            userProfile={userProfile}
            pendingRequests={getFilteredRequests(['Pendiente'])}
          />

          <div style={{
            marginLeft: isSidebarVisible ? '250px' : '0',
            marginTop: '56px',
            padding: '20px',
            transition: 'margin-left 0.3s',
            minHeight: 'calc(100vh - 56px)',
            backgroundColor: '#f8f9fa'
          }}>
            <Container fluid>
              {userProfile.rol === 'admin' ? (
                <AdminDashboard 
                  activeTab={activeTab}
                  solicitudesPendientes={getFilteredRequests(['Pendiente'])}
                  solicitudesHistorial={getFilteredRequests(['Aprobada', 'Rechazada'])}
                  ordenesHistorial={orders}
                />
              ) : (
                <>
                  {activeTab === 'solicitudes' && (
                    <RequestTable 
                      requests={getFilteredRequests(['Pendiente'])}
                    />
                  )}
                  
                  {activeTab === 'historial' && (
                    <RequestTable
                      requests={getFilteredRequests(['Aprobada', 'Rechazada'])}
                    />
                  )}
                </>
              )}
            </Container>
          </div>

          {userProfile.rol === 'usuario' && (
            <RequestForm 
              show={showForm} 
              onHide={() => setShowForm(false)} 
              onSubmit={handleSubmitRequest} 
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;