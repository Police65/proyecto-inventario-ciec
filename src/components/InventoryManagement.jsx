// src/components/InventoryManagement.jsx
import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import InventorySidebar from './InventorySidebar';
import InventoryStats from './InventoryStats';
import AIInsights from './AIInsights';
import DetailedStats from './DetailedStats';

const InventoryManagement = ({ userProfile }) => {
  return (
    <Row>
      <Col md={3}>
        <InventorySidebar userProfile={userProfile} />
      </Col>
      <Col md={9}>
        <Container fluid className="mt-3">
          <h3 className="text-light mb-4">📦 Gestión de Inventario</h3>
          <InventoryStats />
          <DetailedStats />
          <AIInsights />
        </Container>
      </Col>
    </Row>
  );
};

export default InventoryManagement;