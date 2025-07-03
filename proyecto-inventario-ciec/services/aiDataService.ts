import { supabase } from '../supabaseClient';
import { Producto, Proveedor, OrdenCompra, Inventario, CategoriaProducto, SolicitudCompra, Departamento } from '../types';
import { startOfMonth, endOfMonth, subDays, startOfYear, formatISO } from 'date-fns';

/**
 * Obtiene el conteo de solicitudes de compra pendientes.
 */
export const getPendingRequestsCount = async (): Promise<number | string> => {
  try {
    const { count, error } = await supabase
      .from('solicitudcompra')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'Pendiente');

    if (error) {
      console.error('Error al obtener el conteo de solicitudes pendientes:', error.message);
      return "Error al consultar el número de solicitudes pendientes."
    }
    return count || 0;
  } catch (err) {
    console.error('Excepción en getPendingRequestsCount:', err);
    return "Excepción al consultar solicitudes pendientes.";
  }
};

/**
 * Obtiene el total de gastos para un departamento específico de órdenes completadas.
 * @param departmentName - El nombre del departamento.
 * @param period - Período opcional para filtrar gastos.
 */
export const getDepartmentExpenses = async (
    departmentName: string,
    period?: 'current_month' | 'last_30_days' | 'year_to_date' | 'all_time'
): Promise<number | string> => {
    try {
        const { data: deptData, error: deptError } = await supabase
            .from('departamento')
            .select('id')
            .ilike('nombre', `%${departmentName}%`)
            .single();

        if (deptError || !deptData) {
            console.warn(`Departamento llamado '${departmentName}' no encontrado o error:`, deptError?.message);
            return `No se encontró el departamento '${departmentName}'.`;
        }
        const departmentId = deptData.id;

        const { data: solicitations, error: solError } = await supabase
            .from('solicitudcompra')
            .select('id')
            .eq('departamento_id', departmentId);

        if (solError) {
            console.error(`Error al obtener solicitudes para el departamento ${departmentName} (ID: ${departmentId}):`, solError.message);
            return `Error al obtener solicitudes para el departamento '${departmentName}'.`;
        }
        if (!solicitations || solicitations.length === 0) {
            return `No hay solicitudes registradas para el departamento '${departmentName}'.`;
        }

        const solicitationIds = solicitations.map(s => s.id);

        let query = supabase
            .from('ordencompra')
            .select('neto_a_pagar, fecha_orden')
            .in('solicitud_compra_id', solicitationIds)
            .eq('estado', 'Completada');

        const today = new Date();
        if (period) {
            let startDate: Date | undefined;
            let endDate: Date | undefined = today; 

            if (period === 'current_month') {
                startDate = startOfMonth(today);
                endDate = endOfMonth(today); 
            } else if (period === 'last_30_days') {
                startDate = subDays(today, 30);
            } else if (period === 'year_to_date') {
                startDate = startOfYear(today);
            }
            
            if (startDate) {
                query = query.gte('fecha_orden', formatISO(startDate, { representation: 'date' }));
            }
            if (endDate && period !== 'all_time') { 
                query = query.lte('fecha_orden', formatISO(endDate, { representation: 'date' }));
            }
        }
        
        const { data: orders, error: ordersError } = await query;

        if (ordersError) {
            console.error(`Error al obtener órdenes completadas para el departamento ${departmentName} (período: ${period || 'all_time'}):`, ordersError.message);
            return `Error al obtener órdenes completadas para '${departmentName}' (período: ${period || 'N/A'}).`;
        }
        if (!orders || orders.length === 0) {
            return `No hay órdenes completadas para el departamento '${departmentName}' en el período especificado (${period || 'todos los tiempos'}).`;
        }

        const totalExpenses = orders.reduce((sum, order) => sum + (order.neto_a_pagar || 0), 0);
        return totalExpenses;

    } catch (err) {
        console.error(`Excepción en getDepartmentExpenses para '${departmentName}':`, err);
        return `Excepción al calcular gastos para '${departmentName}'.`;
    }
};


/**
 * Obtiene el conteo total de todas las órdenes de compra.
 */
export const getTotalPurchaseOrdersCount = async (): Promise<number | string> => {
  try {
    const { count, error } = await supabase
      .from('ordencompra')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error al obtener el conteo total de órdenes de compra:', error.message);
      return "Error al consultar el número total de órdenes de compra.";
    }
    return count || 0;
  } catch (err) {
    console.error('Excepción en getTotalPurchaseOrdersCount:', err);
    return "Excepción al consultar el total de órdenes de compra.";
  }
};

/**
 * Obtiene el conteo total de todos los productos.
 */
export const getTotalProductsCount = async (): Promise<number | string> => {
  try {
    const { count, error } = await supabase
      .from('producto')
      .select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Error al obtener el conteo total de productos:', error.message);
        return "Error al consultar el número total de productos.";
    }
    return count || 0;
  } catch (err) {
    console.error('Excepción en getTotalProductsCount:', err);
    return "Excepción al consultar el total de productos.";
  }
};

/**
 * Obtiene detalles de un producto específico por su nombre o código interno.
 * Devuelve solo id, descripcion, codigo_interno y categoria_nombre.
 */
export const getProductDetailsByNameOrCode = async (identifier: string): Promise<Partial<Pick<Producto, 'id' | 'descripcion' | 'codigo_interno'>> & { categoria_nombre?: string; inventario_existencias?: number | string } | string> => {
  try {
    const { data, error } = await supabase
      .from('producto')
      .select(`
        id, descripcion, codigo_interno,
        categoria:categoria_id ( nombre ),
        inventario:inventario ( existencias )
      `)
      .or(`descripcion.ilike.%${identifier}%,codigo_interno.eq.${identifier}`)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { 
        console.error(`Error al obtener detalles del producto '${identifier}':`, error.message);
        return `Error al obtener detalles del producto '${identifier}'.`;
    }
    if (!data) {
        console.warn(`[aiDataService] Producto con identificador '${identifier}' no encontrado en el catálogo.`);
        return `Producto '${identifier}' no encontrado en el catálogo.`;
    }
    
    const inventarioEntry = Array.isArray(data.inventario) ? data.inventario[0] : data.inventario;
    const inventarioExistencias = inventarioEntry?.existencias !== undefined ? inventarioEntry.existencias : "No en inventario";

    return {
        id: data.id,
        descripcion: data.descripcion,
        codigo_interno: data.codigo_interno,
        categoria_nombre: Array.isArray(data.categoria) ? data.categoria[0]?.nombre || "Sin categoría" : data.categoria?.nombre || "Sin categoría",
        inventario_existencias: inventarioExistencias,
    };
  } catch (err) {
    console.error(`Excepción en getProductDetailsByNameOrCode para '${identifier}':`, err);
    return `Excepción al obtener detalles del producto '${identifier}'.`;
  }
};

/**
 * Obtiene el conteo total de todos los proveedores.
 */
export const getTotalSuppliersCount = async (): Promise<number | string> => {
    try {
        const { count, error } = await supabase
            .from('proveedor')
            .select('*', { count: 'exact', head: true });
        if (error) {
            console.error('Error al obtener el conteo total de proveedores:', error.message);
            return "Error al consultar el número total de proveedores.";
        }
        return count || 0;
    } catch (err) {
        console.error('Excepción en getTotalSuppliersCount:', err);
        return "Excepción al consultar el total de proveedores.";
    }
};

/**
 * Obtiene detalles de un proveedor específico por su nombre o RIF.
 */
export const getSupplierDetailsByNameOrRif = async (identifier: string): Promise<Partial<Proveedor> | string> => {
    try {
        const { data, error } = await supabase
            .from('proveedor')
            .select('nombre, direccion, rif, telefono, correo, pagina_web, tiempo_entrega_promedio_dias, calificacion_promedio, estado')
            .or(`nombre.ilike.%${identifier}%,rif.eq.${identifier.toUpperCase()}`)
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error(`Error al obtener detalles del proveedor '${identifier}':`, error.message);
            return `Error al obtener detalles del proveedor '${identifier}'.`;
        }
        if (!data) return `No se encontró proveedor con identificador '${identifier}'.`;
        return data;
    } catch (err) {
        console.error(`Excepción en getSupplierDetailsByNameOrRif para '${identifier}':`, err);
        return `Excepción al obtener detalles del proveedor '${identifier}'.`;
    }
};

/**
 * Obtiene el stock actual de un producto específico por su nombre o código interno.
 */
export const getInventoryByProductNameOrCode = async (identifier: string): Promise<(Pick<Inventario, 'existencias' | 'ubicacion' | 'fecha_actualizacion'> & { producto_descripcion?: string }) | string> => {
    try {
        const { data: productData, error: productError } = await supabase
            .from('producto')
            .select('id, descripcion')
            .or(`descripcion.ilike.%${identifier}%,codigo_interno.eq.${identifier}`)
            .limit(1)
            .single();

        if (productError && productError.code !== 'PGRST116') { // PGRST116 significa que no hay filas, lo cual manejamos a continuación
            console.error(`Error al obtener el ID del producto para la consulta de inventario de '${identifier}':`, productError.message);
            return `Error al buscar el producto '${identifier}' para consultar inventario.`;
        }
        if (!productData) return `Producto '${identifier}' no encontrado en el catálogo.`;

        const { data: invData, error: invError } = await supabase
            .from('inventario')
            .select('existencias, ubicacion, fecha_actualizacion')
            .eq('producto_id', productData.id)
            .single(); 
        
        if (invError && invError.code !== 'PGRST116') { 
            console.error(`Error al obtener el inventario del producto '${productData.descripcion}':`, invError.message);
            return `Error al consultar inventario para '${productData.descripcion}'.`;
        }
        if (!invData) return `Producto '${productData.descripcion}' encontrado, pero sin registro de stock en inventario.`;

        return { 
            producto_descripcion: productData.descripcion,
            existencias: invData.existencias ?? 0, 
            ubicacion: invData.ubicacion,
            fecha_actualizacion: invData.fecha_actualizacion
        };
    } catch (err) {
        console.error(`Excepción en getInventoryByProductNameOrCode para '${identifier}':`, err);
        return `Excepción al consultar inventario para '${identifier}'.`;
    }
};


/**
 * Obtiene detalles no sensibles de una orden de compra específica por su ID.
 */
export const getOrderDetailsById = async (orderId: number): Promise<Partial<OrdenCompra> | string> => {
    try {
        const { data, error } = await supabase
            .from('ordencompra')
            .select(`
                id, fecha_orden, estado, sub_total, iva, ret_iva, neto_a_pagar, unidad, observaciones, fecha_entrega_estimada, fecha_entrega_real,
                proveedor:proveedor_id ( nombre, rif ),
                detalles:ordencompra_detalle ( cantidad, precio_unitario, producto:producto_id ( descripcion ) )
            `)
            .eq('id', orderId)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error(`Error al obtener detalles de la orden con ID '${orderId}':`, error.message);
            return `Error al obtener detalles de la orden #${orderId}.`;
        }
        if (!data) return `No se encontró la orden de compra con ID #${orderId}.`;
        return data;
    } catch (err) {
        console.error(`Excepción en getOrderDetailsById para la orden con ID '${orderId}':`, err);
        return `Excepción al obtener detalles de la orden #${orderId}.`;
    }
};

/**
 * Obtiene el conteo total de todos los departamentos.
 */
export const getTotalDepartmentsCount = async (): Promise<number | string> => {
    try {
        const { count, error } = await supabase
            .from('departamento')
            .select('*', { count: 'exact', head: true });
        if (error) {
            console.error('Error al obtener el conteo total de departamentos:', error.message);
            return "Error al consultar el número total de departamentos.";
        }
        return count || 0;
    } catch (err) {
        console.error('Excepción en getTotalDepartmentsCount:', err);
        return "Excepción al consultar el total de departamentos.";
    }
};

/**
 * Obtiene un resumen del inventario.
 */
export const getInventorySummary = async (options?: { lowStockThresholdPercent?: number; topN?: number }): Promise<object | string> => {
    const topN = options?.topN || 3;

    try {
        const { count: totalDistinctProducts, error: distinctError } = await supabase
            .from('inventario')
            .select('producto_id', { count: 'exact', head: true });
        if (distinctError) return "Error al contar productos distintos en inventario.";

        const { data: lowStockItems, error: lowStockError } = await supabase
            .from('inventario')
            .select('existencias, producto:producto_id!inner(stock_minimo, stock_maximo)') 
            .filter('producto.stock_minimo', 'isnot', null)
            .filter('existencias', 'isnot', null); 
            
        if (lowStockError) return "Error al contar productos con bajo stock.";
        
        const actualLowStockCount = (lowStockItems || []).filter(item =>
            item.producto && item.producto.stock_minimo !== null && item.existencias !== null && item.existencias < item.producto.stock_minimo
        ).length;


        const { data: topStockedItems, error: topStockError } = await supabase
            .from('inventario')
            .select('existencias, producto:producto_id(descripcion)')
            .order('existencias', { ascending: false })
            .limit(topN);
        if (topStockError) return "Error al obtener productos más abundantes.";

        return {
            total_productos_distintos_en_inventario: totalDistinctProducts || 0,
            productos_con_bajo_stock_critico: actualLowStockCount,
            productos_mas_abundantes: (topStockedItems || []).map(item => ({
                producto: item.producto?.descripcion || 'Desconocido',
                existencias: item.existencias
            }))
        };

    } catch (err) {
        console.error('Excepción en getInventorySummary:', err);
        return "Excepción al generar resumen de inventario.";
    }
};

/**
 * Obtiene una lista de todos los productos (id, descripcion, codigo_interno, categoria_nombre), paginados.
 * @param limit - Número de productos a obtener.
 */
export const getAllProducts = async (limit: number = 10): Promise<Array<Pick<Producto, 'id' | 'descripcion' | 'codigo_interno'> & { categoria_nombre?: string }> | string> => {
    try {
        const { data, error } = await supabase
            .from('producto')
            .select('id, descripcion, codigo_interno, categoria:categoria_id(nombre)')
            .limit(limit)
            .order('descripcion', { ascending: true });
        if (error) {
            console.error('Error al obtener todos los productos:', error.message);
            return "Error al obtener la lista de productos.";
        }
        if (!data || data.length === 0) return "No hay productos registrados en el catálogo.";
        
        return data.map(p => {
            const categoria = Array.isArray(p.categoria) ? p.categoria[0] : p.categoria;
            return {
                id: p.id,
                descripcion: p.descripcion,
                codigo_interno: p.codigo_interno,
                categoria_nombre: categoria?.nombre || "Sin categoría"
            };
        });
    } catch (err) {
        console.error('Excepción en getAllProducts:', err);
        return "Excepción al obtener la lista de productos.";
    }
};

/**
 * Obtiene productos filtrados por nombre de categoría (id, descripcion, codigo_interno).
 * @param categoryName - El nombre de la categoría.
 * @param limit - Número de productos a obtener.
 */
export const getProductsByCategoryName = async (categoryName: string, limit: number = 10): Promise<Pick<Producto, 'id' | 'descripcion' | 'codigo_interno'>[] | string> => {
    try {
        const { data: category, error: catError } = await supabase
            .from('categoria_producto')
            .select('id')
            .ilike('nombre', `%${categoryName}%`) 
            .limit(1) 
            .single(); 

        if (catError && catError.code !== 'PGRST116') { 
            console.error(`Error al buscar la categoría '${categoryName}':`, catError.message);
            return `Error al buscar la categoría '${categoryName}'.`;
        }
        if (!category) {
            return `La categoría '${categoryName}' no fue encontrada.`;
        }

        const { data, error } = await supabase
            .from('producto')
            .select('id, descripcion, codigo_interno')
            .eq('categoria_id', category.id)
            .limit(limit)
            .order('descripcion', { ascending: true });

        if (error) {
            console.error(`Error al obtener productos de la categoría '${categoryName}':`, error.message);
            return `Error al obtener productos de la categoría '${categoryName}'.`;
        }
        if (!data || data.length === 0) return `No hay productos registrados en la categoría '${categoryName}'.`;
        return data;
    } catch (err) {
        console.error(`Excepción en getProductsByCategoryName para '${categoryName}':`, err);
        return `Excepción al obtener productos de la categoría '${categoryName}'.`;
    }
};

/**
 * Obtiene una lista de todas las categorías de productos.
 */
export const getAllProductCategories = async (): Promise<Pick<CategoriaProducto, 'id' | 'nombre'>[] | string> => {
    try {
        const { data, error } = await supabase
            .from('categoria_producto')
            .select('id, nombre')
            .order('nombre', { ascending: true });
        if (error) {
            console.error('Error al obtener categorías de productos:', error.message);
            return "Error al obtener las categorías de productos.";
        }
        if (!data || data.length === 0) return "No hay categorías de productos registradas en el sistema.";
        return data;
    } catch (err) {
        console.error('Excepción en getAllProductCategories:', err);
        return "Excepción al obtener las categorías de productos.";
    }
};