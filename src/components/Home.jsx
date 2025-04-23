import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Form, Modal, Card, Row, Col } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const Home = ({ userProfile }) => {
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({ total: 0, aprobadas: 0, rechazadas: 0 });
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [providerData, setProviderData] = useState({ nombre: '', rif: '', direccion: '', telefono: '', correo: '' });
  const [productData, setProductData] = useState({ descripcion: '', categoria_id: '' });

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
        const { data } = await supabase.from('categoria_producto').select('*');
        setCategories(data || []);
      }
    };
    fetchData();
  }, [userProfile]);

  const handleAddProvider = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('proveedor').insert([providerData]);
    if (!error) setShowProviderForm(false);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('producto').insert([productData]);
    if (!error) setShowProductForm(false);
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
            <Button variant="primary" onClick={() => setShowProviderForm(true)} className="me-2">
              Añadir Proveedor
            </Button>
            <Button variant="primary" onClick={() => setShowProductForm(true)}>
              Añadir Producto
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

      <Modal show={showProviderForm} onHide={() => setShowProviderForm(false)} centered>
        <Modal.Header closeButton className="bg-dark text-light">
          <Modal.Title>Añadir Proveedor</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-light">
          <Form onSubmit={handleAddProvider}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control 
                value={providerData.nombre} 
                onChange={(e) => setProviderData({ ...providerData, nombre: e.target.value })} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>RIF</Form.Label>
              <Form.Control 
                value={providerData.rif} 
                onChange={(e) => setProviderData({ ...providerData, rif: e.target.value })} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Dirección</Form.Label>
              <Form.Control 
                value={providerData.direccion} 
                onChange={(e) => setProviderData({ ...providerData, direccion: e.target.value })} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control 
                value={providerData.telefono} 
                onChange={(e) => setProviderData({ ...providerData, telefono: e.target.value })} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Correo</Form.Label>
              <Form.Control 
                value={providerData.correo} 
                onChange={(e) => setProviderData({ ...providerData, correo: e.target.value })} 
              />
            </Form.Group>
            <Button variant="primary" type="submit">Guardar</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={showProductForm} onHide={() => setShowProductForm(false)} centered>
        <Modal.Header closeButton className="bg-dark text-light">
          <Modal.Title>Añadir Producto</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-light">
          <Form onSubmit={handleAddProduct}>
            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control 
                value={productData.descripcion} 
                onChange={(e) => setProductData({ ...productData, descripcion: e.target.value })} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Categoría</Form.Label>
              <Form.Select 
                value={productData.categoria_id} 
                onChange={(e) => setProductData({ ...productData, categoria_id: e.target.value })}
              >
                <option value="">Seleccionar</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Button variant="primary" type="submit">Guardar</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Home;