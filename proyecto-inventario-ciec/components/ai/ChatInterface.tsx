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

// This helper function asks the AI to act as a router, choosing which data function to call.
const getIntentFromQuery = async (query: string): Promise<{function: string; args: any}> => {
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.length < 10) {
        console.warn("API Key not found for intent router. Falling back to 'none'.");
        return { function: 'none', args: {} };
    }

    const availableFunctions = `
- getInventorySummary: Returns a high-level summary of the inventory. Call for general questions about inventory like 'how many products are in inventory?', 'what is the inventory status?'. Returns total distinct items in inventory and low-stock items count.
- getTotalProductsCount: Returns the total number of distinct products in the entire catalog, regardless of stock. Call for questions like 'how many product types do you manage?'.
- getTotalPurchaseOrdersCount: Returns the total number of purchase orders ever created. Call for 'how many orders have been made?'.
- getPendingRequestsCount: Returns the number of purchase requests with 'Pendiente' status. Call for questions about pending, open, or new requests.
- getProductDetailsByNameOrCode: Takes a required 'identifier' (string: product name or code). Returns details for a single product. Call for 'details of product X'.
- getInventoryByProductNameOrCode: Takes a required 'identifier' (string: product name or code). Returns the current stock level and location for a single product. Call this for any question about "stock", "cuanto(s) hay", "existencias", "disponibilidad" for a specific item.
- getAllProducts: Takes an optional 'limit' (number, default 10). Returns a list of all products. Call for "list of products", "show me the products".
- getProductsByCategoryName: Takes a required 'categoryName' (string) and an optional 'limit' (number, default 10). Returns a list of products in a given category.
- getAllProductCategories: Returns a list of all available product categories. Call for "what are the categories?".
- getOrderDetailsById: Takes a required 'orderId' (number). Returns details of a specific purchase order.
- getSupplierDetailsByNameOrRif: Takes a required 'identifier' (string, supplier name or RIF). Returns details for a single supplier.
- getTotalSuppliersCount: Returns the total number of suppliers.
- getTotalDepartmentsCount: Returns the total number of departments.
- getTotalExpenses: Takes an optional 'period' (string from 'current_month', 'last_30_days', 'year_to_date', 'all_time'). Returns the total amount of money spent on all completed purchase orders. Call for questions like 'how much was spent?', 'what are the total expenses?'.
- getDepartmentExpenses: Takes a required 'departmentName' (string) and an optional 'period' (string from 'current_month', 'last_30_days', 'year_to_date', 'all_time'). Returns the total expenses for a specific department.
    `;

    const intentPrompt = `You are a smart JSON-only router for a database query system. Analyze the user's question and determine which function to call and what arguments to extract.
    Available functions and their descriptions:
    ${availableFunctions}
    User question: "${query}"

    Your response MUST be a single line of valid JSON and nothing else.
    The JSON format is: {"function": "function_name", "args": {"arg_name": "value"}}.
    If no function is needed, or if the user is just chatting, respond with: {"function": "none"}.
    If a required argument is missing, return the argument key with a null value. E.g., for "dame los productos por categoria", respond: {"function": "getProductsByCategoryName", "args": {"categoryName": null}}.
    Extract arguments precisely. E.g., for "cuanto stock hay de la laptop dell xps", respond: {"function": "getInventoryByProductNameOrCode", "args": {"identifier": "laptop dell xps"}}.
    For "dame los detalles de la orden 123", respond: {"function": "getOrderDetailsById", "args": {"orderId": 123}}.
    For "cuales son las categorias", respond: {"function": "getAllProductCategories", "args": {}}.
    For "cuantos productos hay en el inventario?", respond: {"function": "getInventorySummary", "args": {}}.
    For "cuanto se ha gastado?", respond: {"function": "getTotalExpenses", "args": {"period": "all_time"}}.
    `;

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST", headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json",
                "HTTP-Referer": SITE_URL_AI_CHAT, "X-Title": "RequiSoftware CIEC - Intent Router"
            },
            body: JSON.stringify({ model: "qwen/qwen3-30b-a3b:free", messages: [{ role: "user", content: intentPrompt }], max_tokens: 200, temperature: 0 })
        });
        if (!response.ok) throw new Error(`API error (${response.status}): ${await response.text()}`);
        const data = await response.json();
        const responseText = data.choices[0].message.content;
        
        let jsonStr = responseText.trim();
        const fenceRegex = /^```json\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[1]) jsonStr = match[1];
        
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to get or parse intent from AI:", e);
        return { function: 'none', args: {} };
    }
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
1.  **BAJO NINGUNA CIRCUNSTANCIA DEBES generar el texto '[Datos del sistema: ...]' o '[Instrucción del sistema: ...]' por tu cuenta.** Este texto es una señal que SOLO YO (el frontend) usaré para darte contexto.
2.  Si mi mensaje (el que recibes como 'user') CONTIENE '[Instrucción del sistema: ...]', tu única tarea es seguir esa instrucción al pie de la letra para formular tu respuesta al usuario. Ejemplo: si la instrucción dice "pide el nombre de la categoría", tu respuesta debe ser algo como "¿De qué categoría te gustaría ver los productos?".
3.  Si mi mensaje CONTIENE '[Datos del sistema: ...]', esa es la información real y actualizada que debes usar para responder la pregunta del usuario. Si los datos dicen "No se encontró X", DEBES informar eso.
4.  Si mi mensaje NO CONTIENE ninguno de esos prefijos, significa que no se encontró una función de datos relevante para la pregunta. En este caso, DEBES indicar que no tienes la información específica y sugerir los tipos de consultas que sí puedes manejar (listas de productos, stock de un ítem, detalles de un proveedor, etc.).
5.  **NO INVENTES datos.** Si no tienes la información (porque no te la di), di que no la tienes.
6.  NO tienes acceso a información personal detallada de Empleados (cédula, firma) o Perfiles de Usuario (contraseñas, emails).
7.  Responde en ESPAÑOL. Sé conciso y profesional. NO generes código. Utiliza markdown para formatear tu respuesta (listas, negritas, etc.).`;

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    const userMessage: ChatMessage = { id: Date.now().toString() + '-user', text: trimmedInput, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsFetchingContext(true);

    let contextDataString = "";
    try {
      const intent = await getIntentFromQuery(trimmedInput);
      setIsFetchingContext(false);

      const missingArgs = Object.entries(intent.args || {}).filter(([_, value]) => value === null);

      if (intent.function !== 'none' && missingArgs.length > 0) {
        const missingArgNames = missingArgs.map(([key]) => `'${key}'`).join(', ');
        let followUpPrompt = `The user wants to use the function '${intent.function}' but is missing the required argument(s): ${missingArgNames}. Ask the user to provide this information.`;
        
        if (missingArgNames.includes("'categoryName'")) {
            followUpPrompt += " You can also suggest listing all available categories to help them choose.";
        }
        
        contextDataString = `[Instrucción del sistema: ${followUpPrompt}]`;
      
      } else if (intent && intent.function && intent.function !== 'none') {
        const { function: funcName, args } = intent;
        let result: any;
        
        const serviceFunctions: { [key: string]: Function } = {
          getPendingRequestsCount: aiDataService.getPendingRequestsCount,
          getTotalPurchaseOrdersCount: aiDataService.getTotalPurchaseOrdersCount,
          getTotalProductsCount: aiDataService.getTotalProductsCount,
          getProductDetailsByNameOrCode: aiDataService.getProductDetailsByNameOrCode,
          getTotalSuppliersCount: aiDataService.getTotalSuppliersCount,
          getSupplierDetailsByNameOrRif: aiDataService.getSupplierDetailsByNameOrRif,
          getInventoryByProductNameOrCode: aiDataService.getInventoryByProductNameOrCode,
          getOrderDetailsById: aiDataService.getOrderDetailsById,
          getTotalDepartmentsCount: aiDataService.getTotalDepartmentsCount,
          getInventorySummary: aiDataService.getInventorySummary,
          getAllProducts: aiDataService.getAllProducts,
          getProductsByCategoryName: aiDataService.getProductsByCategoryName,
          getAllProductCategories: aiDataService.getAllProductCategories,
          getDepartmentExpenses: aiDataService.getDepartmentExpenses,
          getTotalExpenses: aiDataService.getTotalExpenses,
        };

        if (serviceFunctions[funcName]) {
          const functionArgs = Object.values(args || {});
          result = await serviceFunctions[funcName](...functionArgs);
        } else {
            console.warn(`Intent router returned unknown function: ${funcName}`);
            result = `Función desconocida '${funcName}' solicitada.`;
        }

        contextDataString = `[Datos del sistema: ${typeof result === 'object' ? JSON.stringify(result) : result}]`;
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
        { role: 'user', content: (contextDataString ? contextDataString + " " : "") + trimmedInput }
    ];

    try {
      if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.length < 10) {
          throw new Error("API Key de OpenRouter no está configurada. Por favor, configure la clave en el archivo correspondiente.");
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST", headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json",
          "HTTP-Referer": SITE_URL_AI_CHAT, "X-Title": "RequiSoftware CIEC - Asistente IA"
        },
        body: JSON.stringify({
          model: "qwen/qwen3-30b-a3b:free", 
          messages: aiPromptMessages,
          max_tokens: 1500,
        })
      });

      if (!response.ok) throw new Error(`Error de API (${response.status}): ${await response.text()}`);
      const data = await response.json();

      if (data?.choices?.[0]?.message?.content) {
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
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '-error',
        text: `Lo siento, ocurrió un error al procesar tu solicitud: ${error instanceof Error ? error.message : String(error)}.`,
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
                  {isFetchingContext ? "Analizando consulta..." : "Asistente está escribiendo..."}
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