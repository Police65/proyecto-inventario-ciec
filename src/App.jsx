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
      // Solicitudes pendientes
      const { data: solicitudesData, error: errorSolicitudes } = await supabase
        .from('solicitudcompra')
        .select(`
          *,
          detalles:solicitudcompra_detalle(producto_id, cantidad)
        `)
        .eq('estado', 'Pendiente')
        .order('fecha_solicitud', { ascending: false });
    
      if (errorSolicitudes) {
        console.error('Error al cargar solicitudes:', errorSolicitudes);
      } else {
        console.log("Solicitudes con detalles:", solicitudesData);
      }
      setRequests(solicitudesData || []);
  
      // Órdenes (solo para admin)
      if (userProfile?.rol === 'admin') {
        const { data: ordenesData, error: errorOrdenes } = await supabase
          .from('ordencompra')
          .select('*, proveedor:proveedor_id(nombre)')
          .order('fecha_orden', { ascending: false });
        if (errorOrdenes) {
          console.error('Error al cargar órdenes:', errorOrdenes);
        }
        setOrders(ordenesData || []);
      }
    };
    fetchData();
  }, [userProfile]);

  // Manejar envío de solicitud
  const handleSubmitRequest = async (requestData) => {
    try {
      // Crear solicitud principal
      const { data: solicitud, error } = await supabase
        .from('solicitudcompra')
        .insert([{
          descripcion: requestData.description || 'Solicitud múltiple de productos',
          estado: 'Pendiente',
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id
        }])
        .select('id');
  
      if (error) throw error;
  
      // Insertar detalles solo si no es una solicitud especial
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
  
      setRequests(prev => [...prev, {...solicitud[0], detalles: requestData.products || []}]);
      setShowForm(false);
      
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
     pendingRequests={requests.filter(req => req.estado === 'Pendiente')}
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