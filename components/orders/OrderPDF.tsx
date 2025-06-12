
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../supabaseClient';
import PDFTemplate from './PDFTemplate';
import { OrdenCompra as OrdenCompraType, Camaraindustriales, Proveedor, Empleado, OrdenCompraDetalle, Producto as ProductoType } from '../../types';
import { DocumentArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface OrderPDFProps {
  order: OrdenCompraType; // Takes the basic order prop
  buttonClass?: string;
  iconClass?: string;
  buttonText?: string;
  showText?: boolean;
}

// Interface for the fully detailed OrdenCompra object after fetching
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
  buttonClass: customButtonClass, // Renamed to avoid conflict
  iconClass: customIconClass,     // Renamed
  buttonText: customButtonText,   // Renamed
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
      await new Promise(resolve => setTimeout(resolve, 150)); // Increased slightly from 100ms

      if (!contentRef.current) {
        throw new Error("El contenedor del PDF no está disponible.");
      }

      const originalStyle = contentRef.current.style.cssText;
      contentRef.current.style.position = 'fixed';
      contentRef.current.style.top = '0px';
      contentRef.current.style.left = '0px';
      contentRef.current.style.zIndex = '9999';
      contentRef.current.style.visibility = 'visible';
      contentRef.current.style.backgroundColor = '#FFFFFF'; // Ensure background for capture
      // Ensure width/height are set based on A4, or let content define it IF PDFTemplate's root is styled.
      // For this simpler version, we rely on PDFTemplate's root div having A4 dimensions.
      contentRef.current.style.width = '210mm'; // Match PDFTemplate's style
      contentRef.current.style.minHeight = '297mm'; // Match PDFTemplate's style

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#FFFFFF', // Ensure background for capture
        // Remove explicit width/height to let html2canvas use element's dimensions
      });

      contentRef.current.style.cssText = originalStyle; // Restore styles

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('El canvas generado no tiene dimensiones válidas.');
      }
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(canvas);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (pdfHeight <= pageHeight) {
        pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        // Basic multi-page handling (might need refinement for complex layouts)
        let heightLeft = pdfHeight;
        while (heightLeft > 0) {
          pdf.addImage(canvas, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
          position -= pageHeight; 
          if (heightLeft > 0) {
            pdf.addPage();
          }
        }
      }
      
      pdf.save(`orden_${order.id}.pdf`);

    } catch (error) {
      console.error("Error generando PDF:", error);
      setPdfError(error instanceof Error ? error.message : String(error));
      if (contentRef.current) { // Ensure styles are reset on error
        contentRef.current.style.cssText = ''; // Reset to default or saved original style
      }
    } finally {
      setLoading(false);
      setPdfData(null); // Clear data to hide PDFTemplate from DOM
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
          backgroundColor: 'white', // Explicit white background for capture
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
