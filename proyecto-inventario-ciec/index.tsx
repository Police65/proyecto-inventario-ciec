
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary'; // Componente para manejo de errores globales

// Tailwind CSS se carga a través de CDN en index.html, no se necesita importar CSS aquí.

const rootElement = document.getElementById('root');
if (!rootElement) {
  // Este error es crítico y detiene la app si el elemento raíz no existe.
  throw new Error("No se pudo encontrar el elemento raíz '#root' para montar la aplicación. Verifica tu index.html.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);