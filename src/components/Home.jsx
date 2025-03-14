import React, { useState, useEffect } from 'react';
import { Container, Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const Home = () => {
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from('inventario')
        .select('*, producto:producto_id (descripcion)')
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
    // Implementación: Cambiado text-black a text-light
    <Container fluid className="mt-3">
      <h3 className="text-light">📝Inventario</h3>
      {/* Implementación: Añadida variante dark */}
      <Table striped bordered hover responsive variant="dark">
        <thead>
          <tr>
            <th>Nombre del Producto</th>
            <th>Ubicación</th>
            <th>Fecha de Actualización</th>
          </tr>
        </thead>
        <tbody>
          {inventory.length > 0 ? (
            inventory.map((item) => (
              <tr key={item.id}>
                <td>{item.producto ? item.producto.descripcion : 'Sin nombre'}</td>
                <td>{item.ubicacion}</td>
                <td>{new Date(item.fecha_actualizacion).toLocaleDateString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3" className="text-center text-light">
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