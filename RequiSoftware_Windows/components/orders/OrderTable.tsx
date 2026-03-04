import React from 'react';
import { OrdenCompra, OrdenCompraEstado } from '../../types';
import OrderActions from './OrderActions';
import OrderPDF from './OrderPDF'; // Importar el nuevo componente OrderPDF

interface OrderTableProps {
  orders: OrdenCompra[];
  onOrderClick: (order: OrdenCompra) => void; // Para modal de detalles
  onUpdate: () => void; // Para refrescar datos después de acciones
}

const OrderTable: React.FC<OrderTableProps> = ({ orders, onOrderClick, onUpdate }) => {
  const getStatusBadge = (estado: OrdenCompraEstado) => {
    const variants: Record<OrdenCompraEstado, string> = {
      Pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
      Completada: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100',
      Anulada: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100',
    };
    return (
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${variants[estado] || variants.Pendiente}`}>
        {estado}
      </span>
    );
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-10">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay órdenes</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No se encontraron órdenes para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden animate-slide-up">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900/50">
          <tr>
            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">ID</th>
            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Proveedor</th>
            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Solicitud Rel.</th>
            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Fecha</th>
            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Total</th>
            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Estado</th>
            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {orders.map(order => (
            <tr
              key={order.id}
              onClick={() => onOrderClick(order)}
              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">#{order.codigo_visible || order.id}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-200">{order.proveedor?.nombre || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                <div className="font-bold">{order.solicitud_compra_id ? `#${order.solicitud_compra_id}` : 'Directa'}</div>
                {order.solicitud_compra?.descripcion && <span className="block text-[10px] opacity-70 truncate max-w-[150px]" title={order.solicitud_compra.descripcion}>{order.solicitud_compra.descripcion}</span>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{new Date(order.fecha_orden).toLocaleDateString()}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-primary-600 dark:text-primary-400">{order.neto_a_pagar?.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {order.unidad}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">{getStatusBadge(order.estado)}</td>
              <td
                className="px-4 py-3 whitespace-nowrap text-sm font-medium"
                onClick={(e) => e.stopPropagation()} // Prevenir clic en fila al interactuar con acciones
              >
                <div className="flex items-center space-x-2">
                  <OrderPDF order={order} />
                  <OrderActions order={order} onUpdate={onUpdate} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;