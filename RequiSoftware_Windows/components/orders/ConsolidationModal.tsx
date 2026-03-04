
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
    descripcion_producto_personalizado?: string | null;
    producto: (Pick<Producto, 'id' | 'descripcion' | 'categoria_id'> & {
      categoria: Pick<CategoriaProducto, 'id' | 'nombre'> | null;
    }) | null;
  }> | null;
};

type ProductoConsolidadoItem = {
  uniqueKey: string;
  producto_id: number | null;
  descripcion: string;
  cantidadTotal: number;
  solicitudesOriginales: Set<number>;
};

const ConsolidationModal: React.FC<ConsolidationModalProps> = ({ show, onHide, onConsolidate }) => {
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudConDetallesParaConsolidar[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categoriasProducto, setCategoriasProducto] = useState<Pick<CategoriaProducto, 'id' | 'nombre'>[]>([]);

  const [selectedSolicitudIds, setSelectedSolicitudIds] = useState<Set<number>>(new Set());
  const [selectedProveedorId, setSelectedProveedorId] = useState<string>('');
  const [unselectedProductKeys, setUnselectedProductKeys] = useState<Set<string>>(new Set());

  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [submittingConsolidation, setSubmittingConsolidation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (show) {
      setLoadingInitialData(true);
      setError(null);
      setUnselectedProductKeys(new Set());
      setEditedQuantities({});
      const fetchData = async () => {
        try {
          const { data: solData, error: solError } = await supabase
            .from('solicitudcompra')
            .select(`
              id, descripcion, empleado:empleado_id(nombre, apellido),
              detalles:solicitudcompra_detalle(producto_id, cantidad, descripcion_producto_personalizado, producto:producto_id(id, descripcion, categoria_id, categoria:categoria_id(id, nombre)))
            `)
            .eq('estado', 'Pendiente')
            .returns<SolicitudConDetallesParaConsolidar[]>();
          if (solError) throw solError;
          setSolicitudesPendientes(solData || []);

          const { data: provData, error: provError } = await supabase
            .from('proveedor')
            .select('*')
            .order('nombre');
          if (provError) throw provError;
          setProveedores(provData || []);

          const { data: catProdData } = await supabase.from('categoria_producto').select('id, nombre');
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
    }
  }, [show]);

  const productosConsolidados = useMemo(() => {
    const items: { [key: string]: ProductoConsolidadoItem } = {};
    solicitudesPendientes.forEach(sol => {
      if (selectedSolicitudIds.has(sol.id)) {
        sol.detalles?.forEach(det => {
          const prodId = det.producto_id || null;
          const descOriginal = det.producto?.descripcion || det.descripcion_producto_personalizado || 'Sin descripción';
          const uniqueKey = prodId ? `prod-${prodId}` : `custom-${descOriginal.trim().toLowerCase()}`;

          if (!items[uniqueKey]) {
            items[uniqueKey] = {
              uniqueKey,
              producto_id: prodId,
              descripcion: descOriginal.trim(),
              cantidadTotal: 0,
              solicitudesOriginales: new Set(),
            };
          }
          items[uniqueKey].cantidadTotal += det.cantidad;
          items[uniqueKey].solicitudesOriginales.add(sol.id);
        });
      }
    });
    return Object.values(items);
  }, [solicitudesPendientes, selectedSolicitudIds]);

  const getProductQuantity = (p: ProductoConsolidadoItem) => {
    return editedQuantities[p.uniqueKey] !== undefined ? editedQuantities[p.uniqueKey] : p.cantidadTotal;
  };

  const handleQuantityChange = (uniqueKey: string, value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return;
    setEditedQuantities(prev => ({
      ...prev,
      [uniqueKey]: numValue
    }));
  };

  const handleSubmitConsolidacion = async () => {
    const productosFinales = productosConsolidados.filter(p => !unselectedProductKeys.has(p.uniqueKey));

    if (!selectedProveedorId || productosFinales.length === 0) return;
    setSubmittingConsolidation(true);
    try {
      const payload = {
        proveedor_id: parseInt(selectedProveedorId),
        productos: productosFinales.map(p => ({
          producto_id: p.producto_id,
          descripcion: p.descripcion,
          cantidad: getProductQuantity(p)
        })),
        solicitudes: Array.from(selectedSolicitudIds),
        estado: 'Pendiente',
        fecha_creacion: new Date().toISOString()
      };
      const { data: newOrder, error } = await (supabase.from('ordenes_consolidadas') as any).insert(payload).select('*, proveedor:proveedor_id(id, nombre)').single();
      if (error) throw error;
      onConsolidate(newOrder as OrdenConsolidada);
      onHide();
    } catch (err) {
      console.error(err);
      alert("Error al consolidar solicitudes.");
    } finally {
      setSubmittingConsolidation(false);
    }
  };

  const toggleProductSelection = (uniqueKey: string) => {
    const newSet = new Set(unselectedProductKeys);
    if (newSet.has(uniqueKey)) {
      newSet.delete(uniqueKey);
    } else {
      newSet.add(uniqueKey);
    }
    setUnselectedProductKeys(newSet);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-300 transform scale-100">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Consolidar Solicitudes</h3>
          <button onClick={onHide} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><XMarkIcon className="w-6 h-6" /></button>
        </div>

        {loadingInitialData ? <div className="p-12"><LoadingSpinner /></div> : (
          <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-display font-semibold text-slate-700 dark:text-slate-300">1. Seleccionar Solicitudes</h4>
              <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl p-2 space-y-2 bg-slate-50 dark:bg-slate-950/50">
                {solicitudesPendientes.map(sol => (
                  <div key={sol.id} onClick={() => {
                    const newSet = new Set(selectedSolicitudIds);
                    if (newSet.has(sol.id)) newSet.delete(sol.id);
                    else newSet.add(sol.id);
                    setSelectedSolicitudIds(newSet);
                  }} className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${selectedSolicitudIds.has(sol.id) ? 'bg-primary-50 border-primary-500 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <p className={`text-sm font-bold ${selectedSolicitudIds.has(sol.id) ? 'text-primary-700' : 'text-slate-900 dark:text-slate-100'}`}>Solicitud #{sol.id}</p>
                    <p className={`text-xs truncate ${selectedSolicitudIds.has(sol.id) ? 'text-primary-600' : 'text-slate-500 dark:text-slate-400'}`}>{sol.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-display font-semibold text-slate-700 dark:text-slate-300">2. Proveedor y Resumen</h4>
              <select value={selectedProveedorId} onChange={e => setSelectedProveedorId(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all">
                <option value="">Seleccionar Proveedor...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-96 overflow-y-auto">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Productos a consolidar:</p>
                {productosConsolidados.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Seleccione solicitudes para ver productos.</p>
                ) : (
                  productosConsolidados.map(p => (
                    <div key={p.uniqueKey} className="text-xs flex justify-between items-center py-2 border-b dark:border-gray-700 last:border-0">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={!unselectedProductKeys.has(p.uniqueKey)}
                          onChange={() => toggleProductSelection(p.uniqueKey)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                        />
                        <span className={`truncate ${unselectedProductKeys.has(p.uniqueKey) ? 'text-gray-400 line-through' : ''}`}>
                          {p.descripcion}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ml-2 ${unselectedProductKeys.has(p.uniqueKey) ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>x</span>
                        <input
                          type="number"
                          min="1"
                          value={getProductQuantity(p)}
                          onChange={(e) => handleQuantityChange(p.uniqueKey, e.target.value)}
                          disabled={unselectedProductKeys.has(p.uniqueKey)}
                          className="w-16 p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 transition-all"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button onClick={handleSubmitConsolidacion} disabled={!selectedProveedorId || productosConsolidados.filter(p => !unselectedProductKeys.has(p.uniqueKey)).length === 0 || submittingConsolidation} className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {submittingConsolidation ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : "Crear Orden Consolidada"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsolidationModal;
