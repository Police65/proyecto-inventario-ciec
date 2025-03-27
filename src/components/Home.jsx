import React, { useState, useEffect } from 'react';
import { Container, Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const Home = () => {
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from('inventario')
        .select(`
          *,
          producto:producto_id (
            descripcion,
            categoria:categoria_id (nombre)
          )
        `)
        .order('fecha_actualizacion', { ascending: false });
      
      if (!error) {
        setInventory(data);
      } else {
        console.error('Error al cargar el inventario:', error);
      }
    };
    fetchInventory();
  }, []);

  return (
    <Container fluid className="mt-3">
      <h3 className="text-light">📝 Inventario</h3>
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
    </Container>
  );
};

export default Home;