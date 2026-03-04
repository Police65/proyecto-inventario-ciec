import React from 'react';
import { Inventario } from '../../types';
import { XMarkIcon, ExclamationTriangleIcon, ArchiveBoxIcon, PlusCircleIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

interface LowStockAlertModalProps {
  show: boolean;
  onClose: () => void;
  items: Inventario[];
  userRole?: string | null;
}

const LowStockAlertModal: React.FC<LowStockAlertModalProps> = ({ show, onClose, items, userRole }) => {
  const navigate = useNavigate();

  if (!show || items.length === 0) return null;

  const handleCreateRequest = () => {
    onClose();
    navigate('/new-request');
  };

  const handleCreateDirectOrder = () => {
    onClose();
    // Navegamos al dashboard de solicitudes con un estado que indica abrir el formulario de orden directa
    navigate('/solicitudes', { state: { openDirectOrder: true } });
  };

  const handleGoToInventory = () => {
    onClose();
    navigate('/inventory/view');
  };

  const isAdmin = userRole === 'admin';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 border border-red-200 dark:border-red-900/50">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center">
          <div className="flex items-center text-red-700 dark:text-red-400">
            <ExclamationTriangleIcon className="w-6 h-6 mr-2" />
            <h3 className="text-lg font-bold">Crítico: Reposición Necesaria</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-600 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Los siguientes productos han alcanzado su <span className="font-bold text-red-600 dark:text-red-400 text-base">punto de reorden</span>. Se recomienda reponer existencias lo antes posible.
          </p>
          
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 mb-6 custom-scrollbar">
            {items.map(item => (
              <div key={item.id} className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm mr-3">
                  <ArchiveBoxIcon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate" title={item.producto?.descripcion}>
                    {item.producto?.descripcion}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Mínimo: {item.producto?.stock_minimo} | Actual: <span className="font-bold text-red-600 dark:text-red-400">{item.existencias ?? 0}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGoToInventory}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 font-semibold rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all active:scale-95 text-sm"
            >
              Ver Inventario
            </button>
            <button
              onClick={handleCreateRequest}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-md transition-all active:scale-95 text-sm"
            >
              <PlusCircleIcon className="w-5 h-5 mr-2" />
              Crear Solicitud
            </button>
          </div>
          
          {isAdmin && (
            <button
              onClick={handleCreateDirectOrder}
              className="w-full flex items-center justify-center px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-all active:scale-95 text-sm"
            >
              <DocumentPlusIcon className="w-5 h-5 mr-2" />
              Crear Orden de Compra Directa
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LowStockAlertModal;