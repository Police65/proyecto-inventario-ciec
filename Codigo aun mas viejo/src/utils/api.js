import { supabase } from '../supabaseClient';

/**
 * Obtiene todas las órdenes de compra desde Supabase.
 * @returns {Array} Lista de órdenes de compra.
 */
export const getOrders = async () => {
  const { data, error } = await supabase
    .from('OrdenCompra')
    .select('*')
    .order('fecha_orden', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }

  return data;
};

/**
 * Crea una nueva orden de compra en Supabase.
 * @param {Object} orderData - Datos de la orden de compra.
 * @returns {Object} La orden creada.
 */
export const createOrder = async (orderData) => {
  const { data, error } = await supabase
    .from('OrdenCompra')
    .insert([orderData])
    .single();

  if (error) {
    console.error('Error creating order:', error);
    return null;
  }

  return data;
};

/**
 * Actualiza el estado de una orden de compra.
 * @param {number} orderId - ID de la orden.
 * @param {string} newStatus - Nuevo estado de la orden.
 * @returns {Object} La orden actualizada.
 */
export const updateOrderStatus = async (orderId, newStatus) => {
  const { data, error } = await supabase
    .from('OrdenCompra')
    .update({ estado: newStatus })
    .eq('id', orderId)
    .single();

  if (error) {
    console.error('Error updating order status:', error);
    return null;
  }

  return data;
};