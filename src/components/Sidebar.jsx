import React from 'react';
import { Button } from 'react-bootstrap';
const Sidebar = ({ isVisible, onNewRequest, onSelectTab, userProfile, pendingRequests = [] }) => {
  return (
    <aside
      className={`bg-primary text-white min-vh-100 p-4 ${isVisible ? 'visible' : 'hidden'}`}
      style={{
        width: '250px',
        position: 'fixed',
        top: '56px',
        left: isVisible ? '0' : '-250px',
        transition: 'left 0.3s',
        zIndex: 1000,
      }}
    >
      <h1 className="h4 mb-4">Cámara de Industriales</h1>
      <nav>
        <ul className="list-unstyled">
          <li className="mb-2">
            {/* Ponemos white-space: nowrap en el botón para evitar el salto de línea */}
            <button
              className="btn btn-link text-white w-100 text-start p-2 hover-bg-blue"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => onSelectTab('solicitudes')}
            >
              <i className="bi bi-list-task me-2"></i>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                Solicitudes
                <span
                  className="bg-danger d-flex justify-content-center align-items-center"
                  style={{
                    display: 'inline-flex',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    marginLeft: '8px',
                    fontSize: '12px',
                    color: 'white',
                    verticalAlign: 'middle',
                    marginTop: '-10%',
                  }}
                >
                 {pendingRequests.length}
                </span>
              </span>
            </button>
          </li>
          <li className="mb-2">
            <button
              className="btn btn-link text-white w-100 text-start p-2 hover-bg-blue"
              onClick={() => onSelectTab('historial')}
            >
              <i className="bi bi-clock-history me-2"></i>
              Historial
            </button>
          </li>
          {userProfile?.rol === 'admin' && (
            <li className="mb-2">
              <button
                className="btn btn-link text-white w-100 text-start p-2 hover-bg-blue"
                onClick={() => onSelectTab('ordenes')}
              >
                <i className="bi bi-file-earmark-text me-2"></i>
                Órdenes
              </button>
            </li>
          )}
        </ul>
      </nav>
      {userProfile?.rol === 'usuario' && (
        <Button variant="light" className="w-100 mt-4" onClick={onNewRequest}>
          <i className="bi bi-plus-circle me-2"></i>
          Nueva Solicitud
        </Button>
      )}
    </aside>
  );
};
export default Sidebar;