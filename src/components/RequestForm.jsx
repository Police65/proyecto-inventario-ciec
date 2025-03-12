import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient.js';
import { v4 as uuidv4 } from 'uuid'; // Añadir esta importación

const RequestForm = ({ show, onHide, onSubmit }) => {
  const [products, setProducts] = useState([{ id: uuidv4(), productId: '', quantity: 1 }]);
  const [customRequest, setCustomRequest] = useState(false);
  const [description, setDescription] = useState('');
  const [fetchedProducts, setFetchedProducts] = useState([]); // Renombrado para evitar conflicto

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
    if (products.length > 1) {
      setProducts(products.filter(product => product.id !== id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validaciones
    if (customRequest && !description.trim()) {
      alert('Ingrese una descripción para la requisición especial');
      return;
    }
    
    if (!customRequest) {
      const hasEmptyFields = products.some(p => !p.productId || p.quantity < 1);
      if (hasEmptyFields) {
        alert('Complete todos los campos de productos');
        return;
      }
    }

    onSubmit({
      products: customRequest ? null : products,
      description: customRequest ? description : null
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Nueva Solicitud</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          {!customRequest && products.map((product, index) => (
            <div key={product.id} className="mb-3 border p-2 rounded">
              <Form.Group className="mb-3">
                <Form.Label>Producto:</Form.Label>
                <Form.Select
                  value={product.productId}
                  onChange={(e) => {
                    const newProducts = [...products];
                    newProducts[index].productId = e.target.value;
                    setProducts(newProducts);
                  }}
                >
                  <option value="">Seleccionar producto</option>
                  {fetchedProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.descripcion}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Cantidad:</Form.Label>
                <Form.Control
                  type="number"
                  value={product.quantity}
                  onChange={(e) => {
                    const newProducts = [...products];
                    newProducts[index].quantity = e.target.value;
                    setProducts(newProducts);
                  }}
                  min="1"
                />
              </Form.Group>
              {products.length > 1 && (
                <Button 
                  variant="danger" 
                  size="sm" 
                  onClick={() => handleRemoveProduct(product.id)}
                  className="mb-2"
                >
                  Eliminar producto
                </Button>
              )}
            </div>
          ))}

          <Button 
            variant="outline-primary" 
            onClick={handleAddProduct} 
            className="mb-3"
            disabled={customRequest}
          >
            Añadir otro producto
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
              <Form.Control
                as="textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Form.Group>
          )}

          <div className="d-flex justify-content-between">
            <Button variant="secondary" onClick={onHide}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Enviar
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default RequestForm;