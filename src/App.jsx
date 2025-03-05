import React, { useState, useEffect } from 'react';
import { Button, Offcanvas, Form, Row, Col, Table, Modal } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { supabase } from './supabaseClient';

function App() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [currentProduct, setCurrentProduct] = useState({
    producto_id: null,
    descripcion: '',
    cantidad: 1,
    fecha: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('producto').select('*');
    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setAvailableProducts(data);
    }
  };

  const handleAddProduct = () => {
    setProducts([...products, currentProduct]);
    setCurrentProduct({
      producto_id: null,
      descripcion: '',
      cantidad: 1,
      fecha: new Date().toISOString().split('T')[0]
    });
  };

  const handleRemoveProduct = (index) => {
    const newProducts = products.filter((_, i) => i !== index);
    setProducts(newProducts);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (const product of products) {
      const { data, error } = await supabase
        .from('solicitudcompra')
        .insert([{
          descripcion: product.descripcion,
          producto_id: product.producto_id,
          cantidad: product.cantidad,
          estado: 'Pendiente',
          empleado_id: 1, // Aquí deberías seleccionar el empleado
          departamento_id: 1 // Aquí deberías seleccionar el departamento
        }])
        .select();

      if (error) {
        console.error('Error al crear la solicitud:', error);
      } else {
        console.log('Solicitud creada:', data);
      }
    }
    setProducts([]);
    setShowForm(false);
    alert('Solicitud de compra enviada con éxito');
  };

  return (
    <div className="App container-fluid">
      <Button variant="primary" onClick={() => setShowSidebar(true)}>
        Abrir Sidebar
      </Button>

      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} backdrop="static">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Menú</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Button variant="primary" onClick={() => setShowForm(true)}>
            Nueva Solicitud
          </Button>
        </Offcanvas.Body>
      </Offcanvas>

      {showForm && (
        <div className="mt-4">
          <h2>Nueva Solicitud de Compra</h2>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col>
                <Form.Group controlId="formProducto">
                  <Form.Label>Producto</Form.Label>
                  <Form.Select
                    value={currentProduct.producto_id || ''}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, producto_id: e.target.value || null })}
                  >
                    <option value="">Seleccione un producto</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.descripcion}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formDescripcion">
                  <Form.Label>Descripción de la Requisición</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Descripción"
                    value={currentProduct.descripcion}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, descripcion: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formCantidad">
                  <Form.Label>Cantidad</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="Cantidad"
                    value={currentProduct.cantidad}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, cantidad: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Button variant="primary" onClick={handleAddProduct} className="mt-3">
              Agregar Producto
            </Button>
            <Button variant="success" type="submit" className="mt-3 ms-2">
              Enviar Solicitud
            </Button>
          </Form>

          <Table striped bordered hover className="mt-4">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr key={index}>
                  <td>{product.producto_id ? availableProducts.find(p => p.id === product.producto_id)?.descripcion : 'Nuevo Producto'}</td>
                  <td>{product.descripcion}</td>
                  <td>{product.cantidad}</td>
                  <td>
                    <Button variant="danger" onClick={() => handleRemoveProduct(index)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default App;