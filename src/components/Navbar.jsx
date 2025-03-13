import React, { useState, useRef, useEffect } from 'react';
import { Navbar, Nav, Container, Button, Overlay, Popover } from 'react-bootstrap';
import { Bell, PersonCircle, Cart, List } from 'react-bootstrap-icons';
// Se importa supabase para consultar las notificaciones y realizar el sign out
import { supabase } from '../supabaseClient';
import ModoOscuro from './ModoOscuro'; 
const CustomNavbar = ({ onToggleSidebar, userRole, userId }) => {

  const [showNotifications, setShowNotifications] = useState(false);

  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  
  // Estado para controlar si se muestra el popover del menú de perfil (para cerrar sesión)
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  // Referencia para el ícono de perfil
  const profileRef = useRef(null);
  
  // Función para alternar la visibilidad del popover de notificaciones
  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };
  
  // Función para alternar la visibilidad del popover del menú de perfil
  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };
  // Función para cerrar la sesión y redirigir al formulario de login
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión:', error);
    } else {
      // Redirige al formulario de inicio de sesión (ajusta la ruta según tu proyecto)
      window.location.href = 'vite-react-bootstrap/login';
    }
  };
  // useEffect para cargar las notificaciones dinámicamente
  useEffect(() => {
    if (userRole !== 'admin') {
      // Consulta las notificaciones para un usuario específico
      const fetchUserNotifications = async () => {
        const { data, error } = await supabase
          .from('notificaciones')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          setNotifications(data);
        }
      };
      fetchUserNotifications();
      // Opcional: suscribirse a cambios en tiempo real para actualizar las notificaciones
    } else {
      // Notificaciones de ejemplo para admin
      setNotifications([
        {
          id: 1,
          title: 'Nueva solicitud de compra',
          description: 'Departamento de IT requiere materiales',
          date: '2024-01-20'
        },
        {
          id: 2,
          title: 'Solicitud pendiente',
          description: 'Orden #123 requiere aprobación',
          date: '2024-01-19'
        }
      ]);
    }
  }, [userRole, userId]);
  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="shadow-sm fixed-top">
            <Container fluid>
                {/* Botón para alternar el sidebar */}
                <Button variant="dark" onClick={onToggleSidebar} className="me-2">
                    <List size={20} />
                </Button>
                
                <Navbar.Brand href="#" className="ms-2">
                    Cámara de Industriales
                </Navbar.Brand>
                
                <Navbar.Toggle aria-controls="navbarSupportedContent" />
                
                <Navbar.Collapse id="navbarSupportedContent">
                    <Nav className="me-auto mb-2 mb-lg-0">
                        <Nav.Link href="#">Home</Nav.Link>
                        <Nav.Link href="#">Solicitudes</Nav.Link>
                        <Nav.Link href="#">Reportes</Nav.Link>
                    </Nav>
                    
                    <Nav className="d-flex align-items-center gap-2">
                        {/* Añadir ModoOscuro aquí */}
                        <ModoOscuro />
                        
                        {/* Icono del carrito */}
                        <Nav.Link href="#" className="me-3">
                            <Cart size={20} />
                        </Nav.Link>
                        
                        {/* ... (resto del código existente) */}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
  );
};
export default CustomNavbar;