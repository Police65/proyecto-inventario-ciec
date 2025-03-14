import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import CustomNavbar from './components/Navbar';
import RequestForm from './components/RequestForm';
import RequestTable from './components/RequestTable';
import AdminDashboard from './components/AdminDashboard';
import Home from './components/Home';
import Login from './Login';
import { supabase } from './supabaseClient';
import ModoOscuro from './components/ModoOscuro'; 

const checkStoredSession = () => {
  const storedUser = localStorage.getItem('userProfile');
  const storedTime = localStorage.getItem('sessionTime');
  
  if (storedUser && storedTime) {
    const timeElapsed = Date.now() - parseInt(storedTime);
    return timeElapsed < 900000 ? JSON.parse(storedUser) : null;
  }
  return null;
};

function AuthenticatedLayout({
  userProfile,
  showForm,
  setShowForm,
  requests,
  orders,
  isSidebarVisible,
  toggleSidebar,
  activeTab,
  setActiveTab,
  handleSubmitRequest,
  getFilteredRequests
}) {
  return (
    <>
    <CustomNavbar
      onToggleSidebar={toggleSidebar}
      userRole={userProfile.rol}
      userId={userProfile.id}
    />
    <Sidebar
      isVisible={isSidebarVisible}
      onNewRequest={() => setShowForm(true)}
      onSelectTab={setActiveTab}
      userProfile={userProfile}
      pendingRequests={getFilteredRequests(['Pendiente'])}
    />
    <div
      style={{
        marginLeft: isSidebarVisible ? '250px' : '0',
        marginTop: '56px',
        padding: '20px',
        transition: 'margin-left 0.3s',
        minHeight: 'calc(100vh - 56px)',
        backgroundColor: '#212529' // Modificado: Color oscuro
      }}
    >
      <Container fluid>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route
            path="/solicitudes"
            element={
              userProfile.rol === 'admin' ? (
                <AdminDashboard
                  activeTab={activeTab}
                  solicitudesPendientes={getFilteredRequests(['Pendiente'])}
                  solicitudesHistorial={getFilteredRequests(['Aprobada', 'Rechazada'])}
                  ordenesHistorial={orders}
                />
              ) : (
                <>
                  {activeTab === 'solicitudes' && (
                    <RequestTable requests={getFilteredRequests(['Pendiente'])} />
                  )}
                  {activeTab === 'historial' && (
                    <RequestTable
                      requests={getFilteredRequests(['Aprobada', 'Rechazada'])}
                    />
                  )}
                </>
              )
            }
          />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
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
);
}

function App() {
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('solicitudes');
  const [userProfile, setUserProfile] = useState(checkStoredSession());
  const [inactivityTimer, setInactivityTimer] = useState(null);

  // Nueva función para cargar solicitudes
  const fetchRequests = async () => {
    try {
      const baseQuery = supabase
        .from('solicitudcompra')
        .select(`
          *,
          detalles:solicitudcompra_detalle(producto_id, cantidad),
          empleado:empleado_id(nombre, apellido)
        `)
        .order('fecha_solicitud', { ascending: false });

      let queryResult;
      
      if (userProfile?.rol === 'admin') {
        queryResult = await baseQuery;
      } else {
        queryResult = await baseQuery.eq('empleado_id', userProfile?.empleado_id);
      }

      if (queryResult.error) throw queryResult.error;
      setRequests(queryResult.data || []);
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      alert('Error al cargar las solicitudes');
    }
  };

  // Cargar solicitudes al autenticarse
  useEffect(() => {
    if (userProfile) {
      fetchRequests();
    }
  }, [userProfile]);

  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    
    const newTimer = setTimeout(() => {
      localStorage.removeItem('userProfile');
      localStorage.removeItem('sessionTime');
      setUserProfile(null);
    }, 300000);
    
    setInactivityTimer(newTimer);
  };

  const toggleSidebar = () => {
    setIsSidebarVisible((prev) => !prev);
  };

  useEffect(() => {
    if (userProfile) {
      const activityListeners = ['mousemove', 'keydown', 'click'];
      activityListeners.forEach(event => {
        window.addEventListener(event, resetInactivityTimer);
      });

      return () => {
        activityListeners.forEach(event => {
          window.removeEventListener(event, resetInactivityTimer);
        });
      };
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
      localStorage.setItem('sessionTime', Date.now().toString());
      fetchRequests();
      fetchOrders(); // Llamada añadida
    }
  }, [userProfile]);

  const getFilteredRequests = (estados) => {
    return requests.filter(
      (request) =>
        estados.includes(request.estado) &&
        (userProfile?.rol === 'admin' || request.empleado_id === userProfile?.empleado_id)
    );
  };

  const handleSubmitRequest = async (requestData) => {
    try {
      const { data: solicitud, error } = await supabase
        .from('solicitudcompra')
        .insert([
          {
            descripcion: requestData.description || 'Solicitud múltiple',
            estado: 'Pendiente',
            empleado_id: userProfile.empleado_id,
            departamento_id: userProfile.departamento_id
          }
        ])
        .select('id');
      if (error) throw error;

      if (!requestData.customRequest && requestData.products) {
        const inserts = requestData.products.map((product) => ({
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

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('ordencompra')
        .select(`
          *,
          proveedor:proveedor_id(*),
          productos:ordencompra_detalle(
            *,
            producto:producto_id(*)
          ),
          empleado:empleado_id(*),
          solicitud_compra:solicitud_compra_id(*)
        `)
        .order('fecha_orden', { ascending: false });
  
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    }
  };  

  const isAuthenticated = !!userProfile;

  return (
    <BrowserRouter>
      <ModoOscuro /> 
      <Routes>
        <Route
          path="/login"
          element={
            !userProfile ? (
              <Login 
                onLogin={(profile) => {
                  setUserProfile(profile);
                  resetInactivityTimer();
                }}
              />
            ) : (
              <Navigate to="/home" replace />
            )
          }
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <AuthenticatedLayout
                userProfile={userProfile}
                showForm={showForm}
                setShowForm={setShowForm}
                requests={requests}
                orders={orders}
                isSidebarVisible={isSidebarVisible}
                toggleSidebar={toggleSidebar}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleSubmitRequest={handleSubmitRequest}
                getFilteredRequests={getFilteredRequests}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;