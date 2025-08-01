import React from 'react';
import { SolicitudCompra, SolicitudCompraEstado } from '../../types';
import { CheckCircleIcon, XCircleIcon, EyeIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline'; // Importar ícono DocumentMagnifyingGlassIcon

interface RequestTableProps {
  requests: SolicitudCompra[];
  withActions?: boolean;
  onApprove?: (request: SolicitudCompra) => void;
  onReject?: (requestId: number) => void;
  showStatus?: boolean;
  onRowClick?: (request: SolicitudCompra) => void;
}

const RequestTable: React.FC<RequestTableProps> = ({ 
  requests, 
  withActions, 
  onApprove, 
  onReject, 
  showStatus = true,
  onRowClick
}) => {
  
  const getStatusBadge = (estado: SolicitudCompraEstado) => {
    const variants: Record<SolicitudCompraEstado, string> = {
      Pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
      Aprobada: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100',
      Rechazada: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100',
    };
    return (
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${variants[estado]}`}>
        {estado}
      </span>
    );
  };

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-10">
        <DocumentMagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay solicitudes</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No se encontraron solicitudes para mostrar.</p>
      </div>
    );
  }


  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Departamento</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Solicitante</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Productos</th>
            {showStatus && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>}
            {withActions && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {requests.map(request => (
            <tr 
              key={request.id} 
              className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => typeof onRowClick === 'function' && onRowClick(request)}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{request.id}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs">{request.descripcion || 'N/D'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{request.departamento?.nombre || 'N/D'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{request.empleado?.nombre} {request.empleado?.apellido}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                {request.detalles && request.detalles.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1">
                    {request.detalles.slice(0,2).map((detalle, i) => ( // Mostrar los primeros 2, añadir indicador de "más"
                      <li key={i} className="truncate">
                        {detalle.producto?.descripcion || 'Producto no especificado'} (x{detalle.cantidad})
                      </li>
                    ))}
                    {request.detalles.length > 2 && <li className="text-xs text-gray-400">...y {request.detalles.length - 2} más</li>}
                  </ul>
                ) : 'N/D'}
              </td>
              {showStatus && (
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {getStatusBadge(request.estado)}
                </td>
              )}
              {withActions && onApprove && onReject && (
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onApprove(request)}
                    className="p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-700 transition-colors"
                    title="Aprobar"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onReject(request.id)}
                    className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700 transition-colors"
                    title="Rechazar"
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                   {!onRowClick && ( // Mostrar ícono de ver solo si no hay un onRowClick global
                     <button
                        onClick={() => typeof onRowClick === 'function' && onRowClick(request)} // Si hay un onRowClick dedicado para detalles
                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700 transition-colors"
                        title="Ver Detalles"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                   )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RequestTable;