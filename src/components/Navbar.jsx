import React, { useState, useRef, useEffect } from "react";
import {
  Navbar,
  Nav,
  Container,
  Button,
  Overlay,
  Popover,
} from "react-bootstrap";
import { Bell, PersonCircle, List } from "react-bootstrap-icons";
import { NavLink } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import "../styles/Navbar.css";

const CustomNavbar = ({ onToggleSidebar, userRole, userId }) => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("userProfile");
    localStorage.removeItem("sessionTime");
    navigate("/login");
  };

  useEffect(() => {
    if (!userId) return;

    const fetchUserNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notificaciones")
          .select("*")
          .eq("user_id", userId) // userId es el ID de autenticación
          .eq("read", false)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
      } catch (error) {
        console.error("Error fetching notifications:", error.message);
      }
    };

    fetchUserNotifications();

    const subscription = supabase
      .channel(`notificaciones:user_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!payload.new.read) {
            setNotifications((prev) => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  return (
    <Navbar
      bg="dark"
      variant="dark"
      expand="lg"
      className="shadow-sm fixed-top"
    >
      <Container fluid>
        <Button variant="dark" onClick={onToggleSidebar} className="me-2">
          <List size={20} />
        </Button>
        <Navbar.Brand href="#" className="ms-2">
          Cámara de Industriales
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="navbarSupportedContent" />
        <Navbar.Collapse id="navbarSupportedContent">
          <Nav className="me-auto mb-2 mb-lg-0">
            <Nav.Link as={NavLink} to="/" end>
              Home
            </Nav.Link>
            <Nav.Link as={NavLink} to="/solicitudes">
              Solicitudes
            </Nav.Link>
          </Nav>
          <Nav className="d-flex align-items-center">
            <Nav.Link
              href="#"
              className="me-3 position-relative"
              onClick={handleNotificationClick}
              ref={notificationRef}
            >
              <Bell size={20} />
              <span
                className="badge bg-danger rounded-pill position-absolute"
                style={{ top: "-5px", right: "-5px" }}
              >
                {notifications.length}
              </span>
            </Nav.Link>
            <Overlay
              show={showNotifications}
              target={notificationRef.current}
              placement="bottom"
              container={document.body}
              rootClose
              onHide={() => setShowNotifications(false)}
            >
              <Popover id="notifications-popover">
                <Popover.Header as="h3">Notificaciones</Popover.Header>
                <Popover.Body>
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="notification-item border-bottom p-2"
                      >
                        <h6 className="mb-1">{notification.title}</h6>
                        <p className="mb-1 text-muted small">
                          {notification.description}
                        </p>
                        <small className="text-muted">
                          {new Date(
                            notification.created_at
                          ).toLocaleDateString()}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="m-0">No hay notificaciones</p>
                  )}
                </Popover.Body>
              </Popover>
            </Overlay>
            <Nav.Link
              href="#"
              className="position-relative"
              onClick={handleProfileClick}
              ref={profileRef}
            >
              <PersonCircle size={20} />
            </Nav.Link>
            <Overlay
              show={showProfileMenu}
              target={profileRef.current}
              placement="bottom"
              container={document.body}
              rootClose
              onHide={() => setShowProfileMenu(false)}
            >
              <Popover id="profile-popover">
                <Popover.Body>
                  <Button
                    variant="outline-danger"
                    onClick={handleLogout}
                    size="sm"
                  >
                    Cerrar sesión
                  </Button>
                </Popover.Body>
              </Popover>
            </Overlay>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default CustomNavbar;