import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Modal, Badge } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showCargoHistorialModal, setShowCargoHistorialModal] = useState(false);
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState(null);
  const [cargoHistorial, setCargoHistorial] = useState([]);

  // Cargar usuarios al montar el componente
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('empleado')
        .select(`
          id,
          cedula,
          nombre,
          apellido,
          cargo_actual_id,
          departamento_id,
          estado,
          cargo:cargo_actual_id (nombre),
          departamento:departamento_id (nombre)
        `)
        .order('apellido', { ascending: true });
  
      if (error) {
        throw error;
      }
  
      // Consulta separada para obtener perfiles de usuario
      const { data: profiles, error: profileError } = await supabase
        .from('user_profile')
        .select('id, empleado_id, rol');
  
      if (profileError) {
        throw profileError;
      }
  
      // Combinar datos de empleado con perfiles
      const combinedData = data.map(empleado => {
        const userProfile = profiles.find(profile => profile.empleado_id === empleado.id);
        return {
          ...empleado,
          user_profile: userProfile || null
        };
      });
  
      console.log('Datos obtenidos:', combinedData);
      if (!combinedData || combinedData.length === 0) {
        console.log('No se encontraron empleados en la base de datos.');
      }
  
      setUsers(combinedData || []);
      setFilteredUsers(combinedData || []);
    } catch (error) {
      console.error('Error al cargar empleados:', error.message);
      alert('Error al cargar empleados: ' + error.message);
    }
  };
  // Manejar búsqueda
  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    if (term === '') {
      setFilteredUsers(users); // Restablecer a la lista completa si el término está vacío
    } else {
      const filtered = users.filter(user =>
        user.nombre.toLowerCase().includes(term) ||
        user.apellido.toLowerCase().includes(term) ||
        user.cedula.toLowerCase().includes(term)
      );
      setFilteredUsers(filtered);
    }
  };

  // Cambiar estado (activo/inactivo)
  const handleToggleEstado = async (empleadoId, currentEstado) => {
    const newEstado = currentEstado === 'activo' ? 'inactivo' : 'activo';
    try {
      const { error } = await supabase
        .from('empleado')
        .update({ estado: newEstado })
        .eq('id', empleadoId);

      if (error) throw error;
      fetchUsers(); // Refrescar la lista
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar estado: ' + error.message);
    }
  };

  // Ver historial de cargos
  const handleViewCargoHistorial = async (empleadoId) => {
    setSelectedEmpleadoId(empleadoId);
    try {
      const { data, error } = await supabase
        .from('empleadocargohistorial')
        .select(`
          id,
          cargo_id,
          fecha_inicio,
          fecha_fin,
          cargo:cargo_id (nombre)
        `)
        .eq('empleado_id', empleadoId)
        .order('fecha_inicio', { ascending: false });

      if (error) throw error;
      setCargoHistorial(data || []);
      setShowCargoHistorialModal(true);
    } catch (error) {
      console.error('Error al cargar historial de cargos:', error);
      alert('Error al cargar historial: ' + error.message);
    }
  };

  // Abrir modal para añadir perfil
  const handleAddProfile = (empleadoId) => {
    setSelectedEmpleadoId(empleadoId);
    setShowAddProfileModal(true);
  };

  return (
    <div className="bg-dark rounded-3 p-4 border border-secondary">
      <h4 className="text-light mb-4">👥 Gestión de Usuarios</h4>
      
      <div className="d-flex justify-content-between mb-3">
        <Form.Control
          type="text"
          placeholder="Buscar por nombre, apellido o cédula"
          value={searchTerm}
          onChange={handleSearch}
          className="w-50"
        />
        <Button variant="primary" onClick={() => setShowAddUserModal(true)}>
          Añadir Empleado
        </Button>
      </div>

      <Table striped bordered hover variant="dark">
        <thead>
          <tr>
            <th>ID</th>
            <th>Cédula</th>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Cargo</th>
            <th>Departamento</th>
            <th>Estado</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.cedula}</td>
                <td>{user.nombre}</td>
                <td>{user.apellido}</td>
                <td>{user.cargo?.nombre || 'N/A'}</td>
                <td>{user.departamento?.nombre || 'N/A'}</td>
                <td>
                  <Badge bg={user.estado === 'activo' ? 'success' : 'danger'}>
                    {user.estado}
                  </Badge>
                </td>
                <td>
                  {user.user_profile ? (
                    <Badge bg="success">Sí</Badge>
                  ) : (
                    <Badge bg="warning">No</Badge>
                  )}
                </td>
                <td>{user.user_profile?.rol || 'N/A'}</td>
                <td>
                  <Button
                    variant={user.estado === 'activo' ? 'danger' : 'success'}
                    size="sm"
                    onClick={() => handleToggleEstado(user.id, user.estado)}
                    className="me-2"
                  >
                    {user.estado === 'activo' ? 'Inhabilitar' : 'Habilitar'}
                  </Button>
                  <Button
                    variant="info"
                    size="sm"
                    onClick={() => handleViewCargoHistorial(user.id)}
                    className="me-2"
                  >
                    Ver Historial
                  </Button>
                  {!user.user_profile && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddProfile(user.id)}
                    >
                      Añadir Perfil
                    </Button>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="10" className="text-center">
                No se encontraron empleados
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Modal para añadir empleado */}
      <AddUserModal
        show={showAddUserModal}
        onHide={() => setShowAddUserModal(false)}
        onAddUser={fetchUsers}
      />

      {/* Modal para añadir perfil de usuario */}
      <AddProfileModal
        show={showAddProfileModal}
        onHide={() => setShowAddProfileModal(false)}
        empleadoId={selectedEmpleadoId}
        onAddProfile={fetchUsers}
      />

      {/* Modal para historial de cargos */}
      <CargoHistorialModal
        show={showCargoHistorialModal}
        onHide={() => setShowCargoHistorialModal(false)}
        cargoHistorial={cargoHistorial}
      />
    </div>
  );
};

// Componente para el modal de añadir empleado
const AddUserModal = ({ show, onHide, onAddUser }) => {
  const [formData, setFormData] = useState({
    cedula: '',
    nombre: '',
    apellido: '',
    email: '',
    cargo_id: '',
    departamento_id: '',
    rol: 'usuario'
  });

  const [cargos, setCargos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  useEffect(() => {
    const fetchCargos = async () => {
      const { data } = await supabase.from('cargo').select('id, nombre');
      setCargos(data || []);
    };
    const fetchDepartamentos = async () => {
      const { data } = await supabase.from('departamento').select('id, nombre');
      setDepartamentos(data || []);
    };
    fetchCargos();
    fetchDepartamentos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Insertar empleado
      const { data: empleadoData, error: empleadoError } = await supabase
        .from('empleado')
        .insert([{
          cedula: formData.cedula,
          nombre: formData.nombre,
          apellido: formData.apellido,
          cargo_actual_id: formData.cargo_id,
          departamento_id: formData.departamento_id,
          estado: 'activo'
        }])
        .select('id')
        .single();

      if (empleadoError) throw empleadoError;

      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: 'defaultPassword123', // Considera pedir una contraseña al usuario
      });

      if (authError) throw authError;

      // Insertar perfil de usuario vinculado al empleado y al usuario de autenticación
      const { error: userProfileError } = await supabase
        .from('user_profile')
        .insert([{
          empleado_id: empleadoData.id,
          departamento_id: formData.departamento_id,
          rol: formData.rol,
          id: authData.user.id // Vincular con el ID del usuario autenticado
        }]);

      if (userProfileError) throw userProfileError;

      // Insertar en historial de cargos
      await supabase
        .from('empleadocargohistorial')
        .insert([{
          empleado_id: empleadoData.id,
          cargo_id: formData.cargo_id,
          fecha_inicio: new Date().toISOString().split('T')[0],
          fecha_fin: null
        }]);

      onAddUser();
      onHide();
    } catch (error) {
      console.error('Error al añadir empleado:', error);
      alert('Error al añadir empleado: ' + error.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Añadir Nuevo Empleado</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Cédula</Form.Label>
            <Form.Control
              type="text"
              value={formData.cedula}
              onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Apellido</Form.Label>
            <Form.Control
              type="text"
              value={formData.apellido}
              onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Correo Electrónico</Form.Label>
            <Form.Control
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Cargo</Form.Label>
            <Form.Select
              value={formData.cargo_id}
              onChange={(e) => setFormData({ ...formData, cargo_id: e.target.value })}
              required
            >
              <option value="">Seleccionar cargo</option>
              {cargos.map(cargo => (
                <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Departamento</Form.Label>
            <Form.Select
              value={formData.departamento_id}
              onChange={(e) => setFormData({ ...formData, departamento_id: e.target.value })}
              required
            >
              <option value="">Seleccionar departamento</option>
              {departamentos.map(depto => (
                <option key={depto.id} value={depto.id}>{depto.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Rol</Form.Label>
            <Form.Select
              value={formData.rol}
              onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
            >
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </Form.Select>
          </Form.Group>
          <Button variant="primary" type="submit">
            Añadir Empleado
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

// Componente para el modal de añadir perfil de usuario
const AddProfileModal = ({ show, onHide, empleadoId, onAddProfile }) => {
  const [rol, setRol] = useState('usuario');
  const [departamentos, setDepartamentos] = useState([]);
  const [departamentoId, setDepartamentoId] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const fetchDepartamentos = async () => {
      const { data } = await supabase.from('departamento').select('id, nombre');
      setDepartamentos(data || []);
    };
    fetchDepartamentos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: 'defaultPassword123', // Considera pedir una contraseña al usuario
      });

      if (authError) throw authError;

      // Insertar perfil de usuario
      const { error } = await supabase
        .from('user_profile')
        .insert([{
          empleado_id: empleadoId,
          departamento_id: departamentoId,
          rol: rol,
          id: authData.user.id // Vincular con el ID del usuario autenticado
        }]);

      if (error) throw error;

      onAddProfile();
      onHide();
    } catch (error) {
      console.error('Error al añadir perfil:', error);
      alert('Error al añadir perfil: ' + error.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Añadir Perfil de Usuario</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Correo Electrónico</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Departamento</Form.Label>
            <Form.Select
              value={departamentoId}
              onChange={(e) => setDepartamentoId(e.target.value)}
              required
            >
              <option value="">Seleccionar departamento</option>
              {departamentos.map(depto => (
                <option key={depto.id} value={depto.id}>{depto.nombre}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Rol</Form.Label>
            <Form.Select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
            >
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </Form.Select>
          </Form.Group>
          <Button variant="primary" type="submit">
            Añadir Perfil
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

// Componente para el modal de historial de cargos
const CargoHistorialModal = ({ show, onHide, cargoHistorial }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="bg-dark text-light">
        <Modal.Title>Historial de Cargos</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <Table striped bordered hover variant="dark">
          <thead>
            <tr>
              <th>Cargo</th>
              <th>Fecha Inicio</th>
              <th>Fecha Fin</th>
            </tr>
          </thead>
          <tbody>
            {cargoHistorial.map(hist => (
              <tr key={hist.id}>
                <td>{hist.cargo?.nombre || 'N/A'}</td>
                <td>{new Date(hist.fecha_inicio).toLocaleDateString()}</td>
                <td>{hist.fecha_fin ? new Date(hist.fecha_fin).toLocaleDateString() : 'Actual'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
    </Modal>
  );
};

export default UserManagement;