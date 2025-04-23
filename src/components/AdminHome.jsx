import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Button, Badge } from 'react-bootstrap';
import { supabase } from '../supabaseClient';
import RequestTable from './RequestTable';
import { useNavigate } from 'react-router-dom';

const AdminHome = ({ userProfile }) => {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('Pendiente');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: depts, error: deptError } = await supabase
        .from('departamento')
        .select('id, nombre');

      if (deptError) return;

      const { data: reqs, error: reqError } = await supabase
        .from('solicitudcompra')
        .select(`
          *,
          departamento:departamento_id(nombre)
        `);

      if (!reqError) {
        const deptStats = depts.map(dept => ({
          ...dept,
          pendingCount: reqs.filter(r => r.departamento_id === dept.id && r.estado === 'Pendiente').length
        }));
        setDepartments(deptStats);
        setRequests(reqs);
      }
    };
    fetchData();
  }, []);

  const filteredRequests = selectedDepartment
    ? requests.filter(r => r.departamento_id === selectedDepartment.id && (filter === 'Historial' ? ['Aprobada', 'Rechazada'].includes(r.estado) : r.estado === filter))
    : [];

  return (
    <Container fluid className="mt-3">
      {!selectedDepartment ? (
        <>
          <h3 className="text-light mb-4">📊 Resumen por Departamento</h3>
          <Row>
            {departments.map(dept => (
              <Col md={4} key={dept.id} className="mb-4">
                <Card className="bg-dark text-light border-secondary" style={{ cursor: 'pointer' }} onClick={() => setSelectedDepartment(dept)}>
                  <Card.Body>
                    <Card.Title>{dept.nombre}</Card.Title>
                    <Badge bg="warning" text="dark">{dept.pendingCount} Pendientes</Badge>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="text-light">Solicitudes de {selectedDepartment.nombre}</h3>
            <div>
              <Button variant={filter === 'Pendiente' ? 'primary' : 'outline-primary'} onClick={() => setFilter('Pendiente')} className="me-2">
                Pendientes
              </Button>
              <Button variant={filter === 'Historial' ? 'primary' : 'outline-primary'} onClick={() => setFilter('Historial')}>
                Historial
              </Button>
              <Button variant="secondary" onClick={() => setSelectedDepartment(null)} className="ms-2">
                Volver
              </Button>
            </div>
          </div>
          <RequestTable requests={filteredRequests} />
        </>
      )}
    </Container>
  );
};

export default AdminHome;