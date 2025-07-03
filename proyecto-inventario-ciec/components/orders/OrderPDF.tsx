import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../supabaseClient';
import PDFTemplate from './PDFTemplate';
import { OrdenCompra as OrdenCompraType, Camaraindustriales, Proveedor, Empleado, OrdenCompraDetalle, Producto as ProductoType } from '../../types';
import { DocumentArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface OrderPDFProps {
  order: OrdenCompraType; // Toma la propiedad básica de la orden
  buttonClass?: string;
  iconClass?: string;
  buttonText?: string;
  showText?: boolean;
}

// Interfaz para el objeto OrdenCompra completamente detallado después de la obtención
interface FullOrdenCompraForPDF extends OrdenCompraType {
  proveedor: Proveedor | undefined;
  productos: (OrdenCompraDetalle & { producto: ProductoType | undefined })[];
  empleado: Empleado | undefined;
}

interface PDFRenderData {
  orden: FullOrdenCompraForPDF;
  camara: Camaraindustriales;
}

const OrderPDF: React.FC<OrderPDFProps> = ({
  order,
  buttonClass: customButtonClass, // Renombrado para evitar conflicto
  iconClass: customIconClass,     // Renombrado
  buttonText: customButtonText,   // Renombrado
  showText = false
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [pdfData, setPdfData] = useState<PDFRenderData | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);


  const defaultButtonClass = "p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors";
  const defaultIconClass = "w-5 h-5";
  const defaultButtonText = "Generar PDF";

  const currentButtonClass = customButtonClass || defaultButtonClass;
  const currentIconClass = customIconClass || defaultIconClass;
  const currentButtonText = customButtonText || defaultButtonText;


  const handleGeneratePDF = async () => {
    setLoading(true);
    setPdfError(null);
    setPdfData(null);

    try {
      const { data: camara, error: camaraError } = await supabase
        .from('camaraindustriales')
        .select('*')
        .single<Camaraindustriales>();

      if (camaraError || !camara) {
        throw new Error(`Error obteniendo datos de la cámara: ${camaraError?.message || 'No data'}`);
      }

      const { data: ordenCompleta, error: ordenError } = await supabase
        .from('ordencompra')
        .select(`
          *,
          proveedor:proveedor_id(*),
          productos:ordencompra_detalle(*, producto:producto_id(*)),
          empleado:empleado_id(*)
        `)
        .eq('id', order.id)
        .single<FullOrdenCompraForPDF>();

      if (ordenError || !ordenCompleta) {
        throw new Error(`Error obteniendo datos completos de la orden: ${ordenError?.message || 'No data'}`);
      }
      
      setPdfData({ orden: ordenCompleta, camara });

      // Esperar ciclo de renderizado completo
      await new Promise(resolve => setTimeout(resolve, 150)); // Aumentado ligeramente desde 100ms

      if (!contentRef.current) {
        throw new Error("El contenedor del PDF no está disponible.");
      }

      const originalStyle = contentRef.current.style.cssText;
      contentRef.current.style.position = 'fixed';
      contentRef.current.style.top = '0px';
      contentRef.current.style.left = '0px';
      contentRef.current.style.zIndex = '9999';
      contentRef.current.style.visibility = 'visible';
      contentRef.current.style.backgroundColor = '#FFFFFF'; // Asegurar fondo para la captura
      // Asegurar ancho/alto basados en A4, o dejar que el contenido lo defina SI la raíz de PDFTemplate tiene estilo.
      // Para esta versión más simple, dependemos de que el div raíz de PDFTemplate tenga dimensiones A4.
      contentRef.current.style.width = '210mm'; // Coincidir con el estilo de PDFTemplate
      contentRef.current.style.minHeight = '297mm'; // Coincidir con el estilo de PDFTemplate

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#FFFFFF', // Asegurar fondo para la captura
        // Eliminar ancho/alto explícitos para dejar que html2canvas use las dimensiones del elemento
      });

      contentRef.current.style.cssText = originalStyle; // Restaurar estilos

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('El canvas generado no tiene dimensiones válidas.');
      }
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(canvas);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // La lógica anterior de múltiples páginas a veces creaba una página en blanco extra.
      // Según la solicitud del usuario de una sola página, ahora agregamos la imagen una vez.
      // jspdf recortará automáticamente cualquier contenido que exceda las dimensiones de la página.
      pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      pdf.save(`orden_${order.id}.pdf`);

    } catch (error) {
      console.error("Error generando PDF:", error);
      setPdfError(error instanceof Error ? error.message : String(error));
      if (contentRef.current) { // Asegurar que los estilos se restablezcan en caso de error
        contentRef.current.style.cssText = ''; // Restablecer al estilo predeterminado o al original guardado
      }
    } finally {
      setLoading(false);
      setPdfData(null); // Limpiar datos para ocultar PDFTemplate del DOM
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleGeneratePDF}
        disabled={loading}
        className={`${currentButtonClass} ${loading ? 'cursor-not-allowed opacity-70' : ''} flex items-center`}
        title={currentButtonText}
        aria-label={currentButtonText}
      >
        {loading ? (
          <ArrowPathIcon className={`${currentIconClass} animate-spin`} aria-hidden="true" />
        ) : (
          <DocumentArrowDownIcon className={currentIconClass} aria-hidden="true" />
        )}
        {showText && <span className="ml-2">{loading ? 'Generando...' : currentButtonText}</span>}
      </button>

      <div
        ref={contentRef}
        style={{
          width: '210mm',
          minHeight: '297mm',
          visibility: 'hidden',
          position: 'absolute',
          left: '-9999px',
          top: '0px',
          backgroundColor: 'white', // Fondo blanco explícito para la captura
          padding: '0', margin: '0', border: 'none',
        }}
        aria-hidden="true"
      >
        {pdfData && <PDFTemplate orden={pdfData.orden} camara={pdfData.camara} />}
      </div>
      {pdfError && <p className="text-xs text-red-500 mt-1" role="alert">Error PDF: {pdfError}</p>}
    </>
  );
};

export default OrderPDF;