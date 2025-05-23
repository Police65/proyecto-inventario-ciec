import React from 'react';
import { format } from 'date-fns';

const PDFTemplate = ({ orden, camara }) => {
  // Función de formato monetario
  const formatCurrency = (value, unidad) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: unidad === 'USD' ? 'USD' : 'VES',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  // Estilos base para compatibilidad con html2canvas
  const baseStyles = {
    page: {
      width: '210mm',
      minHeight: '297mm',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#000000',
      backgroundColor: '#FFFFFF'
    },
    header: {
      textAlign: 'center',
      marginBottom: '20px',
      borderBottom: '2px solid #000'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      margin: '10px 0',
      backgroundColor: '#FFFFFF'
    },
    th: {
      backgroundColor: '#f8f9fa',
      border: '1px solid #000',
      padding: '8px',
      textAlign: 'left'
    },
    td: {
      border: '1px solid #000',
      padding: '8px',
      backgroundColor: '#FFFFFF'
    }
  };

  return (
    <div style={baseStyles.page}>
    <img src="logos/LogotipoBLACK@1.5x-svg" alt="Imagen no disponible" />
      {/* Cabecera Institucional */}
      <div style={baseStyles.header}>
        <h2 style={{ fontSize: '24px', margin: '5px 0', color: '#000' }}>
          {camara.nombre}
        </h2>
        <h3 style={{ fontSize: '18px', margin: '5px 0', color: '#000' }}>
          Orden de Compra N°: {orden.id}
        </h3>
        <p style={{ margin: '3px 0', color: '#000' }}>
          {format(new Date(orden.fecha_orden), 'dd/MM/yyyy')}
        </p>
      </div>

      {/* Información de Contacto */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <p style={{ color: '#000' }}>{camara.direccion}</p>
        <p style={{ color: '#000' }}>
          Teléfonos: {camara.telefonos} | RIF: {camara.rif}
        </p>
        <p style={{ color: '#000' }}>
          Web: {camara.web} | Email: {camara.correo}
        </p>
      </div>

      {/* Tabla de Proveedor */}
      <table style={baseStyles.table}>
        <tbody>
          <tr>
            <td style={{ ...baseStyles.td, fontWeight: 'bold', width: '15%' }}>Proveedor:</td>
            <td style={{ ...baseStyles.td, width: '35%' }}>{orden.proveedor?.nombre || 'N/A'}</td>
            <td style={{ ...baseStyles.td, fontWeight: 'bold', width: '15%' }}>RIF:</td>
            <td style={{ ...baseStyles.td, width: '35%' }}>{orden.proveedor?.rif || 'N/A'}</td>
          </tr>
          <tr>
            <td style={{ ...baseStyles.td, fontWeight: 'bold' }}>Dirección:</td>
            <td colSpan="3" style={baseStyles.td}>{orden.proveedor?.direccion || 'N/A'}</td>
          </tr>
        </tbody>
      </table>

      {/* Instrucciones */}
      <div style={{ margin: '20px 0', padding: '10px', border: '1px solid #000' }}>
        <p style={{ fontWeight: 'bold', color: '#000' }}>
          ESTIMADO PROVEEDOR, DE ACUERDO A SU COTIZACIÓN ENVIADA POR WS, FAVOR SUMINISTRAR LO ABAJO INDICADO
        </p>
      </div>

      {/* Tabla de Productos */}
      <table style={baseStyles.table}>
        <thead>
          <tr>
            <th style={baseStyles.th}>REF</th>
            <th style={baseStyles.th}>CANTIDAD</th>
            <th style={baseStyles.th}>DESCRIPCIÓN</th>
            <th style={baseStyles.th}>PRECIO UNITARIO</th>
            <th style={baseStyles.th}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {orden.productos?.map((item, index) => (
            <tr key={index}>
              <td style={baseStyles.td}>{item.producto_id}</td>
              <td style={{ ...baseStyles.td, textAlign: 'center' }}>{item.cantidad}</td>
              <td style={baseStyles.td}>{item.producto?.descripcion || 'N/A'}</td>
              <td style={{ ...baseStyles.td, textAlign: 'right' }}>
                {formatCurrency(item.precio_unitario, orden.unidad)}
              </td>
              <td style={{ ...baseStyles.td, textAlign: 'right' }}>
                {formatCurrency(item.cantidad * item.precio_unitario, orden.unidad)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ marginTop: '20px', textAlign: 'right' }}>
        <p style={{ color: '#000' }}>
          <strong>Subtotal:</strong> {formatCurrency(orden.sub_total, orden.unidad)}
        </p>
        <p style={{ color: '#000' }}>
          <strong>IVA (16%):</strong> {formatCurrency(orden.iva, orden.unidad)}
        </p>
        <p style={{ color: '#000' }}>
          <strong>Ret. IVA (75%):</strong> {formatCurrency(orden.ret_iva, orden.unidad)}
        </p>
        <p style={{ color: '#000', fontSize: '16px', fontWeight: 'bold' }}>
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
          <div style={{ borderBottom: '1px solid #000', height: '50px', marginBottom: '10px' }}></div>
          <p style={{ color: '#000', fontWeight: 'bold' }}>{orden.empleado?.nombre} {orden.empleado?.apellido}</p>
          <p style={{ color: '#000' }}>Departamento de Compras</p>
        </div>
        
        <div style={{ width: '45%', textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid #000', height: '50px', marginBottom: '10px' }}></div>
          <p style={{ color: '#000', fontWeight: 'bold' }}>Coordinación Financiera</p>
          <p style={{ color: '#000' }}>Aprobado por</p>
        </div>
      </div>
    </div>
  );
};

export default PDFTemplate;