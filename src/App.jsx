import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Container, Modal, Button } from "react-bootstrap";
import Sidebar from "./components/Sidebar";
import CustomNavbar from "./components/Navbar";
import RequestForm from "./components/RequestForm";
import RequestTable from "./components/RequestTable";
import AdminDashboard from "./components/AdminDashboard";
import Home from "./components/Home";
import AdminHome from "./components/AdminHome";
import Login from "./Login";
import { supabase } from "./supabaseClient";
import ModoOscuro from "./components/ModoOscuro";
import { generateDescription } from "./components/generateDescription.js";

const INACTIVITY_WARNING_TIME = 10 * 60 * 1000; // 10 minutos en milisegundos
const INACTIVITY_LOGOUT_TIME = 15 * 60 * 1000; // 15 minutos en milisegundos
const COUNTDOWN_INTERVAL = 1000; // 1 segundo

const checkStoredSession = () => {
  const storedUser = localStorage.getItem("userProfile");
  const storedTime = localStorage.getItem("sessionTime");

  if (storedUser && storedTime) {
    const timeElapsed = Date.now() - parseInt(storedTime);
    if (timeElapsed < INACTIVITY_LOGOUT_TIME) {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.empleado_id && parsedUser.rol) {
        return parsedUser;
      }
    }
  }
  return null;
};

function AuthenticatedLayout({
  userProfile,
  showForm,
  setShowForm,
  requests,
  orders,
  isSidebarVisible,
  toggleSidebar,
  activeTab,
  setActiveTab,
  handleSubmitRequest,
  getFilteredRequests,
}) {
  return (
    <>
      <CustomNavbar
        onToggleSidebar={toggleSidebar}
        userRole={userProfile.rol}
        userId={userProfile.id}
      />
      <Sidebar
        isVisible={isSidebarVisible}
        onNewRequest={() => setShowForm(true)}
        onSelectTab={setActiveTab}
        userProfile={userProfile}
        pendingRequests={getFilteredRequests(["Pendiente"], true)}
      />
      <div
        style={{
          marginLeft: isSidebarVisible ? "250px" : "0",
          marginTop: "56px",
          padding: "20px",
          transition: "margin-left 0.3s",
          minHeight: "calc(100vh - 56px)",
          backgroundColor: "#212529",
        }}
      >
        <Container fluid>
          <Routes>
            <Route path="/home" element={userProfile.rol === 'admin' ? <AdminHome userProfile={userProfile} /> : <Home userProfile={userProfile} />} />
            <Route
              path="/solicitudes"
              element={
                userProfile.rol === "admin" ? (
                  <AdminDashboard
                    activeTab={activeTab}
                    solicitudesPendientes={getFilteredRequests(["Pendiente"])}
                    solicitudesHistorial={getFilteredRequests(["Aprobada", "Rechazada"])}
                    ordenesHistorial={orders}
                    userProfile={userProfile}
                  />
                ) : (
                  <>
                    {activeTab === "solicitudes" && (
                      <RequestTable requests={getFilteredRequests(["Pendiente"], true)} />
                    )}
                    {activeTab === "historial" && (
                      <RequestTable requests={getFilteredRequests(["Aprobada", "Rechazada"], true)} />
                    )}
                  </>
                )
              }
            />
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Container>
      </div>
      {userProfile.rol === "usuario" && (
        <RequestForm
          show={showForm}
          onHide={() => setShowForm(false)}
          onSubmit={handleSubmitRequest}
        />
      )}
    </>
  );
}

function App() {
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("solicitudes");
  const [userProfile, setUserProfile] = useState(checkStoredSession());
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5 * 60); // 5 minutos en segundos

  const inactivityWarningTimer = useRef(null);
  const inactivityLogoutTimer = useRef(null);
  const countdownTimer = useRef(null);

  const fetchRequests = async () => {
    try {
      const baseQuery = supabase
        .from("solicitudcompra")
        .select(
          `
          *,
          detalles:solicitudcompra_detalle(
            *,
            producto:producto_id(*)
          ),
          empleado:empleado_id(nombre, apellido),
          departamento:departamento_id(nombre)
        `
        )
        .order("fecha_solicitud", { ascending: false });

      let queryResult =
        userProfile?.rol === "admin"
          ? await baseQuery
          : await baseQuery.eq("empleado_id", userProfile?.empleado_id);

      if (queryResult.error) throw queryResult.error;
      setRequests(queryResult.data || []);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
      alert("Error al cargar las solicitudes");
    }
  };

  useEffect(() => {
    if (userProfile) {
      fetchRequests();
    }
  }, [userProfile]);

  const resetInactivityTimers = () => {
    clearTimeout(inactivityWarningTimer.current);
    clearTimeout(inactivityLogoutTimer.current);
    clearInterval(countdownTimer.current);
    setShowWarningModal(false);
    setTimeLeft(5 * 60);

    inactivityWarningTimer.current = setTimeout(() => {
      setShowWarningModal(true);
      countdownTimer.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimer.current);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, COUNTDOWN_INTERVAL);
    }, INACTIVITY_WARNING_TIME);

    inactivityLogoutTimer.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_LOGOUT_TIME);
  };

  const handleActivity = () => {
    if (userProfile) {
      resetInactivityTimers();
    }
  };

  useEffect(() => {
    if (userProfile) {
      const events = ["mousemove", "keydown", "click"];
      events.forEach((e) => window.addEventListener(e, handleActivity));
      resetInactivityTimers();
      return () => {
        events.forEach((e) => window.removeEventListener(e, handleActivity));
        clearTimeout(inactivityWarningTimer.current);
        clearTimeout(inactivityLogoutTimer.current);
        clearInterval(countdownTimer.current);
      };
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem("userProfile", JSON.stringify(userProfile));
      localStorage.setItem("sessionTime", Date.now().toString());
      fetchRequests();
      fetchOrders();
    }
  }, [userProfile]);

  const getFilteredRequests = (estados, deptFilter = false) => {
    return requests.filter(
      (request) =>
        estados.includes(request.estado) &&
        (userProfile?.rol === "admin" ||
          request.empleado_id === userProfile?.empleado_id ||
          (deptFilter && request.departamento_id === userProfile?.departamento_id))
    );
  };

  const handleSubmitRequest = async (requestData) => {
    try {
      if (!userProfile?.empleado_id) {
        throw new Error("Usuario no tiene empleado asociado");
      }

      let descripcion = "Solicitud múltiple";
      if (!requestData.customRequest && requestData.products) {
        console.log("Generando descripción para:", requestData.products);
        descripcion = await generateDescription(requestData.products);
      } else if (requestData.description) {
        descripcion = requestData.description;
      }

      const { data: solicitud, error } = await supabase
        .from("solicitudcompra")
        .insert([
          {
            descripcion: descripcion,
            estado: "Pendiente",
            empleado_id: userProfile.empleado_id,
            departamento_id: userProfile.departamento_id,
          },
        ])
        .select("id");

      if (error) throw error;

      if (!requestData.customRequest && requestData.products) {
        const inserts = requestData.products.map((product) => ({
          solicitud_compra_id: solicitud[0].id,
          producto_id: product.productId,
          cantidad: product.quantity,
        }));

        const { error: detalleError } = await supabase
          .from("solicitudcompra_detalle")
          .insert(inserts);

        if (detalleError) throw detalleError;
      }

      const { data: admins, error: adminsError } = await supabase
        .from("user_profile")
        .select("id")
        .eq("rol", "admin");

      if (adminsError) throw adminsError;

      const notificationInserts = admins.map((admin) => ({
        user_id: admin.id,
        title: "Nueva Solicitud de Compra",
        description: `Se ha creado una nueva solicitud de compra con ID ${solicitud[0].id}`,
        created_at: new Date().toISOString(),
        type: "solicitud_compra",
        read: false,
      }));

      const { error: notificationError } = await supabase
        .from("notificaciones")
        .insert(notificationInserts);

      if (notificationError) throw notificationError;

      await fetchRequests();
      setShowForm(false);
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("ordencompra")
        .select(
          `
          *,
          proveedor:proveedor_id(*),
          productos:ordencompra_detalle(
            *,
            producto:producto_id(*)
          ),
          empleado:empleado_id(*),
          solicitud_compra:solicitud_compra_id(*)
        `
        )
        .order("fecha_orden", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error cargando órdenes:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("userProfile");
    localStorage.removeItem("sessionTime");
    setUserProfile(null);
    clearTimeout(inactivityWarningTimer.current);
    clearTimeout(inactivityLogoutTimer.current);
    clearInterval(countdownTimer.current);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            !userProfile ? (
              <Login
                onLogin={(profile) => {
                  if (!profile.empleado_id) {
                    alert(
                      "Tu usuario no está asociado a un empleado. Contacta al administrador."
                    );
                    return;
                  }
                  setUserProfile({
                    ...profile,
                    empleado_id: profile.empleado_id,
                  });
                }}
              />
            ) : (
              <Navigate to="/home" replace />
            )
          }
        />
        <Route
          path="/*"
          element={
            userProfile ? (
              <>
                <AuthenticatedLayout
                  userProfile={userProfile}
                  showForm={showForm}
                  setShowForm={setShowForm}
                  requests={requests}
                  orders={orders}
                  isSidebarVisible={isSidebarVisible}
                  toggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  handleSubmitRequest={handleSubmitRequest}
                  getFilteredRequests={getFilteredRequests}
                />
                <Modal show={showWarningModal} onHide={() => {}} backdrop="static" keyboard={false}>
                  <Modal.Header>
                    <Modal.Title>Sesión a punto de expirar</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <p>Tu sesión se cerrará en {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')} debido a inactividad.</p>
                    <p>¿Deseas mantener la sesión abierta?</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onClick={handleLogout}>
                      Cerrar sesión ahora
                    </Button>
                    <Button variant="primary" onClick={handleActivity}>
                      Mantener sesión
                    </Button>
                  </Modal.Footer>
                </Modal>
              </>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;