import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

const RequestForm = ({ show, onHide, onSubmit }) => {
  const [products, setProducts] = useState([{ id: uuidv4(), productId: '', quantity: 1 }]);
  const [customRequest, setCustomRequest] = useState(false);
  const [description, setDescription] = useState('');
  const [fetchedProducts, setFetchedProducts] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('producto').select('*');
    if (!error) setFetchedProducts(data);
  };

  const handleAddProduct = () => {
    setProducts([...products, { id: uuidv4(), productId: '', quantity: 1 }]);
  };

  const handleRemoveProduct = (id) => {
    if (products.length > 1) setProducts(products.filter(p => p.id !== id));
  };

  const handleProductChange = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (customRequest && !description.trim()) {
      alert('Ingrese una descripción para la requisición especial');
      return;
    }
    if (!customRequest && products.some(p => !p.productId || p.quantity < 1)) {
      alert('Complete todos los campos de productos');
      return;
    }
    onSubmit({
      products: customRequest ? null : products,
      description: customRequest ? description : null
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-dark text-light" size="lg">
      <Modal.Header closeButton className="bg-dark border-secondary">
        <Modal.Title className="text-light">Nueva Solicitud</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark">
        <Form onSubmit={handleSubmit}>
          {!customRequest && (
            <Table striped bordered hover variant="dark">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Form.Select
                        value={product.productId}
                        onChange={(e) => handleProductChange(product.id, 'productId', e.target.value)}
                      >
                        <option value="">Seleccionar producto</option>
                        {fetchedProducts.map((prod) => (
                          <option key={prod.id} value={prod.id}>{prod.descripcion}</option>
                        ))}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        value={product.quantity}
                        onChange={(e) => handleProductChange(product.id, 'quantity', e.target.value)}
                        min="1"
                      />
                    </td>
                    <td>
                      {products.length > 1 && (
                        <Button variant="danger" size="sm" onClick={() => handleRemoveProduct(product.id)}>
                          Eliminar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <Button variant="outline-primary" onClick={handleAddProduct} className="mb-3" disabled={customRequest}>
            Añadir Producto
          </Button>

          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              label="Requisición especial"
              checked={customRequest}
              onChange={(e) => setCustomRequest(e.target.checked)}
            />
          </Form.Group>

          {customRequest && (
            <Form.Group className="mb-3">
              <Form.Label>Descripción:</Form.Label>
              <Form.Control as="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Form.Group>
          )}

          <div className="d-flex justify-content-between">
            <Button variant="secondary" onClick={onHide}>Cancelar</Button>
            <Button variant="primary" type="submit">Enviar</Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default RequestForm;