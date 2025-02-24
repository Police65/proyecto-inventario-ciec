-- Tabla Proveedor
CREATE TABLE Proveedor (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT,
    rif VARCHAR(50),
    telefono VARCHAR(50),
    correo VARCHAR(255),
    pagina_web VARCHAR(255)
);

-- Tabla Producto
CREATE TABLE Producto (
    id SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    precio_unitario DECIMAL(10, 2),
    unidad VARCHAR(50),
    proveedor_id INT,
    FOREIGN KEY (proveedor_id) REFERENCES Proveedor(id)
);

-- Tabla OrdenCompra
CREATE TABLE OrdenCompra (
    id SERIAL PRIMARY KEY,
    fecha_orden DATE NOT NULL,
    numero_orden VARCHAR(100),
    estado VARCHAR(50),
    observaciones TEXT,
    factura TEXT,
    proveedor_id INT,
    departamento_id INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Activo',
    changed_by INT,
    FOREIGN KEY (proveedor_id) REFERENCES Proveedor(id),
    FOREIGN KEY (departamento_id) REFERENCES Departamento(id),
    FOREIGN KEY (changed_by) REFERENCES Usuario(id)
);

-- Tabla OrdenProducto (M:N entre OrdenCompra y Producto)
CREATE TABLE OrdenProducto (
    id SERIAL PRIMARY KEY,
    orden_compra_id INT,
    producto_id INT,
    cantidad INT NOT NULL,
    FOREIGN KEY (orden_compra_id) REFERENCES OrdenCompra(id),
    FOREIGN KEY (producto_id) REFERENCES Producto(id)
);

-- Tabla Departamento
CREATE TABLE Departamento (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

-- Tabla Empleado
CREATE TABLE Empleado (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cargo_actual_id INT,
    firma BYTEA,
    departamento_id INT,
    FOREIGN KEY (cargo_actual_id) REFERENCES Cargo(id),
    FOREIGN KEY (departamento_id) REFERENCES Departamento(id)
);

-- Tabla Cargo
CREATE TABLE Cargo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    departamento_id INT,
    FOREIGN KEY (departamento_id) REFERENCES Departamento(id)
);

-- Tabla EmpleadoCargoHistorial (M:N entre Empleado y Cargo)
CREATE TABLE EmpleadoCargoHistorial (
    id SERIAL PRIMARY KEY,
    empleado_id INT,
    cargo_id INT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    FOREIGN KEY (empleado_id) REFERENCES Empleado(id),
    FOREIGN KEY (cargo_id) REFERENCES Cargo(id)
);

-- Tabla Usuario
CREATE TABLE Usuario (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol VARCHAR(50),
    empleado_id INT UNIQUE,
    FOREIGN KEY (empleado_id) REFERENCES Empleado(id)
);

-- Tabla CamaradeIndustriales
CREATE TABLE CamaradeIndustriales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT,
    web VARCHAR(255),
    correo VARCHAR(255),
    telefonos VARCHAR(255),
    rif VARCHAR(50)
);
