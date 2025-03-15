import React from 'react';
import { format } from 'date-fns';

const PDFTemplate = ({ orden, camara }) => {
  const formatCurrency = (value, unidad) => 
    new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: unidad === 'USD' ? 'USD' : 'VES',
      minimumFractionDigits: 2
    }).format(value || 0);

  return (
    <div style={{
      width: '210mm',
      minHeight: '297mm',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      backgroundColor: 'white'
    }}>
      {/* Cabecera Institucional */}
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000' }}>
        <h2 style={{ fontSize: '24px', margin: '5px 0' }}>{camara.nombre}</h2>
        <h3 style={{ fontSize: '18px', margin: '5px 0' }}>Orden de Compra N°: {orden.id}</h3>
        <p style={{ margin: '3px 0' }}>{format(new Date(orden.fecha_orden), 'dd/MM/yyyy')}</p>
      </div>

      {/* Información de Contacto */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <p>{camara.direccion}</p>
        <p>Teléfonos: {camara.telefonos} | RIF: {camara.rif}</p>
        <p>Web: {camara.web} | Email: {camara.correo}</p>
      </div>

      {/* Datos del Proveedor */}
      <table style={{ width: '100%', marginBottom: '25px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '20%', padding: '8px' }}><strong>Proveedor:</strong></td>
            <td style={{ width: '30%', padding: '8px' }}>{orden.proveedor?.nombre || 'N/A'}</td>
            <td style={{ width: '20%', padding: '8px' }}><strong>RIF:</strong></td>
            <td style={{ width: '30%', padding: '8px' }}>{orden.proveedor?.rif || 'N/A'}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px' }}><strong>Dirección:</strong></td>
            <td colSpan="3" style={{ padding: '8px' }}>{orden.proveedor?.direccion || 'N/A'}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px' }}><strong>Teléfonos:</strong></td>
            <td colSpan="3" style={{ padding: '8px' }}>{orden.proveedor?.telefono || 'N/A'}</td>
          </tr>
        </tbody>
      </table>

      {/* Instrucciones */}
      <div style={{ marginBottom: '20px' }}>
        <p><strong>ESTIMADO PROVEEDOR, DE ACUERDO A SU COTIZACIÓN ENVIADA POR WS, FAVOR SUMINISTRAR LO ABAJO INDICADO</strong></p>
      </div>

      {/* Tabla de Productos */}
      <table style={{ 
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '25px',
        border: '1px solid #000'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <th style={{ border: '1px solid #000', padding: '10px' }}>REF</th>
            <th style={{ border: '1px solid #000', padding: '10px' }}>CANTIDAD</th>
            <th style={{ border: '1px solid #000', padding: '10px' }}>DESCRIPCIÓN</th>
            <th style={{ border: '1px solid #000', padding: '10px' }}>PRECIO UNITARIO</th>
            <th style={{ border: '1px solid #000', padding: '10px' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {orden.productos?.map((item, index) => (
            <tr key={index}>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{item.producto_id}</td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{item.cantidad}</td>
              <td style={{ border: '1px solid #000', padding: '8px' }}>{item.producto?.descripcion || 'N/A'}</td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                {formatCurrency(item.precio_unitario, orden.unidad)}
              </td>
              <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                {formatCurrency(item.cantidad * item.precio_unitario, orden.unidad)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ textAlign: 'right', marginBottom: '30px' }}>
        <p><strong>Subtotal: {formatCurrency(orden.sub_total, orden.unidad)}</strong></p>
        <p><strong>IVA (16%): {formatCurrency(orden.iva, orden.unidad)}</strong></p>
        <p><strong>Ret. IVA (75%): {formatCurrency(orden.ret_iva, orden.unidad)}</strong></p>
        <p style={{ fontSize: '16px', fontWeight: 'bold' }}>
          Neto a pagar: {formatCurrency(orden.neto_a_pagar, orden.unidad)}
        </p>
      </div>

      {/* Firmas */}
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '50px',
        paddingTop: '20px',
        borderTop: '1px solid #000'
      }}>
        <div style={{ width: '45%', textAlign: 'center' }}>
          <p style={{ borderBottom: '1px solid #000', paddingBottom: '40px' }}>
            {orden.empleado?.nombre} {orden.empleado?.apellido}
          </p>
          <strong>Elaborado por</strong>
          <p>Departamento de Compras</p>
        </div>
        
        <div style={{ width: '45%', textAlign: 'center' }}>
          <p style={{ borderBottom: '1px solid #000', paddingBottom: '40px' }}></p>
          <strong>Aprobado por</strong>
          <p>Coordinación Financiera</p>
        </div>
      </div>
    </div>
  );
};

export default PDFTemplate;