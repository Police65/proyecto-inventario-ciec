import React, { useState, useEffect } from 'react';
import { Button, Offcanvas, Form, Row, Col, Table } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { supabase } from './supabaseClient';

function App() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState([]);
  const [currentProduct, setCurrentProduct] = useState({
    descripcion: '',
    cantidad: 1,
    proveedor: '',
    fecha: new Date().toISOString().split('T')[0]
  });
  const [proveedorId, setProveedorId] = useState(null);
  const [departamentoId, setDepartamentoId] = useState(null);
  const [empleadoId, setEmpleadoId] = useState(null);

  useEffect(() => {
    // Obtener el primer proveedor, departamento y empleado
    const fetchIds = async () => {
      const { data: proveedor } = await supabase
        .from('Proveedor')
        .select('id')
        .limit(1);

      const { data: departamento } = await supabase
        .from('Departamento')
        .select('id')
        .limit(1);

      const { data: empleado } = await supabase
        .from('Empleado')
        .select('id')
        .limit(1);

      if (proveedor && proveedor.length > 0) setProveedorId(proveedor[0].id);
      if (departamento && departamento.length > 0) setDepartamentoId(departamento[0].id);
      if (empleado && empleado.length > 0) setEmpleadoId(empleado[0].id);
    };

    fetchIds();
  }, []);

  const handleAddProduct = () => {
    setProducts([...products, currentProduct]);
    setCurrentProduct({
      descripcion: '',
      cantidad: 1,
      proveedor: '',
      fecha: new Date().toISOString().split('T')[0]
    });
  };

  const handleRemoveProduct = (index) => {
    const newProducts = products.filter((_, i) => i !== index);
    setProducts(newProducts);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proveedorId || !departamentoId || !empleadoId) {
      alert('Falta configurar proveedor, departamento o empleado');
      return;
    }

    const { data: orden, error: ordenError } = await supabase
      .from('OrdenCompra')
      .insert([{
        fecha_orden: new Date().toISOString(),
        estado: 'Pendiente',
        observaciones: 'Nueva solicitud de compra',
        proveedor_id: proveedorId,
        departamento_id: departamentoId,
        empleado_id: empleadoId
      }])
      .select();

    if (ordenError) {
      console.error('Error al crear la orden:', ordenError);
      return;
    }

    const ordenId = orden[0].id;

    for (const product of products) {
      // Insertar el producto si no existe
      const { data: producto, error: productoError } = await supabase
        .from('Producto')
        .insert([{
          descripcion: product.descripcion,
          precio_unitario: 0, // Aquí deberías definir un precio
          unidad: 'Bs', // Aquí deberías definir la unidad
          proveedor_id: proveedorId
        }])
        .select();

      if (productoError) {
        console.error('Error al crear el producto:', productoError);
        continue;
      }

      const productoId = producto[0].id;

      // Insertar en OrdenProducto
      const { error: ordenProductoError } = await supabase
        .from('OrdenProducto')
        .insert([{
          orden_compra_id: ordenId,
          producto_id: productoId,
          cantidad: product.cantidad
        }]);

      if (ordenProductoError) {
        console.error('Error al agregar el producto a la orden:', ordenProductoError);
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
                <Form.Group controlId="formDescripcion">
                  <Form.Label>Descripción del Producto</Form.Label>
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
              <Col>
                <Form.Group controlId="formProveedor">
                  <Form.Label>Proveedor</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Proveedor"
                    value={currentProduct.proveedor}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, proveedor: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formFecha">
                  <Form.Label>Fecha</Form.Label>
                  <Form.Control
                    type="date"
                    value={currentProduct.fecha}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, fecha: e.target.value })}
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
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr key={index}>
                  <td>{product.descripcion}</td>
                  <td>{product.cantidad}</td>
                  <td>{product.proveedor}</td>
                  <td>{product.fecha}</td>
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