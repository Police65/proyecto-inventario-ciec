// src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App'; // Importa App como un export default

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
);