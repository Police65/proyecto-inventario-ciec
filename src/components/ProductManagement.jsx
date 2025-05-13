import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Modal } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: null, descripcion: '', categoria_id: '' });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('producto').select('*');
    setProducts(data || []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categoria_producto').select('*');
    setCategories(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.id) {
      await supabase.from('producto').update(formData).eq('id', formData.id);
    } else {
      await supabase.from('producto').insert([formData]);
    }
    fetchProducts();
    setShowModal(false);
    setFormData({ id: null, descripcion: '', categoria_id: '' });
  };

  const handleEdit = (product) => {
    setFormData(product);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    await supabase.from('producto').delete().eq('id', id);
    fetchProducts();
  };

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className="mb-3">Añadir Producto</Button>
      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Categoría</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.descripcion}</td>
              <td>{categories.find(c => c.id === p.categoria_id)?.nombre || 'N/A'}</td>
              <td>
                <Button variant="info" onClick={() => handleEdit(p)} className="me-2">Editar</Button>
                <Button variant="danger" onClick={() => handleDelete(p.id)}>Eliminar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton className="bg-dark text-light">
          <Modal.Title>{formData.id ? 'Editar' : 'Añadir'} Producto</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-light">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control 
                value={formData.descripcion} 
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} 
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Categoría</Form.Label>
              <Form.Select 
                value={formData.categoria_id} 
                onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                required
              >
                <option value="">Seleccionar</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Button type="submit" variant="primary">Guardar</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ProductManagement;