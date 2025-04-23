import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import OrderCompletionForm from './OrderCompletionForm';
import { supabase } from '../supabaseClient';

const OrderActions = ({ order, onUpdate }) => {
  const [showCompletionForm, setShowCompletionForm] = useState(false);

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
            onClick={(e) => {
              e.stopPropagation(); // Evita que el clic se propague a la fila
              setShowCompletionForm(true);
            }}
          >
            Marcar como Completada
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation(); // Evita que el clic se propague a la fila
              handleStatusChange('Anulada');
            }}
          >
            Anular Orden
          </Button>
        </>
      )}
      {order.estado === 'Completada' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation(); // Evita que el clic se propague a la fila
            handleStatusChange('Anulada');
          }}
        >
          Revertir a Anulada
        </Button>
      )}
      <OrderCompletionForm
        show={showCompletionForm}
        onHide={() => setShowCompletionForm(false)}
        order={order}
        onComplete={onUpdate}
      />
    </div>
  );
};

export default OrderActions;