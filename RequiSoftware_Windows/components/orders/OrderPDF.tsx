import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../supabaseClient';
import PDFTemplate from './PDFTemplate';
import { OrdenCompra as OrdenCompraType, Camaraindustriales, Proveedor, Empleado, OrdenCompraDetalle, Producto as ProductoType } from '../../types';
import { DocumentArrowDownIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface OrderPDFProps {
  order: OrdenCompraType;
  buttonClass?: string;
  iconClass?: string;
  buttonText?: string;
  showText?: boolean;
}

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
  buttonClass: customButtonClass,
  iconClass: customIconClass,
  buttonText: customButtonText,
  showText = false
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [pdfData, setPdfData] = useState<PDFRenderData | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'loading' | 'success' | 'error', message: string } | null>(null);

  const defaultButtonClass = "p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors";
  const defaultIconClass = "w-5 h-5";
  const defaultButtonText = "Generar PDF";

  const currentButtonClass = customButtonClass || defaultButtonClass;
  const currentIconClass = customIconClass || defaultIconClass;
  const currentButtonText = customButtonText || defaultButtonText;

  const handleGeneratePDF = async () => {
    setLoading(true);
    setFeedback({ type: 'loading', message: 'Preparando datos para el PDF...' });
    setPdfData(null);

    try {
      // FIX: Use .limit(1).single() to safely fetch one record or null.
      const { data: camara, error: camaraError } = await supabase
        .from('camaraindustriales')
        .select('*')
        .limit(1)
        .single<Camaraindustriales>();

      if (camaraError) {
        throw new Error(`Error de base de datos al buscar datos de la cámara: ${camaraError.message}`);
      }
      if (!camara) {
        throw new Error('No se encontraron los datos de la cámara industrial. Verifique la configuración.');
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

      setFeedback({ type: 'loading', message: 'Generando vista previa del PDF...' });
      await new Promise(resolve => setTimeout(resolve, 200));

      if (!contentRef.current) {
        throw new Error("El contenedor del PDF no está disponible.");
      }

      const originalStyle = contentRef.current.style.cssText;
      contentRef.current.style.position = 'fixed';
      contentRef.current.style.top = '0px';
      contentRef.current.style.left = '0px';
      contentRef.current.style.zIndex = '9999';
      contentRef.current.style.visibility = 'visible';
      contentRef.current.style.backgroundColor = '#FFFFFF';
      contentRef.current.style.width = '210mm';
      contentRef.current.style.minHeight = '297mm';

      setFeedback({ type: 'loading', message: 'Procesando PDF, por favor espere...' });
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#FFFFFF',
      });

      contentRef.current.style.cssText = originalStyle;

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('El canvas generado no tiene dimensiones válidas.');
      }
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(canvas);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      pdf.save(`orden_de_compra_${order.id}.pdf`);

      setFeedback({ type: 'success', message: '¡PDF generado! La descarga ha comenzado.' });
      setTimeout(() => setFeedback(null), 5000);

    } catch (error) {
      console.error("Error generando PDF:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFeedback({ type: 'error', message: errorMessage });
      if (contentRef.current) {
        contentRef.current.style.cssText = '';
      }
    } finally {
      setLoading(false);
      setPdfData(null);
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

      {feedback && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black bg-opacity-60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="feedback-title">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex items-center space-x-4 max-w-md w-full">
            {feedback.type === 'loading' && <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-500 flex-shrink-0" />}
            {feedback.type === 'success' && <CheckCircleIcon className="w-8 h-8 text-green-500 flex-shrink-0" />}
            {feedback.type === 'error' && <ExclamationTriangleIcon className="w-8 h-8 text-red-500 flex-shrink-0" />}
            <div>
              <p id="feedback-title" className="font-semibold text-gray-800 dark:text-white">
                {feedback.type === 'loading' ? 'Generando PDF' : feedback.type === 'success' ? 'Éxito' : 'Error'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{feedback.message}</p>
              {feedback.type !== 'loading' && (
                <button onClick={() => setFeedback(null)} className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline">
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={contentRef}
        style={{
          width: '210mm',
          minHeight: '297mm',
          visibility: 'hidden',
          position: 'absolute',
          left: '-9999px',
          top: '0px',
          backgroundColor: 'white',
          padding: '0', margin: '0', border: 'none',
        }}
        aria-hidden="true"
      >
        {pdfData && <PDFTemplate orden={pdfData.orden} camara={pdfData.camara} />}
      </div>
    </>
  );
};

export default OrderPDF;
