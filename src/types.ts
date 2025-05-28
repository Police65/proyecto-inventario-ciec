// types.ts

// Based on SQL schema
export interface Camaraindustriales {
  id: number;
  nombre: string;
  direccion: string;
  web?: string | null;
  correo?: string | null;
  telefonos?: string | null;
  rif: string;
}

export interface Cargo {
  id: number;
  nombre: string;
  departamento_id: number;
  departamento?: Departamento; 
}

export interface CategoriaProducto {
  id: number;
  nombre: string;
}

export interface CategoriaProveedor {
  id: number;
  nombre: string;
}

export interface Departamento {
  id: number;
  nombre: string;
}

export type EmpleadoEstado = 'activo' | 'inactivo';

export interface Empleado {
  id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  cargo_actual_id: number | null;
  firma?: string | null;
  departamento_id: number;
  estado: EmpleadoEstado;
  cargo?: Cargo | null;
  departamento?: Departamento;
  user_profile?: UserProfile | null; 
}

export interface EmpleadoCargoHistorial {
  id: number;
  empleado_id: number;
  cargo_id: number;
  fecha_inicio: string; // Date string
  fecha_fin?: string | null; // Date string
  cargo?: Cargo;
}

export interface FacturaOrden {
  id: number;
  orden_compra_id?: number | null;
  numero_factura?: string | null;
  fecha_recepcion?: string | null; // Date string
  documento_factura?: string | null; // URL or path
  total_recepcionado?: number | null;
}

export interface Inventario {
  id: number;
  producto_id: number;
  ubicacion: string;
  fecha_actualizacion: string; // Timestamp string
  existencias?: number | null;
  producto?: Producto;
}

export interface OrdenSolicitud {
  ordencompra_id: number;
  solicitud_id: number;
}

export type OrdenCompraEstado = 'Pendiente' | 'Completada' | 'Anulada';
export type OrdenCompraUnidad = 'Bs' | 'USD';

export interface OrdenCompra {
  id: number;
  solicitud_compra_id: number | null; // Can be null for direct orders
  proveedor_id: number;
  fecha_orden: string; // Timestamp string
  estado: OrdenCompraEstado;
  precio_unitario: number; // Default '0' - Consider removing if details always used
  sub_total: number;
  iva: number;
  ret_iva?: number | null;
  neto_a_pagar: number;
  unidad?: OrdenCompraUnidad | null;
  observaciones?: string | null;
  empleado_id: number;
  changed_by?: number | null;
  fecha_modificacion: string; // Timestamp string
  retencion_porcentaje?: number | null; // Default '0'
  
  // Relations
  proveedor?: Proveedor;
  detalles?: OrdenCompraDetalle[]; 
  empleado?: Empleado; // Or Partial<Empleado> if only some fields are joined
  solicitud_compra?: SolicitudCompra; // Or Partial<SolicitudCompra>
  factura?: FacturaOrden; // If linked
}

export interface OrdenCompraDetalle {
  id: number;
  orden_compra_id?: number | null;
  producto_id?: number | null;
  cantidad: number;
  precio_unitario: number;
  monto_total?: number | null; // Generated column
  producto?: Producto;
}

export interface OrdenConsolidada {
  id: number;
  proveedor_id?: number | null;
  productos: any; // JSONB - Define more strictly if possible { producto_id: number, descripcion: string, cantidad: number }[]
  estado: string; // Default 'Pendiente'
  fecha_creacion: string; // Timestamp string
  solicitudes: any; // JSONB - Define more strictly if possible number[] (array of solicitud_id)
  proveedor?: Proveedor;
}

export interface Producto {
  id: number;
  descripcion: string;
  categoria_id?: number | null;
  categoria?: CategoriaProducto;
  inventario?: Inventario; // if fetched
}

export interface ProductoNoRecibido {
  id: number;
  orden_compra_id?: number | null;
  producto_id?: number | null;
  cantidad_faltante?: number | null;
  motivo?: string | null;
  producto?: Producto;
  orden_compra?: OrdenCompra;
}

export interface ProductoRezagado {
  id: number;
  orden_compra_id?: number | null;
  producto_id?: number | null;
  cantidad: number;
  motivo?: string | null;
  solicitud_id?: number | null;
  created_at: string; // Timestamp string
  producto?: Producto;
  solicitud?: SolicitudCompra;
  orden_compra?: OrdenCompra;
}

export interface Proveedor {
  id: number;
  nombre: string;
  direccion: string;
  rif: string;
  telefono?: string | null;
  correo?: string | null;
  pagina_web?: string | null;
  categorias?: ProveedorCategoria[];
}

export interface ProveedorCategoria {
  proveedor_id: number;
  categoria_id: number;
  categoria?: CategoriaProveedor;
}

export type SolicitudCompraEstado = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface SolicitudCompra {
  id: number;
  descripcion?: string | null;
  fecha_solicitud: string; // Timestamp string
  estado: SolicitudCompraEstado;
  empleado_id: number;
  departamento_id: number;
  
  // Relations
  detalles?: SolicitudCompraDetalle[];
  empleado?: Empleado; // Or Partial<Empleado>
  departamento?: Departamento; // Or Partial<Departamento>
}

export interface SolicitudCompraDetalle {
  id: number;
  solicitud_compra_id: number;
  producto_id?: number | null;
  cantidad: number;
  producto?: Producto;
}

export type UserProfileRol = 'admin' | 'usuario';

export interface UserProfile {
  id: string; // UUID from auth.users
  empleado_id?: number | null;
  departamento_id?: number | null;
  rol?: UserProfileRol | null;
  empleado?: Partial<Empleado>; // Changed to Partial
  departamento?: Partial<Departamento>; // Changed to Partial
}

export interface Notificacion {
  id?: number;
  user_id: string; // UUID
  title: string;
  description: string;
  created_at: string; // ISO date string
  type?: string;
  read: boolean;
  related_id?: number; // e.g., solicitud_id or orden_id
}


// This is a placeholder for your Supabase schema.
// You should generate this using \`supabase gen types typescript > types.ts\`
// For now, we'll define the tables we know from the SQL.
export interface Database {
  public: {
    Tables: {
      camaraindustriales: {
        Row: Camaraindustriales;
        Insert: Omit<Camaraindustriales, 'id'>;
        Update: Partial<Camaraindustriales>;
      };
      cargo: {
        Row: Cargo;
        Insert: Omit<Cargo, 'id'>;
        Update: Partial<Cargo>;
      };
      categoria_producto: {
        Row: CategoriaProducto;
        Insert: Omit<CategoriaProducto, 'id'>;
        Update: Partial<CategoriaProducto>;
      };
      categoria_proveedor: {
        Row: CategoriaProveedor;
        Insert: Omit<CategoriaProveedor, 'id'>;
        Update: Partial<CategoriaProveedor>;
      };
      departamento: {
        Row: Departamento;
        Insert: Omit<Departamento, 'id'>;
        Update: Partial<Departamento>;
      };
      empleado: {
        Row: Empleado;
        Insert: Omit<Empleado, 'id'>;
        Update: Partial<Empleado>;
      };
      empleadocargohistorial: {
        Row: EmpleadoCargoHistorial;
        Insert: Omit<EmpleadoCargoHistorial, 'id'>;
        Update: Partial<EmpleadoCargoHistorial>;
      };
      facturas_orden: {
        Row: FacturaOrden;
        Insert: Omit<FacturaOrden, 'id'>;
        Update: Partial<FacturaOrden>;
      };
      inventario: {
        Row: Inventario;
        Insert: Omit<Inventario, 'id'>;
        Update: Partial<Inventario>;
      };
      orden_solicitud: {
        Row: OrdenSolicitud;
        Insert: OrdenSolicitud;
        Update: Partial<OrdenSolicitud>;
      };
      ordencompra: {
        Row: OrdenCompra;
        Insert: Omit<OrdenCompra, 'id' | 'fecha_orden' | 'fecha_modificacion'>;
        Update: Partial<OrdenCompra>;
      };
      ordencompra_detalle: {
        Row: OrdenCompraDetalle;
        Insert: Omit<OrdenCompraDetalle, 'id' | 'monto_total'>;
        Update: Partial<OrdenCompraDetalle>;
      };
      ordenes_consolidadas: {
        Row: OrdenConsolidada;
        Insert: Omit<OrdenConsolidada, 'id' | 'fecha_creacion' | 'estado'>;
        Update: Partial<OrdenConsolidada>;
      };
      producto: {
        Row: Producto;
        Insert: Omit<Producto, 'id'>;
        Update: Partial<Producto>;
      };
      productos_no_recibidos: {
        Row: ProductoNoRecibido;
        Insert: Omit<ProductoNoRecibido, 'id'>;
        Update: Partial<ProductoNoRecibido>;
      };
      productos_rezagados: {
        Row: ProductoRezagado;
        Insert: Omit<ProductoRezagado, 'id' | 'created_at'>;
        Update: Partial<ProductoRezagado>;
      };
      proveedor: {
        Row: Proveedor;
        Insert: Omit<Proveedor, 'id'>;
        Update: Partial<Proveedor>;
      };
      proveedor_categoria: {
        Row: ProveedorCategoria;
        Insert: ProveedorCategoria;
        Update: Partial<ProveedorCategoria>;
      };
      solicitudcompra: {
        Row: SolicitudCompra;
        Insert: Omit<SolicitudCompra, 'id' | 'fecha_solicitud'>;
        Update: Partial<SolicitudCompra>;
      };
      solicitudcompra_detalle: {
        Row: SolicitudCompraDetalle;
        Insert: Omit<SolicitudCompraDetalle, 'id'>;
        Update: Partial<SolicitudCompraDetalle>;
      };
      user_profile: {
        Row: UserProfile;
        Insert: UserProfile; // If all fields are required for insert
        Update: Partial<UserProfile>;
      };
      notificaciones: { 
        Row: Notificacion;
        Insert: Omit<Notificacion, 'id'>;
        Update: Partial<Notificacion>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Utility type for form data to avoid deep partials if not needed
export type OrdenCompraFormData = Omit<OrdenCompra, 'id' | 'fecha_orden' | 'fecha_modificacion' | 'sub_total' | 'iva' | 'ret_iva' | 'neto_a_pagar' | 'proveedor' | 'detalles' | 'empleado' | 'solicitud_compra'> & {
  proveedor_id: number | null; // Make it nullable for initial state
  sub_total?: number;
  iva?: number;
  ret_iva?: number;
  neto_a_pagar?: number;
};


export interface ProductSelectionItem extends Producto {
  quantity: number;
  selected: boolean;
  motivo?: string;
  precio_unitario: number; // Added for OrderForm consistency
}

export interface AISummaryStat {
  dept: string;
  total: number;
  mean: number;
  stdDev: number;
  amounts: number[];
  anomalies: boolean[];
}

export interface AIAnomalySummary {
  dept: string;
  anomalyCount: number;
  normalCount: number;
}

export interface ChartDataItem {
  name: string;
  value: number;
}
