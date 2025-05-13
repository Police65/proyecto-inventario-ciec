import React from 'react';
import { Table, Button } from 'react-bootstrap';

const RequestTable = ({ requests, withActions, onApprove, onReject, showStatus = true, onRowClick }) => {
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
      <Table striped hover className="align-middle" variant="dark">
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Departamento</th>
            <th>Productos</th>
            {showStatus && <th>Estado</th>}
            {withActions && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {requests?.map(request => (
            <tr 
              key={request.id} 
              className="text-light" 
              onClick={() => onRowClick && onRowClick(request)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              <td>{request.id}</td>
              <td>{request.descripcion || 'N/A'}</td>
              <td>{request.departamento?.nombre || 'N/A'}</td>
              <td>
                {request.detalles?.map((detalle, i) => (
                  <div key={i} className="mb-1 small">
                    {detalle.producto && detalle.producto.descripcion ? (
                      <>
                        <strong>{detalle.producto.descripcion}</strong>
                        <span className="ms-2">(Cantidad: {detalle.cantidad})</span>
                      </>
                    ) : (
                      'Producto no especificado'
                    )}
                  </div>
                )) || 'N/A'}
              </td>
              {showStatus && <td>{getStatusBadge(request.estado)}</td>}
              {withActions && (
                <td onClick={(e) => e.stopPropagation()}>
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
          {requests?.length === 0 && (
            <tr>
              <td colSpan={showStatus ? 6 : 5} className="text-center text-muted py-4">
                No hay registros para mostrar
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default RequestTable;