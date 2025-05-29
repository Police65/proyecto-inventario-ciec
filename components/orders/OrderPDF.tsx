
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../supabaseClient';
import PDFTemplate from './PDFTemplate';
import { OrdenCompra as OrdenCompraType, Camaraindustriales, Empleado, OrdenCompraDetalle, Producto as ProductoType } from '../../types';
import { DocumentArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface OrderPDFProps {
  order: OrdenCompraType;
  buttonClass?: string;
  iconClass?: string;
  buttonText?: string;
  showText?: boolean;
}

interface FullOrdenCompraForPDF extends OrdenCompraType {
  proveedor: OrdenCompraType['proveedor'];
  productos: (OrdenCompraDetalle & { producto: ProductoType | undefined })[];
  empleado: Empleado | undefined;
}

interface PDFData {
    orden: FullOrdenCompraForPDF;
    camara: Camaraindustriales;
}

const OrderPDF = ({
    order,
    buttonClass = "p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors",
    iconClass = "w-5 h-5",
    buttonText = "Generar PDF",
    showText = false
}: OrderPDFProps): JSX.Element => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [pdfData, setPdfData] = useState<PDFData | null>(null);

  const handleGeneratePDF = async () => {
    setLoading(true);
    try {
      const { data: camaraData, error: camaraError } = await supabase
        .from('camaraindustriales')
        .select('*')
        .single<Camaraindustriales>();

      if (camaraError || !camaraData) {
        throw new Error(`Error obteniendo datos de la cámara: ${camaraError?.message || 'No data'}`);
      }

      const { data: ordenCompletaData, error: ordenError } = await supabase
        .from('ordencompra')
        .select(`
          *,
          proveedor:proveedor_id(*),
          productos:ordencompra_detalle(*, producto:producto_id(*)),
          empleado:empleado_id(*)
        `)
        .eq('id', order.id)
        .single<FullOrdenCompraForPDF>();

      if (ordenError || !ordenCompletaData) {
        throw new Error(`Error obteniendo datos completos de la orden: ${ordenError?.message || 'No data'}`);
      }

      setPdfData({ orden: ordenCompletaData, camara: camaraData });

      await new Promise(resolve => setTimeout(resolve, 100)); 

      if (!contentRef.current) {
        throw new Error("PDF template container not found.");
      }

      const originalStyle = contentRef.current.style.cssText;
      contentRef.current.style.position = 'fixed';
      contentRef.current.style.top = '0';
      contentRef.current.style.left = '0';
      contentRef.current.style.zIndex = '9999';
      contentRef.current.style.visibility = 'visible';
      contentRef.current.style.backgroundColor = '#FFFFFF';


      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
    
      });

      contentRef.current.style.cssText = originalStyle;

      if (canvas.width === 0 || canvas.height === 0) {
        console.error("Canvas generated with zero dimensions. Check CSS and content visibility.");
        throw new Error('El canvas generado no tiene dimensiones válidas. Puede ser un problema con los estilos o la visibilidad del contenido.');
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = imgProps.height / imgProps.width;
      const imgActualHeight = pdfWidth * ratio;

      if (imgActualHeight > pdfHeight) {
        let yPositionOnCanvas = 0;
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        if (!pageCtx) throw new Error("Failed to get 2D context for page canvas.");

        const canvasPageHeightEquivalent = (pdfHeight / pdfWidth) * canvas.width;
        
        let pageCount = 0;
        while (yPositionOnCanvas < canvas.height && pageCount < 20) { 
            if (pageCount > 0) pdf.addPage();

            pageCanvas.width = canvas.width;
            const chunkHeightOnCanvas = Math.min(canvasPageHeightEquivalent, canvas.height - yPositionOnCanvas);
            pageCanvas.height = chunkHeightOnCanvas;

            pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageCtx.drawImage(canvas, 0, yPositionOnCanvas, canvas.width, chunkHeightOnCanvas, 0, 0, canvas.width, chunkHeightOnCanvas);
            
            const pageImgData = pageCanvas.toDataURL('image/png');
            const chunkImgHeightOnPdf = pdfWidth * (pageCanvas.height / pageCanvas.width);
            pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, chunkImgHeightOnPdf);
            
            yPositionOnCanvas += chunkHeightOnCanvas;
            pageCount++;
        }
        pageCanvas.remove();
      } else {
         pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgActualHeight);
      }

      pdf.save(`orden_${order.id}.pdf`);

    } catch (error) {
      console.error("Error generando PDF:", error);
      alert(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
      setPdfData(null);
    }
  };

  return (
    <>
      <button
        onClick={handleGeneratePDF}
        disabled={loading}
        className={`${buttonClass} ${loading ? 'cursor-not-allowed' : ''} flex items-center`}
        title={buttonText || "Generar PDF"}
      >
        {loading ? (
          <ArrowPathIcon className={`${iconClass} animate-spin`} />
        ) : (
          <DocumentArrowDownIcon className={iconClass} />
        )}
        {showText && <span className="ml-2">{loading ? 'Generando...' : (buttonText || "Generar PDF")}</span>}
      </button>

      <div
        ref={contentRef}
        style={{
            width: '210mm', 
            minHeight: pdfData ? '297mm' : 'auto', 
            visibility: 'hidden',
            position: 'absolute',
            left: '-9999px', 
            backgroundColor: '#FFFFFF',
            padding: '0',
            margin: '0',
        }}
      >
        {pdfData && <PDFTemplate orden={pdfData.orden} camara={pdfData.camara} />}
      </div>
    </>
  );
};

export default OrderPDF;
