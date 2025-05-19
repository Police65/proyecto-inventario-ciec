// src/components/ViewInventory.jsx
import React, { useState, useEffect } from 'react';
import { Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const ViewInventory = () => {
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const { data } = await supabase
          .from('inventario')
          .select('*, producto:producto_id(descripcion)');
        setInventory(data || []);
      } catch (error) {
        console.error('Error fetching inventory:', error);
      }
    };
    fetchInventory();
  }, []);

  return (
    <div className="mt-3">
      <h4 className="text-light">Inventario Actual</h4>
      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Ubicación</th>
            <th>Existencias</th>
            <th>Fecha de Actualización</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id}>
              <td>{item.producto?.descripcion || 'N/A'}</td>
              <td>{item.ubicacion || 'N/A'}</td>
              <td>{item.existencias}</td>
              <td>{new Date(item.fecha_actualizacion).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default ViewInventory;