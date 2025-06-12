
import React, { useState, useEffect } from 'react'; 
import { supabase } from '../../supabaseClient';
import DOMPurify from 'dompurify';
import DepartmentExpensesChart from './DepartmentExpensesChart';
import AnomalyPieChart from './AnomalyPieChart';
import { OPENROUTER_API_KEY, OPENROUTER_API_URL } from '../../config';
import { AISummaryStat, AIAnomalySummary, ChartDataItem, OrdenCompra, SolicitudCompra, Departamento, RendimientoProveedor, ConsumoHistoricoProducto, Producto, MetricasProductoMensual } from '../../types';
import { LightBulbIcon, BanknotesIcon, TruckIcon, CpuChipIcon, UserGroupIcon, ArrowPathIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';


type InsightType = "auditor" | "proveedores" | "predictor" | "asistente" | "tendencias" | "eventos_externos";

interface TabConfig {
  key: InsightType;
  title: string;
  icon: React.ElementType;
  description: string;
}

const TABS_CONFIG: TabConfig[] = [
  { key: "auditor", title: "Auditor de Gastos", icon: BanknotesIcon, description: "Analiza gastos por departamento, detecta anomalías y sugiere acciones." },
  { key: "proveedores", title: "Optimizador de Proveedores", icon: TruckIcon, description: "Analiza el rendimiento de proveedores y optimiza la selección." },
  { key: "predictor", title: "Predictor de Consumo", icon: CpuChipIcon, description: "Predice necesidades futuras de productos basado en el consumo histórico." },
  { key: "eventos_externos", title: "Análisis de Eventos Externos", icon: GlobeAltIcon, description: "Analiza el consumo y compras relacionadas con eventos externos." },
  { key: "tendencias", title: "Análisis de Tendencias", icon: UserGroupIcon, description: "Analiza tendencias de gastos y solicitudes mensuales." },
  { key: "asistente", title: "Asistente Inteligente", icon: LightBulbIcon, description: "Proporciona recomendaciones generales y alertas de stock." },
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
  const [providerPerformanceData, setProviderPerformanceData] = useState<RendimientoProveedor[]>([]);
  const [consumptionData, setConsumptionData] = useState<ConsumoHistoricoProducto[]>([]);
  const [monthlyMetricsData, setMonthlyMetricsData] = useState<MetricasProductoMensual[]>([]);


  useEffect(() => {
    const loadDataForTab = async (tab: InsightType) => {
        setLoading(prev => ({ ...prev, [tab]: true }));
        try {
            if (tab === 'proveedores' && providerPerformanceData.length === 0) {
                const { data, error } = await supabase.from('rendimiento_proveedor').select('*, proveedor:proveedor_id(nombre), orden_compra:orden_compra_id(id, fecha_orden)');
                if (error) console.error("Error fetching provider performance:", error);
                else setProviderPerformanceData(data || []);
            } else if (tab === 'predictor') { // Load for predictor tab
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
            }
            // Add similar data loading for "eventos_externos" if needed, fetching from consumo_para_evento_externo & compras_para_evento_externo
        } catch (err) {
            console.error(`Error loading data for tab ${tab}:`, err);
            setInsights(prev => ({ ...prev, [tab]: `**Error al cargar datos para ${tab}:**\n- ${err instanceof Error ? err.message : String(err)}`}));
        } finally {
            setLoading(prev => ({ ...prev, [tab]: false }));
        }
    };
    // Load data when tab becomes active if not already loaded or insight generated
    if (!insights[activeTab]) { 
      loadDataForTab(activeTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


  const calculateMean = (values: number[]): number => values.length === 0 ? 0 : values.reduce((acc, val) => acc + val, 0) / values.length;
  const calculateStandardDeviation = (values: number[], mean: number): number => values.length === 0 ? 0 : Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length);
  const detectAnomaliesIQR = (values: number[]): boolean[] => {
    if (values.length < 4) return values.map(() => false);
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length / 4)];
    const q3 = sorted[Math.floor((sorted.length * 3) / 4)];
    const iqr = q3 - q1;
    if (iqr === 0) return values.map(() => false); // Avoid division by zero or meaningless bounds
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
      if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
        if (inList) html += `</${listType}>`;
        inList = false;
        const level = line.startsWith('### ') ? 5 : (line.startsWith('## ') ? 4 : 3);
        html += `<h${level} class="text-lg font-semibold text-gray-800 dark:text-white mt-3 mb-1">${line.replace(/^#+\s*/, '')}</h${level}>`;
      } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
        if (inList) html += `</${listType}>`;
        inList = false;
        html += `<h4 class="text-md font-semibold text-gray-700 dark:text-gray-300 mt-2 mb-1">${line.substring(2, line.length - 2)}</h4>`;
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        if (!inList || listType === 'ol') {
          if (inList) html += `</${listType}>`;
          listType = 'ul';
          html += `<ul class="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300 ml-4">`;
          inList = true;
        }
        html += `<li>${line.substring(2)}</li>`;
      } else if (/^\d+\.\s/.test(line)) {
         if (!inList || listType === 'ul') {
          if (inList) html += `</${listType}>`;
          listType = 'ol';
          html += `<ol class="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-300 ml-4">`;
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
      return `**Información Simulada para ${type}**\n- Esta es una respuesta simulada porque la clave API no está configurada.\n- Configure su clave API de OpenRouter en config.ts para obtener información real.\n- Este es un ejemplo de formato con **markdown** y listas:\n  * Punto uno.\n  * Punto dos con *énfasis*.`;
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
    setLoading(prev => ({ ...prev, [type]: true }));
    setInsights(prev => ({ ...prev, [type]: undefined })); 
    let prompt = "";
    let generatedInsight = "";

    try {
      switch (type) {
        case "auditor":
          const { data: ordersData, error: ordersError } = await supabase
            .from("ordencompra")
            .select(`neto_a_pagar, solicitudcompra!ordencompra_solicitud_compra_id_fkey!inner(id, departamento!inner(id, nombre))`)
            .eq('estado', 'Completada')
            .returns<OrderForAuditor[]>();

          if (ordersError) throw ordersError;
          if (!ordersData || ordersData.length === 0) {
            generatedInsight = "**Sin Datos Suficientes**\n- No hay datos de órdenes completadas para analizar los gastos por departamento.";
            setDepartmentStatsForChart([]); setAnomalyChartData([]);
          } else {
            const departmentExpensesMap: { [key: string]: number[] } = {};
            ordersData.forEach(order => {
              const deptName = order.solicitudcompra?.departamento?.nombre || 'Desconocido';
              if (!departmentExpensesMap[deptName]) departmentExpensesMap[deptName] = [];
              departmentExpensesMap[deptName].push(order.neto_a_pagar || 0);
            });

            const localStats: AISummaryStat[] = Object.entries(departmentExpensesMap).map(([dept, amounts]) => {
              const mean = calculateMean(amounts);
              const stdDev = calculateStandardDeviation(amounts, mean);
              const anomalies = detectAnomaliesIQR(amounts); 
              return { dept, total: amounts.reduce((a, b) => a + b, 0), mean, stdDev, amounts, anomalies };
            });
            setDepartmentStatsForChart(localStats);

            const anomalyCounts = localStats.reduce((acc, deptStat) => {
                acc.anomalyCount += deptStat.anomalies.filter(Boolean).length;
                acc.normalCount += deptStat.anomalies.filter(a => !a).length;
                return acc;
            }, { anomalyCount: 0, normalCount: 0 });
            setAnomalyChartData([
                { name: "Anomalías Detectadas", value: anomalyCounts.anomalyCount },
                { name: "Transacciones Normales", value: anomalyCounts.normalCount },
            ]);

            const statsForPrompt = localStats.map(s => ({ departamento: s.dept, gasto_total: s.total, gasto_promedio: s.mean, desviacion_estandar: s.stdDev, numero_anomalias: s.anomalies.filter(Boolean).length, total_transacciones: s.amounts.length }));
            prompt = `Actúa como un auditor financiero experto. Analiza estos datos de gastos por departamento (en Bs.): ${JSON.stringify(statsForPrompt)}.
            Considera que una anomalía es un gasto significativamente diferente al promedio del departamento.
            Proporciona un resumen ejecutivo (1-2 párrafos). Luego, identifica 2-3 departamentos con gastos notables o anomalías significativas. Para cada uno, sugiere una posible causa y una acción correctiva o de investigación.
            Responde en ESPAÑOL. Formatea con títulos en markdown (ej. ## Resumen Ejecutivo, ## Análisis Detallado) y listas para las sugerencias.`;
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
              observaciones: p.observaciones,
          })).slice(0, 15); 

          if (performanceSummary.length === 0) {
             generatedInsight = "**Sin Datos de Rendimiento**\n- No hay evaluaciones de rendimiento de proveedores registradas. Complete evaluaciones después de que las órdenes sean completadas para habilitar este análisis detallado.";
          } else {
            prompt = `Como experto en optimización de la cadena de suministro, analiza estos datos de rendimiento de proveedores (calificaciones en escala 1-5 donde 5 es mejor; tiempo en días): ${JSON.stringify(performanceSummary)}.
                    Identifica proveedores destacados (alta calificación general, buen cumplimiento de tiempos). También identifica proveedores con áreas claras de mejora (bajas calificaciones, retrasos consistentes).
                    Sugiere 2-3 estrategias concisas y accionables para optimizar la selección y gestión de proveedores basadas en estos datos. Responde en ESPAÑOL. Formatea con títulos en markdown y listas.`;
            generatedInsight = await fetchAIResponse(prompt, type);
          }
          break;

        case "predictor":
            const consumoResumen = consumptionData.map(c => ({
                producto: c.producto?.descripcion || `ID ${c.producto_id}`,
                cantidad_total_consumida_historica: c.cantidad_consumida,
                fecha_ultimo_consumo_registrado: c.fecha_consumo,
                tipo_consumo: c.tipo_consumo,
            })).slice(0, 15); 
             const metricasResumen = monthlyMetricsData.map(m => ({
                producto: m.producto?.descripcion || `ID ${m.producto_id}`,
                mes: m.mes,
                cantidad_comprada_ese_mes: m.cantidad_comprada_total,
                gasto_en_producto_ese_mes: m.gasto_total_producto,
                numero_ordenes_ese_mes_para_producto: m.numero_ordenes,
            })).slice(0,15);

            if(consumoResumen.length === 0 && metricasResumen.length === 0) {
                generatedInsight = "**Sin Datos para Predicción**\n- No hay datos suficientes en 'consumo_historico_producto' o 'metricas_producto_mensual'. Registre consumos y complete órdenes para habilitar las predicciones."
            } else {
                prompt = `Eres un analista de inventario experto. Basado en este historial de consumo de productos: ${JSON.stringify(consumoResumen)} y estas métricas mensuales de compra/gasto de productos: ${JSON.stringify(metricasResumen)}.
                        Identifica 2-3 productos con alto consumo o patrones de compra recurrentes. Para estos productos, predice posibles necesidades futuras a corto plazo (ej. próximo mes o trimestre).
                        Sugiere 2-3 acciones específicas para optimizar los niveles de stock para estos productos clave (ej. ajustar stock mínimo/máximo, programar compras).
                        Responde en ESPAÑOL. Formatea con títulos en markdown y listas para las predicciones y acciones.`;
                generatedInsight = await fetchAIResponse(prompt, type);
            }
          break;
        
        case "eventos_externos":
            prompt = `Como analista de eventos y logística, tu objetivo es entender cómo los eventos externos impactan el consumo de recursos de la empresa.
                      Considera que tienes acceso a datos de eventos externos (nombre del evento, fecha, tipo, organizador) y a datos internos de consumo de productos y compras asociadas a estos eventos.
                      Con base en esto, tu análisis debe incluir:
                      1. **Patrones de Consumo por Evento:** ¿Qué tipos de eventos (ej. ferias, congresos, reuniones específicas) tienden a generar mayor consumo de qué tipos de productos (ej. material promocional, equipos tecnológicos, suministros de oficina)?
                      2. **Productos Clave para Eventos:** Identifica si existen productos que se consumen recurrentemente o en grandes cantidades para tipos específicos de eventos.
                      3. **Impacto en Compras:** ¿Las compras asociadas a eventos se realizan con suficiente antelación? ¿Hay sobrecostos por compras de última hora?
                      4. **Recomendaciones de Optimización:** Ofrece 2-3 recomendaciones claras para mejorar la planificación de inventario, optimizar las compras y reducir costos relacionados con la participación en eventos externos.
                      Responde en ESPAÑOL. Usa formato Markdown con títulos claros (ej. ## Patrones de Consumo, ## Recomendaciones) y listas para facilitar la lectura.`;
            generatedInsight = await fetchAIResponse(prompt, type);
            break;

        case "asistente":
            prompt = `Actúa como un asistente de gestión de compras inteligente. Revisa estos datos (ficticios) y urgencias:
                    - Alerta CRÍTICA: Producto 'Tóner XP-500' tiene solo 5 unidades en stock (stock mínimo es 10), y se consumen 10 por semana.
                    - Información: Hay 3 solicitudes de compra pendientes de aprobación del departamento de Marketing por un total de $2500.
                    - Tendencia: El gasto en 'Material de Oficina' ha aumentado un 20% este mes en comparación con el promedio de los últimos 3 meses.
                    Proporciona un breve resumen ejecutivo (1-2 párrafos). Luego, ofrece 2-3 recomendaciones o alertas prioritarias basadas en esta información. Responde en ESPAÑOL. Usa títulos en markdown (ej. ## Resumen Ejecutivo, ## Alertas y Recomendaciones) y listas para las recomendaciones.`;
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
          
          {!insights[activeTab] && !loading[activeTab] && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Haga clic en "Generar Análisis" para ver la perspectiva de IA.
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
