import React from 'react';
import { Button } from 'react-bootstrap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const OrderPDF = ({ order }) => {
  const handleGeneratePDF = () => {
    const input = document.getElementById('order-pdf-content');

    html2canvas(input).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // Ancho de la página A4 en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`orden_compra_${order.id}.pdf`);
    });
  };

  return (
    <div>
      <Button variant="primary" onClick={handleGeneratePDF}>
        Descargar PDF
      </Button>

      {/* Contenido del PDF (oculto en la interfaz) */}
      <div id="order-pdf-content" style={{ display: 'none' }}>
        <h1>Orden de Compra</h1>
        <p>Nro: {order.id}</p>
        <p>Fecha: {new Date(order.fecha_orden).toLocaleDateString()}</p>

        {/* Información del proveedor */}
        <h2>PROVEEDOR:</h2>
        <p>{order.proveedor.nombre}</p>
        <p>RIF: {order.proveedor.rif}</p>
        <p>Teléfonos: {order.proveedor.telefono}</p>
        <p>Dirección: {order.proveedor.direccion}</p>

        {/* Tabla de productos */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '8px' }}>REF</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>CANTIDAD</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>DESCRIPCIÓN DE LA MERCANCÍA</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>PRECIO UNITARIO (Bs)</th>
              <th style={{ border: '1px solid black', padding: '8px' }}>MONTO TOTAL (Bs)</th>
            </tr>
          </thead>
          <tbody>
            {order.productos.map((producto, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid black', padding: '8px' }}>{producto.ref}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{producto.cantidad}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{producto.descripcion}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{producto.precio_unitario}</td>
                <td style={{ border: '1px solid black', padding: '8px' }}>{producto.monto_total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div style={{ marginTop: '20px' }}>
          <p>SUB-TOTAL: {order.sub_total}</p>
          <p>IVA (16%): {order.iva}</p>
          <p>TOTAL: {order.total}</p>
          <p>Ret. IVA (75%): {order.ret_iva}</p>
          <p>Neto a Pagar: {order.neto_a_pagar}</p>
        </div>

        {/* Firmas */}
        <div style={{ marginTop: '20px' }}>
          <p>Elaborado por: {order.elaborado_por}</p>
          <p>Aprobado por: {order.aprobado_por}</p>
        </div>
      </div>
    </div>
  );
};

export default OrderPDF;