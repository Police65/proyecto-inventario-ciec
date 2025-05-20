import React from "react";
import { Link } from "react-router-dom";
import { Button } from "react-bootstrap";
import "../styles/sidebar.css";

const InventorySidebar = ({ userProfile, isVisible }) => {
  return (
    <aside className={`sidebar ${isVisible ? "visible" : ""}`}>
      <h1>Gestión de Inventario</h1>
      <p className="text-light">
        Bienvenido, {userProfile.nombre} {userProfile.apellido}
      </p>
      <nav>
        <ul>
          <li>
            <Link to="/inventory" className="btn">
              <i className="bi bi-house-door me-2"></i>
              Home
            </Link>
          </li>
          <li>
            <Button variant="link" className="text-light">
              <i className="bi bi-gear me-2"></i>
              Administración
            </Button>
            <ul className="sub-menu">
              <li>
                <Link to="/inventory/view" className="btn">
                  Ver Inventario
                </Link>
              </li>
              <li>
                <Link to="/inventory/add-product" className="btn">
                  Añadir Producto
                </Link>
              </li>
              <li>
                <Link to="/inventory/add-provider" className="btn">
                  Añadir Proveedor
                </Link>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default InventorySidebar;