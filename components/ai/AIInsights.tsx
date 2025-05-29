
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import DOMPurify from 'dompurify';
import DepartmentExpensesChart from './DepartmentExpensesChart';
import AnomalyPieChart from './AnomalyPieChart';
import { OPENROUTER_API_KEY, OPENROUTER_API_URL } from '../../config';
import { AISummaryStat, AIAnomalySummary, ChartDataItem, OrdenCompra, SolicitudCompra, Departamento } from '../../types';
import { LightBulbIcon, BanknotesIcon, TruckIcon, CpuChipIcon, UserGroupIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';


type InsightType = "auditor" | "proveedores" | "predictor" | "asistente" | "tendencias";

interface TabConfig {
  key: InsightType;
  title: string;
  icon: React.ElementType;
  description: string;
}

const TABS_CONFIG: TabConfig[] = [
  { key: "auditor", title: "Auditor de Gastos", icon: BanknotesIcon, description: "Analiza gastos por departamento, detecta anomalías y sugiere acciones." },
  { key: "proveedores", title: "Optimizador de Proveedores", icon: TruckIcon, description: "Identifica proveedores eficientes y optimiza la selección." },
  { key: "predictor", title: "Predictor de Consumo", icon: CpuChipIcon, description: "Predice necesidades futuras de productos y optimiza el inventario." },
  { key: "asistente", title: "Asistente Inteligente", icon: LightBulbIcon, description: "Proporciona recomendaciones generales y alertas de stock." },
  { key: "tendencias", title: "Análisis de Tendencias", icon: UserGroupIcon, description: "Analiza tendencias de gastos mensuales e identifica patrones." },
];

type OrderForAuditor = Pick<OrdenCompra, 'neto_a_pagar'> & {
  solicitudcompra: (Pick<SolicitudCompra, 'id'> & {
    departamento: Pick<Departamento, 'id' | 'nombre'> | null; 
  }) | null; 
};

const SITE_URL_AI_INSIGHTS = typeof window !== 'undefined' ? window.location.origin : "https://example.com";


const AIInsights: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InsightType>("auditor");
  const [insights, setInsights] = useState<Partial<Record<InsightType, string>>>({});
  const [loading, setLoading] = useState<Partial<Record<InsightType, boolean>>>({});

  const [departmentStatsForChart, setDepartmentStatsForChart] = useState<AISummaryStat[]>([]);
  const [anomalyChartData, setAnomalyChartData] = useState<ChartDataItem[]>([]);


  const calculateMean = (values: number[]): number => values.length === 0 ? 0 : values.reduce((acc, val) => acc + val, 0) / values.length;
  const calculateStandardDeviation = (values: number[], mean: number): number => values.length === 0 ? 0 : Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length);
  const detectAnomaliesZScore = (values: number[], mean: number, stdDev: number, threshold = 2): boolean[] => stdDev === 0 ? values.map(() => false) : values.map(val => Math.abs(val - mean) / stdDev > threshold);
  const detectAnomaliesIQR = (values: number[]): boolean[] => {
    if (values.length < 4) return values.map(() => false);
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length / 4)];
    const q3 = sorted[Math.floor((sorted.length * 3) / 4)];
    const iqr = q3 - q1;
    if (iqr === 0) return values.map(() => false);
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    return values.map(val => val < lowerBound || val > upperBound);
  };

  const parseResponseToHTML = (text: string): string => {
    const lines = text.split('\n');
    let html = '';
    let inList = false;
    let listType: 'ol' | 'ul' = 'ul';

    lines.forEach(line => {
      line = line.trim();
      if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
        if (inList) html += `</${listType}>`;
        inList = false;
        html += `<h4 class="text-lg font-semibold text-gray-800 dark:text-white mt-3 mb-1">${line.replace(/\*\*/g, '')}</h4>`;
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        if (!inList || listType === 'ol') {
          if (inList) html += `</${listType}>`;
          listType = 'ul';
          html += `<ul class="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">`;
          inList = true;
        }
        html += `<li>${line.substring(2)}</li>`;
      } else if (/^\d+\.\s/.test(line)) {
         if (!inList || listType === 'ul') {
          if (inList) html += `</${listType}>`;
          listType = 'ol';
          html += `<ol class="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-300">`;
          inList = true;
        }
        html += `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
      } else if (line) {
        if (inList) {
          html += `</${listType}>`;
          inList = false;
        }
        html += `<p class="text-gray-600 dark:text-gray-300 my-2">${line}</p>`;
      }
    });
    if (inList) html += `</${listType}>`;
    return html;
  };

  const fetchAIResponse = async (prompt: string, type: InsightType): Promise<string> => {
    if (!OPENROUTER_API_KEY) {
      console.warn("OpenRouter API Key is not configured. AI insights will be mocked.");
      return `**Información Simulada para ${type}**\n- Esta es una respuesta simulada porque la clave API no está configurada.\n- Configure su clave API de OpenRouter en config.ts para obtener información real.\n- Asegúrate de que las respuestas estén en ESPAÑOL.`;
    }
    try {
        const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": SITE_URL_AI_INSIGHTS,
            "X-Title": "RequiSoftware CIEC",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "qwen/qwen3-30b-a3b:free",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1500 // Increased max_tokens
        }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`AI API Error for ${type}: ${response.status} - ${errorBody}`, response);
            throw new Error(`Error de API de IA (${response.status}): ${errorBody}`);
        }
        const data = await response.json();

        if (data && data.choices && data.choices.length > 0 && data.choices[0].message && typeof data.choices[0].message.content === 'string') {
            const content = data.choices[0].message.content;
            const finishReason = data.choices[0].finish_reason;

            if (content.trim() === "") {
                if (finishReason === 'length') {
                     console.warn(`AI response for ${type} was an empty string due to 'length' finish_reason. max_tokens might be too low. Full choice:`, JSON.stringify(data.choices[0], null, 2));
                     return `**Respuesta Incompleta de la IA**\n- La IA comenzó a generar una respuesta pero fue interrumpida porque se alcanzó el límite de tokens.\n- El límite de tokens ha sido aumentado, intente generar de nuevo. Si el problema persiste, la consulta podría ser demasiado compleja o requerir aún más tokens.`;
                } else {
                    console.warn(`AI response for ${type} was an empty string (finish_reason: ${finishReason}). Full choice:`, JSON.stringify(data.choices[0], null, 2));
                    return `**Respuesta Vacía de la IA**\n- La IA no generó un análisis de texto para esta consulta.\n- Esto podría deberse a la naturaleza de los datos, la configuración del modelo, o un error inesperado de la IA.`;
                }
            }
            return content;
        } else {
            console.error(`Invalid AI response structure for ${type}. Expected 'data.choices[0].message.content' to be a string. Received:`, JSON.stringify(data, null, 2));
            throw new Error("Estructura de respuesta inválida o inesperada de la API de IA.");
        }

    } catch (fetchError) {
        const errorMessageText = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error(`Fetch AI response error for ${type}: ${errorMessageText}`, fetchError);
        throw new Error(`Error de red o de fetch para la API de IA: ${errorMessageText}`);
    }
  };

  const handleGenerateInsight = async (type: InsightType) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    setInsights(prev => ({ ...prev, [type]: undefined }));
    let prompt = "";
    let generatedInsight = "";

    try {
      switch (type) {
        case "auditor":
          const { data: orders, error: ordersError } = await supabase
            .from("ordencompra")
            .select(`neto_a_pagar, solicitudcompra!ordencompra_solicitud_compra_id_fkey!inner(id, departamento!inner(id, nombre))`)
            .returns<OrderForAuditor[]>();
          if (ordersError) {
            console.error("Error fetching orders for AI auditor:", ordersError.message, ordersError.details, ordersError.code, ordersError);
            throw ordersError;
          }
          if (!orders || orders.length === 0) {
            generatedInsight = "**Sin Datos Suficientes**\n- No hay datos de órdenes completas (con departamento asociado) para analizar y generar un informe de auditoría.";
            setDepartmentStatsForChart([]);
            setAnomalyChartData([]);
          } else {
            const expensesByDept: { [key: string]: number[] } = (orders || []).reduce((acc, order) => {
              const deptName = order.solicitudcompra?.departamento?.nombre || "Sin_Departamento_Asignado";
              if (!acc[deptName]) acc[deptName] = [];
              acc[deptName].push(order.neto_a_pagar || 0);
              return acc;
            }, {} as { [key: string]: number[] });

            const localAuditorStats: AISummaryStat[] = Object.entries(expensesByDept).map(([dept, amounts]) => {
              const mean = calculateMean(amounts);
              const stdDev = calculateStandardDeviation(amounts, mean);
              const zAnomalies = detectAnomaliesZScore(amounts, mean, stdDev);
              const iqrAnomalies = detectAnomaliesIQR(amounts);
              const anomalies = amounts.map((_, i) => zAnomalies[i] || iqrAnomalies[i]);
              return { dept, total: amounts.reduce((s, v) => s + v, 0), mean, stdDev, amounts, anomalies };
            });
            setDepartmentStatsForChart(localAuditorStats);

            const overallAnomalies = localAuditorStats.reduce((sum, stat) => sum + stat.anomalies.filter(Boolean).length, 0);
            const overallTransactions = localAuditorStats.reduce((sum, stat) => sum + stat.amounts.length, 0);
            setAnomalyChartData([
              { name: "Anomalías", value: overallAnomalies },
              { name: "Normales", value: overallTransactions - overallAnomalies },
            ]);

            prompt = `Eres un asistente de auditoría financiera para una empresa. Analiza los siguientes datos de gastos por departamento. Cada departamento tiene un total gastado, un promedio de gasto por transacción, y una lista de montos de transacciones individuales, con un indicador booleano de si cada transacción es una anomalía.
                      Datos: ${JSON.stringify(localAuditorStats.map(s => ({ departamento: s.dept, total_gastado: s.total, promedio_transaccion: s.mean, numero_transacciones: s.amounts.length, numero_anomalias: s.anomalies.filter(Boolean).length })))}
                      Proporciona un resumen conciso (1-2 párrafos), identifica departamentos con gastos inusualmente altos o con muchas anomalías (menciona al menos 1-2 departamentos específicos si aplica). Ofrece 2-3 recomendaciones generales y accionables para mejorar el control de gastos o investigar más a fondo. Formatea tu respuesta en ESPAÑOL con títulos en markdown (ej. **Resumen General**) y listas con viñetas o numeradas. Si no hay anomalías significativas o los datos son muy uniformes, indícalo. Sé claro y profesional.`;
            generatedInsight = await fetchAIResponse(prompt, type);
          }
          break;

        case "proveedores":
          prompt = `Como experto en optimización de la cadena de suministro, analiza estos datos (ficticios) de proveedores:
                    - Proveedor A: 100 órdenes, 95% completadas a tiempo, costo promedio por orden $500.
                    - Proveedor B: 50 órdenes, 80% completadas a tiempo, costo promedio por orden $450.
                    - Proveedor C: 200 órdenes, 98% completadas a tiempo, costo promedio por orden $550.
                    Identifica fortalezas y debilidades de cada uno. Sugiere 2-3 estrategias claras y concisas para optimizar la selección y gestión de proveedores en general. Responde en ESPAÑOL. Formatea tu respuesta con títulos en markdown para cada sección principal (ej. **Análisis de Proveedores**, **Estrategias de Optimización**) y usa listas para los detalles.`;
          generatedInsight = await fetchAIResponse(prompt, type);
          break;
        case "predictor":
           prompt = `Eres un analista de inventario. Basado en estos datos (ficticios) de consumo y stock actual:
                    - Producto X: Stock 100, Consumo mensual promedio 20.
                    - Producto Y: Stock 50, Consumo mensual promedio 30 (tendencia al alza).
                    - Producto Z: Stock 200, Consumo mensual promedio 10 (estable).
                    Predice aproximadamente cuándo se agotará cada producto (en meses o semanas). Sugiere 2-3 acciones específicas y prácticas para optimizar niveles de inventario y evitar desabastecimientos o excesos para estos productos. Responde en ESPAÑOL. Formatea tu respuesta con títulos en markdown (ej. **Predicciones de Agotamiento**, **Recomendaciones de Inventario**) y usa listas.`;
           generatedInsight = await fetchAIResponse(prompt, type);
           break;
        case "asistente":
            prompt = `Actúa como un asistente de gestión de compras inteligente. Revisa estos datos (ficticios) y urgencias:
                    - Alerta CRÍTICA: Producto 'Tóner XP-500' tiene solo 5 unidades en stock (umbral bajo es 10). Se necesita urgentemente.
                    - Nota: Las solicitudes del departamento de Marketing han aumentado un 30% este mes, revisar si es un pico o nueva tendencia.
                    - Info: El proveedor 'Suministros Rápidos' tiene una promoción en papel de resma esta semana (15% descuento).
                    Proporciona 2-3 recomendaciones accionables y prioritarias para el gerente de compras. Enfócate en lo más urgente primero. Responde en ESPAÑOL. Formatea tu respuesta con títulos en markdown (ej. **Acciones Urgentes**, **Consideraciones Adicionales**) y usa listas numeradas para las acciones.`;
            generatedInsight = await fetchAIResponse(prompt, type);
            break;
        case "tendencias":
            prompt = `Eres un analista de datos financieros. Observa estas tendencias (ficticias) de gasto total mensual de la empresa:
                    - Enero: $10,000
                    - Febrero: $12,000 (Incremento notable)
                    - Marzo: $9,000 (Campaña de ahorro implementada a mediados de mes)
                    - Abril: $15,000 (Proyecto grande 'Omega' iniciado, presupuesto adicional asignado)
                    Identifica 2-3 patrones significativos o anomalías en los gastos mensuales. Ofrece 2-3 insights o preguntas clave que el equipo de finanzas debería considerar para entender mejor estas variaciones. Responde en ESPAÑOL. Formatea tu respuesta con títulos en markdown (ej. **Patrones Observados**, **Preguntas Clave para Finanzas**) y usa listas.`;
            generatedInsight = await fetchAIResponse(prompt, type);
            break;
        default:
          generatedInsight = "**Funcionalidad no implementada.**\n- La lógica para este tipo de insight aún no ha sido desarrollada.";
      }
      const cleanHTML = DOMPurify.sanitize(parseResponseToHTML(generatedInsight));
      setInsights(prev => ({ ...prev, [type]: cleanHTML }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error generando insight para ${type}: ${errorMessage}`, error);
      const errorHtml = `<p class="text-red-600 dark:text-red-400"><strong>Error al generar análisis para ${TABS_CONFIG.find(t => t.key === type)?.title || type}:</strong></p><p class="text-red-500 dark:text-red-500">${DOMPurify.sanitize(errorMessage)}</p>`;
      setInsights(prev => ({ ...prev, [type]: errorHtml }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const currentTabConfig = TABS_CONFIG.find(tab => tab.key === activeTab);

  return (
    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4 sm:p-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Perspectivas con IA</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Utiliza la inteligencia artificial para obtener análisis y recomendaciones sobre tus datos de compras e inventario.
      </p>

      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
          {TABS_CONFIG.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                } focus:outline-none flex items-center space-x-2`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.title}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4">
        {currentTabConfig && (
            <div className="p-1 mb-4 bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-start">
                    <currentTabConfig.icon className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3 mt-1 flex-shrink-0" />
                    <div>
                        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">{currentTabConfig.title}</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{currentTabConfig.description}</p>
                    </div>
                </div>
            </div>
        )}
        <button
          onClick={() => handleGenerateInsight(activeTab)}
          disabled={loading[activeTab]}
          className="mb-6 w-full sm:w-auto flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
        >
          {loading[activeTab] ? (
            <>
              <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
              Generando...
            </>
          ) : (
            `Analizar ${TABS_CONFIG.find(t => t.key === activeTab)?.title || ''}`
          )}
        </button>

        {loading[activeTab] && <div className="py-10"><LoadingSpinner message="Procesando con IA..." /></div>}

        {!loading[activeTab] && insights[activeTab] && (
          <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md border dark:border-gray-700">
            <div dangerouslySetInnerHTML={{ __html: insights[activeTab]! }} />
          </div>
        )}
         {!loading[activeTab] && !insights[activeTab] && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                Presiona el botón para generar el análisis de IA para "{TABS_CONFIG.find(t => t.key === activeTab)?.title}".
            </p>
        )}

        {activeTab === 'auditor' && !loading.auditor && departmentStatsForChart.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <DepartmentExpensesChart data={departmentStatsForChart} />
            <AnomalyPieChart data={anomalyChartData} title="Distribución General (Anomalías vs Normales)"/>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
