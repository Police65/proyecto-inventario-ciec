// src/App.js
import React from 'react';
import ReactDOM from 'react-dom';
import NewRequestForm from './components/NewRequestForm';
import './App.css';

function App() {
    return (
        <div>
            <NewRequestForm />
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));