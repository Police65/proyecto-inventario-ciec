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

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      // Solicitudes
      const { data: solicitudesData } = await supabase
        .from('solicitudcompra')
        .select('*')
        .order('fecha_solicitud', { ascending: false });

      setRequests(solicitudesData || []);

      // Órdenes (solo para admin)
      if (userProfile?.rol === 'admin') {
        const { data: ordenesData } = await supabase
          .from('ordencompra')
          .select('*, proveedor:proveedor_id(nombre)')
          .order('fecha_orden', { ascending: false });
        
        setOrders(ordenesData || []);
      }
    };
    fetchData();
  }, [userProfile]);

  // Manejar envío de solicitud
  const handleSubmitRequest = async (requestData) => {
    try {
      const inserts = requestData.products?.map(product => ({
        descripcion: null,
        producto_id: product.productId,
        cantidad: product.quantity,
        estado: 'Pendiente',
        empleado_id: userProfile.empleado_id,
        departamento_id: userProfile.departamento_id
      })) || [{
        descripcion: requestData.description,
        producto_id: null,
        cantidad: 1,
        estado: 'Pendiente',
        empleado_id: userProfile.empleado_id,
        departamento_id: userProfile.departamento_id
      }];

      const { data, error } = await supabase
        .from('solicitudcompra')
        .insert(inserts);

      if (!error) {
        setRequests(prev => [...(data || []), ...prev]);
        setShowForm(false);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
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
                  solicitudesPendientes={requests.filter(r => r.estado === 'Pendiente')}
                  solicitudesHistorial={requests.filter(r => r.estado !== 'Pendiente')}
                  ordenesHistorial={orders}
                />
              ) : (
                <>
                  {activeTab === 'solicitudes' && (
                    <RequestTable 
                      requests={requests.filter(r => 
                        r.empleado_id === userProfile.empleado_id &&
                        r.estado === 'Pendiente'
                      )}
                    />
                  )}
                  
                  {activeTab === 'historial' && (
                    <RequestTable
                      requests={requests.filter(r => 
                        r.empleado_id === userProfile.empleado_id && 
                        r.estado !== 'Pendiente'
                      )}
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