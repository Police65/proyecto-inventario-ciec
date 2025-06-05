
import React from 'react';
import { OrdenCompra } from '../../types';
import { XMarkIcon } from '@heroicons/react/24/outline';
import OrderPDF from './OrderPDF'; // Import the new OrderPDF component

interface OrderDetailsModalProps {
  show: boolean;
  onHide: () => void;
  order: OrdenCompra | null;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ show, onHide, order }) => {
  if (!show || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Detalles de la Orden de Compra #{order.id}
          </h3>
          <button
            onClick={onHide}
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Proveedor:</p>
              <p className="text-gray-800 dark:text-gray-200">{order.proveedor?.nombre || 'N/A'} (RIF: {order.proveedor?.rif || 'N/A'})</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{order.proveedor?.direccion}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Fecha de Orden:</p>
              <p className="text-gray-800 dark:text-gray-200">{new Date(order.fecha_orden).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Estado:</p>
              <p className="text-gray-800 dark:text-gray-200">{order.estado}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Solicitud Original:</p>
              <p className="text-gray-800 dark:text-gray-200">
                {order.solicitud_compra_id ? `#${order.solicitud_compra_id} - ${order.solicitud_compra?.descripcion || ''}` : 'Orden Directa'}
              </p>
            </div>
             <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">Creada por:</p>
              <p className="text-gray-800 dark:text-gray-200">{order.empleado?.nombre} {order.empleado?.apellido}</p>
            </div>
          </div>

          <div className="pt-3">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-2">Productos Ordenados</h4>
            {order.detalles && order.detalles.length > 0 ? (
              <div className="overflow-x-auto border dark:border-gray-700 rounded-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Producto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Precio Unit. ({order.unidad})</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total ({order.unidad})</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    {order.detalles.map((detalle) => (
                      <tr key={detalle.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">{detalle.producto?.descripcion || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">{detalle.cantidad}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">{detalle.precio_unitario.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200">{(detalle.cantidad * detalle.precio_unitario).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay productos detallados en esta orden.</p>
            )}
          </div>

          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg space-y-1 text-sm">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-1">Resumen Financiero</h4>
            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Subtotal:</span> <span className="font-medium text-gray-800 dark:text-gray-100">{order.sub_total.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {order.unidad}</span></div>
            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">IVA (16%):</span> <span className="font-medium text-gray-800 dark:text-gray-100">{order.iva.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {order.unidad}</span></div>
            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300">Retención IVA ({order.retencion_porcentaje || 0}%):</span> <span className="font-medium text-gray-800 dark:text-gray-100">{order.ret_iva?.toLocaleString('es-VE', { minimumFractionDigits: 2 }) || '0.00'} {order.unidad}</span></div>
            <div className="flex justify-between font-bold text-md pt-1 border-t dark:border-gray-600 text-gray-900 dark:text-white"><span >Neto a Pagar:</span> <span>{order.neto_a_pagar.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {order.unidad}</span></div>
          </div>
            {order.observaciones && (
                 <div className="mt-3">
                    <p className="font-medium text-gray-500 dark:text-gray-400 text-sm">Observaciones:</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{order.observaciones}</p>
                </div>
            )}
        </div>

        <div className="p-4 sm:p-5 border-t dark:border-gray-700 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800 z-10">
          <OrderPDF 
            order={order} 
            buttonClass="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm"
            iconClass="w-4 h-4"
            showText={true}
            buttonText="Generar PDF"
          />
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

export default OrderDetailsModal;
