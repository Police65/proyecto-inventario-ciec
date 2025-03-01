import React, { useEffect, useState } from 'react';
import { getOrders } from '../utils/api';

const MainContent = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      const ordersData = await getOrders();
      setOrders(ordersData);
    };

    fetchOrders();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl text-black pb-6">Panel Principal</h1>
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Órdenes de Compra</h2>
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="text-left py-2">Número de Orden</th>
              <th className="text-left py-2">Fecha</th>
              <th className="text-left py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b">
                <td className="py-2">{order.numero_orden}</td>
                <td className="py-2">{new Date(order.fecha_orden).toLocaleDateString()}</td>
                <td className="py-2">{order.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MainContent; // Solo un export default