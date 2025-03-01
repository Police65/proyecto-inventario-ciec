import React from 'react';

const Sidebar = () => {
  return (
    <aside className="relative bg-blue-600 h-screen w-64 hidden sm:block shadow-xl">
      <div className="p-6">
        <a href="/" className="text-white text-3xl font-semibold uppercase hover:text-gray-300">Cámara de Industriales</a>
        <button className="w-full bg-white text-blue-600 font-semibold py-2 mt-5 rounded-br-lg rounded-bl-lg rounded-tr-lg shadow-lg hover:shadow-xl hover:bg-gray-300 flex items-center justify-center">
          <i className="fas fa-plus mr-3"></i> Nueva solicitud
        </button>
      </div>
      <nav className="text-white text-base font-semibold pt-3">
        <a href="/" className="flex items-center bg-blue-700 text-white py-4 pl-6 nav-item">
          <i className="fas fa-tachometer-alt mr-3"></i>
          Panel Principal
        </a>
        <a href="/orders" className="flex items-center text-white opacity-75 hover:opacity-100 py-4 pl-6 nav-item">
          <i className="fas fa-list mr-3"></i>
          Solicitudes de Compra
        </a>
        <a href="/reports" className="flex items-center text-white opacity-75 hover:opacity-100 py-4 pl-6 nav-item">
          <i className="fas fa-file-alt mr-3"></i>
          Reportes
        </a>
      </nav>
    </aside>
  );
};

export default Sidebar;