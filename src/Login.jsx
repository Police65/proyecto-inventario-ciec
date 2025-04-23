import "./styles/login.css";
import { Link } from "react-router-dom";
import React, { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { supabase } from "./supabaseClient.js";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(true);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
  
      if (error) throw error;
  
      // Consultar perfil sin relación automática
      const { data: profile, error: profileError } = await supabase
        .from("user_profile")
        .select(`
          id,
          rol,
          empleado_id,
          departamento_id
        `)
        .eq("id", data.user.id)
        .single();
  
      if (profileError) throw profileError;
  
      // Consultar datos del empleado por separado
      const { data: empleado, error: empleadoError } = await supabase
        .from("empleado")
        .select("id, estado")
        .eq("id", profile.empleado_id)
        .single();
  
      if (empleadoError) throw empleadoError;
  
      // Combinar los datos
      const combinedProfile = {
        ...profile,
        empleado: empleado || null
      };
  
      // Verificar estado del empleado
      if (combinedProfile && combinedProfile.empleado?.estado === 'activo') {
        onLogin(combinedProfile);
        setShow(false);
      } else {
        throw new Error("Usuario inactivo. Contacta al administrador.");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };
  
  return (
    <div className="addUser">
      <h3>Iniciar Sesión</h3>
      <form className="addUserForm" onSubmit={handleLogin}>
        <div className="inputGroup">
          <Form.Group controlId="formEmail">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="Ingrese su email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Form.Group>
          <Form.Group controlId="formPassword">
            <Form.Label>Contraseña</Form.Label>
            <Form.Control
              type="password"
              placeholder="Ingrese su contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </Form.Group>

          <button type="submit" class="btn-config ">
            Login
          </button>
        </div>
      </form>
    </div>
  );
};

export default Login;