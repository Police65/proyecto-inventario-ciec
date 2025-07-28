// types.ts
// Este archivo contiene las definiciones de TypeScript para las estructuras de datos (tablas)
// y otros tipos personalizados utilizados en la aplicación.

// Basado en el esquema SQL proporcionado por el usuario.

export interface Camaraindustriales {
  id: number;
  nombre: string;
  direccion: string;
  web?: string | null;
  correo?: string | null;
  telefonos?: string | null;
  rif: string; // ÚNICO
  created_at: string; // timestamptz (cadena ISO 8601)
  updated_at: string; // timestamptz
}

export interface Cargo {
  id: number;
  nombre: string; // Nombre del cargo, ÚNICO
  departamento_id: number; // FK a 'departamento'
  created_at: string;
  updated_at: string;
}

export interface CategoriaProducto {
  id: number;
  nombre: string; // ÚNICO
  created_at: string;
  updated_at: string;
}

export interface CategoriaProveedor {
  id: number;
  nombre: string; // ÚNICO
  created_at: string;
  updated_at: string;
}

export interface Departamento {
  id: number;
  nombre: string; // ÚNICO
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
}

export type EmpleadoEstado = 'activo' | 'inactivo'; // Estados posibles para un empleado

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
}

export interface EmpleadoCargoHistorial {
  id: number;
  empleado_id: number;
  cargo_id: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FacturaOrden {
  id: number;
  orden_compra_id?: number | null; // FK a 'ordencompra'
  numero_factura?: string | null;
  fecha_recepcion?: string | null; // 'YYYY-MM-DD'
  documento_factura?: string | null; // URL o ruta al archivo de la factura
  total_recepcionado?: number | null; // Monto total según la factura
  created_at: string;
  updated_at: string;
}


export interface Inventario {
  id: number;
  producto_id: number;
  ubicacion: string;
  fecha_actualizacion: string;
  existencias?: number | null;
  created_at: string;
  updated_at: string;
}

// Tabla de unión entre OrdenCompra y SolicitudCompra
export interface OrdenSolicitud {
  ordencompra_id: number; // FK a 'ordencompra'
  solicitud_id: number;   // FK a 'solicitudcompra'
  created_at: string;
  updated_at: string;
}

export type OrdenCompraEstado = 'Pendiente' | 'Completada' | 'Anulada';
export type OrdenCompraUnidad = 'Bs' | 'USD'; // Unidades monetarias


export interface OrdenCompra {
  id: number;
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
}

export interface OrdenCompraDetalle {
  id: number;
  orden_compra_id?: number | null;
  producto_id?: number | null;
  cantidad: number;
  precio_unitario: number;
  monto_total?: number | null;
  created_at: string;
  updated_at: string;
  descripcion_producto_personalizado?: string | null;
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
}

// Productos que no se recibieron completamente en una orden
export interface ProductoNoRecibido {
  id: number;
  orden_compra_id?: number | null; // FK a 'ordencompra'
  producto_id?: number | null; // FK a 'producto'
  cantidad_faltante?: number | null;
  motivo?: string | null;
  created_at: string;
  updated_at: string;
}

// Productos que fueron solicitados pero no incluidos en una orden (por decisión o falta de stock)
export interface ProductoRezagado {
  id: number;
  orden_compra_id?: number | null; // Orden de compra relacionada (si se llegó a crear una orden parcial)
  producto_id?: number | null; // FK a 'producto'
  cantidad: number; // Cantidad que quedó rezagada
  motivo?: string | null; // Razón por la que se rezagó
  solicitud_id?: number | null; // Solicitud original del producto
  created_at: string;
  updated_at: string;
}

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
  tipo_contribuyente: ProveedorTipoContribuyente;
  porcentaje_retencion_iva: number;
  created_at: string;
  updated_at: string;
}

// Tabla de unión para relación muchos-a-muchos entre Proveedor y CategoriaProveedor
export interface ProveedorCategoria {
  proveedor_id: number; // FK a 'proveedor'
  categoria_id: number; // FK a 'categoria_proveedor'
  created_at: string;
  updated_at: string;
}

export type SolicitudCompraEstado = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface SolicitudCompra {
  id: number;
  descripcion?: string | null;
  fecha_solicitud: string;
  estado: SolicitudCompraEstado;
  empleado_id: number;
  departamento_id: number;
  created_at: string;
  updated_at: string;
}

export interface SolicitudCompraDetalle {
  id: number;
  solicitud_compra_id: number;
  producto_id?: number | null;
  cantidad: number;
  descripcion_producto_personalizado?: string | null;
  created_at: string;
  updated_at: string;
}

export type UserProfileRol = 'admin' | 'usuario'; // Roles de usuario en la aplicación

export interface UserProfile {
  id: string;
  email?: string | null;
  empleado_id?: number | null;
  departamento_id?: number | null;
  rol?: UserProfileRol | null;
  created_at: string;
  updated_at: string;
}

export interface Notificacion {
  id: number; // El ID de la notificación, autogenerado por la DB
  user_id: string; // UUID del usuario de auth.users al que va dirigida (FK a auth.users)
  title: string; // Título corto de la notificación
  description: string; // Descripción más detallada
  created_at: string; // Fecha de creación
  type?: string; // Tipo de notificación (ej: 'nueva_solicitud', 'solicitud_aprobada')
  read: boolean; // Estado de lectura (true si ya fue leída)
  updated_at: string;
}

// Tipo para insertar notificaciones, excluyendo campos auto-generados o con default
export type NotificacionInsert = Omit<Notificacion, 'id' | 'created_at' | 'updated_at' | 'read'>;


// --- Tablas de Análisis (según esquema SQL) ---

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
}

// Para registrar qué compras se hicieron específicamente para un evento externo
export interface ComprasParaEventoExterno {
  id: number;
  evento_id_externo: string; // ID del evento en la DB del compañero
  orden_compra_id: number; // ID de la orden de compra en nuestra DB (FK a 'ordencompra')
  descripcion_motivo?: string | null; // Por qué esta compra se asocia al evento
  created_at: string;
  updated_at: string;
}

// Para registrar el consumo de productos de nuestro inventario en un evento externo
export interface ConsumoParaEventoExterno {
  id: number;
  evento_id_externo: string; // ID del evento en la DB del compañero
  nombre_evento_externo?: string | null; // Nombre del evento (puede obtenerse de la DB compañera)
  fecha_evento: string; // 'YYYY-MM-DD'
  producto_id: number; // Producto de nuestro inventario consumido (FK a 'producto')
  cantidad_consumida: number;
  departamento_solicitante_id?: number | null; // Nuestro departamento que usó el producto (FK a 'departamento')
  notas?: string | null;
  // Campos de la DB del compañero para referencia
  organizer_type_externo?: string | null; // 'commission' o 'category'
  organizer_id_externo?: string | null; // ID del organizador
  location_externo?: string | null; // Ubicación del evento
  costo_estimado_consumo?: number | null; // Calculado si es posible (cantidad * costo_unitario_producto)
  created_at: string;
  updated_at: string;
}

// --- Tipos para la Base de Datos del Compañero (Eventos Externos) ---
// Estos tipos definen la estructura esperada de los datos de la BD del compañero.

export interface PartnerCommission { // Comisiones (organizadores)
  id: string; // UUID
  name: string;
}

export interface PartnerCompany { // Empresas (participantes/clientes del compañero)
  id: string; // UUID
  name: string;
  rif: string;
  status: 'Active' | 'Inactive';
  email: string;
  phone?: string | null;
  address?: string | null;
}

export interface PartnerEventCategory { // Categorías de Eventos
  id: string; // UUID
  name: string;
}

export interface PartnerEvent { // Eventos
  id: string; // UUID, ej: "00dc8082-c888-4a0b-a194-105057f2d764"
  subject: string; // Nombre del evento
  organizer_type: 'commission' | 'category'; // Tipo de organizador
  organizer_id: string; // ID de la comisión o categoría (UUID)
  date: string; // Fecha del evento 'YYYY-MM-DD'
  start_time: string; // Hora de inicio 'HH:MM:SS'
  end_time?: string | null; // Hora de fin 'HH:MM:SS'
  location?: string | null;
  facilitator_id?: string | null; // ID del facilitador (de PartnerParticipant)
  attendees_in_person?: string[] | null; // Array de IDs de PartnerParticipant
  attendees_online?: string[] | null; // Array de IDs de PartnerParticipant
  external_participants_count?: number;
  description?: string | null;
  cost?: number | null; // Costo del evento
  investment?: number | null; // Inversión
  revenue?: number | null; // Ingresos
  // Campos opcionales que podrían poblarse con JOINs o búsquedas separadas para UI
  organizer_name?: string;
  facilitator_name?: string;
}

export interface PartnerMeeting { // Reuniones (similar a Eventos pero podría ser específico)
  id: string; // UUID
  subject: string;
  commission_id: string; // FK a PartnerCommission
  date: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  facilitator_id?: string | null;
  attendees_in_person?: string[] | null;
  attendees_online?: string[] | null;
  external_participants_count?: number;
  description?: string | null;
}

export interface PartnerParticipant { // Personas participantes en eventos/reuniones
  id: string; // UUID
  name: string;
  company_id?: string | null; // FK a PartnerCompany
  role: string; // Cargo/rol del participante
  email: string;
  phone?: string | null;
  commission_ids?: string[] | null; // IDs de comisiones a las que pertenece (array de UUIDs)
}


// --- Definición del Esquema de Base de Datos para el cliente Supabase ---
//
// CAMBIO CLAVE: Se simplifican los tipos 'Insert' y 'Update' a 'Record<string, any>'.
// Esta es la solución más permisiva para resolver los errores de
// "type instantiation is excessively deep" y "is not assignable to type 'never'" que pueden
// ocurrir en proyectos con esquemas de base de datos muy grandes y complejos. Se sacrifica
// la seguridad de tipos en las cargas útiles de inserción/actualización para garantizar
// que el compilador de TypeScript pueda manejar el esquema sin fallar. La validación de datos
// se delega a la base de datos (constraints, RLS) y a la lógica de los formularios.

export interface Database {
  public: {
    Tables: {
      camaraindustriales: {
        Row: Camaraindustriales;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      cargo: {
        Row: Cargo;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      categoria_producto: {
        Row: CategoriaProducto;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      categoria_proveedor: {
        Row: CategoriaProveedor;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      compras_para_evento_externo: {
        Row: ComprasParaEventoExterno;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      consumo_historico_producto: {
        Row: ConsumoHistoricoProducto;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      consumo_para_evento_externo: {
        Row: ConsumoParaEventoExterno;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      departamento: {
        Row: Departamento;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      empleado: {
        Row: Empleado;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      empleadocargohistorial: {
        Row: EmpleadoCargoHistorial;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      facturas_orden: {
        Row: FacturaOrden;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      inventario: {
        Row: Inventario;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      metricas_producto_mensual: {
        Row: MetricasProductoMensual;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      notificaciones: {
        Row: Notificacion;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      orden_solicitud: {
        Row: OrdenSolicitud;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      ordencompra: {
        Row: OrdenCompra;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      ordencompra_detalle: {
        Row: OrdenCompraDetalle;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      ordenes_consolidadas: {
        Row: OrdenConsolidada;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      producto: {
        Row: Producto;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      productos_no_recibidos: {
        Row: ProductoNoRecibido;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      productos_rezagados: {
        Row: ProductoRezagado;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      proveedor: {
        Row: Proveedor;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      proveedor_categoria: {
        Row: ProveedorCategoria;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      rendimiento_proveedor: {
        Row: RendimientoProveedor;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      solicitudcompra: {
        Row: SolicitudCompra;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      solicitudcompra_detalle: {
        Row: SolicitudCompraDetalle;
        Insert: Record<string, any>;
        Update: Record<string, any>;
      };
      user_profile: {
        Row: UserProfile;
        Insert: Record<string, any>;
        Update: Record<string, any>;
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


export interface PartnerDatabaseSchema {
  public: {
    Tables: {
      Events: { Row: PartnerEvent; Insert: Record<string, any>; Update: Record<string, any>; };
      Meetings: { Row: PartnerMeeting; Insert: Record<string, any>; Update: Record<string, any>; };
      Commissions: { Row: PartnerCommission; Insert: Record<string, any>; Update: Record<string, any>; };
      Companies: { Row: PartnerCompany; Insert: Record<string, any>; Update: Record<string, any>; };
      EventCategories: { Row: PartnerEventCategory; Insert: Record<string, any>; Update: Record<string, any>; };
      Participants: { Row: PartnerParticipant; Insert: Record<string, any>; Update: Record<string, any>; };
    };
    Views: { [_ in never]: never; };
    Functions: { [_ in never]: never; };
    Enums: { [_ in never]: never; };
    CompositeTypes: { [_ in never]: never; };
  };
}

// --- Tipos Personalizados para Formularios y Componentes ---

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

export interface ProductSelectionItem {
  id: number | null;
  descripcion: string;
  quantity: number;
  precio_unitario: number;
  selected: boolean;
  motivo?: string;
  categoria_id?: number | null;
  codigo_interno?: string | null;
  unidad_medida?: string | null;
}

// --- Tipos para Componentes de IA ---

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