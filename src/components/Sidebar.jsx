import React from 'react';
import { Button } from 'react-bootstrap';

const Sidebar = ({ isVisible, onNewRequest, onSelectTab, userProfile }) => {
  return (
    <aside
      className={`bg-primary text-white min-vh-100 p-4 ${isVisible ? 'visible' : 'hidden'}`}
      style={{
        width: '250px',
        position: 'fixed',
        top: '56px',
        left: isVisible ? '0' : '-250px', // Mueve la sidebar fuera de la pantalla cuando no esté visible
        transition: 'left 0.3s',
        zIndex: 1000,
      }}
    >
      <h1 className="text-2xl font-bold">Cámara de Industriales</h1>
      <nav className="mt-5">
        <ul className="list-unstyled">
          <li className="mb-3">
            <a
              href="#"
              className="text-white d-block p-2 hover:bg-blue-500"
              onClick={() => onSelectTab('home')}
            >
              Home
            </a>
          </li>
          <li className="mb-3">
            <a
              href="#"
              className="text-white d-block p-2 hover:bg-blue-500"
              onClick={() => onSelectTab('solicitudes')}
            >
              Solicitudes
            </a>
          </li>
          {userProfile.rol === 'admin' && (
            <li className="mb-3">
              <a
                href="#"
                className="text-white d-block p-2 hover:bg-blue-500"
                onClick={() => onSelectTab('ordenes')}
              >
                Órdenes
              </a>
            </li>
          )}
        </ul>
      </nav>
      {userProfile.rol === 'usuario' && (
        <Button variant="light" className="w-100 mt-5" onClick={onNewRequest}>
          Nueva Solicitud
        </Button>
      )}
    </aside>
  );
};

export default Sidebar;