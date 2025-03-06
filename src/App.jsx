import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import CustomNavbar from './components/Navbar';
import RequestForm from './components/RequestForm';
import RequestTable from './components/RequestTable';
import { supabase } from './supabaseClient';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase.from('solicitudcompra').select('*');
    if (!error) setRequests(data);
  };

  const handleSubmitRequest = async (request) => {
    const { data, error } = await supabase.from('solicitudcompra').insert([{
      descripcion: request.description,
      producto_id: request.productId || null,
      cantidad: request.quantity,
      estado: 'Pendiente'
    }]);
    if (!error) setRequests([...requests, data[0]]);
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  return (
    <div>
      <CustomNavbar onToggleSidebar={toggleSidebar} />
      <Sidebar isVisible={isSidebarVisible} onNewRequest={() => setShowForm(true)} />
      <div style={{ marginLeft: isSidebarVisible ? '250px' : '0', marginTop: '56px', transition: 'margin-left 0.3s' }}>
        <Container fluid>
          {activeTab === 'solicitudes' && (
            <Row>
              <Col>
                <RequestTable requests={requests} />
              </Col>
            </Row>
          )}
        </Container>
      </div>
      <RequestForm show={showForm} onHide={() => setShowForm(false)} onSubmit={handleSubmitRequest} />
    </div>
  );
}

export default App;