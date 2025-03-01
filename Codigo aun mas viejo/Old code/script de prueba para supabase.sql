-- Crear tabla de Usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol VARCHAR(50) CHECK (rol IN ('normal', 'admin')) NOT NULL DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de Proyectos (Tesis)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    archivo_url TEXT NOT NULL, -- URL del PDF almacenado en Supabase Storage
    usuario_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Crear tabla de Comentarios
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    texto TEXT NOT NULL,
    usuario_id INT NOT NULL,
    proyecto_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (proyecto_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Crear tabla de Descargas (Para registrar quién ha descargado cada tesis)
CREATE TABLE downloads (
    id SERIAL PRIMARY KEY,
    usuario_id INT,  -- Puede ser NULL si no requiere inicio de sesión
    proyecto_id INT NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (proyecto_id) REFERENCES projects(id) ON DELETE CASCADE
);
