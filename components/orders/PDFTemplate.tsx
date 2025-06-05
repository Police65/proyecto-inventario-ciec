
import React from 'react';
import { format } from 'date-fns';
import { OrdenCompra, Camaraindustriales, Proveedor, Empleado, OrdenCompraDetalle, Producto } from '../../types'; // Asegúrate que las rutas y tipos sean correctos

interface PDFOrdenCompra extends OrdenCompra {
  proveedor: Proveedor | undefined; // Supabase might return this as an object or undefined
  productos: (OrdenCompraDetalle & { producto: Producto | undefined })[]; // Alias from user's query
  empleado: Empleado | undefined;
}

interface PDFTemplateProps {
  orden: PDFOrdenCompra;
  camara: Camaraindustriales;
}

const PDFTemplate: React.FC<PDFTemplateProps> = ({ orden, camara }) => {
  const formatCurrency = (value?: number, unidad?: string) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: unidad === 'USD' ? 'USD' : 'VES', // Default to VES if unidad is not USD
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Estilos base para compatibilidad con html2canvas
  // Usar objetos de estilo de React en lugar de strings CSS directos para mejor mantenibilidad
  const styles: { [key: string]: React.CSSProperties } = {
    page: {
      width: '210mm',
      minHeight: '297mm', // Opcional si el contenido define la altura
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px', // Reducido para mejor encaje
      color: '#000000',
      backgroundColor: '#FFFFFF', // Importante para html2canvas
    },
    header: {
      textAlign: 'center',
      marginBottom: '15px',
      borderBottom: '2px solid #000000',
      paddingBottom: '10px',
    },
    headerTitle: {
        fontSize: '20px', // Reducido
        margin: '5px 0',
        color: '#000000',
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: '16px', // Reducido
        margin: '5px 0',
        color: '#000000',
    },
    contactInfo: {
      textAlign: 'center',
      marginBottom: '20px',
      fontSize: '9px', // Reducido
    },
    contactInfoP: {
        margin: '2px 0',
        color: '#000000',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      margin: '15px 0',
      backgroundColor: '#FFFFFF', // Importante para html2canvas
      fontSize: '9px', // Reducido
    },
    th: {
      backgroundColor: '#EAEAEA', // Un gris más claro
      border: '1px solid #333333', // Bordes más oscuros para mejor visibilidad
      padding: '6px', // Reducido
      textAlign: 'left',
      color: '#000000',
      fontWeight: 'bold',
    },
    td: {
      border: '1px solid #333333',
      padding: '6px', // Reducido
      backgroundColor: '#FFFFFF', // Asegurar fondo blanco para celdas
      color: '#000000',
      verticalAlign: 'top',
    },
    instructions: {
      margin: '15px 0',
      padding: '8px',
      border: '1px solid #000000',
      fontSize: '10px', // Reducido
      fontWeight: 'bold',
      color: '#000000',
      textAlign: 'center',
    },
    totals: {
      marginTop: '15px',
      textAlign: 'right',
      fontSize: '10px', // Reducido
    },
    totalsP: {
        margin: '3px 0',
        color: '#000000',
    },
    totalsBoldP: {
        margin: '3px 0',
        color: '#000000',
        fontSize: '11px', // Ligeramente más grande para el total neto
        fontWeight: 'bold',
    },
    signatures: {
        display: 'flex', // Usar flexbox para alinear
        justifyContent: 'space-around', // Distribuir espacio
        marginTop: '40px', // Más espacio antes de las firmas
        paddingTop: '15px',
        borderTop: '1px solid #000000',
        fontSize: '10px', // Reducido
    },
    signatureBlock: {
        width: '40%', // Ancho de cada bloque de firma
        textAlign: 'center',
        color: '#000000',
    },
    signatureLine: {
        borderBottom: '1px solid #000000',
        height: '40px', // Espacio para la firma
        marginBottom: '8px'
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>{camara.nombre}</h2>
        <h3 style={styles.headerSubtitle}>Orden de Compra N°: {orden.id}</h3>
        <p style={{ ...styles.contactInfoP, fontSize: '12px' }}>
          {format(new Date(orden.fecha_orden), 'dd/MM/yyyy')}
        </p>
      </div>

      <div style={styles.contactInfo}>
        <p style={styles.contactInfoP}>{camara.direccion}</p>
        <p style={styles.contactInfoP}>
          Teléfonos: {camara.telefonos || 'N/A'} | RIF: {camara.rif}
        </p>
        <p style={styles.contactInfoP}>
          Web: {camara.web || 'N/A'} | Email: {camara.correo || 'N/A'}
        </p>
      </div>

      <table style={styles.table}>
        <tbody>
          <tr>
            <td style={{ ...styles.td, fontWeight: 'bold', width: '20%' }}>Proveedor:</td>
            <td style={{ ...styles.td, width: '30%' }}>{orden.proveedor?.nombre || 'N/A'}</td>
            <td style={{ ...styles.td, fontWeight: 'bold', width: '20%' }}>RIF:</td>
            <td style={{ ...styles.td, width: '30%' }}>{orden.proveedor?.rif || 'N/A'}</td>
          </tr>
          <tr>
            <td style={{ ...styles.td, fontWeight: 'bold' }}>Dirección:</td>
            <td colSpan={3} style={styles.td}>{orden.proveedor?.direccion || 'N/A'}</td>
          </tr>
        </tbody>
      </table>

      <div style={styles.instructions}>
        <p>ESTIMADO PROVEEDOR, DE ACUERDO A SU COTIZACIÓN, FAVOR SUMINISTRAR LO ABAJO INDICADO</p>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>REF</th>
            <th style={styles.th}>CANT.</th>
            <th style={{...styles.th, width: '40%'}}>DESCRIPCIÓN</th>
            <th style={styles.th}>PRECIO UNIT.</th>
            <th style={styles.th}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {orden.productos?.map((item, index) => (
            <tr key={item.id || index}>
              <td style={{...styles.td, textAlign: 'center'}}>{item.producto?.id || 'N/A'}</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>{item.cantidad}</td>
              <td style={styles.td}>{item.producto?.descripcion || 'N/A'}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                {formatCurrency(item.precio_unitario, orden.unidad)}
              </td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                {formatCurrency(item.cantidad * item.precio_unitario, orden.unidad)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={styles.totals}>
        <p style={styles.totalsP}>
          <strong>Subtotal:</strong> {formatCurrency(orden.sub_total, orden.unidad)}
        </p>
        <p style={styles.totalsP}>
          <strong>IVA (16%):</strong> {formatCurrency(orden.iva, orden.unidad)}
        </p>
        <p style={styles.totalsP}>
          <strong>Ret. IVA ({orden.retencion_porcentaje || 75}%):</strong> {formatCurrency(orden.ret_iva, orden.unidad)}
        </p>
        <p style={styles.totalsBoldP}>
          Neto a pagar: {formatCurrency(orden.neto_a_pagar, orden.unidad)}
        </p>
      </div>
        {orden.observaciones && (
            <div style={{ marginTop: '15px', fontSize: '10px', borderTop: '1px solid #CCC', paddingTop: '10px'}}>
                <p style={{color: '#000000', fontWeight: 'bold' }}>Observaciones:</p>
                <p style={{color: '#000000', whiteSpace: 'pre-line'}}>{orden.observaciones}</p>
            </div>
        )}

      <div style={styles.signatures}>
        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}></div>
          <p style={{ fontWeight: 'bold' }}>{orden.empleado?.nombre} {orden.empleado?.apellido}</p>
          <p>Departamento de Compras</p>
        </div>

        <div style={styles.signatureBlock}>
          <div style={styles.signatureLine}></div>
          <p style={{ fontWeight: 'bold' }}>Coordinación Financiera</p>
          <p>Aprobado por</p>
        </div>
      </div>
    </div>
  );
};

export default PDFTemplate;
