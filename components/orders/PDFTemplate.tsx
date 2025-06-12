
import React from 'react';
import { format } from 'date-fns';
import { OrdenCompra, Camaraindustriales, Proveedor, Empleado, OrdenCompraDetalle, Producto as ProductoType } from '../../types';

// Interface for the fully detailed OrdenCompra object expected by PDFTemplate
interface PDFOrdenCompra extends OrdenCompra {
  proveedor: Proveedor | undefined;
  productos: (OrdenCompraDetalle & { producto: ProductoType | undefined })[]; // From the select query
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
      currency: unidad === 'USD' ? 'USD' : 'VES',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const baseStyles: { [key: string]: React.CSSProperties } = {
    page: {
      width: '210mm',
      minHeight: '297mm',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px', // Adjusted from 14px for potentially better fit
      color: '#000000',
      backgroundColor: '#FFFFFF',
    },
    header: {
      display: 'flex', // Changed for logo alignment
      alignItems: 'center', // Vertically align logo and text
      marginBottom: '15px', // Adjusted
      borderBottom: '2px solid #000',
      paddingBottom: '10px', // Adjusted',
    },
    logo: {
      width: '60px', // Adjust size as needed
      height: 'auto',
      marginRight: '15px', // Space between logo and text
    },
    headerTextContainer: {
      textAlign: 'left', // Text next to logo will be left-aligned
    },
    headerTitle: {
        fontSize: '20px', // Adjusted
        margin: '5px 0',
        color: '#000000',
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: '16px', // Adjusted
        margin: '5px 0',
        color: '#000000',
    },
    headerDate: {
        margin: '3px 0',
        color: '#000000',
        fontSize: '12px', // Adjusted
    },
    contactInfo: {
      textAlign: 'center',
      marginBottom: '20px', // Adjusted
      fontSize: '9px', // Adjusted
    },
    contactInfoP: {
      margin: '2px 0', // Adjusted
      color: '#000000',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      margin: '15px 0', // Adjusted
      backgroundColor: '#FFFFFF',
      fontSize: '9px', // Adjusted
    },
    th: {
      backgroundColor: '#EAEAEA',
      border: '1px solid #333333',
      padding: '6px', // Adjusted
      textAlign: 'left',
      color: '#000000',
      fontWeight: 'bold',
    },
    td: {
      border: '1px solid #333333',
      padding: '6px', // Adjusted
      backgroundColor: '#FFFFFF',
      color: '#000000',
      verticalAlign: 'top',
    },
    instructions: {
      margin: '15px 0', // Adjusted
      padding: '8px', // Adjusted
      border: '1px solid #000',
      fontSize: '10px', // Adjusted
      fontWeight: 'bold',
      color: '#000000',
      textAlign: 'center',
    },
    totals: {
      marginTop: '15px', // Adjusted
      textAlign: 'right',
      fontSize: '10px', // Adjusted
    },
    totalsP: {
      margin: '3px 0',
      color: '#000000',
    },
    totalsBoldP: {
      margin: '3px 0',
      color: '#000000',
      fontSize: '11px', // Adjusted
      fontWeight: 'bold',
    },
    signatures: {
      display: 'flex',
      justifyContent: 'space-around',
      marginTop: '40px', // Adjusted
      paddingTop: '15px', // Adjusted
      borderTop: '1px solid #000',
      fontSize: '10px', // Adjusted
    },
    signatureBlock: {
      width: '40%',
      textAlign: 'center',
      color: '#000000',
    },
    signatureLine: {
      borderBottom: '1px solid #000',
      height: '40px', // Adjusted
      marginBottom: '8px', // Adjusted
    },
    observationsDiv: {
        marginTop: '15px',
        fontSize: '10px',
        borderTop: '1px solid #CCC',
        paddingTop: '10px'
    },
    observationsTitle: {
        color: '#000000',
        fontWeight: 'bold'
    },
    observationsText: {
        color: '#000000',
        whiteSpace: 'pre-line' as 'pre-line' // Type assertion for CSS white-space property
    }
  };

  return (
    <div style={baseStyles.page}>
      <div style={baseStyles.header}>
        <img src="/assets/logo_svg.svg" alt="Logo CIEC" style={baseStyles.logo} />
        <div style={baseStyles.headerTextContainer}>
            <h2 style={baseStyles.headerTitle}>{camara.nombre}</h2>
            <h3 style={baseStyles.headerSubtitle}>Orden de Compra N°: {orden.id}</h3>
            <p style={baseStyles.headerDate}>
            {format(new Date(orden.fecha_orden), 'dd/MM/yyyy')}
            </p>
        </div>
      </div>

      <div style={baseStyles.contactInfo}>
        <p style={baseStyles.contactInfoP}>{camara.direccion}</p>
        <p style={baseStyles.contactInfoP}>
          Teléfonos: {camara.telefonos || 'N/A'} | RIF: {camara.rif}
        </p>
        <p style={baseStyles.contactInfoP}>
          Web: {camara.web || 'N/A'} | Email: {camara.correo || 'N/A'}
        </p>
      </div>

      <table style={baseStyles.table}>
        <tbody>
          <tr>
            <td style={{ ...baseStyles.td, fontWeight: 'bold', width: '20%' }}>Proveedor:</td>
            <td style={{ ...baseStyles.td, width: '30%' }}>{orden.proveedor?.nombre || 'N/A'}</td>
            <td style={{ ...baseStyles.td, fontWeight: 'bold', width: '20%' }}>RIF:</td>
            <td style={{ ...baseStyles.td, width: '30%' }}>{orden.proveedor?.rif || 'N/A'}</td>
          </tr>
          <tr>
            <td style={{ ...baseStyles.td, fontWeight: 'bold' }}>Dirección:</td>
            <td colSpan={3} style={baseStyles.td}>{orden.proveedor?.direccion || 'N/A'}</td>
          </tr>
        </tbody>
      </table>

      <div style={baseStyles.instructions}>
        <p>ESTIMADO PROVEEDOR, DE ACUERDO A SU COTIZACIÓN ENVIADA POR WS, FAVOR SUMINISTRAR LO ABAJO INDICADO</p>
      </div>

      <table style={baseStyles.table}>
        <thead>
          <tr>
            <th style={baseStyles.th}>REF</th>
            <th style={baseStyles.th}>CANT.</th>
            <th style={{ ...baseStyles.th, width: '40%' }}>DESCRIPCIÓN</th>
            <th style={baseStyles.th}>PRECIO UNIT.</th>
            <th style={baseStyles.th}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {orden.productos?.map((item, index) => (
            <tr key={item.id || index}>
              <td style={{ ...baseStyles.td, textAlign: 'center' }}>{item.producto_id || 'N/A'}</td>
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

      <div style={baseStyles.totals}>
        <p style={baseStyles.totalsP}>
          <strong>Subtotal:</strong> {formatCurrency(orden.sub_total, orden.unidad)}
        </p>
        <p style={baseStyles.totalsP}>
          <strong>IVA (16%):</strong> {formatCurrency(orden.iva, orden.unidad)}
        </p>
        <p style={baseStyles.totalsP}>
          <strong>Ret. IVA ({orden.retencion_porcentaje || 75}%):</strong> {formatCurrency(orden.ret_iva, orden.unidad)}
        </p>
        <p style={baseStyles.totalsBoldP}>
          Neto a pagar: {formatCurrency(orden.neto_a_pagar, orden.unidad)}
        </p>
      </div>
      {orden.observaciones && (
        <div style={baseStyles.observationsDiv}>
          <p style={baseStyles.observationsTitle}>Observaciones:</p>
          <p style={baseStyles.observationsText}>{orden.observaciones}</p>
        </div>
      )}

      <div style={baseStyles.signatures}>
        <div style={baseStyles.signatureBlock}>
          <div style={baseStyles.signatureLine}></div>
          <p style={{ fontWeight: 'bold' }}>{orden.empleado?.nombre} {orden.empleado?.apellido}</p>
          <p>Departamento de Compras</p>
        </div>
        <div style={baseStyles.signatureBlock}>
          <div style={baseStyles.signatureLine}></div>
          <p style={{ fontWeight: 'bold' }}>Coordinación Financiera</p>
          <p>Aprobado por</p>
        </div>
      </div>
    </div>
  );
};

export default PDFTemplate;
