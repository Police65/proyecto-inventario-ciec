import React, { useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../supabaseClient';
import PDFTemplate from './PDFTemplate';

const OrderPDF = ({ order }) => {
  const contentRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [pdfData, setPdfData] = useState(null);

  const handleGeneratePDF = async () => {
    setLoading(true);
    try {
      const [
        { data: camara }, 
        { data: ordenCompleta }
      ] = await Promise.all([
        supabase.from('camaraindustriales').select('*').single(),
        supabase.from('ordencompra')
          .select(`
            *,
            proveedor:proveedor_id(*),
            productos:ordencompra_detalle(
              *,
              producto:producto_id(*)
            ),
            empleado:empleado_id(*)
          `)
          .eq('id', order.id)
          .single()
      ]);

      if (!ordenCompleta || !camara) {
        throw new Error('Datos incompletos para generar el PDF');
      }

      setPdfData({ orden: ordenCompleta, camara });
      
      // Esperar ciclo de renderizado
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      const input = contentRef.current;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        windowWidth: 794,
        windowHeight: 1123,
        logging: true
      });

      if (!canvas.width || !canvas.height) {
        throw new Error('El canvas no tiene dimensiones válidas');
      }

      pdf.addImage(canvas, 'PNG', 0, 0, 210, 297);
      pdf.save(`orden_${order.id}.pdf`);

    } catch (error) {
      console.error("Error generando PDF:", error);
      alert('Error al generar el PDF: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="primary" 
        onClick={handleGeneratePDF}
        size="sm"
        disabled={loading}
      >
        {loading ? 'Generando...' : 'Generar PDF'}
      </Button>

      <div ref={contentRef} style={{ 
        position: 'absolute',
        left: '-9999px',
        width: '210mm',
        height: '297mm',
        visibility: 'hidden'
      }}>
        {pdfData && (
          <PDFTemplate 
            orden={pdfData.orden} 
            camara={pdfData.camara} 
          />
        )}
      </div>
    </>
  );
};

export default OrderPDF;