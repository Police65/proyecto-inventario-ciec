
// types.ts
export interface Camaraindustriales {
  id: number;
  nombre: string;
  direccion: string;
  web?: string | null;
  correo?: string | null;
  telefonos?: string | null;
  rif: string;
  created_at: string;
  updated_at: string;
}

export interface Cargo {
  id: number;
  nombre: string;
  departamento_id: number;
  created_at: string;
  updated_at: string;
}

export interface CategoriaProducto {
  id: number;
  nombre: string;
  created_at: string;
  updated_at: string;
}

export interface CategoriaProveedor {
  id: number;
  nombre: string;
  created_at: string;
  updated_at: string;
}

export interface Departamento {
  id: number;
  nombre: string;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
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
  telefono?: string | null;
  created_at: string;
  updated_at: string;
  cargo?: Pick<Cargo, 'id' | 'nombre'>;
  departamento?: Pick<Departamento, 'id' | 'nombre'>;
}

export interface Inventario {
  id: number;
  producto_id: number;
  ubicacion: string;
  fecha_actualizacion: string;
  existencias?: number | null;
  created_at: string;
  updated_at: string;
  producto?: any;
}

export type OrdenCompraEstado = 'Pendiente' | 'Completada' | 'Anulada';
export type OrdenCompraUnidad = 'Bs' | 'USD';

export interface OrdenCompra {
  id: number;
  codigo_visible?: string | null;
  solicitud_compra_id: number | null;
  proveedor_id: number;
  fecha_orden: string;
  estado: OrdenCompraEstado;
  precio_unitario: number;
  sub_total: number;
  iva: number;
  ret_iva?: number | null;
  neto_a_pagar: number;
  unidad?: OrdenCompraUnidad | null;
  observaciones?: string | null;
  empleado_id: number;
  changed_by?: number | null;
  fecha_modificacion: string;
  retencion_porcentaje?: number | null;
  created_at: string;
  updated_at: string;
  fecha_entrega_estimada?: string | null;
  fecha_entrega_real?: string | null;
  proveedor?: Proveedor;
  empleado?: Empleado;
  solicitud_compra?: any;
  detalles?: (OrdenCompraDetalle & { producto?: Producto })[];
}

export interface OrdenCompraDetalle {
  id: number;
  orden_comp_id?: number | null;
  producto_id?: number | null;
  cantidad: number;
  precio_unitario: number;
  /* Added missing field to resolve constraint error in AdminDashboardPage.tsx */
  descripcion_producto_personalizado?: string | null;
  created_at: string;
  updated_at: string;
  producto?: Producto;
}

export interface OrdenConsolidada {
  id: number;
  proveedor_id?: number | null;
  productos: Array<{ producto_id: number; descripcion: string; cantidad: number }>;
  estado: string;
  fecha_creacion: string;
  solicitudes: number[];
  created_at: string;
  updated_at: string;
  proveedor?: Pick<Proveedor, 'id' | 'nombre'>;
}

export interface Producto {
  id: number;
  descripcion: string;
  categoria_id?: number | null;
  stock_minimo?: number | null;
  stock_maximo?: number | null;
  unidad_medida?: string | null;
  codigo_interno?: string | null;
  created_at: string;
  updated_at: string;
  categoria?: CategoriaProducto;
  inventario?: { existencias: number | null }[] | null;
}

/* Added missing exported type to resolve error in ProviderManagement.tsx */
export type ProveedorTipoContribuyente = 'normal' | 'especial';

export interface Proveedor {
  id: number;
  nombre: string;
  direccion: string;
  rif: string;
  telefono?: string | null;
  correo?: string | null;
  pagina_web?: string | null;
  tiempo_entrega_promedio_dias?: number | null;
  calificacion_promedio?: number | null;
  estado: string;
  /* Updated to use the new ProveedorTipoContribuyente type */
  tipo_contribuyente: ProveedorTipoContribuyente;
  porcentaje_retencion_iva: number;
  created_at: string;
  updated_at: string;
  categorias?: ({ categoria_id: number; categoria?: Pick<CategoriaProveedor, 'id' | 'nombre'> })[];
}

export type SolicitudCompraEstado = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface SolicitudCompra {
  id: number;
  codigo_visible?: string | null;
  descripcion?: string | null;
  fecha_solicitud: string;
  estado: SolicitudCompraEstado;
  empleado_id: number;
  departamento_id: number;
  created_at: string;
  updated_at: string;
  empleado?: Empleado;
  departamento?: Departamento;
  detalles?: (SolicitudCompraDetalle & { producto?: Producto & { categoria?: CategoriaProducto } })[];
  ordenes?: any[] | null;
}

export interface SolicitudCompraDetalle {
  id: number;
  solicitud_compra_id: number;
  producto_id?: number | null;
  cantidad: number;
  descripcion_producto_personalizado?: string | null;
  categoria_producto_sugerida_id?: number | null;
  categoria_sugerida_nombre?: string | null;
  created_at: string;
  updated_at: string;
  producto?: Producto;
}

export type UserProfileRol = 'admin' | 'usuario';

export interface UserProfile {
  id: string;
  empleado_id?: number | null;
  departamento_id?: number | null;
  rol?: UserProfileRol | null;
  has_completed_tour?: boolean | null;
  created_at: string;
  updated_at: string;
  email?: string | null;
  empleado?: Empleado;
  departamento?: Departamento;
}

export interface Notificacion {
  id: number;
  user_id: string;
  title: string;
  description: string;
  created_at: string;
  type?: string;
  read: boolean;
  updated_at: string;
}

export type NotificacionInsert = Omit<Notificacion, 'id' | 'created_at' | 'updated_at' | 'read'>;

export interface ConsumoHistoricoProducto {
  id: number;
  producto_id: number;
  cantidad_consumida: number;
  fecha_consumo: string;
  departamento_id?: number | null;
  solicitud_detalle_id?: number | null;
  orden_detalle_id?: number | null;
  tipo_consumo: string;
  evento_id_externo?: string | null;
  descripcion_adicional?: string | null;
  created_at: string;
  updated_at: string;
  producto?: Pick<Producto, 'id' | 'descripcion'>;
  departamento?: Pick<Departamento, 'id' | 'nombre'>;
}

export interface RendimientoProveedor {
  id: number;
  proveedor_id: number;
  orden_compra_id: number;
  fecha_evaluacion: string;
  tiempo_entrega_estimado_dias?: number | null;
  tiempo_entrega_real_dias?: number | null;
  calidad_producto_evaluacion?: number | null;
  cumplimiento_pedido_evaluacion?: number | null;
  precio_competitividad_evaluacion?: number | null;
  comunicacion_evaluacion?: number | null;
  observaciones?: string | null;
  created_at: string;
  updated_at: string;
  proveedor?: Pick<Proveedor, 'nombre'>;
  orden_compra?: Pick<OrdenCompra, 'id' | 'fecha_orden'>;
}

export interface MetricasProductoMensual {
  id: number;
  producto_id: number;
  mes: string;
  cantidad_solicitada_total?: number;
  cantidad_comprada_total?: number;
  gasto_total_producto?: number;
  numero_solicitudes?: number;
  numero_ordenes?: number;
  created_at: string;
  updated_at: string;
  producto?: Pick<Producto, 'id' | 'descripcion'>;
}

/* Added missing exported interface to resolve error in HomePage.tsx */
export interface ProductoRezagado {
  id: number;
  orden_compra_id: number;
  producto_id: number;
  cantidad: number;
  motivo?: string | null;
  solicitud_id?: number | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  producto?: Pick<Producto, 'id' | 'descripcion' | 'unidad_medida' | 'codigo_interno'> | null;
  orden_compra?: Pick<OrdenCompra, 'id' | 'codigo_visible'> | null;
  solicitud?: Pick<SolicitudCompra, 'id' | 'codigo_visible'> | null;
}

/* Added missing exported interface to resolve error in UserManagement.tsx */
export interface EmpleadoCargoHistorial {
  id: number;
  empleado_id: number;
  cargo_id: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  created_at: string;
  updated_at: string;
  cargo?: Pick<Cargo, 'id' | 'nombre'>;
}

/* Added missing exported interface to resolve error in OrderCompletionForm.tsx */
export interface ProductoNoRecibido {
  id: number;
  orden_compra_id: number;
  producto_id: number;
  cantidad_faltante: number;
  motivo: string;
  created_at: string;
  updated_at: string;
}

// Tipos para la Base de Datos del Compañero
export interface PartnerCommission {
  id: string;
  name: string;
  is_active: boolean;
}

export interface PartnerEvent {
  id: string;
  subject: string; // Título en el esquema del compañero
  date: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
  is_cancelled: boolean;
}

export interface PartnerMeeting {
  id: string;
  subject: string;
  commission_id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
  is_cancelled: boolean;
  commission?: { name: string }; // Relación
}

export interface Database {
  public: {
    Tables: {
      camaraindustriales: { Row: Camaraindustriales; Insert: any; Update: any };
      cargo: { Row: Cargo; Insert: any; Update: any };
      categoria_producto: { Row: CategoriaProducto; Insert: any; Update: any };
      categoria_proveedor: { Row: CategoriaProveedor; Insert: any; Update: any };
      departamento: { Row: Departamento; Insert: any; Update: any };
      empleado: { Row: Empleado; Insert: any; Update: any };
      inventario: { Row: Inventario; Insert: any; Update: any };
      notificaciones: { Row: Notificacion; Insert: any; Update: any };
      ordencompra: { Row: OrdenCompra; Insert: any; Update: any };
      ordencompra_detalle: { Row: OrdenCompraDetalle; Insert: any; Update: any };
      ordenes_consolidadas: { Row: OrdenConsolidada; Insert: any; Update: any };
      producto: { Row: Producto; Insert: any; Update: any };
      proveedor: { Row: Proveedor; Insert: any; Update: any };
      rendimiento_proveedor: { Row: RendimientoProveedor; Insert: any; Update: any };
      solicitudcompra: { Row: SolicitudCompra; Insert: any; Update: any };
      solicitudcompra_detalle: { Row: SolicitudCompraDetalle; Insert: any; Update: any };
      user_profile: { Row: UserProfile; Insert: any; Update: any };
      consumo_historico_producto: { Row: ConsumoHistoricoProducto; Insert: any; Update: any };
      metricas_producto_mensual: { Row: MetricasProductoMensual; Insert: any; Update: any };
      facturas_orden: { Row: any; Insert: any; Update: any };
      orden_solicitud: { Row: any; Insert: any; Update: any };
      productos_no_recibidos: { Row: any; Insert: any; Update: any };
      productos_rezagados: { Row: any; Insert: any; Update: any };
      proveedor_categoria: { Row: any; Insert: any; Update: any };
      empleadocargohistorial: { Row: any; Insert: any; Update: any };
      consumo_para_evento_externo: { Row: any; Insert: any; Update: any };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export interface PartnerDatabaseSchema {
  public: {
    Tables: {
      events: { Row: PartnerEvent; Insert: any; Update: any };
      meetings: { Row: PartnerMeeting; Insert: any; Update: any };
      commissions: { Row: PartnerCommission; Insert: any; Update: any };
      departments: { Row: any; Insert: any; Update: any };
      participants: { Row: any; Insert: any; Update: any };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export interface AISummaryStat {
  dept: string;
  total: number;
  mean: number;
  stdDev: number;
  amounts: number[];
  anomalies: boolean[];
}

export interface ChartDataItem {
  name: string;
  value: number;
}

export interface ProductSelectionItem {
  id: number | null;
  descripcion: string;
  quantity: number;
  precio_unitario: number;
  selected: boolean;
  isNewProduct?: boolean;
  categoria_id?: number | null;
  codigo_interno?: string | null;
  unidad_medida?: string | null;
}

export interface OrdenCompraFormData {
  proveedor_id: number;
  unidad: OrdenCompraUnidad;
  retencion_porcentaje: number | null;
  sub_total: number;
  iva: number;
  ret_iva: number;
  neto_a_pagar: number;
  estado: OrdenCompraEstado;
  observaciones: string;
  fecha_entrega_estimada: string | null;
}
