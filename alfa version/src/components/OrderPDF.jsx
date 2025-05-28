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
      // 1. Cargar datos necesarios
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

      // 2. Validar datos críticos
      if (!ordenCompleta || !camara) {
        throw new Error(`
          Datos faltantes:
          ${!ordenCompleta ? '- Orden no encontrada\n' : ''}
          ${!camara ? '- Datos de la cámara no configurados' : ''}
        `);
      }

      // 3. Actualizar estado con nuevos datos
      setPdfData({ orden: ordenCompleta, camara });

      // 4. Esperar ciclo de renderizado completo
      await new Promise(resolve => setTimeout(resolve, 100));

      // 5. Configurar elemento temporal visible
      const originalStyle = contentRef.current.style.cssText;
      contentRef.current.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9999;
        visibility: visible;
      `;

      // 6. Generar PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#FFFFFF'
      });

      // 7. Restaurar estilos originales
      contentRef.current.style.cssText = originalStyle;

      // 8. Validar canvas
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('El canvas generado no tiene dimensiones válidas');
      }

      // 9. Guardar PDF
      const imgProps = pdf.getImageProperties(canvas);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`orden_${order.id}.pdf`);

    } catch (error) {
      console.error("Error generando PDF:", error);
      alert(`Error al generar PDF: ${error.message}`);
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

      {/* Contenedor PDF - Siempre presente en el DOM */}
      <div ref={contentRef} style={{
        width: '210mm',
        minHeight: '297mm',
        visibility: 'hidden',
        position: 'absolute',
        left: '-9999px',
        backgroundColor: 'white'
      }}>
        {pdfData && <PDFTemplate orden={pdfData.orden} camara={pdfData.camara} />}
      </div>
    </>
  );
};

export default OrderPDF;