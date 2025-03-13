import React from 'react';
import { Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const OrderActions = ({ order, onUpdate }) => {
  const handleStatusChange = async (newStatus) => {
    const { error } = await supabase
      .from('ordencompra')
      .update({ estado: newStatus })
      .eq('id', order.id);

    if (!error) onUpdate();
  };

  return (
    <div className="d-flex gap-2">
      {order.estado === 'Pendiente' && (
        <>
          <Button 
            variant="success" 
            size="sm"
            onClick={() => handleStatusChange('Completada')}
          >
            Marcar como Completada
          </Button>
          <Button 
            variant="danger" 
            size="sm"
            onClick={() => handleStatusChange('Anulada')}
          >
            Anular Orden
          </Button>
        </>
      )}
      
      {order.estado === 'Completada' && (
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => handleStatusChange('Anulada')}
        >
          Revertir a Anulada
        </Button>
      )}
    </div>
  );
};

export default OrderActions;