// src/components/InventoryStats.jsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const InventoryStats = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: inventoryData } = await supabase
          .from('inventario')
          .select('id, existencias');
        const totalProducts = inventoryData.length;
        const lowStockProducts = inventoryData.filter(item => item.existencias < 10).length;

        const { data: ordersData } = await supabase
          .from('ordencompra')
          .select('id, estado, neto_a_pagar');
        const totalOrders = ordersData.length;
        const pendingOrders = ordersData.filter(order => order.estado === 'Pendiente').length;
        const totalSpent = ordersData.reduce((acc, order) => acc + (order.neto_a_pagar || 0), 0);

        setStats({
          totalProducts,
          lowStockProducts,
          totalOrders,
          pendingOrders,
          totalSpent,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  return (
    <Row className="mb-4">
      <Col md={3}>
        <Card className="bg-dark text-light">
          <Card.Body>
            <Card.Title>Productos en Inventario</Card.Title>
            <Card.Text>{stats.totalProducts}</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="bg-dark text-light">
          <Card.Body>
            <Card.Title>Productos con Bajo Stock</Card.Title>
            <Card.Text>{stats.lowStockProducts}</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="bg-dark text-light">
          <Card.Body>
            <Card.Title>Órdenes de Compra Totales</Card.Title>
            <Card.Text>{stats.totalOrders}</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="bg-dark text-light">
          <Card.Body>
            <Card.Title>Órdenes Pendientes</Card.Title>
            <Card.Text>{stats.pendingOrders}</Card.Text>
          </Card.Body>
        </Card>
      </Col>
      <Col md={3}>
        <Card className="bg-dark text-light">
          <Card.Body>
            <Card.Title>Gasto Total en Órdenes</Card.Title>
            <Card.Text>{stats.totalSpent.toFixed(2)} Bs</Card.Text>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export default InventoryStats;