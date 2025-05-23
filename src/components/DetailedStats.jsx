import React, { useState, useEffect } from "react";
import { Table } from "react-bootstrap";
import { supabase } from "../supabaseClient";

const DetailedStats = () => {
  const [departmentExpenses, setDepartmentExpenses] = useState([]);
  const [topOrderProducts, setTopOrderProducts] = useState([]);
  const [topRequestProducts, setTopRequestProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Gastos por departamento a través de solicitudcompra
        const { data: orders, error: ordersError } = await supabase
          .from("ordencompra")
          .select(`
            neto_a_pagar,
            solicitudcompra!solicitud_compra_id (
              departamento!departamento_id (nombre)
            )
          `);
        if (ordersError) throw ordersError;
        if (!orders || orders.length === 0) {
          setDepartmentExpenses([]);
        } else {
          const expenses = orders.reduce((acc, order) => {
            const dept = order.solicitudcompra?.departamento?.nombre || "Sin departamento";
            acc[dept] = (acc[dept] || 0) + (order.neto_a_pagar || 0);
            return acc;
          }, {});
          setDepartmentExpenses(
            Object.entries(expenses).map(([dept, total]) => ({ dept, total }))
          );
        }

        // Productos más frecuentes en órdenes
        const { data: orderDetails, error: orderDetailsError } = await supabase
          .from("ordencompra_detalle")
          .select("cantidad, producto:producto_id(descripcion)")
          .order("cantidad", { ascending: false })
          .limit(5);
        if (orderDetailsError) throw orderDetailsError;
        if (!orderDetails || orderDetails.length === 0) {
          setTopOrderProducts([]);
        } else {
          const orderProducts = orderDetails.reduce((acc, detail) => {
            const prod = detail.producto?.descripcion || "Desconocido";
            acc[prod] = (acc[prod] || 0) + (detail.cantidad || 0);
            return acc;
          }, {});
          setTopOrderProducts(
            Object.entries(orderProducts).map(([product, quantity]) => ({
              product,
              quantity,
            }))
          );
        }

        // Productos más frecuentes en solicitudes
        const { data: requestDetails, error: requestDetailsError } = await supabase
          .from("solicitudcompra_detalle")
          .select("cantidad, producto:producto_id(descripcion)")
          .order("cantidad", { ascending: false })
          .limit(5);
        if (requestDetailsError) throw requestDetailsError;
        if (!requestDetails || requestDetails.length === 0) {
          setTopRequestProducts([]);
        } else {
          const requestProducts = requestDetails.reduce((acc, detail) => {
            const prod = detail.producto?.descripcion || "Desconocido";
            acc[prod] = (acc[prod] || 0) + (detail.cantidad || 0);
            return acc;
          }, {});
          setTopRequestProducts(
            Object.entries(requestProducts).map(([product, quantity]) => ({
              product,
              quantity,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching detailed stats:", error);
        setError(error.message);
      }
    };
    fetchData();
  }, []);

  if (error) return <p className="text-light">Error: {error}</p>;

  return (
    <div className="mb-4">
      <h4 className="text-light">Gastos por Departamento</h4>
      {departmentExpenses.length > 0 ? (
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
      ) : (
        <p className="text-light">No hay datos de gastos por departamento.</p>
      )}

      <h4 className="text-light">Productos Más Frecuentes en Órdenes</h4>
      {topOrderProducts.length > 0 ? (
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
      ) : (
        <p className="text-light">No hay datos de productos en órdenes.</p>
      )}

      <h4 className="text-light">Productos Más Frecuentes en Solicitudes</h4>
      {topRequestProducts.length > 0 ? (
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
      ) : (
        <p className="text-light">No hay datos de productos en solicitudes.</p>
      )}
    </div>
  );
};

export default DetailedStats;