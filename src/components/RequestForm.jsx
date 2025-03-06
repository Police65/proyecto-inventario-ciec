import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient.js';

const RequestForm = ({ show, onHide, onSubmit }) => {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customRequest, setCustomRequest] = useState(false);
  const [description, setDescription] = useState('');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('producto').select('*');
    if (!error) setProducts(data);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      productId,
      quantity,
      description: customRequest ? description : null,
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
          <Form.Group className="mb-3">
            <Form.Label>Producto:</Form.Label>
            <Form.Select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={customRequest}>
              <option value="">Seleccionar producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.descripcion}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Cantidad:</Form.Label>
            <Form.Control
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              disabled={customRequest}
            />
          </Form.Group>
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