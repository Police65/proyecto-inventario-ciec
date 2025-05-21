import React, { useState } from "react";
import { Card, Button, Tab, Tabs } from "react-bootstrap";
import { supabase } from "../supabaseClient";

const API_URL = import.meta.env.VITE_APP_OPENROUTER_API_URL;
const API_KEY = import.meta.env.VITE_APP_OPENROUTER_API_KEY;

const AIInsights = () => {
  const [activeTab, setActiveTab] = useState("auditor");
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchAIResponse = async (prompt) => {
    try {
      if (!API_KEY || !API_URL) {
        throw new Error("Faltan las credenciales de OpenRouter en el archivo .env");
      }
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-70b-instruct",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Error en la API: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      } else {
        return "No se encontró respuesta válida";
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      return "Error al generar respuesta";
    }
  };

  const handleGenerateInsight = async (type) => {
    setLoading(true);
    let prompt = "";
    try {
      switch (type) {
        case "auditor":
          const { data: orders, error: ordersError } = await supabase
            .from("ordencompra")
            .select(`
              neto_a_pagar,
              solicitudcompra!solicitud_compra_id (
                departamento!departamento_id (nombre)
              )
            `);
          if (ordersError) throw ordersError;
          if (!orders || orders.length === 0) {
            setInsights((prev) => ({ ...prev, [type]: "No hay datos de órdenes para analizar." }));
            setLoading(false);
            return;
          }
          prompt = `
            Analiza los siguientes gastos por departamento:
            ${JSON.stringify(orders)}
            Detecta anomalías y sugiere acciones correctivas.
          `;
          break;
        case "proveedores":
          const { data: providers } = await supabase
            .from("proveedor")
            .select("id, nombre, direccion");
          const { data: orderDetails } = await supabase
            .from("ordencompra_detalle")
            .select("orden_compra_id, cantidad");
          prompt = `
            Con base en estos proveedores y órdenes:
            - Proveedores: ${JSON.stringify(providers)}
            - Detalles de órdenes: ${JSON.stringify(orderDetails)}
            Genera un ranking de proveedores éticos locales con explicaciones (prioriza entrega rápida y costos bajos).
          `;
          break;
        case "predictor":
          const { data: inventory } = await supabase
            .from("inventario")
            .select("producto_id, existencias");
          const { data: pastOrders } = await supabase
            .from("ordencompra")
            .select("fecha_orden, neto_a_pagar");
          prompt = `
            Según estos datos:
            - Inventario: ${JSON.stringify(inventory)}
            - Órdenes pasadas: ${JSON.stringify(pastOrders)}
            Recomienda cantidades a comprar para el próximo trimestre con justificación técnica.
          `;
          break;
        case "asistente":
          const { data: requests } = await supabase
            .from("solicitudcompra_detalle")
            .select("cantidad, producto!producto_id(descripcion)");
          prompt = `
            Analiza estas solicitudes recurrentes:
            ${JSON.stringify(requests)}
            Sugiere órdenes de compra recurrentes para optimizar el proceso.
          `;
          break;
        default:
          break;
      }
      const response = await fetchAIResponse(prompt);
      setInsights((prev) => ({ ...prev, [type]: response }));
    } catch (error) {
      setInsights((prev) => ({ ...prev, [type]: "Error al procesar datos" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-dark text-light">
      <Card.Body>
        <Card.Title>Insights de IA</Card.Title>
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-3"
        >
          <Tab eventKey="auditor" title="Auditor de Gastos">
            <Button
              onClick={() => handleGenerateInsight("auditor")}
              disabled={loading}
            >
              {loading ? "Generando..." : "Analizar Gastos"}
            </Button>
            <p className="mt-3">
              {insights.auditor || "Presiona el botón para generar análisis"}
            </p>
          </Tab>
          <Tab eventKey="proveedores" title="Optimizador de Proveedores">
            <Button
              onClick={() => handleGenerateInsight("proveedores")}
              disabled={loading}
            >
              {loading ? "Generando..." : "Optimizar Proveedores"}
            </Button>
            <p className="mt-3">
              {insights.proveedores || "Presiona el botón para generar ranking"}
            </p>
          </Tab>
          <Tab eventKey="predictor" title="Predictor de Consumo">
            <Button
              onClick={() => handleGenerateInsight("predictor")}
              disabled={loading}
            >
              {loading ? "Generando..." : "Predecir Consumo"}
            </Button>
            <p className="mt-3">
              {insights.predictor || "Presiona el botón para generar predicción"}
            </p>
          </Tab>
          <Tab eventKey="asistente" title="Asistente Inteligente">
            <Button
              onClick={() => handleGenerateInsight("asistente")}
              disabled={loading}
            >
              {loading ? "Generando..." : "Sugerir Órdenes Recurrentes"}
            </Button>
            <p className="mt-3">
              {insights.asistente || "Presiona el botón para generar sugerencias"}
            </p>
          </Tab>
        </Tabs>
      </Card.Body>
    </Card>
  );
};

export default AIInsights;