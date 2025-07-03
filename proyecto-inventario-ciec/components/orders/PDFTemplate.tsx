import React from 'react';
import { format } from 'date-fns';
import { OrdenCompra, Camaraindustriales, Proveedor, Empleado, OrdenCompraDetalle, Producto as ProductoType, OrdenCompraUnidad } from '../../types';
import { PDF_LOGO_URL } from '../../assets/paths';

// Interfaz para el objeto OrdenCompra completamente detallado esperado por PDFTemplate
interface PDFOrdenCompra extends OrdenCompra {
  proveedor: Proveedor | undefined;
  productos: (OrdenCompraDetalle & { producto: ProductoType | undefined })[]; // De la consulta select
  empleado: Empleado | undefined;
}

interface PDFTemplateProps {
  orden: PDFOrdenCompra;
  camara: Camaraindustriales;
}

const PDFTemplate: React.FC<PDFTemplateProps> = ({ orden, camara }) => {
  const formatCurrency = (value?: number | null, unidadInput?: OrdenCompraUnidad | string | null) => {
    if (value === undefined || value === null) return 'N/A';
    const unidad = unidadInput || 'Bs'; // Default to 'Bs' if null or undefined
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: unidad === 'USD' ? 'USD' : 'VES', // Assuming 'Bs' maps to 'VES'
      minimumFractionDigits: 2,
    }).format(value);
  };

  const logoWidth = '120px'; // Aumentado para mejor visibilidad

  const baseStyles: { [key: string]: React.CSSProperties } = {
    page: {
      width: '210mm',
      minHeight: '297mm',
      padding: '15px', // Reducido desde 20px
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#000000',
      backgroundColor: '#FFFFFF',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between', // Modificado para centrar el texto
      marginBottom: '15px',
      borderBottom: '2px solid #000',
      paddingBottom: '10px',
    },
    logo: {
      width: logoWidth,
      height: 'auto',
    },
    headerTextContainer: {
      textAlign: 'center',
    },
    headerTitle: {
      fontSize: '20px',
      margin: '5px 0',
      color: '#000000',
      fontWeight: 'bold',
    },
    headerSubtitle: {
      fontSize: '16px',
      margin: '5px 0',
      color: '#000000',
    },
    headerDate: {
      margin: '3px 0',
      color: '#000000',
      fontSize: '12px',
    },
    contactInfo: {
      textAlign: 'center',
      marginBottom: '20px',
      fontSize: '9px',
    },
    contactInfoP: {
      margin: '2px 0',
      color: '#000000',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      margin: '15px 0',
      backgroundColor: '#FFFFFF',
      fontSize: '9px',
    },
    th: {
      backgroundColor: '#EAEAEA',
      border: '1px solid #333333',
      padding: '6px',
      textAlign: 'left',
      color: '#000000',
      fontWeight: 'bold',
    },
    td: {
      border: '1px solid #333333',
      padding: '6px',
      backgroundColor: '#FFFFFF',
      color: '#000000',
      verticalAlign: 'top',
    },
    instructions: {
      margin: '15px 0',
      padding: '8px',
      border: '1px solid #000',
      fontSize: '10px',
      fontWeight: 'bold',
      color: '#000000',
      textAlign: 'center',
    },
    totals: {
      marginTop: '15px',
      textAlign: 'right',
      fontSize: '10px',
    },
    totalsP: {
      margin: '3px 0',
      color: '#000000',
    },
    totalsBoldP: {
      margin: '3px 0',
      color: '#000000',
      fontSize: '11px',
      fontWeight: 'bold',
    },
    signatures: {
      display: 'flex',
      justifyContent: 'space-around',
      marginTop: '25px', // Reducido desde 40px
      paddingTop: '10px', // Reducido desde 15px
      borderTop: '1px solid #000',
      fontSize: '10px',
    },
    signatureBlock: {
      width: '40%',
      textAlign: 'center',
      color: '#000000',
    },
    signatureLine: {
      borderBottom: '1px solid #000',
      height: '40px',
      marginBottom: '8px',
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
      whiteSpace: 'pre-line' as 'pre-line'
    }
  };

  return (
    <div style={baseStyles.page}>
      <div style={baseStyles.header}>
        <img src={PDF_LOGO_URL} alt="Logo CIEC" style={baseStyles.logo} crossOrigin="anonymous" />
        <div style={baseStyles.headerTextContainer}>
          <h2 style={baseStyles.headerTitle}>{camara.nombre}</h2>
          <h3 style={baseStyles.headerSubtitle}>Orden de Compra N°: {orden.id}</h3>
          <p style={baseStyles.headerDate}>
            {format(new Date(orden.fecha_orden), 'dd/MM/yyyy')}
          </p>
        </div>
        {/* Spacer div to balance the logo and keep text centered */}
        <div style={{ width: logoWidth }} />
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
        <p>ESTIMADO PROVEEDOR, DE ACUERDO A SU COTIZACIÓN ENVIADA, FAVOR SUMINISTRAR LO ABAJO INDICADO</p>
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
          <strong>Ret. IVA ({(orden.retencion_porcentaje ?? 75)}%):</strong> {formatCurrency(orden.ret_iva, orden.unidad)}
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