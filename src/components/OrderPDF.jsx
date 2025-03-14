import React from 'react';
import { Button } from 'react-bootstrap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const OrderPDF = ({ order }) => {
  const handleGeneratePDF = () => {
    const input = document.getElementById(`order-pdf-${order.id}`);
    
    html2canvas(input, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`orden_compra_${order.id}.pdf`);
    });
  };

  return (
    <>
      <Button variant="primary" onClick={handleGeneratePDF} size="sm">
        Generar PDF
      </Button>

      {/* Plantilla HTML oculta con datos dinámicos */}
      <div id={`order-pdf-${order.id}`} style={{ position: 'absolute', left: '-9999px' }}>
        <div style={{ padding: '20px', fontFamily: 'Arial' }}>
          {/* Cabecera */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2>Cámara de Industriales</h2>
            <h3>Orden de Compra Nro: {order.id}</h3>
          </div>

          {/* Datos del proveedor */}
          <table style={{ width: '100%', marginBottom: '20px' }}>
            <tbody>
              <tr>
                <td><strong>PROVEEDOR:</strong></td>
                <td>{order.proveedor?.nombre || 'N/A'}</td>
                <td><strong>FECHA:</strong></td>
                <td>{new Date(order.fecha_orden).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td><strong>DIRECCIÓN:</strong></td>
                <td>{order.proveedor?.direccion || 'N/A'}</td>
                <td><strong>RIF:</strong></td>
                <td>{order.proveedor?.rif || 'N/A'}</td>
              </tr>
            </tbody>
          </table>

          {/* Tabla de productos */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '8px' }}>REF</th>
                <th style={{ border: '1px solid black', padding: '8px' }}>CANTIDAD</th>
                <th style={{ border: '1px solid black', padding: '8px' }}>DESCRIPCIÓN</th>
                <th style={{ border: '1px solid black', padding: '8px' }}>PRECIO UNITARIO ({order.unidad})</th>
                <th style={{ border: '1px solid black', padding: '8px' }}>TOTAL ({order.unidad})</th>
              </tr>
            </thead>
            <tbody>
              {order.productos?.map((producto, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid black', padding: '8px' }}>{producto.ref || 'N/A'}</td>
                  <td style={{ border: '1px solid black', padding: '8px' }}>{producto.cantidad}</td>
                  <td style={{ border: '1px solid black', padding: '8px' }}>{producto.descripcion}</td>
                  <td style={{ border: '1px solid black', padding: '8px' }}>{producto.precio_unitario?.toFixed(2)}</td>
                  <td style={{ border: '1px solid black', padding: '8px' }}>{(producto.cantidad * producto.precio_unitario)?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div style={{ textAlign: 'right', marginBottom: '20px' }}>
            <p><strong>Subtotal: {order.unidad} {order.sub_total?.toFixed(2)}</strong></p>
            <p><strong>IVA (16%): {order.unidad} {order.iva?.toFixed(2)}</strong></p>
            <p><strong>Ret. IVA (75%): {order.unidad} {order.ret_iva?.toFixed(2)}</strong></p>
            <p><strong>Neto a Pagar: {order.unidad} {order.neto_a_pagar?.toFixed(2)}</strong></p>
          </div>

          {/* Firmas */}
          <div style={{ marginTop: '50px' }}>
            <p>Elaborado por: {order.empleado?.nombre} {order.empleado?.apellido}</p>
            <p>_________________________</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderPDF;