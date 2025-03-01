CREATE TABLE Inventario (
    id SERIAL PRIMARY KEY,
    producto_id INT UNIQUE REFERENCES Producto(id) ON DELETE CASCADE,
    cantidad_disponible INT NOT NULL,
    ubicacion TEXT,
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    changed_by INT REFERENCES Usuario(id)
);
