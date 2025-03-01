// src/App.js
import React, { useState } from 'react';
import NewRequestForm from './components/NewRequestForm';
import './App.css';

function App() {
    const [showForm, setShowForm] = useState(false); // Estado para mostrar/ocultar el formulario

    return (
        <div className="bg-gray-100 font-family-karla flex">
         
            <aside className="relative bg-sidebar h-screen w-64 hidden sm:block shadow-xl">
                <div className="p-6">
                    <a href="index.html" className="text-white text-3xl font-semibold uppercase hover:text-gray-300">Cámara de Industriales</a>
                    <button
                        onClick={() => setShowForm(!showForm)} // Mostrar/ocultar el formulario
                        className="w-full bg-white cta-btn font-semibold py-2 mt-5 rounded-br-lg rounded-bl-lg rounded-tr-lg shadow-lg hover:shadow-xl hover:bg-gray-300 flex items-center justify-center"
                    >
                        <i className="fas fa-plus mr-3"></i> Nueva solicitud
                    </button>
                </div>
                <nav className="text-white text-base font-semibold pt-3">
                    <a href="index.html" className="flex items-center active-nav-link text-white py-4 pl-6 nav-item">
                        <i className="fas fa-tachometer-alt mr-3"></i>
                        Panel Principal
                    </a>
                    <a href="orders.html" className="flex items-center text-white opacity-75 hover:opacity-100 py-4 pl-6 nav-item">
                        <i className="fas fa-list mr-3"></i>
                        Solicitudes de Compra
                    </a>
                    <a href="reports.html" className="flex items-center text-white opacity-75 hover:opacity-100 py-4 pl-6 nav-item">
                        <i className="fas fa-file-alt mr-3"></i>
                        Reportes
                    </a>
                </nav>
                <a href="#" className="absolute w-full upgrade-btn bottom-0 active-nav-link text-white flex items-center justify-center py-4">
                    <i className="fas fa-arrow-circle-up mr-3"></i>
                    Upgrade to Pro!
                </a>
            </aside>

            <div className="w-full flex flex-col h-screen overflow-y-hidden">
           
                <header className="w-full items-center bg-white py-2 px-6 hidden sm:flex">
                    <div className="w-1/2"></div>
                    <div className="relative w-1/2 flex justify-end">
                        <button className="realtive z-10 w-12 h-12 rounded-full overflow-hidden border-4 border-gray-400 hover:border-gray-300 focus:border-gray-300 focus:outline-none">
                            <img src="https://source.unsplash.com/uJ8LNVCBjFQ/400x400" alt="User" />
                        </button>
                    </div>
                </header>

                {showForm && (
                    <div className="leading-loose flex items-center justify-center h-screen">
                        <NewRequestForm />
                    </div>
                )}

        
                <div className="w-full overflow-x-hidden border-t flex flex-col">
                    <main className="w-full flex-grow p-6">
                        <h1 className="text-3xl text-black pb-6">Panel Principal</h1>
          
                    </main>
                </div>
            </div>
        </div>
    );
}

export default App;