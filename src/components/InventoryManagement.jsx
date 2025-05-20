import React from "react";
import { Container } from "react-bootstrap";
import InventoryStats from "./InventoryStats";
import AIInsights from "./AIInsights";
import DetailedStats from "./DetailedStats";

const InventoryManagement = ({ userProfile }) => {
  return (
    <Container fluid className="mt-3">
      <h3 className="text-light mb-4">📦 Gestión de Inventario</h3>
      <InventoryStats />
      <DetailedStats />
      <AIInsights />
    </Container>
  );
};

export default InventoryManagement;