// supabaseClient.js - Actualizar funciones de agrupación
export const agruparSolicitudes = async (solicitudId) => {
  const { data: currentSolicitud } = await supabase
    .from('solicitudcompra')
    .select('*, detalles:solicitudcompra_detalle(*, producto:producto_id(categoria_id))')
    .eq('id', solicitudId)
    .single();

  // Obtener productos y categorías de la solicitud actual
  const productosIds = currentSolicitud.detalles.map(d => d.producto_id);
  const categoriasIds = currentSolicitud.detalles.map(d => d.producto.categoria_id);

  // Buscar solicitudes agrupables por producto o categoría
  const { data: agrupables } = await supabase
    .from('solicitudcompra')
    .select(`
      *,
      detalles:solicitudcompra_detalle(*, producto:producto_id(categoria_id)),
      empleado:empleado_id(nombre, apellido)
    `)
    .or(`and(estado.eq.Pendiente,detalles.producto_id.in.(${productosIds.join(',')}),
          and(estado.eq.Pendiente,producto.categoria_id.in.(${categoriasIds.join(',')}))`)
    .neq('id', solicitudId);

  return {
    porProducto: agruparPorProducto(agrupables),
    porCategoria: agruparPorCategoria(agrupables)
  };
};

const agruparPorProducto = (solicitudes) => {
  const grupos = {};
  solicitudes.forEach(solicitud => {
    solicitud.detalles.forEach(detalle => {
      if (!grupos[detalle.producto_id]) {
        grupos[detalle.producto_id] = {
          producto: detalle.producto_id,
          cantidadTotal: 0,
          solicitudes: new Set(),
          detalles: []
        };
      }
      grupos[detalle.producto_id].cantidadTotal += detalle.cantidad;
      grupos[detalle.producto_id].solicitudes.add(solicitud.id);
      grupos[detalle.producto_id].detalles.push(detalle);
    });
  });
  return Object.values(grupos);
};

const agruparPorCategoria = (solicitudes) => {
  const grupos = {};
  solicitudes.forEach(solicitud => {
    solicitud.detalles.forEach(detalle => {
      const categoriaId = detalle.producto.categoria_id;
      if (!grupos[categoriaId]) {
        grupos[categoriaId] = {
          categoria: categoriaId,
          cantidadTotal: 0,
          solicitudes: new Set(),
          productos: new Set(),
          detalles: []
        };
      }
      grupos[categoriaId].cantidadTotal += detalle.cantidad;
      grupos[categoriaId].solicitudes.add(solicitud.id);
      grupos[categoriaId].productos.add(detalle.producto_id);
      grupos[categoriaId].detalles.push(detalle);
    });
  });
  return Object.values(grupos);
};