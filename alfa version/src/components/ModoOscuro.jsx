import React, { useEffect, useState } from 'react';

const ModoOscuro = () => {
    const [modo, setModo] = useState("dark");

    useEffect(() => {
        const htmlElement = document.documentElement;
        htmlElement.setAttribute("data-bs-theme", modo);
        
        // Aplicar el fondo según el tema
        document.body.style.backgroundColor = modo === "dark" 
            ? "#212529" 
            : "#f8f9fa";
            
    }, [modo]); 

    return (
        <div className="btn-group" role="group">
            <button 
                className='btn btn-primary'
                onClick={() => setModo("dark")}
                title="Modo oscuro"
            >
                <i className="bi bi-moon-fill"></i>
            </button>
            <button 
                className='btn btn-primary'
                onClick={() => setModo("light")}
                title="Modo claro"
            >
                <i className="bi bi-sun-fill"></i>
            </button>
        </div>
    );
};

export default ModoOscuro;