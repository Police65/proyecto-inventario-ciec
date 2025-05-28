import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Form, Modal, Card, Row, Col } from 'react-bootstrap';
import { supabase } from '../supabaseClient';
import ProviderManagement from './ProviderManagement';
import ProductManagement from './ProductManagement';

const Home = ({ userProfile }) => {
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({ total: 0, aprobadas: 0, rechazadas: 0 });
  const [showRezagadosModal, setShowRezagadosModal] = useState(false);
  const [productosRezagados, setProductosRezagados] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: invData } = await supabase
        .from('inventario')
        .select(`
          *,
          producto:producto_id (
            descripcion,
            categoria:categoria_id (nombre)
          )
        `);
      setInventory(invData || []);

      const query = supabase.from('solicitudcompra').select('*');
      let reqs;
      if (userProfile.rol === 'admin') {
        const { data } = await query;
        reqs = data;
      } else {
        const { data } = await query.eq('departamento_id', userProfile.departamento_id);
        reqs = data;
      }
      setStats({
        total: reqs.length,
        aprobadas: reqs.filter(r => r.estado === 'Aprobada').length,
        rechazadas: reqs.filter(r => r.estado === 'Rechazada').length
      });

      if (userProfile?.rol === 'admin') {
        const { data: rezagadosData } = await supabase
          .from('productos_rezagados')
          .select(`
            *,
            producto:producto_id(descripcion),
            solicitud:solicitud_id(descripcion),
            orden:orden_compra_id(id)
          `);
        setProductosRezagados(rezagadosData || []);
      }
    };
    fetchData();
  }, [userProfile]);

  const handleDeleteRezagado = async (id) => {
    await supabase.from('productos_rezagados').delete().eq('id', id);
    setProductosRezagados(prev => prev.filter(p => p.id !== id));
  };

  return (
    <Container fluid className="mt-3">
      <h3 className="text-light mb-4">🏠 Inicio</h3>
      <Row className="mb-4">
        <Col md={4}>
          <Card className="bg-dark text-light">
            <Card.Body>
              <Card.Title>Total Solicitudes</Card.Title>
              <Card.Text>{stats.total}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="bg-dark text-light">
            <Card.Body>
              <Card.Title>Aprobadas</Card.Title>
              <Card.Text>{stats.aprobadas}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="bg-dark text-light">
            <Card.Body>
              <Card.Title>Rechazadas</Card.Title>
              <Card.Text>{stats.rechazadas}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="text-light">📝 Inventario</h3>
        {userProfile?.rol === 'admin' && (
          <div>
            <Button variant="primary" onClick={() => setShowRezagadosModal(true)} className="me-2">
              Ver Productos Rezagados
            </Button>
          </div>
        )}
      </div>
      
      <Table striped bordered hover responsive variant="dark">
        <thead>
          <tr>
            <th>Nombre del Producto</th>
            <th>Categoría</th>
            <th>Ubicación</th>
            <th>Existencias</th>
            <th>Fecha de Actualización</th>
          </tr>
        </thead>
        <tbody>
          {inventory.length > 0 ? (
            inventory.map((item) => (
              <tr key={item.id}>
                <td>{item.producto?.descripcion || 'Sin nombre'}</td>
                <td>{item.producto?.categoria?.nombre || 'Sin categoría'}</td>
                <td>{item.ubicacion || 'N/A'}</td>
                <td>{item.existencias !== null ? item.existencias : '0'}</td>
                <td>{new Date(item.fecha_actualizacion).toLocaleString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="text-center text-light">
                No hay registros en el inventario
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {userProfile?.rol === 'admin' && (
        <div className="mt-4">
          <h4 className="text-light">Gestión de Proveedores y Productos</h4>
          <ProviderManagement />
          <ProductManagement />
        </div>
      )}

      <Modal show={showRezagadosModal} onHide={() => setShowRezagadosModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-light">
          <Modal.Title>Productos Rezagados</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-light">
          <Table striped bordered hover variant="dark">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Solicitud</th>
                <th>Orden</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosRezagados.map(p => (
                <tr key={p.id}>
                  <td>{p.producto?.descripcion || 'N/A'}</td>
                  <td>{p.cantidad}</td>
                  <td>{p.motivo}</td>
                  <td>{p.solicitud?.descripcion || 'N/A'}</td>
                  <td>{p.orden?.id || 'N/A'}</td>
                  <td>
                    <Button variant="danger" onClick={() => handleDeleteRezagado(p.id)}>Eliminar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Home;