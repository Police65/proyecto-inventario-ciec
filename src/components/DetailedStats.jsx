// src/components/DetailedStats.jsx
import React, { useState, useEffect } from 'react';
import { Table } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const DetailedStats = () => {
  const [departmentExpenses, setDepartmentExpenses] = useState([]);
  const [topOrderProducts, setTopOrderProducts] = useState([]);
  const [topRequestProducts, setTopRequestProducts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Gastos por departamento
        const { data: orders } = await supabase
          .from('ordencompra')
          .select('departamento:departamento_id(nombre), neto_a_pagar');
        const expenses = orders.reduce((acc, order) => {
          const dept = order.departamento?.nombre || 'Sin departamento';
          acc[dept] = (acc[dept] || 0) + (order.neto_a_pagar || 0);
          return acc;
        }, {});
        setDepartmentExpenses(Object.entries(expenses).map(([dept, total]) => ({ dept, total })));

        // Productos más frecuentes en órdenes
        const { data: orderDetails } = await supabase
          .from('ordencompra_detalle')
          .select('producto:producto_id(descripcion), cantidad')
          .order('cantidad', { ascending: false })
          .limit(5);
        const orderProducts = orderDetails.reduce((acc, detail) => {
          const prod = detail.producto.descripcion;
          acc[prod] = (acc[prod] || 0) + detail.cantidad;
          return acc;
        }, {});
        setTopOrderProducts(Object.entries(orderProducts).map(([product, quantity]) => ({ product, quantity })));

        // Productos más frecuentes en solicitudes
        const { data: requestDetails } = await supabase
          .from('solicitudcompra_detalle')
          .select('producto:producto_id(descripcion), cantidad')
          .order('cantidad', { ascending: false })
          .limit(5);
        const requestProducts = requestDetails.reduce((acc, detail) => {
          const prod = detail.producto.descripcion;
          acc[prod] = (acc[prod] || 0) + detail.cantidad;
          return acc;
        }, {});
        setTopRequestProducts(Object.entries(requestProducts).map(([product, quantity]) => ({ product, quantity })));
      } catch (error) {
        console.error('Error fetching detailed stats:', error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="mb-4">
      <h4 className="text-light">Gastos por Departamento</h4>
      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>Departamento</th>
            <th>Total Gastado (Bs)</th>
          </tr>
        </thead>
        <tbody>
          {departmentExpenses.map((expense, index) => (
            <tr key={index}>
              <td>{expense.dept}</td>
              <td>{expense.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h4 className="text-light">Productos Más Frecuentes en Órdenes</h4>
      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad Total Ordenada</th>
          </tr>
        </thead>
        <tbody>
          {topOrderProducts.map((product, index) => (
            <tr key={index}>
              <td>{product.product}</td>
              <td>{product.quantity}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h4 className="text-light">Productos Más Frecuentes en Solicitudes</h4>
      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad Total Solicitada</th>
          </tr>
        </thead>
        <tbody>
          {topRequestProducts.map((product, index) => (
            <tr key={index}>
              <td>{product.product}</td>
              <td>{product.quantity}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default DetailedStats;