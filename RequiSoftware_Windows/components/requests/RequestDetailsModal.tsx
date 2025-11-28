
import React from 'react';
import { SolicitudCompra, OrdenCompra } from '../../types';
import { XMarkIcon, DocumentMagnifyingGlassIcon, PaperClipIcon } from '@heroicons/react/24/outline';

interface RequestDetailsModalProps {
  show: boolean;
  onHide: () => void;
  request: SolicitudCompra | null;
  onViewOrder?: (order: OrdenCompra) => void;
}

const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({ show, onHide, request, onViewOrder }) => {
  if (!show || !request) return null;

  const handleViewOrderClick = () => {
    if (onViewOrder && request.ordenes && request.ordenes.length > 0) {
      onViewOrder(request.ordenes[0]);
    }
  };
  
  const attachmentRegex = /\[Adjunto: (.*?)\]\((.*?)\)/;
  const match = request.descripcion?.match(attachmentRegex);
  const attachmentName = match ? match[1] : null;
  const attachmentUrl = match ? match[2] : null;
  
  // Lógica para limpiar la descripción y arreglar errores antiguos de IA
  let cleanDescription = request.descripcion?.replace(attachmentRegex, '').trim();
  
  if (!cleanDescription || cleanDescription.includes("(error en IA)") || cleanDescription.includes("Error en IA")) {
      if (request.detalles && request.detalles.length > 0) {
          const products = request.detalles;
          const firstProd = products[0].producto?.descripcion || products[0].descripcion_producto_personalizado || 'Producto';
          const count = products.length;
          
          if (count === 1) cleanDescription = `Solicitud de ${firstProd}`;
          else if (count === 2) {
             const secondProd = products[1].producto?.descripcion || products[1].descripcion_producto_personalizado || 'Producto';
             cleanDescription = `Solicitud de ${firstProd} y ${secondProd}`;
          } else {
             cleanDescription = `Solicitud de ${firstProd} y ${count - 1} más`;
          }
      } else {
          cleanDescription = "Solicitud de Compra";
      }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Detalles de la Solicitud #{request.codigo_visible || request.id}
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
              <p className="font-medium text-gray-500 dark:text-gray-400">Descripción General:</p>
              <p className="text-gray-800 dark:text-gray-200">{cleanDescription}</p>
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
            {attachmentUrl && (
                <div className="sm:col-span-2">
                    <p className="font-medium text-gray-500 dark:text-gray-400">Archivo Adjunto:</p>
                    <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-primary-600 dark:text-primary-400 hover:underline">
                        <PaperClipIcon className="w-4 h-4 mr-1.5" />
                        {attachmentName || 'Ver Archivo'}
                    </a>
                </div>
            )}
          </div>
          
          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mt-4 mb-2">Detalles de la Solicitud</h4>
            {request.detalles && request.detalles.length > 0 ? (
              <div className="overflow-x-auto border dark:border-gray-700 rounded-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ítem</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {request.detalles.map((detalle, i) => (
                      <tr key={detalle.id || i}>
                        <td className="px-4 py-2 whitespace-normal text-sm text-gray-800 dark:text-gray-200">
                          {detalle.producto_id 
                            ? (detalle.producto?.descripcion || 'Producto no especificado') 
                            : (detalle.descripcion_producto_personalizado || 'Descripción personalizada no especificada')}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos detallados en esta solicitud (podría ser una requisición especial descrita arriba).</p>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t dark:border-gray-700 flex justify-between items-center">
          {request.estado === 'Aprobada' && request.ordenes && request.ordenes.length > 0 && onViewOrder && (
            <button
              onClick={handleViewOrderClick}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
            >
              <DocumentMagnifyingGlassIcon className="w-5 h-5 mr-2" />
              Ver Orden de Compra
            </button>
          )}
          <button
            onClick={onHide}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ml-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsModal;
