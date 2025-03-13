import React, { useState, useEffect } from 'react';
import { Container, Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';
const Home = () => {
  // Estado para almacenar los registros de la tabla "inventario"
  const [inventory, setInventory] = useState([]);
  // useEffect para cargar los datos de "inventario" al montar el componente
  useEffect(() => {
    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from('inventario')
        // Realiza un join con la tabla "producto" usando el campo de referencia "producto_id"
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
    <Container fluid className="mt-3">
         <h3 className="text-black">📝Inventario</h3>
      <Table striped bordered hover responsive>
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
              <td colSpan="3" className="text-center">
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