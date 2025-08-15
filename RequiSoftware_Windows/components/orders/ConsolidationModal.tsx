
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { SolicitudCompra, Proveedor, OrdenConsolidada, CategoriaProducto, Producto, Empleado } from '../../types';
import { XMarkIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

interface ConsolidationModalProps {
  show: boolean;
  onHide: () => void;
  onConsolidate: (newOrder: OrdenConsolidada) => void;
}

type SolicitudConDetallesParaConsolidar = Pick<SolicitudCompra, 'id' | 'descripcion'> & {
    empleado: Pick<Empleado, 'nombre' | 'apellido'> | null;
    detalles: Array<{
        producto_id: number | null;
        cantidad: number;
        producto: (Pick<Producto, 'id' | 'descripcion' | 'categoria_id'> & {
            categoria: Pick<CategoriaProducto, 'id' | 'nombre'> | null;
        }) | null;
    }> | null;
};

type ProductoConsolidadoItem = {
    producto_id: number;
    descripcion: string;
    cantidadTotal: number;
    solicitudesOriginales: Set<number>; // IDs of SolicitudCompra
    categoria_id?: number | null;
    categoria_nombre?: string | null;
};


const ConsolidationModal: React.FC<ConsolidationModalProps> = ({ show, onHide, onConsolidate }) => {
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudConDetallesParaConsolidar[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categoriasProducto, setCategoriasProducto] = useState<Pick<CategoriaProducto, 'id' | 'nombre'>[]>([]);
  
  const [selectedSolicitudIds, setSelectedSolicitudIds] = useState<Set<number>>(new Set());
  const [selectedProveedorId, setSelectedProveedorId] = useState<string>('');
  const [selectedCategoriaFiltro, setSelectedCategoriaFiltro] = useState<string>('');
  
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [submittingConsolidation, setSubmittingConsolidation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setLoadingInitialData(true);
      setError(null);
      const fetchData = async () => {
        try {
          const { data: solData, error: solError } = await supabase
            .from('solicitudcompra')
            .select(`
              id, descripcion, empleado:empleado_id(nombre, apellido),
              detalles:solicitudcompra_detalle(producto_id, cantidad, producto:producto_id(id, descripcion, categoria_id, categoria:categoria_id(id, nombre)))
            `)
            .eq('estado', 'Pendiente')
            .returns<SolicitudConDetallesParaConsolidar[]>();
          if (solError) throw solError;
          setSolicitudesPendientes(solData || []);

          const { data: provData, error: provError } = await supabase
            .from('proveedor')
            .select('*, categorias:proveedor_categoria(categoria_id, categoria:categoria_id(id, nombre))')
            .order('nombre');
          if (provError) throw provError;
          setProveedores(provData || []);
          
          const { data: catProdData, error: catProdError } = await supabase
            .from('categoria_producto')
            .select('id, nombre').order('nombre');
          if (catProdError) throw catProdError;
          setCategoriasProducto(catProdData || []);

        } catch (err) {
          console.error("Error fetching data for consolidation:", err);
          setError("Error al cargar datos.");
        } finally {
          setLoadingInitialData(false);
        }
      };
      fetchData();
    } else {
        setSelectedSolicitudIds(new Set());
        setSelectedProveedorId('');
        setSelectedCategoriaFiltro('');
    }
  }, [show]);

  const handleSolicitudSelect = (id: number) => {
    setSelectedSolicitudIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const productosConsolidados = useMemo(() => {
    const items: { [key: number]: ProductoConsolidadoItem } = {};
    solicitudesPendientes.forEach(sol => {
      if (selectedSolicitudIds.has(sol.id)) {
        sol.detalles?.forEach(det => {
          if (det.producto_id && det.producto) {
            if (!items[det.producto_id]) {
              items[det.producto_id] = {
                producto_id: det.producto_id,
                descripcion: det.producto.descripcion,
                cantidadTotal: 0,
                solicitudesOriginales: new Set(),
                categoria_id: det.producto.categoria_id,
                categoria_nombre: det.producto.categoria?.nombre
              };
            }
            items[det.producto_id].cantidadTotal += det.cantidad;
            items[det.producto_id].solicitudesOriginales.add(sol.id);
          }
        });
      }
    });
    return Object.values(items);
  }, [solicitudesPendientes, selectedSolicitudIds]);

  const filteredSolicitudes = useMemo(() => {
    if (!selectedCategoriaFiltro) return solicitudesPendientes;
    const catId = parseInt(selectedCategoriaFiltro);
    return solicitudesPendientes.filter(sol => 
        sol.detalles?.some(det => det.producto?.categoria_id === catId)
    );
  }, [solicitudesPendientes, selectedCategoriaFiltro]);

  const handleSubmitConsolidacion = async () => {
    if (!selectedProveedorId || productosConsolidados.length === 0) {
      alert("Debe seleccionar un proveedor y al menos una solicitud con productos.");
      return;
    }
    setSubmittingConsolidation(true);
    setError(null);
    try {
      const payload = {
        proveedor_id: parseInt(selectedProveedorId),
        productos: productosConsolidados.map(p => ({ producto_id: p.producto_id, descripcion: p.descripcion, cantidad: p.cantidadTotal })),
        solicitudes: Array.from(selectedSolicitudIds),
        estado: 'Pendiente', 
        fecha_creacion: new Date().toISOString()
      };
      const { data: newOrder, error } = await supabase
        .from('ordenes_consolidadas')
        .insert(payload)
        .select('*, proveedor:proveedor_id(id, nombre)') 
        .single();
      if (error) throw error;
      if (newOrder) {
        onConsolidate(newOrder as OrdenConsolidada);
        onHide();
      }
    } catch (err) {
        const supabaseError = err as { code?: string; message: string };
        if (supabaseError.code === '23505') {
             alert(`Error al consolidar: Ya existe un registro con un valor único similar. (${supabaseError.message})`);
        } else {
            alert(`Error al consolidar: ${supabaseError.message}`);
        }
      console.error("Error creating consolidated order:", err);
      setError(`Error al consolidar: ${supabaseError.message}`);
    } finally {
      setSubmittingConsolidation(false);
    }
  };


  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Consolidar Solicitudes de Compra</h3>
          <button onClick={onHide} disabled={submittingConsolidation} className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {(loadingInitialData && !solicitudesPendientes.length) ? <div className="p-10 flex-grow flex items-center justify-center"><LoadingSpinner message="Cargando datos..." /></div> : (
          <div className="flex-grow overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100">1. Seleccionar Solicitudes</h4>
               <div className="mb-3">
                <label htmlFor="categoriaFiltro" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por Categoría de Producto:</label>
                <select id="categoriaFiltro" value={selectedCategoriaFiltro} onChange={(e) => setSelectedCategoriaFiltro(e.target.value)}
                    disabled={submittingConsolidation}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Todas las Categorías</option>
                    {categoriasProducto.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                </select>
              </div>
              <div className="max-h-96 overflow-y-auto border dark:border-gray-600 rounded-md p-2 space-y-2">
                {filteredSolicitudes.length > 0 ? filteredSolicitudes.map(sol => (
                  <div key={sol.id} className={`p-2.5 rounded-md cursor-pointer transition-colors
                    ${selectedSolicitudIds.has(sol.id) ? 'bg-primary-100 dark:bg-primary-700 border border-primary-400 dark:border-primary-500' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 border dark:border-transparent'}`}
                    onClick={() => !submittingConsolidation && handleSolicitudSelect(sol.id)}
                  >
                    <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Solicitud #{sol.id} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({sol.empleado?.nombre || 'N/A'})</span></p>
                        {selectedSolicitudIds.has(sol.id) && <CheckCircleIcon className="w-5 h-5 text-green-500"/>}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate" title={sol.descripcion || ''}>{sol.descripcion || 'Sin descripción'}</p>
                    <div className="mt-1 text-xs">
                        {sol.detalles?.slice(0,2).map(d => d.producto?.descripcion).join(', ')}
                        {sol.detalles && sol.detalles.length > 2 ? '...' : ''}
                    </div>
                  </div>
                )) : <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No hay solicitudes pendientes o que coincidan con el filtro.</p>}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100">2. Productos Consolidados</h4>
              <div className="max-h-60 overflow-y-auto border dark:border-gray-600 rounded-md p-2 text-sm space-y-1">
                {productosConsolidados.length > 0 ? productosConsolidados.map(p => (
                  <div key={p.producto_id} className="flex justify-between p-1 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-gray-700 dark:text-gray-200 truncate" title={p.descripcion}>{p.descripcion}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">x {p.cantidadTotal}</span>
                  </div>
                )) : <p className="text-gray-500 dark:text-gray-400 text-center py-3">Seleccione solicitudes para ver productos.</p>}
              </div>

              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mt-3">3. Seleccionar Proveedor <span className="text-red-500">*</span></h4>
              <div>
                <label htmlFor="proveedorId" className="sr-only">Proveedor</label>
                <select id="proveedorId" value={selectedProveedorId} onChange={(e) => setSelectedProveedorId(e.target.value)} required
                  disabled={submittingConsolidation}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">-- Elegir Proveedor --</option>
                  {proveedores.map(prov => <option key={prov.id} value={prov.id}>{prov.nombre}</option>)}
                </select>
              </div>
               {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5 border-t dark:border-gray-700 flex justify-end space-x-3">
          <button type="button" onClick={onHide}
            disabled={submittingConsolidation}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmitConsolidacion} disabled={submittingConsolidation || loadingInitialData || !selectedProveedorId || productosConsolidados.length === 0}
            className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none disabled:opacity-50">
            {submittingConsolidation ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-1.5 -ml-1" />}
            {submittingConsolidation ? "Procesando..." : "Crear Orden Consolidada"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsolidationModal;
