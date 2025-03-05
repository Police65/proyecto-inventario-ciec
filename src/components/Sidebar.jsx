import React from 'react';
import { Button } from 'react-bootstrap';

const Sidebar = ({ onNewRequest }) => {
  return (
    <aside className="bg-primary text-white min-vh-100 p-4" style={{ width: '250px' }}>
      <h1 className="text-2xl font-bold">Cámara de Industriales</h1>
      <nav className="mt-5">
        <ul className="list-unstyled">
          <li className="mb-3"><a href="#" className="text-white d-block p-2 hover:bg-blue-500">Home</a></li>
          <li className="mb-3"><a href="#" className="text-white d-block p-2 hover:bg-blue-500">Solicitudes</a></li>
          <li className="mb-3"><a href="#" className="text-white d-block p-2 hover:bg-blue-500">Reportes</a></li>
        </ul>
      </nav>
      <Button variant="light" className="w-100 mt-5" onClick={onNewRequest}>
        Nueva Solicitud
      </Button>
    </aside>
  );
};

export default Sidebar;