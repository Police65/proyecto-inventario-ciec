-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.camaraindustriales (
  id integer NOT NULL DEFAULT nextval('camaraindustriales_id_seq'::regclass),
  nombre character varying NOT NULL,
  direccion text NOT NULL,
  web character varying,
  correo character varying,
  telefonos character varying,
  rif character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT camaraindustriales_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cargo (
  id integer NOT NULL DEFAULT nextval('cargo_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  departamento_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cargo_pkey PRIMARY KEY (id),
  CONSTRAINT cargo_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamento(id)
);
CREATE TABLE public.categoria_producto (
  id integer NOT NULL DEFAULT nextval('categoria_producto_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT categoria_producto_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categoria_proveedor (
  id integer NOT NULL DEFAULT nextval('categoria_proveedor_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT categoria_proveedor_pkey PRIMARY KEY (id)
);
CREATE TABLE public.compras_para_evento_externo (
  id integer NOT NULL DEFAULT nextval('compras_para_evento_externo_id_seq'::regclass),
  evento_id_externo text NOT NULL,
  orden_compra_id integer NOT NULL,
  descripcion_motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT compras_para_evento_externo_pkey PRIMARY KEY (id),
  CONSTRAINT compras_para_evento_externo_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordencompra(id)
);
CREATE TABLE public.consumo_historico_producto (
  id integer NOT NULL DEFAULT nextval('consumo_historico_producto_id_seq'::regclass),
  producto_id integer NOT NULL,
  cantidad_consumida integer NOT NULL CHECK (cantidad_consumida <> 0),
  fecha_consumo date NOT NULL DEFAULT CURRENT_DATE,
  departamento_id integer,
  solicitud_detalle_id integer,
  orden_detalle_id integer,
  tipo_consumo text NOT NULL DEFAULT 'uso_regular'::text,
  evento_id_externo text,
  descripcion_adicional text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT consumo_historico_producto_pkey PRIMARY KEY (id),
  CONSTRAINT consumo_historico_producto_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id),
  CONSTRAINT consumo_historico_producto_orden_detalle_id_fkey FOREIGN KEY (orden_detalle_id) REFERENCES public.ordencompra_detalle(id),
  CONSTRAINT consumo_historico_producto_solicitud_detalle_id_fkey FOREIGN KEY (solicitud_detalle_id) REFERENCES public.solicitudcompra_detalle(id),
  CONSTRAINT consumo_historico_producto_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamento(id)
);
CREATE TABLE public.consumo_para_evento_externo (
  id integer NOT NULL DEFAULT nextval('consumo_para_evento_externo_id_seq'::regclass),
  evento_id_externo text NOT NULL,
  nombre_evento_externo text,
  fecha_evento date NOT NULL,
  producto_id integer NOT NULL,
  cantidad_consumida integer NOT NULL CHECK (cantidad_consumida > 0),
  departamento_solicitante_id integer,
  notas text,
  organizer_type_externo text,
  organizer_id_externo text,
  location_externo text,
  costo_estimado_consumo numeric,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT consumo_para_evento_externo_pkey PRIMARY KEY (id),
  CONSTRAINT consumo_para_evento_externo_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id),
  CONSTRAINT consumo_para_evento_externo_departamento_solicitante_id_fkey FOREIGN KEY (departamento_solicitante_id) REFERENCES public.departamento(id)
);
CREATE TABLE public.departamento (
  id integer NOT NULL DEFAULT nextval('departamento_id_seq'::regclass),
  nombre character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT departamento_pkey PRIMARY KEY (id)
);
CREATE TABLE public.empleado (
  id integer NOT NULL DEFAULT nextval('empleado_id_seq'::regclass),
  cedula character varying NOT NULL UNIQUE,
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  cargo_actual_id integer NOT NULL,
  firma text,
  departamento_id integer NOT NULL,
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying::text, 'inactivo'::character varying::text])),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT empleado_pkey PRIMARY KEY (id),
  CONSTRAINT empleado_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamento(id),
  CONSTRAINT empleado_cargo_actual_id_fkey FOREIGN KEY (cargo_actual_id) REFERENCES public.cargo(id)
);
CREATE TABLE public.empleadocargohistorial (
  id integer NOT NULL DEFAULT nextval('empleadocargohistorial_id_seq'::regclass),
  empleado_id integer NOT NULL,
  cargo_id integer NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT empleadocargohistorial_pkey PRIMARY KEY (id),
  CONSTRAINT empleadocargohistorial_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleado(id),
  CONSTRAINT empleadocargohistorial_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES public.cargo(id)
);
CREATE TABLE public.facturas_orden (
  id integer NOT NULL DEFAULT nextval('facturas_orden_id_seq'::regclass),
  orden_compra_id integer,
  numero_factura character varying,
  fecha_recepcion date,
  documento_factura text,
  total_recepcionado numeric,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT facturas_orden_pkey PRIMARY KEY (id),
  CONSTRAINT facturas_orden_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordencompra(id)
);
CREATE TABLE public.inventario (
  id integer NOT NULL DEFAULT nextval('inventario_id_seq'::regclass),
  producto_id integer NOT NULL UNIQUE,
  ubicacion text NOT NULL,
  fecha_actualizacion timestamp without time zone DEFAULT now(),
  existencias integer CHECK (existencias > 0),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inventario_pkey PRIMARY KEY (id),
  CONSTRAINT inventario_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id)
);
CREATE TABLE public.metricas_producto_mensual (
  id integer NOT NULL DEFAULT nextval('metricas_producto_mensual_id_seq'::regclass),
  producto_id integer NOT NULL,
  mes date NOT NULL,
  cantidad_solicitada_total integer DEFAULT 0,
  cantidad_comprada_total integer DEFAULT 0,
  gasto_total_producto numeric DEFAULT 0.00,
  numero_solicitudes integer DEFAULT 0,
  numero_ordenes integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT metricas_producto_mensual_pkey PRIMARY KEY (id),
  CONSTRAINT metricas_producto_mensual_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id)
);
CREATE TABLE public.notificaciones (
  id integer NOT NULL DEFAULT nextval('notificaciones_id_seq'::regclass),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read boolean DEFAULT false,
  type character varying,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.orden_solicitud (
  ordencompra_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  solicitud_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT orden_solicitud_pkey PRIMARY KEY (ordencompra_id, solicitud_id),
  CONSTRAINT orden_solicitud_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudcompra(id),
  CONSTRAINT orden_solicitud_ordencompra_id_fkey FOREIGN KEY (ordencompra_id) REFERENCES public.ordencompra(id)
);
CREATE TABLE public.ordencompra (
  id integer NOT NULL DEFAULT nextval('ordencompra_id_seq'::regclass),
  solicitud_compra_id integer NOT NULL,
  proveedor_id integer NOT NULL,
  fecha_orden timestamp without time zone DEFAULT now(),
  estado character varying NOT NULL CHECK (estado::text = ANY (ARRAY['Pendiente'::character varying::text, 'Completada'::character varying::text, 'Anulada'::character varying::text])),
  precio_unitario numeric NOT NULL DEFAULT '0'::numeric,
  sub_total numeric NOT NULL,
  iva numeric NOT NULL,
  ret_iva numeric,
  neto_a_pagar numeric NOT NULL,
  unidad character varying CHECK (unidad::text = ANY (ARRAY['Bs'::character varying::text, 'USD'::character varying::text])),
  observaciones text,
  empleado_id integer NOT NULL,
  changed_by integer,
  fecha_modificacion timestamp without time zone DEFAULT now(),
  retencion_porcentaje numeric DEFAULT '0'::numeric CHECK (retencion_porcentaje > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_entrega_estimada date,
  fecha_entrega_real date,
  CONSTRAINT ordencompra_pkey PRIMARY KEY (id),
  CONSTRAINT ordencompra_solicitud_compra_id_fkey FOREIGN KEY (solicitud_compra_id) REFERENCES public.solicitudcompra(id),
  CONSTRAINT ordencompra_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedor(id),
  CONSTRAINT ordencompra_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleado(id)
);
CREATE TABLE public.ordencompra_detalle (
  id integer NOT NULL DEFAULT nextval('ordencompra_detalle_id_seq'::regclass),
  orden_compra_id integer,
  producto_id integer,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL,
  monto_total numeric DEFAULT ((cantidad)::numeric * precio_unitario),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ordencompra_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT ordencompra_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id),
  CONSTRAINT ordencompra_detalle_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordencompra(id)
);
CREATE TABLE public.ordenes_consolidadas (
  id integer NOT NULL DEFAULT nextval('ordenes_consolidadas_id_seq'::regclass),
  proveedor_id integer,
  productos jsonb NOT NULL,
  estado character varying NOT NULL DEFAULT 'Pendiente'::character varying,
  fecha_creacion timestamp without time zone NOT NULL DEFAULT now(),
  solicitudes jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ordenes_consolidadas_pkey PRIMARY KEY (id),
  CONSTRAINT ordenes_consolidadas_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedor(id)
);
CREATE TABLE public.producto (
  id integer NOT NULL DEFAULT nextval('producto_id_seq'::regclass),
  descripcion text NOT NULL,
  categoria_id integer,
  stock_minimo integer DEFAULT 0,
  stock_maximo integer,
  unidad_medida character varying,
  codigo_interno character varying UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT producto_pkey PRIMARY KEY (id),
  CONSTRAINT producto_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categoria_producto(id)
);
CREATE TABLE public.productos_no_recibidos (
  id integer NOT NULL DEFAULT nextval('productos_no_recibidos_id_seq'::regclass),
  orden_compra_id integer,
  producto_id integer,
  cantidad_faltante integer,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT productos_no_recibidos_pkey PRIMARY KEY (id),
  CONSTRAINT productos_no_recibidos_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordencompra(id),
  CONSTRAINT productos_no_recibidos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id)
);
CREATE TABLE public.productos_rezagados (
  id integer NOT NULL DEFAULT nextval('productos_rezagados_id_seq'::regclass),
  orden_compra_id integer,
  producto_id integer,
  cantidad integer NOT NULL,
  motivo text,
  solicitud_id integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT productos_rezagados_pkey PRIMARY KEY (id),
  CONSTRAINT productos_rezagados_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudcompra(id),
  CONSTRAINT productos_rezagados_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordencompra(id),
  CONSTRAINT productos_rezagados_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id)
);
CREATE TABLE public.proveedor (
  id integer NOT NULL DEFAULT nextval('proveedor_id_seq'::regclass),
  nombre character varying NOT NULL,
  direccion text NOT NULL,
  rif character varying NOT NULL UNIQUE,
  telefono character varying,
  correo character varying,
  pagina_web character varying,
  tiempo_entrega_promedio_dias integer,
  calificacion_promedio numeric,
  estado character varying NOT NULL DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo_contribuyente USER-DEFINED NOT NULL DEFAULT 'normal'::tipo_contribuyente_enum,
  porcentaje_retencion_iva numeric NOT NULL DEFAULT 0 CHECK (porcentaje_retencion_iva >= 0::numeric AND porcentaje_retencion_iva <= 100::numeric),
  CONSTRAINT proveedor_pkey PRIMARY KEY (id)
);
CREATE TABLE public.proveedor_categoria (
  proveedor_id integer NOT NULL,
  categoria_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT proveedor_categoria_pkey PRIMARY KEY (proveedor_id, categoria_id),
  CONSTRAINT proveedor_categoria_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categoria_proveedor(id),
  CONSTRAINT proveedor_categoria_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedor(id)
);
CREATE TABLE public.rendimiento_proveedor (
  id integer NOT NULL DEFAULT nextval('rendimiento_proveedor_id_seq'::regclass),
  proveedor_id integer NOT NULL,
  orden_compra_id integer NOT NULL UNIQUE,
  fecha_evaluacion date NOT NULL DEFAULT CURRENT_DATE,
  tiempo_entrega_estimado_dias integer,
  tiempo_entrega_real_dias integer,
  calidad_producto_evaluacion smallint CHECK (calidad_producto_evaluacion >= 1 AND calidad_producto_evaluacion <= 5),
  cumplimiento_pedido_evaluacion smallint CHECK (cumplimiento_pedido_evaluacion >= 1 AND cumplimiento_pedido_evaluacion <= 5),
  precio_competitividad_evaluacion smallint CHECK (precio_competitividad_evaluacion >= 1 AND precio_competitividad_evaluacion <= 5),
  comunicacion_evaluacion smallint CHECK (comunicacion_evaluacion >= 1 AND comunicacion_evaluacion <= 5),
  observaciones text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT rendimiento_proveedor_pkey PRIMARY KEY (id),
  CONSTRAINT rendimiento_proveedor_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedor(id),
  CONSTRAINT rendimiento_proveedor_orden_compra_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordencompra(id)
);
CREATE TABLE public.solicitudcompra (
  id integer NOT NULL DEFAULT nextval('solicitudcompra_id_seq'::regclass),
  descripcion text,
  fecha_solicitud timestamp without time zone DEFAULT now(),
  estado character varying NOT NULL CHECK (estado::text = ANY (ARRAY['Pendiente'::character varying::text, 'Aprobada'::character varying::text, 'Rechazada'::character varying::text])),
  empleado_id integer NOT NULL,
  departamento_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT solicitudcompra_pkey PRIMARY KEY (id),
  CONSTRAINT solicitudcompra_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamento(id),
  CONSTRAINT solicitudcompra_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleado(id)
);
CREATE TABLE public.solicitudcompra_detalle (
  id integer NOT NULL DEFAULT nextval('solicitudcompra_detalle_id_seq'::regclass),
  solicitud_compra_id integer NOT NULL,
  producto_id integer,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  descripcion_producto_personalizado text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT solicitudcompra_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT solicitudcompra_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id),
  CONSTRAINT solicitudcompra_detalle_solicitud_compra_id_fkey FOREIGN KEY (solicitud_compra_id) REFERENCES public.solicitudcompra(id)
);
CREATE TABLE public.user_presences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_presences_pkey PRIMARY KEY (id),
  CONSTRAINT user_presences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_profile (
  id uuid NOT NULL,
  empleado_id integer,
  departamento_id integer,
  rol character varying CHECK (rol::text = ANY (ARRAY['admin'::character varying::text, 'usuario'::character varying::text])),
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_profile_pkey PRIMARY KEY (id),
  CONSTRAINT user_profile_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT user_profile_departamento_id_fkey FOREIGN KEY (departamento_id) REFERENCES public.departamento(id)
);