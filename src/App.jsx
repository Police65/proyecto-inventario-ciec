import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import CustomNavbar from './components/Navbar'; // Verifica que el nombre y la ruta sean correctos
import RequestForm from './components/RequestForm';
import RequestTable from './components/RequestTable';
import AdminDashboard from './components/AdminDashboard';
import Home from './components/Home'; // Verifica la ruta y el nombre (home.jsx o Home.jsx)
import Login from './Login';
import { supabase } from './supabaseClient';
// Componente que agrupa todo lo que se muestra para usuarios autenticados
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
  getFilteredRequests,
  handleOrderSuccess
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
          backgroundColor: '#f8f9fa'
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
                    onOrderSuccess={handleOrderSuccess}
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
  const [userProfile, setUserProfile] = useState(null);

  const toggleSidebar = () => setIsSidebarVisible(prev => !prev);

  const getFilteredRequests = (estados) => {
    return requests.filter(
      request => estados.includes(request.estado) &&
      (userProfile?.rol === 'admin' || request.empleado_id === userProfile?.empleado_id)
    );
  };

  const fetchRequests = async () => {
    const baseQuery = supabase
      .from('solicitudcompra')
      .select(`
        *,
        detalles:solicitudcompra_detalle(producto_id, cantidad),
        empleado:empleado_id(nombre, apellido)
      `)
      .order('fecha_solicitud', { ascending: false });

    const { data, error } = userProfile?.rol === 'admin' 
      ? await baseQuery 
      : await baseQuery.eq('empleado_id', userProfile?.empleado_id);

    if (!error) setRequests(data || []);
  };

  const fetchOrders = async () => {
    if (userProfile?.rol === 'admin') {
      const { data: ordenesData } = await supabase
        .from('ordencompra')
        .select('*, proveedor:proveedor_id(nombre)');
      setOrders(ordenesData || []);
    }
  };

  // Nueva función para manejar éxito de orden
  const handleOrderSuccess = (newOrder) => {
    setOrders(prev => [...prev, newOrder]);
    fetchRequests();
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) window.location.href = '/login';
    };

    if (userProfile) {
      fetchRequests();
      fetchOrders();
      checkSession();
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

  const isAuthenticated = !!userProfile;

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta de login: se muestra el Login si el usuario no está autenticado */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLogin={setUserProfile} />
            ) : (
              <Navigate to="/home" replace />
            )
          }
        />
        {/* Rutas protegidas: solo se muestra el layout si el usuario está autenticado */}
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
        {/* Redirige la raíz a /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;