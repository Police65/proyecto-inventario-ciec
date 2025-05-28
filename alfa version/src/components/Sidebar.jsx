// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "react-bootstrap";
import "../styles/sidebar.css";

const Sidebar = ({
  isVisible,
  onNewRequest,
  onSelectTab,
  userProfile,
  pendingRequests = [],
}) => {
  const location = useLocation();

  return (
    <aside className={`sidebar ${isVisible ? "visible" : ""}`}>
      <h1>Cámara de Industriales</h1>
      <nav>
        <ul>
          <li>
            <Link
              to="/solicitudes"
              className="btn"
              onClick={() => onSelectTab("solicitudes")}
            >
              <i className="bi bi-list-task me-2"></i>
              <span>
                Solicitudes
                <span className="badge">{pendingRequests.length}</span>
              </span>
            </Link>
          </li>
          <li>
            <Link
              to="/solicitudes"
              className="btn"
              onClick={() => onSelectTab("historial-solicitudes")}
            >
              <i className="bi bi-clock-history me-2"></i>
              Historial Solicitudes
            </Link>
          </li>
          {userProfile?.rol === "admin" && (
            <>
              <li>
                <Link
                  to="/solicitudes"
                  className="btn"
                  onClick={() => onSelectTab("ordenes")}
                >
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Historial de Órdenes
                </Link>
              </li>
              <li>
                <Link
                  to="/solicitudes"
                  className="btn"
                  onClick={() => onSelectTab("ordenes-consolidadas")}
                >
                  <i className="bi bi-archive me-2"></i>
                  Órdenes Consolidadas
                </Link>
              </li>
              <li>
                <Link
                  to="/solicitudes"
                  className="btn"
                  onClick={() => onSelectTab("usuarios")}
                >
                  <i className="bi bi-people me-2"></i>
                  Gestión de Usuarios
                </Link>
              </li>
              {/* Nuevo enlace para Gestión de Inventario */}
              <li>
                <Link to="/inventory" className="btn">
                  <i className="bi bi-box-seam me-2"></i>
                  Gestión de Inventario
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
      {userProfile?.rol === "usuario" && (
        <Button
          variant="light"
          className="new-request-btn"
          onClick={onNewRequest}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Nueva Solicitud
        </Button>
      )}
    </aside>
  );
};

export default Sidebar;