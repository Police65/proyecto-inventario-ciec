-- Eliminamos tablas si existen para evitar conflictos al recrearlas
DROP TABLE IF EXISTS Inventario, OrdenProducto, OrdenCompra, Producto, Proveedor, Departamento, EmpleadoCargoHistorial, Cargo, Empleado, Usuario, CamaraIndustriales CASCADE;

-- Tabla de Usuario
CREATE TABLE Usuario (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol VARCHAR(20) CHECK (rol IN ('admin', 'usuario'))
);

-- Tabla de Cámara de Industriales
CREATE TABLE CamaraIndustriales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT NOT NULL,
    web VARCHAR(255),
    correo VARCHAR(100),
    telefonos VARCHAR(100),
    rif VARCHAR(50) UNIQUE NOT NULL
);

-- Tabla de Proveedor
CREATE TABLE Proveedor (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT NOT NULL,
    rif VARCHAR(50) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    correo VARCHAR(100),
    pagina_web VARCHAR(255)
);

-- Tabla de Producto
CREATE TABLE Producto (
    id SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    unidad VARCHAR(10) CHECK (unidad IN ('Bs', 'USD')),
    proveedor_id INT NOT NULL REFERENCES Proveedor(id) ON DELETE CASCADE
);

-- Tabla de Inventario
CREATE TABLE Inventario (
    id SERIAL PRIMARY KEY,
    producto_id INT UNIQUE NOT NULL REFERENCES Producto(id) ON DELETE CASCADE,
    cantidad_disponible INT NOT NULL DEFAULT 0,
    ubicacion TEXT NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT now(),
    changed_by INT REFERENCES Usuario(id) ON DELETE SET NULL
);

-- Tabla de Departamento
CREATE TABLE Departamento (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

-- Tabla de Cargo
CREATE TABLE Cargo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    departamento_id INT NOT NULL REFERENCES Departamento(id) ON DELETE CASCADE
);

-- Tabla de Empleado
CREATE TABLE Empleado (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cargo_actual_id INT NOT NULL REFERENCES Cargo(id) ON DELETE SET NULL,
    firma TEXT,
    departamento_id INT NOT NULL REFERENCES Departamento(id) ON DELETE CASCADE
);

-- Relación 1:1 entre Usuario y Empleado
ALTER TABLE Usuario ADD COLUMN empleado_id INT UNIQUE REFERENCES Empleado(id) ON DELETE CASCADE;

-- Tabla Historial de Cargos
CREATE TABLE EmpleadoCargoHistorial (
    id SERIAL PRIMARY KEY,
    empleado_id INT NOT NULL REFERENCES Empleado(id) ON DELETE CASCADE,
    cargo_id INT NOT NULL REFERENCES Cargo(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE
);

-- Tabla de Orden de Compra
CREATE TABLE OrdenCompra (
    id SERIAL PRIMARY KEY,
    fecha_orden TIMESTAMP DEFAULT now(),
    numero_orden VARCHAR(50) UNIQUE NOT NULL,
    estado VARCHAR(20) CHECK (estado IN ('Pendiente', 'Aprobada', 'Anulada')) NOT NULL,
    observaciones TEXT,
    factura TEXT, -- Puede ser un enlace o ruta de archivo
    proveedor_id INT NOT NULL REFERENCES Proveedor(id) ON DELETE CASCADE,
    departamento_id INT NOT NULL REFERENCES Departamento(id) ON DELETE CASCADE,
    empleado_id INT NOT NULL REFERENCES Empleado(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP DEFAULT now(),
    fecha_modificacion TIMESTAMP DEFAULT now(),
    fecha_eliminacion TIMESTAMP,
    status BOOLEAN DEFAULT TRUE, -- TRUE = Activo, FALSE = Eliminado
    changed_by INT REFERENCES Usuario(id) ON DELETE SET NULL
);

-- Tabla intermedia Orden-Producto (relación N:M)
CREATE TABLE OrdenProducto (
    id SERIAL PRIMARY KEY,
    orden_compra_id INT NOT NULL REFERENCES OrdenCompra(id) ON DELETE CASCADE,
    producto_id INT NOT NULL REFERENCES Producto(id) ON DELETE CASCADE,
    cantidad INT NOT NULL CHECK (cantidad > 0)
);

-- Trigger para actualizar automáticamente fecha_modificacion en OrdenCompra
CREATE OR REPLACE FUNCTION actualizar_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actualizar_fecha_modificacion_trigger
BEFORE UPDATE ON OrdenCompra
FOR EACH ROW
EXECUTE FUNCTION actualizar_fecha_modificacion();
