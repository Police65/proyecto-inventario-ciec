
import React from 'react';
import { OrdenConsolidada } from '../../types';
import { EyeIcon, TrashIcon, ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../supabaseClient';

interface ConsolidatedOrderTableProps {
  orders: OrdenConsolidada[];
  onOrderClick: (order: OrdenConsolidada) => void; // For details modal
  onConvertToRegularOrder: (order: OrdenConsolidada) => void;
  onUpdate: () => void; // To refresh data after actions
}

const ConsolidatedOrderTable: React.FC<ConsolidatedOrderTableProps> = ({ orders, onOrderClick, onConvertToRegularOrder, onUpdate }) => {
  
  const getStatusBadge = (estado: string) => {
    const variants: { [key: string]: string } = {
      Pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
      Procesada: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100', // Assuming 'Procesada' when converted
      Completada: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100', // If consolidated order can be completed
      Anulada: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100',
    };
    return (
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${variants[estado] || variants.Pendiente}`}>
        {estado}
      </span>
    );
  };

  const handleDeleteConsolidacion = async (id: number) => {
    if (window.confirm(`¿Está seguro de eliminar la orden consolidada #${id}? Esta acción no se puede deshacer.`)) {
        try {
            const { error } = await supabase.from('ordenes_consolidadas').delete().eq('id', id);
            if (error) throw error;
            onUpdate(); // Refresh data
        } catch (err) {
            console.error("Error eliminando consolidación:", err);
            alert(`Error al eliminar orden consolidada: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-10">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay órdenes consolidadas</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Actualmente no existen órdenes consolidadas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Proveedor</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Productos</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Solicitudes IDs</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Creación</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {orders.map(order => (
            <tr 
              key={order.id} 
              onClick={() => onOrderClick(order)}
              className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{order.id}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{order.proveedor?.nombre || 'N/A'}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                {(order.productos as Array<{descripcion: string, cantidad: number}>)?.map(p => `${p.descripcion} (x${p.cantidad})`).join(', ') || 'N/A'}
              </td>
               <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                {(order.solicitudes as number[])?.join(', ') || 'N/A'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(order.fecha_creacion).toLocaleDateString()}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">{getStatusBadge(order.estado)}</td>
              <td 
                className="px-4 py-3 whitespace-nowrap text-sm font-medium"
                onClick={(e) => e.stopPropagation()} // Prevent row click when interacting with actions
              >
                <div className="flex items-center space-x-2">
                  {order.estado === 'Pendiente' && (
                    <button
                      onClick={() => onConvertToRegularOrder(order)}
                      className="p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-700"
                      title="Convertir a Orden de Compra"
                    >
                      <ArrowRightCircleIcon className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteConsolidacion(order.id)}
                    className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700"
                    title="Eliminar Consolidación"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ConsolidatedOrderTable;
