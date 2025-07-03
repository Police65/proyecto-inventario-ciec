
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DOMPurify from 'dompurify';
import DepartmentExpensesChart from './DepartmentExpensesChart';
import AnomalyPieChart from './AnomalyPieChart';
import ChatInterface from '@/components/ai/ChatInterface'; // Changed to aliased import
import { OPENROUTER_API_KEY, OPENROUTER_API_URL } from '../../config';
import { AISummaryStat, ChartDataItem, OrdenCompra, SolicitudCompra, Departamento, RendimientoProveedor, ConsumoHistoricoProducto, MetricasProductoMensual, UserProfile, PartnerEvent, PartnerMeeting } from '../../types';
import { LightBulbIcon, BanknotesIcon, TruckIcon, CpuChipIcon, UserGroupIcon, ArrowPathIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
// @ts-ignore
import { useOutletContext } from 'react-router-dom';
import { fetchExternalEvents, fetchExternalMeetings } from '../../supabaseClient';

type InsightType = "auditor" | "proveedores" | "predictor" | "asistente" | "tendencias" | "eventos_externos";

interface TabConfig {
  key: InsightType;
  title: string;
  icon: React.ElementType;
  description: string;
}

interface AIInsightsContext {
  userProfile: UserProfile;
}


const TABS_CONFIG: TabConfig[] = [
  { key: "auditor", title: "Auditor de Gastos", icon: BanknotesIcon, description: "Analiza gastos por departamento, detecta anomalías y sugiere acciones." },
  { key: "proveedores", title: "Optimizador de Proveedores", icon: TruckIcon, description: "Analiza el rendimiento de proveedores y optimiza la selección." },
  { key: "predictor", title: "Predictor de Consumo", icon: CpuChipIcon, description: "Predice necesidades futuras de productos basado en el consumo histórico." },
  { key: "eventos_externos", title: "Análisis de Eventos Externos", icon: GlobeAltIcon, description: "Analiza el consumo y compras relacionadas con eventos y reuniones externas." },
  { key: "tendencias", title: "Análisis de Tendencias", icon: UserGroupIcon, description: "Analiza tendencias de gastos y solicitudes mensuales." },
  { key: "asistente", title: "Asistente Inteligente", icon: LightBulbIcon, description: "Interactúa con el asistente para obtener ayuda y recomendaciones sobre la gestión de compras e inventario." },
];

type OrderForAuditor = Pick<OrdenCompra, 'neto_a_pagar'> & {
  solicitudcompra: (Pick<SolicitudCompra, 'id'> & {
    departamento: Pick<Departamento, 'id' | 'nombre'> | null;
  }) | null;
};

const SITE_URL_AI_INSIGHTS = typeof window !== 'undefined' ? window.location.origin : "https://requisoftware-ciec.example.com";


export const AIInsights: React.FC = () => {
  const { userProfile } = useOutletContext<AIInsightsContext>();
  const [activeTab, setActiveTab] = useState<InsightType>("auditor");
  const [insights, setInsights] = useState<Partial<Record<InsightType, string>>>({});
  const [loading, setLoading] = useState<Partial<Record<InsightType, boolean>>>({});

  const [departmentStatsForChart, setDepartmentStatsForChart] = useState<AISummaryStat[]>([]);
  const [anomalyChartData, setAnomalyChartData] = useState<ChartDataItem[]>([]);
  const [providerPerformanceData, setProviderPerformanceData] = useState<RendimientoProveedor[]>([]);
  const [consumptionData, setConsumptionData] = useState<ConsumoHistoricoProducto[]>([]);
  const [monthlyMetricsData, setMonthlyMetricsData] = useState<MetricasProductoMensual[]>([]);
  const [externalEventsData, setExternalEventsData] = useState<PartnerEvent[]>([]);
  const [externalMeetingsData, setExternalMeetingsData] = useState<PartnerMeeting[]>([]);


  useEffect(() => {
    const loadDataForTab = async (tab: InsightType) => {
        // For 'asistente' tab, no specific data pre-loading is needed for the static insight generator anymore
        // as it's being replaced by the chat interface.
        if (tab === 'asistente') {
            setLoading(prev => ({ ...prev, [tab]: false })); // Ensure loading is false if no pre-load
            return;
        }

        setLoading(prev => ({ ...prev, [tab]: true }));
        try {
            if (tab === 'proveedores' && providerPerformanceData.length === 0) {
                const { data, error } = await supabase.from('rendimiento_proveedor').select('*, proveedor:proveedor_id(nombre), orden_compra:orden_compra_id(id, fecha_orden)');
                if (error) console.error("Error fetching provider performance:", error);
                else setProviderPerformanceData(data || []);
            } else if (tab === 'predictor') {
                 if (consumptionData.length === 0) {
                    const { data: consumo, error: consumoErr } = await supabase.from('consumo_historico_producto').select('*, producto:producto_id(id, descripcion)');
                    if (consumoErr) console.error("Error fetching consumption data:", consumoErr);
                    else setConsumptionData(consumo || []);
                 }
                 if (monthlyMetricsData.length === 0) {
                    const { data: metricas, error: metricasErr } = await supabase.from('metricas_producto_mensual').select('*, producto:producto_id(id, descripcion)');
                    if (metricasErr) console.error("Error fetching monthly metrics:", metricasErr);
                    else setMonthlyMetricsData(metricas || []);
                 }
            } else if (tab === 'eventos_externos') {
                if (externalEventsData.length === 0) {
                    const events = await fetchExternalEvents(10);
                    setExternalEventsData(events);
                }
                if (externalMeetingsData.length === 0) {
                    const meetings = await fetchExternalMeetings(10);
                    setExternalMeetingsData(meetings);
                }
            }
        } catch (err) {
            console.error(`Error loading data for tab ${tab}:`, err);
            setInsights(prev => ({ ...prev, [tab]: `**Error al cargar datos para ${tab}:**\n- ${err instanceof Error ? err.message : String(err)}`}));
        } finally {
            setLoading(prev => ({ ...prev, [tab]: false }));
        }
    };

    if (!insights[activeTab] && !loading[activeTab] && activeTab !== 'asistente') {
      loadDataForTab(activeTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userProfile]);


  const calculateMean = (values: number[]): number => values.length === 0 ? 0 : values.reduce((acc, val) => acc + val, 0) / values.length;
  const calculateStandardDeviation = (values: number[], mean: number): number => values.length === 0 ? 0 : Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length);

  const detectAnomaliesIQR = (values: number[]): boolean[] => {
    if (values.length < 4) return values.map(() => false);
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length / 4);
    const q3Index = Math.floor((sorted.length * 3) / 4);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index < sorted.length ? q3Index : sorted.length -1];

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
      let processedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

      processedLine = processedLine.trim();

      if (processedLine.startsWith('### ') || processedLine.startsWith('## ') || processedLine.startsWith('# ')) {
        if (inList) html += `</${listType}>`;
        inList = false;
        const level = processedLine.startsWith('### ') ? 5 : (processedLine.startsWith('## ') ? 4 : 3);
        const headingContent = DOMPurify.sanitize(processedLine.replace(/^#+\s*/, ''));
        html += `<h${level} class="text-lg font-semibold text-gray-800 dark:text-white mt-3 mb-1">${headingContent}</h${level}>`;
      } else if (processedLine.startsWith('* ') || processedLine.startsWith('- ')) {
        if (!inList || listType === 'ol') {
          if (inList) html += `</${listType}>`;
          listType = 'ul';
          html += `<ul class="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300 ml-4">`;
          inList = true;
        }
        const listItemContent = DOMPurify.sanitize(processedLine.substring(2));
        html += `<li>${listItemContent}</li>`;
      } else if (/^\d+\.\s/.test(processedLine)) {
         if (!inList || listType === 'ul') {
          if (inList) html += `</${listType}>`;
          listType = 'ol';
          html += `<ol class="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-300 ml-4">`;
          inList = true;
        }
        const orderedListItemContent = DOMPurify.sanitize(processedLine.replace(/^\d+\.\s/, ''));
        html += `<li>${orderedListItemContent}</li>`;
      } else if (processedLine) {
        if (inList) {
          html += `</${listType}>`;
          inList = false;
        }
        const paragraphContent = DOMPurify.sanitize(processedLine);
        html += `<p class="text-gray-600 dark:text-gray-300 my-2">${paragraphContent}</p>`;
      }
    });
    if (inList) html += `</${listType}>`;
    return html;
  };

  const fetchAIResponse = async (prompt: string, type: InsightType): Promise<string> => {
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.length < 10) {
      console.warn("La clave API de OpenRouter no está configurada o es inválida. Las perspectivas de IA serán simuladas.");
      return `**Información Simulada para ${type}**\n- Esta es una respuesta simulada porque la clave API no está configurada o es inválida.\n- Configure su clave API de OpenRouter en config.ts para obtener información real.\n- Este es un ejemplo de formato con **markdown** y listas:\n  * Punto uno.\n  * Punto dos con *énfasis*.`;
    }
    try {
        const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": SITE_URL_AI_INSIGHTS,
            "X-Title": "RequiSoftware CIEC - AI Insights",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "qwen/qwen3-30b-a3b:free",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2000
        }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Error de API de IA para ${type}: ${response.status} - ${errorBody}`, response);
            throw new Error(`Error de API de IA (${response.status}): ${errorBody}`);
        }
        const data = await response.json();

        if (data && data.choices && data.choices.length > 0 && data.choices[0].message && typeof data.choices[0].message.content === 'string') {
            return data.choices[0].message.content;
        } else {
            console.error(`Estructura de respuesta de IA inválida para ${type}. Recibido:`, JSON.stringify(data, null, 2));
            throw new Error("Estructura de respuesta inválida o inesperada de la API de IA.");
        }

    } catch (fetchError) {
        const errorMessageText = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error(`Error de fetch para respuesta de IA para ${type}: ${errorMessageText}`, fetchError);
        throw new Error(`Error de red o de fetch para la API de IA: ${errorMessageText}`);
    }
  };

  const handleGenerateInsight = async (type: InsightType) => {
    // This function will not be called for 'asistente' tab as it uses ChatInterface
    if (type === 'asistente') return;

    setLoading(prev => ({ ...prev, [type]: true }));
    setInsights(prev => ({ ...prev, [type]: undefined }));
    let prompt = "";
    let generatedInsight = "";

    try {
      switch (type) {
        case "auditor":
          const { data: ordersData, error: ordersError } = await supabase
            .from("ordencompra")
            .select(`neto_a_pagar, solicitudcompra!ordencompra_solicitud_compra_id_fkey(id, departamento!inner(id, nombre))`)
            .eq('estado', 'Completada')
            .returns<OrderForAuditor[]>();

          if (ordersError) throw ordersError;
          if (!ordersData || ordersData.length === 0) {
            generatedInsight = "**Sin Datos Suficientes**\n- No hay datos de órdenes completadas para analizar los gastos por departamento.";
            setDepartmentStatsForChart([]); setAnomalyChartData([]);
          } else {
            const departmentExpensesMap: { [key: string]: number[] } = {};
            ordersData.forEach(order => {
              const deptName = order.solicitudcompra?.departamento?.nombre || 'Desconocido/Directa';
              if (!departmentExpensesMap[deptName]) departmentExpensesMap[deptName] = [];
              departmentExpensesMap[deptName].push(order.neto_a_pagar || 0);
            });

            const localStats: AISummaryStat[] = Object.entries(departmentExpensesMap).map(([dept, amounts]) => {
              const mean = calculateMean(amounts);
              const stdDev = calculateStandardDeviation(amounts, mean);
              const anomalies = detectAnomaliesIQR(amounts);
              return { dept, total: amounts.reduce((a, b) => a + b, 0), mean, stdDev, amounts, anomalies };
            });
            setDepartmentStatsForChart(localStats.sort((a,b) => b.total - a.total));

            const anomalyCounts = localStats.reduce((acc, deptStat) => {
                acc.anomalyCount += deptStat.anomalies.filter(Boolean).length;
                acc.normalCount += deptStat.anomalies.filter(a => !a).length;
                return acc;
            }, { anomalyCount: 0, normalCount: 0 });

            if (anomalyCounts.anomalyCount === 0 && anomalyCounts.normalCount === 0) {
                setAnomalyChartData([]);
            } else {
                 setAnomalyChartData([
                    { name: "Anomalías", value: anomalyCounts.anomalyCount },
                    { name: "Normales", value: anomalyCounts.normalCount },
                ]);
            }

            const statsForPrompt = localStats.map(s => ({ departamento: s.dept, gasto_total: s.total.toFixed(2), gasto_promedio: s.mean.toFixed(2), desviacion_estandar: s.stdDev.toFixed(2), numero_anomalias: s.anomalies.filter(Boolean).length, total_transacciones: s.amounts.length }));
            prompt = `Actúa como un auditor financiero experto para RequiSoftware CIEC. Analiza estos datos de gastos por departamento (en Bs.): ${JSON.stringify(statsForPrompt)}.
            Considera que una anomalía es un gasto significativamente diferente al promedio del departamento (ya calculado con IQR).
            Proporciona un resumen ejecutivo conciso (1-2 párrafos).
            Luego, identifica 2-3 departamentos con gastos notables (más altos, más bajos si es relevante) o con un número significativo de anomalías. Para cada uno, sugiere una posible causa y una acción correctiva o de investigación específica y accionable.
            Finaliza con 1-2 recomendaciones generales para mejorar el control de gastos en la organización.
            Responde en ESPAÑOL. Formatea con títulos en markdown (ej. ## Resumen Ejecutivo, ## Análisis Detallado por Departamento, ### Recomendaciones Generales) y usa listas para las sugerencias y acciones.`;
            generatedInsight = await fetchAIResponse(prompt, type);
          }
          break;

        case "proveedores":
          const performanceSummary = providerPerformanceData.map(p => ({
              proveedor: p.proveedor?.nombre || `ID ${p.proveedor_id}`,
              calidad_producto: p.calidad_producto_evaluacion,
              cumplimiento_pedido: p.cumplimiento_pedido_evaluacion,
              competitividad_precio: p.precio_competitividad_evaluacion,
              comunicacion: p.comunicacion_evaluacion,
              tiempo_entrega_real_dias: p.tiempo_entrega_real_dias,
              tiempo_entrega_estimado_dias: p.tiempo_entrega_estimado_dias,
              orden_id: p.orden_compra_id,
              observaciones: p.observaciones,
          })).slice(0, 20);

          if (performanceSummary.length === 0) {
             generatedInsight = "**Sin Datos de Rendimiento**\n- No hay evaluaciones de rendimiento de proveedores registradas. Complete evaluaciones después de que las órdenes sean completadas para habilitar este análisis detallado.";
          } else {
            prompt = `Como experto en optimización de la cadena de suministro para RequiSoftware CIEC, analiza estos datos de rendimiento de proveedores (calificaciones en escala 1-5 donde 5 es mejor; tiempo en días): ${JSON.stringify(performanceSummary)}.
                    Identifica proveedores destacados (alta calificación general, buen cumplimiento de tiempos) y menciona por qué.
                    También identifica proveedores con áreas claras de mejora (bajas calificaciones, retrasos consistentes) y detalla las áreas problemáticas.
                    Sugiere 2-3 estrategias concisas y accionables para optimizar la selección y gestión de proveedores basadas en estos datos, como renegociar términos, buscar alternativas o fortalecer relaciones.
                    Responde en ESPAÑOL. Formatea con títulos en markdown (ej. ## Proveedores Destacados, ## Proveedores con Áreas de Mejora, ## Estrategias de Optimización) y usa listas.`;
            generatedInsight = await fetchAIResponse(prompt, type);
          }
          break;

        case "predictor":
            const consumoResumen = consumptionData.map(c => ({
                producto: c.producto?.descripcion || `ID ${c.producto_id}`,
                cantidad_total_consumida_historica: c.cantidad_consumida,
                fecha_ultimo_consumo_registrado: c.fecha_consumo,
                tipo_consumo: c.tipo_consumo,
            })).slice(0, 20);
             const metricasResumen = monthlyMetricsData.map(m => ({
                producto: m.producto?.descripcion || `ID ${m.producto_id}`,
                mes: m.mes,
                cantidad_comprada_ese_mes: m.cantidad_comprada_total,
                gasto_en_producto_ese_mes: m.gasto_total_producto,
                numero_ordenes_ese_mes_para_producto: m.numero_ordenes,
            })).slice(0,20);

            if(consumoResumen.length === 0 && metricasResumen.length === 0) {
                generatedInsight = "**Sin Datos para Predicción**\n- No hay datos suficientes en 'consumo_historico_producto' o 'metricas_producto_mensual'. Registre consumos y complete órdenes para habilitar las predicciones."
            } else {
                prompt = `Eres un analista de inventario experto para RequiSoftware CIEC. Basado en este historial de consumo de productos: ${JSON.stringify(consumoResumen)} y estas métricas mensuales de compra/gasto de productos: ${JSON.stringify(metricasResumen)}.
                        Identifica 2-3 productos con alto consumo o patrones de compra recurrentes. Para estos productos, predice posibles necesidades futuras a corto plazo (ej. próximo mes o trimestre), explicando tu razonamiento.
                        Sugiere 2-3 acciones específicas y prácticas para optimizar los niveles de stock para estos productos clave (ej. ajustar stock mínimo/máximo, programar compras basadas en tendencias, considerar compras por volumen).
                        Responde en ESPAÑOL. Formatea con títulos en markdown (## Productos Clave y Predicciones, ## Acciones de Optimización de Stock) y usa listas para las predicciones y acciones.`;
                generatedInsight = await fetchAIResponse(prompt, type);
            }
          break;

        case "eventos_externos":
            const eventsSummary = externalEventsData.map(e => ({ tipo: 'Evento', nombre: e.subject, fecha: e.date, organizador: e.organizer_type + (e.organizer_name ? `: ${e.organizer_name}` : ''), lugar: e.location })).slice(0, 5);
            const meetingsSummary = externalMeetingsData.map(m => ({ tipo: 'Reunión', nombre: m.subject, fecha: m.date, comision_id: m.commission_id, lugar: m.location })).slice(0, 5);
            const externalActivitiesSummary = [...eventsSummary, ...meetingsSummary];

            if (externalActivitiesSummary.length === 0) {
                generatedInsight = "**Sin Datos de Actividades Externas**\n- No se encontraron eventos o reuniones recientes en la base de datos del calendario externo. Estos datos son necesarios para el análisis.";
            } else {
                prompt = `Como analista de logística y planificación de recursos para RequiSoftware CIEC, has obtenido la siguiente lista de actividades externas recientes (eventos y reuniones) de la organización: ${JSON.stringify(externalActivitiesSummary)}.
                        Aunque no tienes datos detallados del consumo específico de productos de RequiSoftware para cada una de estas actividades, tu tarea es:
                        1.  **Análisis General del Impacto Potencial:** Basado en la naturaleza de estas actividades (ej. tipo, nombre, organizador, lugar), describe el *impacto potencial general* que este tipo de actividades externas podrían tener en el consumo de recursos de RequiSoftware (ej. material de papelería, equipos de presentación, material promocional, refrigerios, etc.). Diferencia si es posible el impacto de eventos vs. reuniones.
                        2.  **Tipos de Datos a Registrar:** Para mejorar el análisis futuro, ¿qué *tipos específicos de datos* debería RequiSoftware registrar internamente cada vez que participa o apoya una actividad externa (evento o reunión)? (ej. productos específicos consumidos, cantidades, departamento solicitante, propósito del consumo).
                        3.  **Recomendaciones Proactivas:** Ofrece 2-3 recomendaciones generales y accionables sobre cómo RequiSoftware podría planificar proactivamente sus compras y niveles de inventario en anticipación a diferentes tipos de actividades externas.
                        Responde en ESPAÑOL. Usa formato Markdown con títulos claros (ej. ## Impacto Potencial de Actividades Externas, ## Datos Clave a Registrar, ## Recomendaciones de Planificación Proactiva) y listas para facilitar la lectura.`;
                generatedInsight = await fetchAIResponse(prompt, type);
            }
            break;

        // 'asistente' tab is handled by ChatInterface, so this case won't be hit by this button
        case "tendencias":
            prompt = `Eres un analista de datos para RequiSoftware CIEC. Observa estos datos (ficticios) de gastos totales por departamento (en Bs.F) durante los últimos 3 meses:
                    - Marketing: Mes 1: 1.000.000, Mes 2: 1.200.000, Mes 3: 1.500.000
                    - Ventas: Mes 1: 800.000, Mes 2: 850.000, Mes 3: 820.000
                    - TI: Mes 1: 2.000.000, Mes 2: 1.800.000, Mes 3: 2.200.000
                    - Administración: Mes 1: 500.000, Mes 2: 550.000, Mes 3: 480.000
                    Identifica 2-3 tendencias clave de gasto (aumento, disminución, estabilidad) por departamento. Ofrece una breve explicación (1-2 frases) para cada tendencia observada, incluyendo posibles implicaciones o áreas a investigar.
                    Responde en ESPAÑOL. Formatea con títulos en markdown (## Tendencias de Gasto por Departamento) y listas para cada departamento y su tendencia.`;
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
    <div className="space-y-6 bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md">
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {TABS_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center px-3 py-3 text-sm font-medium focus:outline-none whitespace-nowrap
              ${activeTab === tab.key
                ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
              }`}
            aria-current={activeTab === tab.key ? 'page' : undefined}
          >
            <tab.icon className={`w-5 h-5 mr-2 ${activeTab === tab.key ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`} aria-hidden="true" />
            {tab.title}
          </button>
        ))}
      </div>

      {currentTabConfig && (
        <div className="p-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{currentTabConfig.description}</p>

          {activeTab === "asistente" ? (
            <ChatInterface userProfile={userProfile} />
          ) : (
            <>
              <button
                onClick={() => handleGenerateInsight(activeTab)}
                disabled={loading[activeTab]}
                className="mb-6 flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-400 dark:disabled:bg-primary-700 disabled:cursor-not-allowed"
                aria-live="polite"
                aria-busy={loading[activeTab]}
              >
                {loading[activeTab] ? <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" aria-hidden="true" /> : <CpuChipIcon className="h-5 w-5 mr-2" aria-hidden="true" />}
                {loading[activeTab] ? 'Generando...' : `Generar Análisis de ${currentTabConfig.title}`}
              </button>

              {loading[activeTab] && (
                <div className="mt-4" aria-label={`Cargando análisis para ${currentTabConfig.title}`}>
                    <LoadingSpinner message={`Analizando datos para ${currentTabConfig.title}... Por favor espere, esto puede tardar unos momentos.`} />
                </div>
              )}

              {insights[activeTab] && !loading[activeTab] && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow prose prose-sm dark:prose-invert max-w-none" role="article">
                  <div dangerouslySetInnerHTML={{ __html: parseResponseToHTML(insights[activeTab]!) }} />
                </div>
              )}

              {!insights[activeTab] && !loading[activeTab] && (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Haga clic en "Generar Análisis" para ver la perspectiva de IA.
                </p>
              )}

              {activeTab === "auditor" && (departmentStatsForChart.length > 0 || (anomalyChartData.length > 0 && (anomalyChartData[0].value > 0 || anomalyChartData[1].value > 0) )) && !loading[activeTab] && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {departmentStatsForChart.length > 0 && <DepartmentExpensesChart data={departmentStatsForChart} />}
                  {(anomalyChartData.length > 0 && (anomalyChartData[0].value > 0 || anomalyChartData[1].value > 0) ) && <AnomalyPieChart data={anomalyChartData} title="Distribución de Transacciones (Anomalías)" />}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};