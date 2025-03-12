import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
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
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase.from('solicitudcompra').select('*');
    if (!error) setRequests(data);
  };

  const handleSubmitRequest = async (request) => {
    if (!userProfile) {
      alert('Debe iniciar sesión para enviar una solicitud');
      return;
    }
  
    try {
      if (request.description) {
        // Insertar requisición especial
        const { data, error } = await supabase.from('solicitudcompra').insert([{
          descripcion: request.description,
          producto_id: null,
          cantidad: 1,
          estado: 'Pendiente',
          empleado_id: userProfile.empleado_id,
          departamento_id: userProfile.departamento_id
        }]);
        
        if (!error) setRequests([...requests, data[0]]);
      } else {
        // Insertar múltiples productos
        const inserts = request.products.map(product => 
          supabase.from('solicitudcompra').insert([{
            descripcion: null,
            producto_id: product.productId,
            cantidad: product.quantity,
            estado: 'Pendiente',
            empleado_id: userProfile.empleado_id,
            departamento_id: userProfile.departamento_id
          }])
        );
  
        const results = await Promise.all(inserts);
        const newRequests = results.flatMap(res => res.data);
        setRequests([...requests, ...newRequests]);
      }
    } catch (error) {
      alert('Error al enviar la solicitud: ' + error.message);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div>
      {!userProfile && <Login onLogin={setUserProfile} />}
      {userProfile && (
        <>
          <CustomNavbar onToggleSidebar={toggleSidebar} />
          <Sidebar
            isVisible={isSidebarVisible}
            onNewRequest={() => setShowForm(true)}
            onSelectTab={handleSelectTab}
            userProfile={userProfile}
          />
          <div
            style={{
              marginLeft: isSidebarVisible ? '50px' : '0',
              marginTop: '56px',
              transition: 'margin-left 0.3s',
              padding: '20px',
              width: isSidebarVisible ? 'calc(100% - 250px)' : '100%',
              maxWidth: isSidebarVisible ? 'calc(100% - 250px)' : '100%',
            }}
          >
            <Container fluid>
              {userProfile.rol === 'admin' ? (
                <AdminDashboard requests={requests} isSidebarVisible={isSidebarVisible} />
              ) : (
                <>
                  {activeTab === 'solicitudes' && (
                    <Row>
                      <Col>
                        <RequestTable requests={requests} />
                      </Col>
                    </Row>
                  )}
                </>
              )}
            </Container>
          </div>
          {userProfile.rol === 'usuario' && (
            <RequestForm show={showForm} onHide={() => setShowForm(false)} onSubmit={handleSubmitRequest} />
          )}
        </>
      )}
    </div>
  );
}

export default App;