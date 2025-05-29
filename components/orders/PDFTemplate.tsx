
import React from 'react';
import { format } from 'date-fns';
import { OrdenCompra, Camaraindustriales, Proveedor, Empleado, OrdenCompraDetalle, Producto } from '../../types'; 
interface PDFOrdenCompra extends OrdenCompra {
  proveedor: Proveedor | undefined; 
  productos: (OrdenCompraDetalle & { producto: Producto | undefined })[]; 
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

  // Estilos base para compatibilidad con html2canvas, necesito que esto este lo mas simple posible 
  // para hacer la planilla, si un tutor, profesor, jefe mio, directivo, gerente o etc ve esto, COMPRENDAN JAJAS
  //Uso objetos de estilo de React en lugar de strings CSS directos para mejor mantenibilidad 
  // literalmente estoy capturando un html y convirtiendolo en pdf para los reportes, 
  // es la solucion que encontre no me juzgue JASKJ
  const styles: { [key: string]: React.CSSProperties } = {
    page: {
      width: '210mm',
      minHeight: '297mm', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px', 
      color: '#000000',
      backgroundColor: '#FFFFFF', 
    },
    header: {
      textAlign: 'center',
      marginBottom: '15px',
      borderBottom: '2px solid #000000',
      paddingBottom: '10px',
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
      border: '1px solid #000000',
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
        marginTop: '40px', 
        paddingTop: '15px',
        borderTop: '1px solid #000000',
        fontSize: '10px', 
    },
    signatureBlock: {
        width: '40%', 
        textAlign: 'center',
        color: '#000000',
    },
    signatureLine: {
        borderBottom: '1px solid #000000',
        height: '40px', 
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
