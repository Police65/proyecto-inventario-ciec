import React, { useState, useEffect } from "react";
import { Table } from "react-bootstrap";
import { supabase } from "../supabaseClient";

const ViewInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase
          .from("inventario")
          .select("*, producto!producto_id(descripcion)");
        if (error) throw error;
        setInventory(data || []);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  if (loading) return <p className="text-light">Cargando inventario...</p>;
  if (error) return <p className="text-light">Error: {error}</p>;

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
              <td>{item.producto?.descripcion || "N/A"}</td>
              <td>{item.ubicacion || "N/A"}</td>
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