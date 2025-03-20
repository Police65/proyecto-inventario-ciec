-- Tabla: camaraindustriales
CREATE TABLE IF NOT EXISTS camaraindustriales (
  id integer,
  nombre character varying,
  direccion text,
  web character varying,
  correo character varying,
  telefonos character varying,
  rif character varying
);

-- Tabla: cargo
CREATE TABLE IF NOT EXISTS cargo (
  id integer,
  nombre character varying,
  departamento_id integer
);

-- Tabla: categoria_producto
CREATE TABLE IF NOT EXISTS categoria_producto (
  id integer,
  nombre character varying
);

-- Tabla: categoria_proveedor
CREATE TABLE IF NOT EXISTS categoria_proveedor (
  id integer,
  nombre character varying
);

-- Tabla: departamento
CREATE TABLE IF NOT EXISTS departamento (
  id integer,
  nombre character varying
);

-- Tabla: empleado
CREATE TABLE IF NOT EXISTS empleado (
  id integer,
  cedula character varying,
  nombre character varying,
  apellido character varying,
  cargo_actual_id integer,
  firma text,
  departamento_id integer
);

-- Tabla: empleadocargohistorial
CREATE TABLE IF NOT EXISTS empleadocargohistorial (
  id integer,
  empleado_id integer,
  cargo_id integer,
  fecha_inicio date,
  fecha_fin date
);

-- Tabla: facturas_orden
CREATE TABLE IF NOT EXISTS facturas_orden (
  id integer,
  orden_compra_id integer,
  numero_factura character varying,
  fecha_recepcion date,
  documento_factura text,
  total_recepcionado numeric
);

-- Tabla: inventario
CREATE TABLE IF NOT EXISTS inventario (
  id integer,
  producto_id integer,
  ubicacion text,
  fecha_actualizacion timestamp without time zone,
  existencias integer
);

-- Tabla: orden_solicitud
CREATE TABLE IF NOT EXISTS orden_solicitud (
  orden_id integer,
  solicitud_id integer
);

-- Tabla: ordencompra
CREATE TABLE IF NOT EXISTS ordencompra (
  id integer,
  solicitud_compra_id integer,
  proveedor_id integer,
  fecha_orden timestamp without time zone,
  estado character varying,
  precio_unitario numeric,
  sub_total numeric,
  iva numeric,
  ret_iva numeric,
  neto_a_pagar numeric,
  unidad character varying,
  observaciones text,
  empleado_id integer,
  changed_by integer,
  fecha_modificacion timestamp without time zone,
  retencion_porcentaje numeric
);

-- Tabla: ordencompra_detalle
CREATE TABLE IF NOT EXISTS ordencompra_detalle (
  id integer,
  orden_compra_id integer,
  producto_id integer,
  cantidad integer,
  precio_unitario numeric,
  monto_total numeric
);

-- Tabla: ordenes_consolidadas
CREATE TABLE IF NOT EXISTS ordenes_consolidadas (
  id integer,
  proveedor_id integer,
  productos jsonb,
  estado character varying,
  fecha_creacion timestamp without time zone,
  solicitudes jsonb
);

-- Tabla: producto
CREATE TABLE IF NOT EXISTS producto (
  id integer,
  descripcion text,
  cantidad_disponible integer,
  categoria_id integer
);

-- Tabla: productos_no_recibidos
CREATE TABLE IF NOT EXISTS productos_no_recibidos (
  id integer,
  orden_compra_id integer,
  producto_id integer,
  cantidad_faltante integer,
  motivo text
);

-- Tabla: proveedor
CREATE TABLE IF NOT EXISTS proveedor (
  id integer,
  nombre character varying,
  direccion text,
  rif character varying,
  telefono character varying,
  correo character varying,
  pagina_web character varying
);

-- Tabla: proveedor_categoria
CREATE TABLE IF NOT EXISTS proveedor_categoria (
  proveedor_id integer,
  categoria_id integer
);

-- Tabla: solicitudcompra
CREATE TABLE IF NOT EXISTS solicitudcompra (
  id integer,
  descripcion text,
  fecha_solicitud timestamp without time zone,
  estado character varying,
  empleado_id integer,
  departamento_id integer
);

-- Tabla: solicitudcompra_detalle
CREATE TABLE IF NOT EXISTS solicitudcompra_detalle (
  id integer,
  solicitud_compra_id integer,
  producto_id integer,
  cantidad integer
);

-- Tabla: user_profile
CREATE TABLE IF NOT EXISTS user_profile (
  id uuid,
  empleado_id integer,
  departamento_id integer,
  CONSTRAINT fk_user_profile_user FOREIGN KEY (id) REFERENCES auth.users (id)
);
