import React, { useState } from "react";
import { Card, Button, Tab, Tabs } from "react-bootstrap";
import { supabase } from "../supabaseClient";
import DOMPurify from "dompurify";
import DepartmentExpensesChart from "./DepartmentExpensesChart";
import AnomalyPieChart from "./AnomalyPieChart";

const AIInsights = () => {
  const [activeTab, setActiveTab] = useState("auditor");
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(false);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [anomalyData, setAnomalyData] = useState([]);

  // Funciones de cálculo
  const calculateMean = (values) => {
    return values.reduce((acc, val) => acc + val, 0) / values.length;
  };

  const calculateStandardDeviation = (values, mean) => {
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  };

  const detectAnomaliesZScore = (values, mean, stdDev, threshold = 2) => {
    return values.map((val) => Math.abs(val - mean) / stdDev > threshold);
  };

  const detectAnomaliesIQR = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length / 4)];
    const q3 = sorted[Math.floor((sorted.length * 3) / 4)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    return values.map((val) => val < lowerBound || val > upperBound);
  };

  const parseResponseToHTML = (text) => {
    const lines = text.split("\n");
    let html = "";
    let inList = false;

    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("**") && line.endsWith("**")) {
        if (inList) html += "</ol>";
        inList = false;
        const heading = line.replace(/\*\*/g, "");
        html += `<h2>${heading}</h2>`;
      } else if (/^\d+\./.test(line)) {
        if (!inList) {
          html += "<ol>";
          inList = true;
        }
        const listItem = line.replace(/^\d+\.\s*/, "");
        html += `<li>${listItem}</li>`;
      } else if (line) {
        if (inList) {
          html += "</ol>";
          inList = false;
        }
        html += `<p>${line}</p>`;
      }
    });

    if (inList) html += "</ol>";
    return html;
  };

  const fetchAIResponse = async (prompt) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-8b-instruct:free",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const handleGenerateInsight = async (type) => {
    setLoading(true);
    let prompt = "";
    try {
      switch (type) {
        case "auditor":
          const { data: orders, error } = await supabase
            .from("ordencompra")
            .select(`
              neto_a_pagar,
              solicitudcompra!solicitud_compra_id (
                departamento!departamento_id (nombre)
              )
            `);
          if (error) throw error;
          if (!orders || orders.length === 0) {
            setInsights((prev) => ({
              ...prev,
              [type]: "No hay datos de órdenes para analizar.",
            }));
            setLoading(false);
            return;
          }

          const expensesByDept = orders.reduce((acc, order) => {
            const dept =
              order.solicitudcompra?.departamento?.nombre || "Sin departamento";
            const amount = order.neto_a_pagar || 0;
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(amount);
            return acc;
          }, {});

          const stats = Object.entries(expensesByDept).map(
            ([dept, amounts]) => {
              const total = amounts.reduce((sum, val) => sum + val, 0);
              const mean = calculateMean(amounts);
              const stdDev = calculateStandardDeviation(amounts, mean);
              const zAnomalies = detectAnomaliesZScore(amounts, mean, stdDev);
              const iqrAnomalies = detectAnomaliesIQR(amounts);
              const anomalies = amounts.map(
                (val, i) => zAnomalies[i] || iqrAnomalies[i]
              );
              return { dept, total, mean, stdDev, amounts, anomalies };
            }
          );

          const anomalySummary = stats.map((stat) => {
            const anomalyCount = stat.anomalies.filter(Boolean).length;
            const normalCount = stat.amounts.length - anomalyCount;
            return {
              dept: stat.dept,
              anomalyCount,
              normalCount,
            };
          });

          prompt = `
            Analiza los siguientes gastos por departamento con estadísticas:
            ${JSON.stringify(stats)}
            Resumen de anomalías: ${JSON.stringify(anomalySummary)}
            Detecta anomalías y sugiere acciones correctivas.
          `;

          setDepartmentStats(stats);
          setAnomalyData(
            anomalySummary.map((s) => [
              { name: "Anomalías", value: s.anomalyCount },
              { name: "Normales", value: s.normalCount },
            ])
          );

          const response = await fetchAIResponse(prompt);
          const cleanHTML = DOMPurify.sanitize(parseResponseToHTML(response));
          setInsights((prev) => ({ ...prev, [type]: cleanHTML }));
          break;
        default:
          break;
      }
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
            <div className="mt-3">
              {departmentStats.length > 0 && (
                <DepartmentExpensesChart data={departmentStats} />
              )}
              {anomalyData.length > 0 && <AnomalyPieChart data={anomalyData[0]} />}
              <div
                className="ai-response"
                dangerouslySetInnerHTML={{
                  __html:
                    insights.auditor || "Presiona el botón para generar análisis",
                }}
              />
            </div>
          </Tab>
        </Tabs>
      </Card.Body>
      <style jsx>{`
        .ai-response h2 {
          color: #ffffff;
          margin-top: 20px;
          font-size: 1.5rem;
        }
        .ai-response p {
          color: #d3d3d3;
          line-height: 1.6;
          margin-bottom: 10px;
        }
        .ai-response ol {
          padding-left: 20px;
          color: #d3d3d3;
        }
        .ai-response li {
          margin-bottom: 8px;
        }
      `}</style>
    </Card>
  );
};

export default AIInsights;