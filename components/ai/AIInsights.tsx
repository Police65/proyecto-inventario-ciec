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


export const AIInsights: React.FC = () => {
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
      console.warn("La clave API de OpenRouter no está configurada. Las perspectivas de IA serán simuladas.");
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
            max_tokens: 1500 
        }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Error de API de IA para ${type}: ${response.status} - ${errorBody}`, response);
            throw new Error(`Error de API de IA (${response.status}): ${errorBody}`);
        }
        const data = await response.json();

        if (data && data.choices && data.choices.length > 0 && data.choices[0].message && typeof data.choices[0].message.content === 'string') {
            const content = data.choices[0].message.content;
            const finishReason = data.choices[0].finish_reason;

            if (content.trim() === "") {
                if (finishReason === 'length') {
                     console.warn(`La respuesta de IA para ${type} fue una cadena vacía debido a 'length' como motivo de finalización. max_tokens podría ser demasiado bajo. Respuesta completa:`, JSON.stringify(data.choices[0], null, 2));
                     return `**Respuesta Incompleta de la IA**\n- La IA comenzó a generar una respuesta pero fue interrumpida porque se alcanzó el límite de tokens.\n- El límite de tokens ha sido aumentado, intente generar de nuevo. Si el problema persiste, la consulta podría ser demasiado compleja o requerir aún más tokens.`;
                } else {
                    console.warn(`La respuesta de IA para ${type} fue una cadena vacía (motivo de finalización: ${finishReason}). Respuesta completa:`, JSON.stringify(data.choices[0], null, 2));
                    return `**Respuesta Vacía de la IA**\n- La IA no generó un análisis de texto para esta consulta.\n- Esto podría deberse a la naturaleza de los datos, la configuración del modelo, o un error inesperado de la IA.`;
                }
            }
            return content;
        } else {
            console.error(`Estructura de respuesta de IA inválida para ${type}. Se esperaba 'data.choices[0].message.content' como cadena. Recibido:`, JSON.stringify(data, null, 2));
            throw new Error("Estructura de respuesta inválida o inesperada de la API de IA.");
        }

    } catch (fetchError) {
        const errorMessageText = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error(`Error de fetch para respuesta de IA para ${type}: ${errorMessageText}`, fetchError);
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
            console.error("Error al obtener órdenes para auditor IA:", ordersError.message, ordersError.details, ordersError.code, ordersError);
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
                    - Alerta CRÍTICA: Producto 'Tóner XP-500' tiene solo 5 unidades en stock, y se consumen 10 por semana.
                    - Información: Hay 3 solicitudes de compra pendientes de aprobación del departamento de Marketing.
                    - Tendencia: El gasto en 'Material de Oficina' ha aumentado un 20% este mes.
                    Proporciona un breve resumen ejecutivo (1-2 párrafos). Luego, ofrece 2-3 recomendaciones o alertas prioritarias basadas en esta información. Responde en ESPAÑOL. Usa títulos en markdown (ej. **Resumen Ejecutivo**, **Alertas y Recomendaciones**) y listas para las recomendaciones.`;
            generatedInsight = await fetchAIResponse(prompt, type);
            break;
        case "tendencias":
            prompt = `Eres un analista de datos. Observa estos datos (ficticios) de gastos totales por departamento durante los últimos 3 meses:
                    - Marketing: Mes 1: $1000, Mes 2: $1200, Mes 3: $1500
                    - Ventas: Mes 1: $800, Mes 2: $850, Mes 3: $820
                    - TI: Mes 1: $2000, Mes 2: $1800, Mes 3: $2200
                    Identifica 1-2 tendencias clave de gasto (aumento, disminución, estabilidad) por departamento. Ofrece una breve explicación (1 frase) para cada tendencia observada. Responde en ESPAÑOL. Formatea con títulos y listas.`;
            generatedInsight = await fetchAIResponse(prompt, type);
            break;
        default:
             generatedInsight = "Tipo de perspectiva no reconocida.";
      }
      setInsights(prev => ({ ...prev, [type]: generatedInsight }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Error en handleGenerateInsight para ${type}:`, errorMessage, err);
      setInsights(prev => ({ ...prev, [type]: `**Error al generar la perspectiva:**\n- ${errorMessage}` }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const currentTabConfig = TABS_CONFIG.find(tab => tab.key === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {TABS_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center px-3 py-3 text-sm font-medium focus:outline-none
              ${activeTab === tab.key
                ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
              }`}
          >
            <tab.icon className={`w-5 h-5 mr-2 ${activeTab === tab.key ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
            {tab.title}
          </button>
        ))}
      </div>

      {currentTabConfig && (
        <div className="p-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{currentTabConfig.description}</p>
          <button
            onClick={() => handleGenerateInsight(activeTab)}
            disabled={loading[activeTab]}
            className="mb-6 flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-400 dark:disabled:bg-primary-800"
          >
            {loading[activeTab] ? <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" /> : <CpuChipIcon className="h-5 w-5 mr-2" />}
            {loading[activeTab] ? 'Generando...' : `Generar Análisis de ${currentTabConfig.title}`}
          </button>

          {loading[activeTab] && (
            <div className="mt-4"><LoadingSpinner message={`Analizando datos para ${currentTabConfig.title}...`} /></div>
          )}

          {insights[activeTab] && !loading[activeTab] && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parseResponseToHTML(insights[activeTab]!)) }} />
            </div>
          )}
          
          {!insights[activeTab] && !loading[activeTab] && activeTab === "auditor" && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Haga clic en "Generar Análisis" para ver el informe del auditor de gastos y los gráficos asociados.
            </p>
          )}

          {activeTab === "auditor" && (departmentStatsForChart.length > 0 || anomalyChartData.length > 0) && !loading[activeTab] && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {departmentStatsForChart.length > 0 && <DepartmentExpensesChart data={departmentStatsForChart} />}
              {anomalyChartData.length > 0 && <AnomalyPieChart data={anomalyChartData} title="Distribución de Transacciones (Anomalías)" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
};