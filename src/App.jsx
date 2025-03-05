import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import RequestForm from './components/RequestForm';
import RequestTable from './components/RequestTable';
import { supabase } from './supabaseClient';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase.from('solicitudcompra').select('*');
    if (error) {
      console.error('Error fetching requests:', error);
    } else {
      setRequests(data);
    }
  };

  const handleSubmitRequest = async (request) => {
    if (!userProfile) {
      alert('Debe iniciar sesión para enviar una solicitud');
      return;
    }

    const { data, error } = await supabase
      .from('solicitudcompra')
      .insert([{
        descripcion: request.description,
        producto_id: request.productId || null,
        cantidad: request.quantity,
        estado: 'Pendiente',
        empleado_id: userProfile.empleado_id,
        departamento_id: userProfile.departamento_id
      }])
      .select();

    if (error) {
      console.error('Error al crear la solicitud:', error);
    } else {
      setRequests([...requests, data[0]]);
    }
  };

  return (
    <Container fluid className="p-0">
      <Row>
        <Col xs={2} className="p-0">
          <Sidebar onNewRequest={() => setShowForm(true)} />
        </Col>
        <Col xs={10} className="p-0">
          <Navbar />
          <div className="p-4">
            <RequestTable requests={requests} />
          </div>
        </Col>
      </Row>
      <RequestForm
        show={showForm}
        onHide={() => setShowForm(false)}
        onSubmit={handleSubmitRequest}
      />
    </Container>
  );
}

export default App;