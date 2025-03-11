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
        Generar PDF
      </Button>

      <div id="order-pdf-content" style={{ display: 'none' }}>
        <h1>Orden de Compra</h1>
        <p>Nro: {order.id}</p>
        <p>Proveedor: {order.proveedor.nombre}</p>
        <p>RIF: {order.proveedor.rif}</p>
        <p>Teléfonos: {order.proveedor.telefono}</p>
        <p>Dirección: {order.proveedor.direccion}</p>

        <table>
          <thead>
            <tr>
              <th>REF</th>
              <th>CANTIDAD</th>
              <th>DESCRIPCIÓN</th>
              <th>PRECIO UNITARIO (USD)</th>
              <th>MONTO TOTAL (USD)</th>
            </tr>
          </thead>
          <tbody>
            {order.productos.map((producto, index) => (
              <tr key={index}>
                <td>{producto.ref}</td>
                <td>{producto.cantidad}</td>
                <td>{producto.descripcion}</td>
                <td>{producto.precio_unitario}</td>
                <td>{producto.monto_total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>Observaciones: {order.observaciones}</p>
        <p>Elaborado por: {order.empleado.nombre}</p>
        <p>Neto a Pagar: {order.neto_a_pagar}</p>
      </div>
    </div>
  );
};

export default OrderPDF;