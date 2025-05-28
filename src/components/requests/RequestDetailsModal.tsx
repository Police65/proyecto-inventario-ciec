
import React from 'react';
import { SolicitudCompra } from '../../types'; // Path relative to src/components/requests
import { XMarkIcon } from '@heroicons/react/24/outline';

interface RequestDetailsModalProps {
  show: boolean;
  onHide: () => void;
  request: SolicitudCompra | null;
}

const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({ show, onHide, request }) => {
  if (!show || !request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Detalles de la Solicitud #\${request.id}
          </h3>
          <button
            onClick={onHide}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Descripción:</p>
              <p className="text-gray-800 dark:text-gray-200">{request.descripcion || 'N/A'}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Estado:</p>
              <p className="text-gray-800 dark:text-gray-200">{request.estado}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Fecha de Solicitud:</p>
              <p className="text-gray-800 dark:text-gray-200">{new Date(request.fecha_solicitud).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Solicitante:</p>
              <p className="text-gray-800 dark:text-gray-200">{request.empleado?.nombre} {request.empleado?.apellido}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Departamento:</p>
              <p className="text-gray-800 dark:text-gray-200">{request.departamento?.nombre}</p>
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mt-4 mb-2">Productos Solicitados</h4>
            {request.detalles && request.detalles.length > 0 ? (
              <div className="overflow-x-auto border dark:border-gray-700 rounded-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Producto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {request.detalles.map((detalle, i) => (
                      <tr key={detalle.id || i}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          {detalle.producto?.descripcion || 'Producto no especificado'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          {detalle.cantidad}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos detallados en esta solicitud.</p>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t dark:border-gray-700 flex justify-end">
          <button
            onClick={onHide}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsModal;
