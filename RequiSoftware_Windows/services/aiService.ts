import { supabase } from '../supabaseClient';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from '../config';

interface ProductInput {
  productId: number;
  quantity: number;
}

async function getProductNames(productIds: number[]): Promise<string[]> {
  if (productIds.length === 0) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('producto')
      .select('id, descripcion')
      .in('id', productIds)
      .returns<{id: number, descripcion: string | null}[]>();

    if (error) {
      console.error('Error de Supabase al obtener nombres de productos:', error.message, error.details, error.code);
      // En caso de error de BD, devolvemos identificadores genéricos para no romper el flujo
      return productIds.map(id => `Producto #${id}`);
    }

    const nameMap = new Map(
      (data || []).map(p => [
        p.id,
        p.descripcion || `Producto #${p.id}` 
      ])
    );

    return productIds.map((id): string => {
      const valueFromMap = nameMap.get(id);
      if (typeof valueFromMap === 'string') {
        return valueFromMap;
      }
      return `Producto #${id}`;
    });

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Fallo en getProductNames:', errorMessage, e);
    return productIds.map(id => `Producto #${id}`);
  }
}

async function generateDescription(products: ProductInput[]): Promise<string> {
  const productIds = products.map(p => p.productId);
  
  // 1. Obtener nombres de productos (necesario tanto para IA como para el fallback manual)
  const productNames = await getProductNames(productIds);
  
  if (productNames.length === 0) return "Solicitud de compra (sin detalles)";

  const productList = productNames.join(", ");
  
  // Función auxiliar para generar descripción manual si la IA falla
  const generateManualDescription = () => {
      const count = productNames.length;
      if (count === 1) return `Solicitud de ${productNames[0]}`;
      if (count === 2) return `Solicitud de ${productNames[0]} y ${productNames[1]}`;
      if (count === 3) return `Solicitud de ${productNames[0]}, ${productNames[1]} y ${productNames[2]}`;
      return `Solicitud de ${productNames[0]}, ${productNames[1]} y ${count - 2} más`;
  };

  try {
    // Verificar si existe la clave antes de intentar usar la IA
    if (!GEMINI_API_KEY || (GEMINI_API_KEY as string) === "TU_CLAVE_API_GEMINI_AQUI") {
        console.warn("API_KEY no definida o es el placeholder en config.ts. Usando descripción manual.");
        return generateManualDescription();
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    const prompt = `Como asistente de compras, genera una descripción muy breve (máximo 5 palabras) para una solicitud que contiene: ${productList}. Ejemplo: "Suministros de Oficina". NO uses comillas.`;

    // console.log("Prompt enviado a Gemini:", prompt);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          maxOutputTokens: 50,
      }
    });

    const responseText = response.text;

    if (!responseText) {
      throw new Error("La respuesta de la IA fue vacía.");
    }

    let generatedDesc = responseText.trim().replace(/["*]/g, '');
    
    // Limpieza básica
    if (!generatedDesc.toLowerCase().startsWith("solicitud")) {
        generatedDesc = generatedDesc.charAt(0).toUpperCase() + generatedDesc.slice(1);
    }
    
    const words = generatedDesc.split(/\s+/);
    if (words.length > 10) { 
        generatedDesc = words.slice(0, 10).join(" ") + "...";
    }
    return generatedDesc;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fallo en IA (usando fallback manual). Error:", errorMessage);
    
    // FALLBACK ROBUSTO: Usar la descripción manual basada en los nombres de productos
    return generateManualDescription().substring(0, 255);
  }
}

export { getProductNames, generateDescription };