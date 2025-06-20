
import React, { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { UserProfile } from '../../types'; // Relative path
import { OPENROUTER_API_KEY, OPENROUTER_API_URL } from '../../config'; // Relative path
import DOMPurify from 'dompurify'; // From esm.sh
import * as aiDataService from '../../services/aiDataService'; // Changed to relative path

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ChatInterfaceProps {
  userProfile: UserProfile;
}

const SITE_URL_AI_CHAT = typeof window !== 'undefined' ? window.location.origin : "https://requisoftware-ciec.example.com";

// Moved parseChatResponseToHTML outside the component
const parseChatResponseToHTML = (text: string): string => {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType: 'ol' | 'ul' = 'ul';

  lines.forEach(line => {
    let processedLine = line
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    processedLine = processedLine.trim();
    
    if (processedLine.startsWith('[Datos del sistema:')) {
        if (inList) html += `</${listType}>`;
        inList = false;
        const contextContent = DOMPurify.sanitize(processedLine);
        html += `<p class="my-1 p-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-blue-600 dark:text-blue-300 italic">${contextContent}</p>`;
        return; 
    }

    if (processedLine.startsWith('### ') || processedLine.startsWith('## ') || processedLine.startsWith('# ')) {
      if (inList) html += `</${listType}>`;
      inList = false;
      const level = processedLine.startsWith('### ') ? 5 : (processedLine.startsWith('## ') ? 4 : 3);
      const headingContent = DOMPurify.sanitize(processedLine.replace(/^#+\s*/, ''));
      html += `<h${level} class="text-md font-semibold my-1">${headingContent}</h${level}>`;
    } else if (processedLine.startsWith('* ') || processedLine.startsWith('- ')) {
      if (!inList || listType === 'ol') {
        if (inList) html += `</${listType}>`;
        listType = 'ul';
        html += `<ul class="list-disc list-inside space-y-0.5 ml-4">`;
        inList = true;
      }
      const listItemContent = DOMPurify.sanitize(processedLine.substring(2));
      html += `<li>${listItemContent}</li>`;
    } else if (/^\d+\.\s/.test(processedLine)) {
       if (!inList || listType === 'ul') {
        if (inList) html += `</${listType}>`;
        listType = 'ol';
        html += `<ol class="list-decimal list-inside space-y-0.5 ml-4">`;
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
      html += `<p class="my-1">${paragraphContent}</p>`;
    }
  });
  if (inList) html += `</${listType}>`;
  return html;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userProfile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingContext, setIsFetchingContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const systemPrompt = `Eres RequiAsistente, un asistente virtual experto integrado en RequiSoftware CIEC. Ayudas a ${userProfile.empleado?.nombre || 'un usuario'} del departamento de ${userProfile.departamento?.nombre || 'Desconocido'}.
REGLAS CRÍTICAS E INQUEBRANTABLES:
1.  **BAJO NINGUNA CIRCUNSTANCIA DEBES generar el texto '[Datos del sistema: ...]' por tu cuenta.** Este texto es una señal que SOLO YO (el frontend) usaré para indicarte que la información que sigue es un dato real obtenido de la base de datos, directamente relevante para tu pregunta actual.
2.  **SI MI MENSAJE (el que recibes como 'user') NO CONTIENE el prefijo '[Datos del sistema: ...]', significa que NO hay datos del sistema para tu pregunta.** En este caso, DEBES indicar que no tienes la información específica solicitada o que no se pudo encontrar. Por ejemplo: "No tengo información sobre el stock de 'pendrives' en este momento." o "No pude encontrar productos en la categoría 'limpieza'." **NO INVENTES datos. NO INVENTES el prefijo.**
3.  Si el texto que YO te proporciono SÍ comienza con '[Datos del sistema: ...]' y este dice 'No se encontró X', 'La categoría X no existe', 'No hay productos en la categoría X', o un resultado similar, DEBES transmitir ese mensaje tal cual al usuario. Ejemplo: "El sistema indica: La categoría 'Limpieza' no fue encontrada."
4.  Si te proporciono una lista de productos (ej. de una categoría, o todos los productos), esta lista SOLO contendrá descripción, ID y código interno, y a veces nombre de categoría. **NO INCLUIRÁ precios ni stock.** Si el usuario pregunta por precio o stock en el contexto de una lista general, DEBES aclarar que esa información no está incluida y que puede preguntar por el stock de un producto específico. **NO INVENTES precios ni stock.**
5.  El sistema (YO, el frontend) SÍ puede proporcionarte información (a través del prefijo '[Datos del sistema: ...]') sobre: Conteos de entidades (órdenes, productos, categorías, proveedores, departamentos), detalles básicos de productos (descripción, código, categoría, y stock si se pregunta específicamente por un producto), detalles de proveedores, stock de un producto específico (si se pregunta directamente), gastos de departamento (por período), listas de productos (generales o por categoría, estas listas NO incluyen precio ni stock) y lista de todas las categorías de producto.
6.  NO tienes acceso directo a información personal detallada de Empleados (cédula, firma, etc.) o Perfiles de Usuario (contraseñas, emails de autenticación, roles, etc.). Limítate a la información agregada o contextual que se te provea.
7.  Si el usuario hace una pregunta general como "dime toda esa información general", y no te proporciono datos del sistema (es decir, mi mensaje no tiene el prefijo '[Datos del sistema: ...]'), debes sugerir los tipos de consultas específicas que sí puedes manejar (basado en el punto 5). Ejemplo: "Puedo darte una lista de productos, detalles de un producto o proveedor específico, o el stock de un producto. ¿Qué información específica te gustaría saber?"
8.  Responde en ESPAÑOL. Sé conciso y profesional. NO generes código. Utiliza markdown para formatear tu respuesta (listas, negritas, etc.).`;


  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '-user',
      text: trimmedInput,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsFetchingContext(true);

    let contextDataString = ""; 
    const lowerInput = trimmedInput.toLowerCase();
    let dataServiceCallMade = false; // Flag to track if any data service function was called

    try {
        if (lowerInput.includes("solicitudes pendientes")) {
            dataServiceCallMade = true;
            const result = await aiDataService.getPendingRequestsCount();
            contextDataString = typeof result === 'number' ? `Actualmente hay ${result} solicitudes de compra pendientes.` : `${result}`;
        } else if (lowerInput.match(/cuántas órdenes de compra hay|total de órdenes de compra/i)) {
            dataServiceCallMade = true;
            const result = await aiDataService.getTotalPurchaseOrdersCount();
            contextDataString = typeof result === 'number' ? `Hay ${result} órdenes de compra registradas en total.` : `${result}`;
        } else if (lowerInput.match(/cuántos productos hay|total de productos/i)) {
            dataServiceCallMade = true;
            const result = await aiDataService.getTotalProductsCount();
            contextDataString = typeof result === 'number' ? `Hay un total de ${result} productos registrados.` : `${result}`;
        } else if (lowerInput.match(/lista de productos|todos los productos/i)) {
            dataServiceCallMade = true;
            const result = await aiDataService.getAllProducts(10); 
            if (Array.isArray(result)) {
              const totalCountResult = await aiDataService.getTotalProductsCount();
              const totalCount = typeof totalCountResult === 'number' ? totalCountResult : 'varios';
              contextDataString = `Aquí tienes los primeros ${result.length} productos de ${totalCount} en total: ${JSON.stringify(result.map(p => ({ id: p.id, descripcion: p.descripcion, codigo_interno: p.codigo_interno, categoria_nombre: p.categoria_nombre })))}. Esta lista no incluye precios ni stock.`;
            } else { // Is a string (e.g., "No hay productos...")
              contextDataString = `${result}`;
            }
        } else if (lowerInput.match(/(?:productos (?:de|en) la categor(?:í|ia)a|qu(?:é|e) productos hay en la categor(?:í|ia)a|ver los productos de|dame los productos de(?: la categor(?:í|ia)a)?)\s*([\w\sáéíóúñÁÉÍÓÚÑ]+)/i)) {
            dataServiceCallMade = true;
            const categoryMatch = lowerInput.match(/(?:productos (?:de|en) la categor(?:í|ia)a|qu(?:é|e) productos hay en la categor(?:í|ia)a|ver los productos de|dame los productos de(?: la categor(?:í|ia)a)?)\s*([\w\sáéíóúñÁÉÍÓÚÑ]+)/i);
            if (categoryMatch && categoryMatch[1]) {
                const categoryName = categoryMatch[1].trim();
                const result = await aiDataService.getProductsByCategoryName(categoryName, 10);
                if (Array.isArray(result)) {
                     contextDataString = `Productos de la categoría '${categoryName}' (hasta 10): ${JSON.stringify(result.map(p => ({ id: p.id, descripcion: p.descripcion, codigo_interno: p.codigo_interno })))}. Esta lista no incluye precios ni stock.`;
                } else { // Is a string (e.g., "Categoría no encontrada" or "No hay productos...")
                    contextDataString = `${result}`;
                }
            }
        } else if (lowerInput.match(/(?:dime las|lista de|cuáles son las|que) categor(?:í|ia)as (?:de productos)?(?: hay| existen| disponibles)?/i)) {
            dataServiceCallMade = true;
            const result = await aiDataService.getAllProductCategories();
            if (Array.isArray(result)) {
                contextDataString = `Las categorías de productos disponibles son: ${result.map(c => c.nombre).join(', ')}.`;
            } else { // Is a string (e.g., "No hay categorías...")
                contextDataString = `${result}`;
            }
        } else if (lowerInput.match(/cuántos proveedores hay|total de proveedores/i)) {
            dataServiceCallMade = true;
            const result = await aiDataService.getTotalSuppliersCount();
            contextDataString = typeof result === 'number' ? `Hay un total de ${result} proveedores registrados.` : `${result}`;
        } else if (lowerInput.match(/cuántos departamentos hay|total de departamentos/i)) {
            dataServiceCallMade = true;
            const result = await aiDataService.getTotalDepartmentsCount();
            contextDataString = typeof result === 'number' ? `Hay un total de ${result} departamentos registrados.` : `${result}`;
        } else if (lowerInput.match(/gasto(?:s)? (?:de|del departamento de|para el departamento de)\s*([\w\sáéíóúñ]+?)(?:\s+en (?:el|los)\s*(mes actual|últimos 30 días|año hasta la fecha|todos los tiempos))?/i)) {
            dataServiceCallMade = true;
            const expenseMatch = lowerInput.match(/gasto(?:s)? (?:de|del departamento de|para el departamento de)\s*([\w\sáéíóúñ]+?)(?:\s+en (?:el|los)\s*(mes actual|últimos 30 días|año hasta la fecha|todos los tiempos))?/i);
            if (expenseMatch && expenseMatch[1]) {
                const deptName = expenseMatch[1].trim();
                const periodMap = { "mes actual": "current_month", "últimos 30 días": "last_30_days", "año hasta la fecha": "year_to_date", "todos los tiempos": "all_time"} as const;
                type PeriodKey = keyof typeof periodMap;
                const periodInput = expenseMatch[2] as PeriodKey | undefined;
                const period = periodInput ? periodMap[periodInput] : 'all_time';
                const result = await aiDataService.getDepartmentExpenses(deptName, period);
                contextDataString = typeof result === 'number' ? `El gasto total del departamento '${deptName}' para '${periodInput || "todos los tiempos"}' es ${result.toLocaleString('es-VE', {style: 'currency', currency: 'VES'})}.` : `${result}`;
            }
        } else if (lowerInput.match(/(?:info(?:rmación)?|detalles) del producto (?:(?:llamado|con nombre|con código)\s*)?([a-zA-Z0-9\s\-_ÁÉÍÓÚáéíóúñÑ.]+)/i)) {
            dataServiceCallMade = true;
            const productMatch = lowerInput.match(/(?:info(?:rmación)?|detalles) del producto (?:(?:llamado|con nombre|con código)\s*)?([a-zA-Z0-9\s\-_ÁÉÍÓÚáéíóúñÑ.]+)/i);
            if (productMatch && productMatch[1]) {
              const identifier = productMatch[1].trim();
              const result = await aiDataService.getProductDetailsByNameOrCode(identifier);
              contextDataString = typeof result === 'object' && result !== null ? `Detalles del producto '${identifier}': ${JSON.stringify(result)}.` : `${result}`;
            }
        } else if (lowerInput.match(/(?:info(?:rmación)?|detalles) del proveedor (?:(?:llamado|con nombre|con RIF)\s*)?([a-zA-Z0-9\s\-_ÁÉÍÓÚáéíóúñÑJjVvGgEe]+)/i)) {
            dataServiceCallMade = true;
            const supplierMatch = lowerInput.match(/(?:info(?:rmación)?|detalles) del proveedor (?:(?:llamado|con nombre|con RIF)\s*)?([a-zA-Z0-9\s\-_ÁÉÍÓÚáéíóúñÑJjVvGgEe]+)/i);
            if (supplierMatch && supplierMatch[1]) {
                const identifier = supplierMatch[1].trim();
                const result = await aiDataService.getSupplierDetailsByNameOrRif(identifier);
                contextDataString = typeof result === 'object' && result !== null ? `Detalles del proveedor '${identifier}': ${JSON.stringify(result)}.` : `${result}`;
            }
        } else if (lowerInput.match(/(?:stock de|cuántos(?: hay de)?|hay)\s*(?:el|los|del)?\s*producto(?:s)?\s*([a-zA-Z0-9\s\-_ÁÉÍÓÚáéíóúñÑ.]+)(?:\s*en (?:el )?inventario)?/i)) {
            dataServiceCallMade = true;
            const stockMatch = lowerInput.match(/(?:stock de|cuántos(?: hay de)?|hay)\s*(?:el|los|del)?\s*producto(?:s)?\s*([a-zA-Z0-9\s\-_ÁÉÍÓÚáéíóúñÑ.]+)(?:\s*en (?:el )?inventario)?/i);
            if (stockMatch && stockMatch[1]) {
                const identifier = stockMatch[1].trim();
                const result = await aiDataService.getInventoryByProductNameOrCode(identifier);
                contextDataString = typeof result === 'object' && result !== null ? `Inventario para '${identifier}': ${JSON.stringify(result)}.` : `${result}`;
            }
        } else if (lowerInput.match(/(?:inventario actual|resumen de inventario|informaci(?:o|ó)n general del inventario)/i)) {
            dataServiceCallMade = true;
            const result = await aiDataService.getInventorySummary();
            contextDataString = typeof result === 'object' && result !== null ? `Resumen del inventario: ${JSON.stringify(result)}.` : `${result}`;
        } else if (lowerInput.match(/(?:info(?:rmación)?|detalles) de la orden (?:de compra )?#?(\d+)/i)) {
            dataServiceCallMade = true;
            const orderMatch = lowerInput.match(/(?:info(?:rmación)?|detalles) de la orden (?:de compra )?#?(\d+)/i);
            if (orderMatch && orderMatch[1]) {
                const orderId = parseInt(orderMatch[1], 10);
                const result = await aiDataService.getOrderDetailsById(orderId);
                contextDataString = typeof result === 'object' && result !== null ? `Detalles de la orden #${orderId}: ${JSON.stringify(result)}.` : `${result}`;
            }
        }

        // Prefix is added ONLY if a data service was called AND it returned a non-empty string (actual data or specific "not found" message)
        if (dataServiceCallMade && contextDataString && contextDataString.trim() !== "") {
            contextDataString = `[Datos del sistema: ${contextDataString}]`;
        } else if (dataServiceCallMade && (!contextDataString || contextDataString.trim() === "")) {
            // If a data service was called but returned nothing (e.g. an empty array that wasn't converted to a "not found" string by the service)
            // This path should ideally not be hit if services return specific "not found" strings for empty arrays.
            contextDataString = "[Datos del sistema: No se encontró información específica para su consulta en la base de datos.]";
        } else {
            contextDataString = ""; // Explicitly empty if no data service call was relevant.
        }

    } catch (dataFetchError) {
        console.error("Error fetching context data:", dataFetchError);
        contextDataString = "[Datos del sistema: Hubo un error al consultar la información de la base de datos para tu pregunta.]";
    }
    setIsFetchingContext(false);

    const chatHistoryForAI = messages.slice(-5).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    const aiPromptMessages = [
        { role: 'system', content: systemPrompt },
        ...chatHistoryForAI,
        // Pass contextDataString (which might be empty, or prefixed if data was fetched/not_found) and then the user's input
        { role: 'user', content: (contextDataString ? contextDataString + " " : "") + trimmedInput }
    ];
    
    try {
      if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.length < 10) {
        console.warn("La clave API de OpenRouter no está configurada o es inválida. Respuesta simulada.");
        setTimeout(() => {
            const simulatedResponse: ChatMessage = {
                id: Date.now().toString() + '-ai',
                text: "Respuesta simulada: Configura tu API Key para interactuar con el asistente real. " + (contextDataString ? `(Contexto simulado: ${contextDataString}) ` : "") + "Basado en tu pregunta, ¿cómo puedo ayudarte?",
                sender: 'ai',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, simulatedResponse]);
            setIsLoading(false);
        }, 1000);
        return;
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": SITE_URL_AI_CHAT,
          "X-Title": "RequiSoftware CIEC - Asistente IA con Datos",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "qwen/qwen3-30b-a3b:free", 
          messages: aiPromptMessages,
          max_tokens: 1500,
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error de API (${response.status}): ${errorBody}`);
      }
      const data = await response.json();

      if (data && data.choices && data.choices.length > 0 && data.choices[0].message && typeof data.choices[0].message.content === 'string') {
        const aiMessage: ChatMessage = {
          id: Date.now().toString() + '-ai',
          text: data.choices[0].message.content,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error("Respuesta de IA inválida o inesperada.");
      }
    } catch (error) {
      console.error("Error al obtener respuesta del Asistente Inteligente:", error);
      const errorMessageText = error instanceof Error ? error.message : String(error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '-error',
        text: `Lo siento, ocurrió un error al procesar tu solicitud: ${errorMessageText}. Por favor, intenta reformular tu pregunta o verifica la consola para más detalles técnicos.`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[65vh] bg-gray-50 dark:bg-gray-800/30 rounded-lg shadow">
      <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] p-2.5 rounded-xl shadow ${
                msg.sender === 'user'
                  ? 'bg-primary-500 text-white rounded-br-none'
                  : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none'
              }`}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: parseChatResponseToHTML(msg.text) }} />
              <p className={`text-xs mt-1.5 ${msg.sender === 'user' ? 'text-primary-200 text-right' : 'text-gray-400 dark:text-gray-500 text-left'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[70%] p-3 rounded-xl shadow bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none">
              <div className="flex items-center space-x-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {isFetchingContext ? "Consultando información..." : "Asistente está escribiendo..."}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 rounded-b-lg">
        <div className="flex items-center space-x-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }}
            placeholder="Escribe tu mensaje al Asistente Inteligente..."
            className="flex-grow p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="p-2.5 text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:bg-primary-300 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
            aria-label="Enviar mensaje"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};
export default ChatInterface;
