import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import CustomNavbar from './components/Navbar'; // Verifica que el nombre y la ruta sean correctos
import RequestForm from './components/RequestForm';
import RequestTable from './components/RequestTable';
import AdminDashboard from './components/AdminDashboard';
import Home from './components/home'; // Verifica la ruta y el nombre (home.jsx o Home.jsx)
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
  getFilteredRequests
}) {
  return (
    <>
      {/* Navbar: se muestra siempre */}
      <CustomNavbar
        onToggleSidebar={toggleSidebar}
        userRole={userProfile.rol}
        userId={userProfile.id}
      />
      {/* Sidebar */}
      <Sidebar
        isVisible={isSidebarVisible}
        onNewRequest={() => setShowForm(true)}
        onSelectTab={setActiveTab}
        userProfile={userProfile}
        pendingRequests={getFilteredRequests(['Pendiente'])}
      />
      {/* Contenido principal */}
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
            {/* Ruta Home */}
            <Route path="/home" element={<Home />} />
            {/* Ruta Solicitudes */}
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
            {/* Rutas por defecto y no definidas redirigen a /home */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Container>
      </div>
      {/* Formulario para envío de solicitudes (solo para usuarios, no admin) */}
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
  // Estados generales
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('solicitudes');
  const [userProfile, setUserProfile] = useState(null);
  // Función para alternar el Sidebar
  const toggleSidebar = () => {
    setIsSidebarVisible((prev) => !prev);
  };
  // Función para obtener las solicitudes filtradas según estados
  const getFilteredRequests = (estados) => {
    return requests.filter(
      (request) =>
        estados.includes(request.estado) &&
        (userProfile?.rol === 'admin' || request.empleado_id === userProfile?.empleado_id)
    );
  };
  // Función para cargar solicitudes
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
      const { data, error } = await baseQuery.eq('empleado_id', userProfile?.empleado_id);
      if (!error) setRequests(data || []);
    }
  };
  // Función para cargar órdenes (solo para admin)
  const fetchOrders = async () => {
    if (userProfile?.rol === 'admin') {
      const { data, error } = await supabase
        .from('ordencompra')
        .select('*, proveedor:proveedor_id(nombre)')
        .from('ordencompra')
        .select(`
        *,
        proveedor:proveedor_id(nombre),
        solicitud:solicitud_compra_id(descripcion)
      `)
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
  // Función para manejar el envío de solicitud
  const handleSubmitRequest = async (requestData) => {
    try {
      // Crear solicitud principal
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
      // Insertar detalles si aplica
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
  // Determinamos si el usuario está autenticado
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