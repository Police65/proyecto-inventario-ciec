import React, { useState } from 'react';
import { OrdenCompra, OrdenCompraEstado, NotificacionInsert } from '../../types';
import { supabase } from '../../supabaseClient';
import { CheckCircleIcon, XCircleIcon, ArrowUturnLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { OrderCompletionForm } from './OrderCompletionForm'; 
import { createNotifications, fetchAdminUserIds } from '../../services/notificationService';

interface OrderActionsProps {
  order: OrdenCompra;
  onUpdate: () => void; 
}

const OrderActions: React.FC<OrderActionsProps> = ({ order, onUpdate }) => {
  const [showCompletionForm, setShowCompletionForm] = useState(false); 
  const [loadingAction, setLoadingAction] = useState(false); 

  const handleStatusChange = async (newStatus: OrdenCompraEstado) => {
    if (loadingAction) return;
    setLoadingAction(true);
    
    if (newStatus === 'Anulada' && !window.confirm(`¿Está seguro de anular la orden #${order.id}?`)) {
        setLoadingAction(false);
        return;
    }
    
    try {
      const { error: updateError } = await supabase
        .from('ordencompra')
        .update({ estado: newStatus, fecha_modificacion: new Date().toISOString() })
        .eq('id', order.id);

      if (updateError) throw updateError;
      
      if (newStatus === 'Anulada') {
        const adminUserIds = await fetchAdminUserIds();
        if (adminUserIds.length > 0) {
          const notificationsPayload: NotificacionInsert[] = adminUserIds.map(adminId => ({
            user_id: adminId,
            title: 'Orden de Compra Anulada',
            description: `La orden de compra #${order.id} (Proveedor: ${order.proveedor?.nombre || 'N/D'}) ha sido anulada.`,
            type: 'orden_anulada',
            // related_id: order.id, // Removed
          }));
          await createNotifications(notificationsPayload);
        }
      }
      
      onUpdate(); 
    } catch (error) {
      console.error('Error updating order status:', error);
      alert(`Error al actualizar estado de la orden: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoadingAction(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {order.estado === 'Pendiente' && (
        <>
          <button
            onClick={() => setShowCompletionForm(true)} 
            disabled={loadingAction}
            className="p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-700 transition-colors disabled:opacity-50"
            title="Completar Orden (Abrir Formulario)"
          >
            {loadingAction && order.estado === 'Pendiente' ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => handleStatusChange('Anulada')}
            disabled={loadingAction}
            className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700 transition-colors disabled:opacity-50"
            title="Anular Orden"
          >
             {loadingAction && order.estado === 'Pendiente' ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <XCircleIcon className="w-5 h-5" />}
          </button>
        </>
      )}
      {order.estado === 'Anulada' && (
         <button
          onClick={() => handleStatusChange('Pendiente')} 
          disabled={loadingAction}
          className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700 transition-colors disabled:opacity-50"
          title="Reabrir Orden (Marcar como Pendiente)"
        >
          {loadingAction && order.estado === 'Anulada' ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ArrowUturnLeftIcon className="w-5 h-5" />}
        </button>
      )}

      {showCompletionForm && (
        <OrderCompletionForm
          show={showCompletionForm}
          onHide={() => setShowCompletionForm(false)}
          order={order}
          onComplete={(_) => { 
            setShowCompletionForm(false);
            onUpdate(); 
          }}
        />
      )}
    </div>
  );
};

export default OrderActions;
