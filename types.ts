
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
  departamento?: Departamento; // Relación opcional para cargar el nombre del departamento
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
  created_at: string;
  updated_at: string;
}

export type EmpleadoEstado = 'activo' | 'inactivo'; // Estados posibles para un empleado

export interface Empleado {
  id: number;
  cedula: string; // ÚNICO
  nombre: string;
  apellido: string;
  cargo_actual_id: number | null; // FK a 'cargo'
  firma?: string | null; // Podría ser una URL a una imagen de la firma o texto
  departamento_id: number; // FK a 'departamento'
  estado: EmpleadoEstado; // 'activo' o 'inactivo'
  created_at: string;
  updated_at: string;
  // Relaciones opcionales para cargar datos anidados fácilmente
  cargo?: Cargo | null;
  departamento?: Departamento;
  user_profile?: UserProfile | null; // Perfil de usuario asociado a este empleado
}

export interface EmpleadoCargoHistorial {
  id: number;
  empleado_id: number; // FK a 'empleado'
  cargo_id: number; // FK a 'cargo'
  fecha_inicio: string; // Fecha en formato 'YYYY-MM-DD'
  fecha_fin?: string | null; // Fecha en formato 'YYYY-MM-DD', null si es el cargo actual
  created_at: string;
  updated_at: string;
  cargo?: Cargo; // Para mostrar nombre del cargo en el historial
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
  producto_id: number; // FK a 'producto', ÚNICO (un registro de inventario por producto)
  ubicacion: string;
  fecha_actualizacion: string; // timestamp sin zona horaria
  existencias?: number | null; // Cantidad actual en stock
  created_at: string;
  updated_at: string;
  producto?: Producto; // Para mostrar detalles del producto
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
  solicitud_compra_id: number | null; // FK a 'solicitudcompra', null si es orden directa
  proveedor_id: number; // FK a 'proveedor'
  fecha_orden: string; // timestamp sin zona horaria
  estado: OrdenCompraEstado;
  // precio_unitario en la cabecera parece redundante si los detalles tienen sus propios precios.
  // Podría ser un valor informativo o un promedio si se necesita. Por ahora, lo mantenemos según esquema.
  precio_unitario: number; 
  sub_total: number;
  iva: number;
  ret_iva?: number | null;
  neto_a_pagar: number;
  unidad?: OrdenCompraUnidad | null;
  observaciones?: string | null;
  empleado_id: number; // Empleado que crea/gestiona la orden
  changed_by?: number | null; // Empleado que hizo la última modificación (FK a empleado)
  fecha_modificacion: string; // timestamp sin zona horaria
  retencion_porcentaje?: number | null; // Porcentaje de retención de IVA (ej. 75 para 75%)
  created_at: string;
  updated_at: string;
  fecha_entrega_estimada?: string | null; // 'YYYY-MM-DD'
  fecha_entrega_real?: string | null;     // 'YYYY-MM-DD'
  
  // Relaciones opcionales para cargar datos anidados
  proveedor?: Proveedor;
  detalles?: OrdenCompraDetalle[]; 
  empleado?: Empleado; 
  solicitud_compra?: SolicitudCompra; // Para mostrar info de la solicitud vinculada
  factura?: FacturaOrden; // Si hay una factura asociada
}

export interface OrdenCompraDetalle {
  id: number;
  orden_compra_id?: number | null; // FK a 'ordencompra'
  producto_id?: number | null; // FK a 'producto'
  cantidad: number;
  precio_unitario: number;
  monto_total?: number | null; // Calculado en DB: cantidad * precio_unitario
  created_at: string;
  updated_at: string;
  producto?: Producto; // Para mostrar descripción del producto
}

export interface OrdenConsolidada {
  id: number;
  proveedor_id?: number | null; // FK a 'proveedor'
  // JSONB en DB. En la app, manejar como array de objetos con estructura definida.
  productos: Array<{ producto_id: number; descripcion: string; cantidad: number }>; 
  estado: string; // Ej: 'Pendiente', 'Procesada', 'Completada'
  fecha_creacion: string; // timestamp sin zona horaria
  // JSONB en DB. En la app, manejar como array de IDs de solicitud.
  solicitudes: number[]; 
  created_at: string;
  updated_at: string;
  proveedor?: Pick<Proveedor, 'id' | 'nombre'>; // Solo necesitamos ID y nombre del proveedor aquí
}

export interface Producto {
  id: number;
  descripcion: string;
  categoria_id?: number | null; // FK a 'categoria_producto'
  stock_minimo?: number | null;
  stock_maximo?: number | null;
  unidad_medida?: string | null; // Ej: 'Unidad', 'Caja', 'Kg'
  codigo_interno?: string | null; // ÚNICO
  created_at: string;
  updated_at: string;
  categoria?: CategoriaProducto; // Para mostrar nombre de categoría
  // Relación con inventario (si producto_id en inventario es FK a producto.id y único)
  inventario?: Inventario; 
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
  producto?: Producto;
  orden_compra?: OrdenCompra;
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
  producto?: Producto;
  solicitud?: SolicitudCompra;
  orden_compra?: OrdenCompra;
}

export interface Proveedor {
  id: number;
  nombre: string;
  direccion: string;
  rif: string; // ÚNICO
  telefono?: string | null;
  correo?: string | null;
  pagina_web?: string | null;
  tiempo_entrega_promedio_dias?: number | null;
  calificacion_promedio?: number | null; // Podría ser calculado o manual
  estado: string; // Default 'activo'. Podría ser 'activo' | 'inactivo'
  created_at: string;
  updated_at: string;
  // Para join con tabla de unión 'proveedor_categoria'
  categorias?: Array<{ categoria_id: number; categoria?: Pick<CategoriaProveedor, 'id' | 'nombre'> }>;
}

// Tabla de unión para relación muchos-a-muchos entre Proveedor y CategoriaProveedor
export interface ProveedorCategoria { 
  proveedor_id: number; // FK a 'proveedor'
  categoria_id: number; // FK a 'categoria_proveedor'
  created_at: string;
  updated_at: string;
  categoria?: CategoriaProveedor; // Para mostrar nombre de la categoría del proveedor
}

export type SolicitudCompraEstado = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface SolicitudCompra {
  id: number;
  descripcion?: string | null;
  fecha_solicitud: string; // timestamp sin zona horaria
  estado: SolicitudCompraEstado;
  empleado_id: number; // Empleado que crea la solicitud (FK a 'empleado')
  departamento_id: number; // Departamento del solicitante (FK a 'departamento')
  created_at: string;
  updated_at: string;
  
  // Relaciones opcionales para cargar datos anidados
  detalles?: SolicitudCompraDetalle[];
  empleado?: Empleado; 
  departamento?: Departamento; 
}

export interface SolicitudCompraDetalle {
  id: number;
  solicitud_compra_id: number; // FK a 'solicitudcompra'
  producto_id?: number | null; // FK a 'producto', null si es descripción personalizada
  cantidad: number;
  // Para productos no catalogados, el usuario escribe la descripción aquí
  descripcion_producto_personalizado?: string | null; 
  created_at: string;
  updated_at: string;
  producto?: Producto; // Para mostrar detalles del producto si es catalogado
}

export type UserProfileRol = 'admin' | 'usuario'; // Roles de usuario en la aplicación

export interface UserProfile {
  id: string; // UUID de auth.users (clave primaria y FK a auth.users)
  email?: string | null; // Email del usuario, idealmente sincronizado desde auth.users para fácil acceso
  empleado_id?: number | null; // FK a la tabla 'empleado'
  // FK a 'departamento'. Puede ser el del empleado, o uno específico para el perfil si es diferente.
  departamento_id?: number | null; 
  rol?: UserProfileRol | null;
  created_at: string;
  updated_at: string;

  // Relaciones opcionales para cargar datos anidados
  empleado?: Partial<Empleado>; // Usar Partial si no todos los campos de Empleado son necesarios
  departamento?: Partial<Departamento>; 
}

export interface Notificacion {
  id?: number; // El ID de la notificación, autogenerado por la DB
  user_id: string; // UUID del usuario de auth.users al que va dirigida (FK a auth.users)
  title: string; // Título corto de la notificación
  description: string; // Descripción más detallada
  created_at: string; // Fecha de creación
  type?: string; // Tipo de notificación (ej: 'nueva_solicitud', 'solicitud_aprobada')
  read: boolean; // Estado de lectura (true si ya fue leída)
  related_id?: number; // ID relacionado (ej: id de solicitud_compra, id de orden_compra)
  updated_at: string;
}

// --- Tablas de Análisis (según esquema SQL) ---

export interface ConsumoHistoricoProducto {
  id: number;
  producto_id: number; // FK a 'producto'
  cantidad_consumida: number; // Positivo para salidas, podría ser negativo para devoluciones/entradas por ajuste
  fecha_consumo: string; // 'YYYY-MM-DD'
  departamento_id?: number | null; // Departamento que consume o al que se asigna (FK a 'departamento')
  solicitud_detalle_id?: number | null; // Si el consumo proviene de una solicitud (FK a 'solicitudcompra_detalle')
  orden_detalle_id?: number | null; // Si el consumo es una entrada por orden de compra (FK a 'ordencompra_detalle')
  // Tipo de movimiento: 'uso_regular', 'entrada_oc', 'salida_evento_externo', 'ajuste_inventario_salida', 'ajuste_inventario_entrada'
  tipo_consumo: string; 
  evento_id_externo?: string | null; // ID del evento externo si aplica
  descripcion_adicional?: string | null; // Notas adicionales sobre el consumo
  created_at: string;
  updated_at: string;
  producto?: Producto;
  departamento?: Departamento;
}

export interface RendimientoProveedor {
  id: number;
  proveedor_id: number; // FK a 'proveedor'
  orden_compra_id: number; // FK a 'ordencompra', ÚNICO (una evaluación por orden de compra a un proveedor)
  fecha_evaluacion: string; // 'YYYY-MM-DD'
  tiempo_entrega_estimado_dias?: number | null;
  tiempo_entrega_real_dias?: number | null;
  calidad_producto_evaluacion?: number | null; // smallint (1-5)
  cumplimiento_pedido_evaluacion?: number | null; // smallint (1-5)
  precio_competitividad_evaluacion?: number | null; // smallint (1-5)
  comunicacion_evaluacion?: number | null; // smallint (1-5)
  observaciones?: string | null;
  created_at: string;
  updated_at: string;
  proveedor?: Proveedor;
  orden_compra?: OrdenCompra;
}

export interface MetricasProductoMensual {
  id: number;
  producto_id: number; // FK a 'producto'
  mes: string; // 'YYYY-MM-DD', usualmente el primer día del mes para representar el mes completo
  cantidad_solicitada_total?: number;
  cantidad_comprada_total?: number;
  gasto_total_producto?: number;
  numero_solicitudes?: number; // Cuántas solicitudes incluyeron este producto en el mes
  numero_ordenes?: number;   // Cuántas órdenes incluyeron este producto en el mes
  created_at: string;
  updated_at: string;
  producto?: Producto;
}

// Para registrar qué compras se hicieron específicamente para un evento externo
export interface ComprasParaEventoExterno {
  id: number;
  evento_id_externo: string; // ID del evento en la DB del compañero
  orden_compra_id: number; // ID de la orden de compra en nuestra DB (FK a 'ordencompra')
  descripcion_motivo?: string | null; // Por qué esta compra se asocia al evento
  created_at: string;
  updated_at: string;
  orden_compra?: OrdenCompra;
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
  producto?: Producto;
  departamento?: Departamento;
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
// Esto le dice a TypeScript cómo son nuestras tablas, vistas, funciones, etc.

export interface Database {
  public: {
    Tables: {
      camaraindustriales: {
        Row: Camaraindustriales;
        Insert: Omit<Camaraindustriales, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Camaraindustriales, 'id' | 'created_at'>>; // No actualizamos created_at
      };
      cargo: {
        Row: Cargo;
        Insert: Omit<Cargo, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Cargo, 'id' | 'created_at'>>;
      };
      categoria_producto: {
        Row: CategoriaProducto;
        Insert: Omit<CategoriaProducto, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CategoriaProducto, 'id' | 'created_at'>>;
      };
      categoria_proveedor: {
        Row: CategoriaProveedor;
        Insert: Omit<CategoriaProveedor, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CategoriaProveedor, 'id' | 'created_at'>>;
      };
      departamento: {
        Row: Departamento;
        Insert: Omit<Departamento, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Departamento, 'id' | 'created_at'>>;
      };
      empleado: {
        Row: Empleado;
        // 'id' es serial, 'created_at', 'updated_at' tienen defaults y se manejan por DB
        Insert: Omit<Empleado, 'id' | 'created_at' | 'updated_at'>; 
        Update: Partial<Omit<Empleado, 'id' | 'created_at'>>;
      };
      empleadocargohistorial: {
        Row: EmpleadoCargoHistorial;
        Insert: Omit<EmpleadoCargoHistorial, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<EmpleadoCargoHistorial, 'id' | 'created_at'>>;
      };
      facturas_orden: {
        Row: FacturaOrden;
        Insert: Omit<FacturaOrden, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FacturaOrden, 'id' | 'created_at'>>;
      };
      inventario: {
        Row: Inventario;
        // fecha_actualizacion tiene default NOW()
        Insert: Omit<Inventario, 'id' | 'fecha_actualizacion' | 'created_at' | 'updated_at'>; 
        Update: Partial<Omit<Inventario, 'id' | 'created_at'>>; // fecha_actualizacion se actualizará con trigger o explícitamente
      };
      orden_solicitud: { // Tabla de unión
        Row: OrdenSolicitud;
        // ordencompra_id es GENERATED ALWAYS AS IDENTITY, no se inserta manualmente
        Insert: Omit<OrdenSolicitud, 'ordencompra_id' | 'created_at' | 'updated_at'>; 
        Update: Partial<Omit<OrdenSolicitud, 'ordencompra_id' | 'created_at'>>;
      };
      ordencompra: {
        Row: OrdenCompra;
        // Varios campos tienen defaults o son serial
        Insert: Omit<OrdenCompra, 'id' | 'fecha_orden' | 'fecha_modificacion' | 'created_at' | 'updated_at'>; 
        Update: Partial<Omit<OrdenCompra, 'id' | 'fecha_orden' | 'created_at'>>; // fecha_modificacion se actualiza
      };
      ordencompra_detalle: {
        Row: OrdenCompraDetalle;
        // monto_total es generado en DB
        Insert: Omit<OrdenCompraDetalle, 'id' | 'monto_total' | 'created_at' | 'updated_at'>; 
        Update: Partial<Omit<OrdenCompraDetalle, 'id' | 'monto_total' | 'created_at'>>;
      };
      ordenes_consolidadas: {
        Row: OrdenConsolidada;
        Insert: Omit<OrdenConsolidada, 'id' | 'fecha_creacion' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrdenConsolidada, 'id' | 'fecha_creacion' | 'created_at'>>;
      };
      producto: {
        Row: Producto;
        Insert: Omit<Producto, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Producto, 'id' | 'created_at'>>;
      };
      productos_no_recibidos: {
        Row: ProductoNoRecibido;
        Insert: Omit<ProductoNoRecibido, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductoNoRecibido, 'id' | 'created_at'>>;
      };
      productos_rezagados: {
        Row: ProductoRezagado;
        Insert: Omit<ProductoRezagado, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductoRezagado, 'id' | 'created_at'>>;
      };
      proveedor: {
        Row: Proveedor;
        Insert: Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Proveedor, 'id' | 'created_at'>>;
      };
      proveedor_categoria: { // Tabla de unión
        Row: ProveedorCategoria;
        // Las PKs son las FKs, se insertan manualmente
        Insert: Omit<ProveedorCategoria, 'created_at' | 'updated_at'>; 
        Update: Partial<Omit<ProveedorCategoria, 'created_at'>>;
      };
      solicitudcompra: {
        Row: SolicitudCompra;
        Insert: Omit<SolicitudCompra, 'id' | 'fecha_solicitud' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SolicitudCompra, 'id' | 'fecha_solicitud' | 'created_at'>>;
      };
      solicitudcompra_detalle: {
        Row: SolicitudCompraDetalle;
        Insert: Omit<SolicitudCompraDetalle, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SolicitudCompraDetalle, 'id' | 'created_at'>>;
      };
      user_profile: {
        Row: UserProfile;
        // 'email' no se inserta/actualiza aquí, se maneja por auth.users y se consulta por FK.
        // 'id' es FK a auth.users.id y se provee al insertar.
        Insert: Omit<UserProfile, 'created_at' | 'updated_at' | 'email'>; 
        Update: Partial<Omit<UserProfile, 'created_at' | 'email'>>; // No actualizar email ni created_at directamente
      };
      notificaciones: { 
        Row: Notificacion;
        // id es serial, created_at/updated_at tienen defaults
        Insert: Omit<Notificacion, 'id' | 'created_at' | 'updated_at'>; 
        Update: Partial<Omit<Notificacion, 'id' | 'created_at'>>;
      };
      // Nuevas tablas de análisis
      consumo_historico_producto: {
        Row: ConsumoHistoricoProducto;
        Insert: Omit<ConsumoHistoricoProducto, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ConsumoHistoricoProducto, 'id' | 'created_at'>>;
      };
      rendimiento_proveedor: {
        Row: RendimientoProveedor;
        Insert: Omit<RendimientoProveedor, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RendimientoProveedor, 'id' | 'created_at'>>;
      };
      metricas_producto_mensual: {
        Row: MetricasProductoMensual;
        Insert: Omit<MetricasProductoMensual, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MetricasProductoMensual, 'id' | 'created_at'>>;
      };
      compras_para_evento_externo: {
        Row: ComprasParaEventoExterno;
        Insert: Omit<ComprasParaEventoExterno, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ComprasParaEventoExterno, 'id' | 'created_at'>>;
      };
      consumo_para_evento_externo: {
        Row: ConsumoParaEventoExterno;
        Insert: Omit<ConsumoParaEventoExterno, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ConsumoParaEventoExterno, 'id' | 'created_at'>>;
      };
    };
    Views: { // Vistas de la base de datos, si las hubiera
      [_ in never]: never; // Placeholder si no hay vistas
    };
    Functions: { // Funciones de PostgreSQL, si las hubiera
      [_ in never]: never; // Placeholder si no hay funciones
    };
    Enums: { // Tipos Enum de PostgreSQL, si los hubiera
      [_ in never]: never; // Placeholder
    };
    CompositeTypes: { // Tipos Compuestos de PostgreSQL, si los hubiera
      [_ in never]: never; // Placeholder
    };
  };
}

// Esquema para la Base de Datos del Compañero (Eventos Externos)
// Solo se definen las tablas para poder usar `createClient<PartnerDatabaseSchema>(...)`.
// No se definen tipos Insert/Update aquí ya que nuestra app solo lee de esta BD.
export interface PartnerDatabaseSchema {
  public: {
    Tables: {
      Commissions: { Row: PartnerCommission };
      Companies: { Row: PartnerCompany };
      EventCategories: { Row: PartnerEventCategory };
      Events: { Row: PartnerEvent };
      Meetings: { Row: PartnerMeeting };
      Participants: { Row: PartnerParticipant };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}


// Tipo para el formulario de Orden de Compra.
// Se omiten campos autogenerados o calculados que no se ingresan directamente en el formulario.
export type OrdenCompraFormData = Omit<OrdenCompra, 
  'id' | 'fecha_orden' | 'fecha_modificacion' | 
  'sub_total' | 'iva' | 'ret_iva' | 'neto_a_pagar' | // Calculados
  'proveedor' | 'detalles' | 'empleado' | 'solicitud_compra' | // Relaciones anidadas
  'created_at' | 'updated_at' | 'factura' // Timestamps y factura
> & {
  // Campos que sí están en el formulario y necesitan ser explícitos
  proveedor_id: number | null; // Asegurar que proveedor_id pueda ser null para el estado inicial del formulario
  // Los campos calculados se pueden añadir opcionalmente si se quieren mostrar en el formulario:
  sub_total?: number;
  iva?: number;
  ret_iva?: number;
  neto_a_pagar?: number;
  fecha_entrega_estimada?: string | null; // Para el input de fecha
};

// Para seleccionar productos en el formulario de orden, incluyendo cantidad y si está seleccionado
export interface ProductSelectionItem extends Producto {
  quantity: number; // Cantidad a ordenar
  selected: boolean; // Para marcar si se incluye en la orden final
  motivo?: string; // Motivo si no se incluye (ej. para productos rezagados)
  precio_unitario: number; // Precio que el admin puede ajustar para esta orden específica
}

// --- Tipos para Resumen de IA y Gráficos ---
export interface AISummaryStat {
  dept: string;         // Nombre del departamento
  total: number;        // Gasto total del departamento
  mean: number;         // Gasto promedio por transacción/orden
  stdDev: number;       // Desviación estándar de los gastos
  amounts: number[];    // Array de los montos individuales de gasto
  anomalies: boolean[]; // Array de booleanos indicando si cada monto es una anomalía
}

export interface AIAnomalySummary {
  dept: string;         // Nombre del departamento
  anomalyCount: number; // Número de transacciones anómalas
  normalCount: number;  // Número de transacciones normales
}

// Tipo genérico para datos de gráficos (ej. PieChart)
export interface ChartDataItem {
  name: string; // Nombre para la etiqueta (ej: "Anomalías", "Normales", nombre de departamento)
  value: number; // Valor numérico para el gráfico
}