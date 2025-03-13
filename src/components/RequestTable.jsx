import React from 'react';
import { Table, Button } from 'react-bootstrap';

const RequestTable = ({ requests, withActions, onApprove, onReject }) => {
  const getStatusBadge = (estado) => {
    const variants = {
      Pendiente: 'warning',
      Aprobada: 'success',
      Rechazada: 'danger'
    };
    
    return (
      <span className={`badge bg-${variants[estado]}`}>
        {estado}
      </span>
    );
  };

  return (
    <div className="table-responsive">
      <Table striped hover className="align-middle">
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Productos</th>
            <th>Estado</th>
            {withActions && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {requests?.map(request => (
            <tr key={request.id}>
              <td>{request.id}</td>
              <td>{request.descripcion || 'N/A'}</td>
              <td>
                {request.detalles?.map((detalle, i) => (
                  <div key={i} className="mb-1">
                    {detalle.producto_id ? (
                      <>
                        <strong>Producto ID:</strong> {detalle.producto_id} 
                        <span className="ms-2">(Cantidad: {detalle.cantidad})</span>
                      </>
                    ) : 'Producto no especificado'}
                  </div>
                )) || 'N/A'}
              </td>
              <td>{getStatusBadge(request.estado)}</td>
              
              {withActions && (
                <td>
                  <Button 
                    variant="success" 
                    size="sm" 
                    className="me-2"
                    onClick={() => onApprove(request)}
                  >
                    Aprobar
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => onReject(request.id)}
                  >
                    Rechazar
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default RequestTable;