import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderForm = ({ show, onHide, request }) => {
  const [proveedores, setProveedores] = useState([]); // Lista de proveedores
  const [proveedorId, setProveedorId] = useState(''); // ID del proveedor seleccionado
  const [searchTerm, setSearchTerm] = useState(''); // Término de búsqueda
  const [observaciones, setObservaciones] = useState('');

  // Obtener la lista de proveedores al cargar el componente
  useEffect(() => {
    const fetchProveedores = async () => {
      const { data, error } = await supabase.from('proveedor').select('*');
      if (!error) {
        setProveedores(data);
      } else {
        console.error('Error al obtener proveedores:', error);
      }
    };

    fetchProveedores();
  }, []);

  // Filtrar proveedores basados en el término de búsqueda
  const filteredProveedores = proveedores.filter((proveedor) =>
    proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!proveedorId) {
      alert('Por favor, seleccione un proveedor.');
      return;
    }

    // Crear la orden de compra
    const { data, error } = await supabase.from('ordencompra').insert([{
      fecha_orden: new Date().toISOString(),
      numero_orden: `ORD-${request.id}`, // Número de orden basado en el ID de la solicitud
      estado: 'Pendiente',
      observaciones: observaciones,
      proveedor_id: proveedorId,
      departamento_id: request.departamento_id,
      empleado_id: request.empleado_id,
    }]);

    if (error) {
      alert('Error al crear la orden de compra: ' + error.message);
    } else {
      alert('Orden de compra creada exitosamente');
      onHide(); // Cerrar el modal después de crear la orden
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Crear Orden de Compra</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Proveedor:</Form.Label>
            <Form.Control
              type="text"
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Form.Select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              required
              className="mt-2"
            >
              <option value="">Seleccione un proveedor</option>
              {filteredProveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Observaciones:</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Ingrese observaciones (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Form.Group>
          <div className="d-flex justify-content-between">
            <Button variant="secondary" onClick={onHide}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Crear Orden
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OrderForm;