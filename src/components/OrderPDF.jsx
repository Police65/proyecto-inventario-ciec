import React, { useRef } from 'react';
import { Button } from 'react-bootstrap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const OrderPDF = ({ order }) => {
  const contentRef = useRef(null);

  // Formatear fechas en español
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  // Formatear montos con separadores
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  const handleGeneratePDF = async () => {
    const input = contentRef.current;
    
    // 1. Hacer visible temporalmente el contenido
    const originalStyles = {
      position: input.style.position,
      visibility: input.style.visibility,
      zIndex: input.style.zIndex,
      top: input.style.top,
      left: input.style.left
    };

    Object.assign(input.style, {
      position: 'fixed',
      visibility: 'visible',
      zIndex: '9999',
      top: '0',
      left: '0'
    });

    try {
      // 2. Configuración avanzada de captura
      const canvas = await html2canvas(input, {
        scale: 2,
        logging: true,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        onclone: (clonedDoc, element) => {
          element.style.fontFamily = 'Arial, sans-serif';
        }
      });

      // 3. Generar PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(canvas, 'PNG', 0, 0, imgWidth, imgHeight, '', 'FAST');
      pdf.save(`orden_compra_${order.id}.pdf`);

    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el documento');
    } finally {
      // 4. Restaurar estilos originales
      Object.assign(input.style, originalStyles);
    }
  };

  return (
    <>
      <Button 
        variant="primary" 
        onClick={handleGeneratePDF}
        size="sm"
        className="mb-2"
      >
        Generar PDF
      </Button>

      {/* Plantilla PDF - Versión Mejorada */}
      <div 
        ref={contentRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '210mm',
          minHeight: '297mm',
          backgroundColor: 'white',
          visibility: 'hidden',
          padding: '20px',
          boxSizing: 'border-box',
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px'
        }}
      >
        {/* Cabecera Institucional */}
        <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000' }}>
          <h2 style={{ fontSize: '22px', margin: '5px 0' }}>Cámara de Industriales del Estado Carabobo</h2>
          <h3 style={{ fontSize: '18px', margin: '5px 0' }}>Coordinación de Administración y Finanzas</h3>
          <h3 style={{ fontSize: '16px', margin: '5px 0' }}>Orden de Compra N°: CIEC-{order.id}</h3>
          <p style={{ margin: '3px 0' }}>{formatDate(order.fecha_orden)}</p>
        </div>

        {/* Datos del Proveedor */}
        <table style={{ width: '100%', margin: '15px 0', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '20%', padding: '5px' }}><strong>Proveedor:</strong></td>
              <td style={{ width: '30%', padding: '5px' }}>{order.proveedor?.nombre || 'N/A'}</td>
              <td style={{ width: '20%', padding: '5px' }}><strong>RIF:</strong></td>
              <td style={{ width: '30%', padding: '5px' }}>{order.proveedor?.rif || 'N/A'}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px' }}><strong>Dirección:</strong></td>
              <td colSpan="3" style={{ padding: '5px' }}>{order.proveedor?.direccion || 'N/A'}</td>
            </tr>
            <tr>
              <td style={{ padding: '5px' }}><strong>Contacto:</strong></td>
              <td style={{ padding: '5px' }}>{order.proveedor?.telefono || 'N/A'}</td>
              <td style={{ padding: '5px' }}><strong>Correo:</strong></td>
              <td style={{ padding: '5px' }}>{order.proveedor?.correo || 'N/A'}</td>
            </tr>
          </tbody>
        </table>

        {/* Tabla de Productos */}
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          margin: '15px 0',
          border: '1px solid #000'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ border: '1px solid #000', padding: '8px' }}>Código</th>
              <th style={{ border: '1px solid #000', padding: '8px' }}>Cantidad</th>
              <th style={{ border: '1px solid #000', padding: '8px' }}>Descripción</th>
              <th style={{ border: '1px solid #000', padding: '8px' }}>P. Unitario</th>
              <th style={{ border: '1px solid #000', padding: '8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.productos?.map((item, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #000', padding: '8px' }}>
                  {item.producto?.ref || 'N/A'}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>
                  {item.cantidad}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>
                  {item.producto?.descripcion || 'N/A'}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {formatCurrency(item.precio_unitario)}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {formatCurrency(item.cantidad * item.precio_unitario)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Sección de Totales */}
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <div style={{ display: 'inline-block', textAlign: 'left' }}>
            <p style={{ margin: '5px 0' }}>
              <strong>Subtotal:</strong> {formatCurrency(order.sub_total)}
            </p>
            <p style={{ margin: '5px 0' }}>
              <strong>IVA (16%):</strong> {formatCurrency(order.iva)}
            </p>
            <p style={{ margin: '5px 0' }}>
              <strong>Ret. IVA (75%):</strong> {formatCurrency(order.ret_iva)}
            </p>
            <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>
              <strong>Neto a Pagar:</strong> {formatCurrency(order.neto_a_pagar)}
            </p>
          </div>
        </div>

        {/* Firmas Autorizadas */}
        <div style={{ 
          marginTop: '40px', 
          display: 'flex', 
          justifyContent: 'space-between',
          paddingTop: '30px',
          borderTop: '1px solid #000'
        }}>
          <div style={{ width: '45%', textAlign: 'center' }}>
            <p style={{ borderBottom: '1px solid #000', paddingBottom: '30px' }}>
              {order.empleado?.nombre} {order.empleado?.apellido}
            </p>
            <strong>Elaborado por</strong>
            <p>Departamento de Compras</p>
          </div>
          
          <div style={{ width: '45%', textAlign: 'center' }}>
            <p style={{ borderBottom: '1px solid #000', paddingBottom: '30px' }}></p>
            <strong>Aprobado por</strong>
            <p>Coordinación Financiera</p>
          </div>
        </div>

        {/* Pie de Página Institucional */}
        <div style={{ 
          marginTop: '30px', 
          textAlign: 'center', 
          fontSize: '10px',
          color: '#666'
        }}>
          <p>Zona Industrial Municipal Norte - Valencia, Estado Carabobo</p>
          <p>Teléfonos: (0241) 634.920 / 617.0269 - RIF: J-07510911-2</p>
        </div>
      </div>
    </>
  );
};

export default OrderPDF;