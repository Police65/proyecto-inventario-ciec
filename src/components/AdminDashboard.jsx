import React, { useState, useEffect } from 'react';
import { Button, Table, Badge, Alert } from 'react-bootstrap';
import ConsolidationModal from './ConsolidationModal';
import { supabase } from '../supabaseClient';

const AdminDashboard = () => {
  const [showConsolidation, setShowConsolidation] = useState(false);
  const [ordenesConsolidadas, setOrdenesConsolidadas] = useState([]);
  const [error, setError] = useState('');

  // Cargar órdenes al iniciar
  useEffect(() => {
    const cargarOrdenes = async () => {
      const { data, error } = await supabase
        .from('ordenes_consolidadas')
        .select('*');
      
      if (!error) setOrdenesConsolidadas(data);
    };
    cargarOrdenes();
  }, []);

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between mb-4">
        <h3 className="text-light">Órdenes de Compra</h3>
        {/* Botón para abrir el modal de consolidación */}
        <Button 
          variant="primary" 
          onClick={() => setShowConsolidation(true)}
        >
          Consolidar Solicitudes
        </Button>
      </div>

      {/* Modal de Consolidación */}
      <ConsolidationModal
        show={showConsolidation}
        onHide={() => setShowConsolidation(false)}
        onConsolidate={(nuevaOrden) => {
          setOrdenesConsolidadas([...ordenesConsolidadas, nuevaOrden]);
        }}
      />

      {/* Tabla de Órdenes */}
      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>ID</th>
            <th>Productos</th>
            <th>Solicitudes</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ordenesConsolidadas.map(orden => (
            <tr key={orden.id}>
              <td>{orden.id}</td>
              <td>
                {orden.productos.map((p, i) => (
                  <div key={i}>
                    {p.descripcion} (x{p.cantidad})
                  </div>
                ))}
              </td>
              <td>
                {orden.solicitudes.map((s, i) => (
                  <Badge key={i} bg="secondary" className="me-1">
                    #{s}
                  </Badge>
                ))}
              </td>
              <td>
                <Button variant="success" size="sm">
                  Crear Orden
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default AdminDashboard;