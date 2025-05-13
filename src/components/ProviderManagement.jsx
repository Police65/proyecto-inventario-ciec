import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Modal } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const ProviderManagement = () => {
  const [providers, setProviders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: null, nombre: '', rif: '', direccion: '', telefono: '', correo: '' });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    const { data } = await supabase.from('proveedor').select('*');
    setProviders(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.id) {
      await supabase.from('proveedor').update(formData).eq('id', formData.id);
    } else {
      await supabase.from('proveedor').insert([formData]);
    }
    fetchProviders();
    setShowModal(false);
    setFormData({ id: null, nombre: '', rif: '', direccion: '', telefono: '', correo: '' });
  };

  const handleEdit = (provider) => {
    setFormData(provider);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    await supabase.from('proveedor').delete().eq('id', id);
    fetchProviders();
  };

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className="mb-3">Añadir Proveedor</Button>
      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>RIF</th>
            <th>Dirección</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {providers.map(p => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.rif}</td>
              <td>{p.direccion}</td>
              <td>{p.telefono}</td>
              <td>{p.correo}</td>
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
          <Modal.Title>{formData.id ? 'Editar' : 'Añadir'} Proveedor</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-light">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control 
                value={formData.nombre} 
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} 
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>RIF</Form.Label>
              <Form.Control 
                value={formData.rif} 
                onChange={(e) => setFormData({ ...formData, rif: e.target.value })} 
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Dirección</Form.Label>
              <Form.Control 
                value={formData.direccion} 
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control 
                value={formData.telefono} 
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} 
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Correo</Form.Label>
              <Form.Control 
                value={formData.correo} 
                onChange={(e) => setFormData({ ...formData, correo: e.target.value })} 
              />
            </Form.Group>
            <Button type="submit" variant="primary">Guardar</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ProviderManagement;