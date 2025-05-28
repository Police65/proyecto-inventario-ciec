import React, { useState } from 'react';
import { OrdenCompra, OrdenCompraEstado } from '../../types';
import { supabase } from '../../supabaseClient';
import { CheckCircleIcon, XCircleIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { OrderCompletionForm } from './OrderCompletionForm'; 

interface OrderActionsProps {
  order: OrdenCompra;
  onUpdate: () => void; 
}

const OrderActions: React.FC<OrderActionsProps> = ({ order, onUpdate }) => {
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: OrdenCompraEstado) => {
    if (loading) return;
    setLoading(true);
    if (newStatus === 'Anulada' && !window.confirm(`¿Está seguro de anular la orden #${order.id}?`)) {
        setLoading(false);
        return;
    }
     if (newStatus === 'Completada' && !window.confirm(`¿Marcar la orden #${order.id} como completada? Esto podría afectar el inventario.`)) {
        setLoading(false);
        return;
    }

    try {
      const { error } = await supabase
        .from('ordencompra')
        .update({ estado: newStatus, fecha_modificacion: new Date().toISOString() })
        .eq('id', order.id);

      if (error) throw error;
      
      if (newStatus === 'Completada') {
        if (order.detalles) {
          for (const detalle of order.detalles) {
            if (detalle.producto_id && detalle.cantidad > 0) {
              const { data: invItem, error: invError } = await supabase
                .from('inventario')
                .select('id, existencias')
                .eq('producto_id', detalle.producto_id)
                .single();

              if (invError && invError.code !== 'PGRST116') { 
                 console.error('Error fetching inventory item for update:', invError);
                 continue; 
              }

              if (invItem) {
                await supabase
                  .from('inventario')
                  .update({ 
                    existencias: (invItem.existencias || 0) + detalle.cantidad,
                    fecha_actualizacion: new Date().toISOString()
                  })
                  .eq('id', invItem.id);
              } else { 
                 await supabase.from('inventario').insert({
                    producto_id: detalle.producto_id,
                    existencias: detalle.cantidad,
                    ubicacion: 'Almacén Principal (Entrada OC)', 
                    fecha_actualizacion: new Date().toISOString(),
                 });
              }
            }
          }
        }
      }
      onUpdate(); 
    } catch (error) {
      console.error('Error updating order status:', error);
      alert(`Error al actualizar estado de la orden: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {order.estado === 'Pendiente' && (
        <>
          <button
            onClick={() => setShowCompletionForm(true)} 
            disabled={loading}
            className="p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-700 transition-colors disabled:opacity-50"
            title="Completar Orden (Abrir Formulario)"
          >
            <CheckCircleIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleStatusChange('Anulada')}
            disabled={loading}
            className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700 transition-colors disabled:opacity-50"
            title="Anular Orden"
          >
            <XCircleIcon className="w-5 h-5" />
          </button>
        </>
      )}
      {order.estado === 'Anulada' && (
         <button
          onClick={() => handleStatusChange('Pendiente')} 
          disabled={loading}
          className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700 transition-colors disabled:opacity-50"
          title="Reabrir Orden (Marcar como Pendiente)"
        >
          <ArrowUturnLeftIcon className="w-5 h-5" />
        </button>
      )}

      {showCompletionForm && (
        <OrderCompletionForm
          show={showCompletionForm}
          onHide={() => setShowCompletionForm(false)}
          order={order}
          onComplete={(updatedOrder) => { 
            setShowCompletionForm(false);
            onUpdate(); 
          }}
        />
      )}
    </div>
  );
};

export default OrderActions;