import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { SolicitudCompra, Proveedor, OrdenConsolidada, CategoriaProducto, Producto, Empleado } from '../../types';
import { XMarkIcon, CheckCircleIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckIcon, SquaresPlusIcon } from '@heroicons/react/24/outline';
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
  const [selectedSolicitudIds, setSelectedSolicitudIds] = useState<Set<number>>(new Set());
  const [selectedProveedorId, setSelectedProveedorId] = useState<string>('');
  const [unselectedProductKeys, setUnselectedProductKeys] = useState<Set<string>>(new Set());
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [submittingConsolidation, setSubmittingConsolidation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRezagadosConfirm, setShowRezagadosConfirm] = useState<ProductoConsolidadoItem[] | null>(null);

  useEffect(() => {
    if (show) {
      setLoadingInitialData(true);
      setError(null);
      setUnselectedProductKeys(new Set());
      setEditedQuantities({});
      const fetchData = async () => {
        try {
          const { data: solData, error: solError } = await (supabase
            .from('solicitudcompra') as any)
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
    setEditedQuantities(prev => ({ ...prev, [uniqueKey]: numValue }));
  };

  const executeConsolidacion = async () => {
    const productosFinales = productosConsolidados.filter(p => !unselectedProductKeys.has(p.uniqueKey));
    const productosRezagadosLista = productosConsolidados.filter(p => unselectedProductKeys.has(p.uniqueKey));

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
      
      const { data: newOrder, error } = await (supabase.from('ordenes_consolidadas') as any)
        .insert(payload)
        .select('*, proveedor:proveedor_id(id, nombre)')
        .single();
      if (error) throw error;

      if (productosRezagadosLista.length > 0) {
        const firstSolicitudId = selectedSolicitudIds.size > 0 ? Array.from(selectedSolicitudIds)[0] : null;
        const rezagadosPayload = productosRezagadosLista.map(p => {
          const pid = p.producto_id;
          const isCustom = !pid;
          return {
            orden_compra_id: null,
            producto_id: isCustom ? null : pid,
            cantidad: getProductQuantity(p),
            motivo: isCustom ? `[CUSTOM:${p.descripcion}] Excluido durante consolidación` : 'Excluido durante consolidación',
            solicitud_id: firstSolicitudId,
          };
        });
        if (rezagadosPayload.length > 0) {
          await (supabase.from('productos_rezagados') as any).insert(rezagadosPayload);
        }
      }

      onConsolidate(newOrder as OrdenConsolidada);
      onHide();
    } catch (err) {
      console.error(err);
      setError("Error al consolidar solicitudes.");
    } finally {
      setSubmittingConsolidation(false);
    }
  };

  const toggleProductSelection = (uniqueKey: string) => {
    const newSet = new Set(unselectedProductKeys);
    if (newSet.has(uniqueKey)) newSet.delete(uniqueKey);
    else newSet.add(uniqueKey);
    setUnselectedProductKeys(newSet);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-pop-in">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-2xl text-primary-600 dark:text-primary-400">
              <SquaresPlusIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Consolidación Grupal</h3>
              <p className="text-sm text-slate-500 font-medium">Agrupe múltiples solicitudes en una sola intención de compra</p>
            </div>
          </div>
          <button onClick={onHide} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10">
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>

        {loadingInitialData ? (
          <div className="flex-grow flex items-center justify-center p-20">
            <LoadingSpinner message="Analizando solicitudes pendientes..." />
          </div>
        ) : (
          <div className="flex-grow overflow-hidden flex flex-col md:flex-row">
            {/* Column 1: Selector */}
            <div className="w-full md:w-1/2 p-8 border-r border-slate-100 dark:border-slate-800 overflow-y-auto space-y-6">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-[10px] font-black">1</span>
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Solicitudes Disponibles</h4>
              </div>
              
              {solicitudesPendientes.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] text-center">
                  <p className="text-slate-400 font-medium">No hay solicitudes pendientes</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {solicitudesPendientes.map(sol => (
                    <div key={sol.id} onClick={() => {
                      const newSet = new Set(selectedSolicitudIds);
                      if (newSet.has(sol.id)) newSet.delete(sol.id);
                      else newSet.add(sol.id);
                      setSelectedSolicitudIds(newSet);
                    }} className={`group relative p-5 rounded-[1.5rem] border transition-all duration-300 cursor-pointer ${selectedSolicitudIds.has(sol.id) ? 'bg-primary-50 dark:bg-primary-950/20 border-primary-500 shadow-lg shadow-primary-500/10' : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className={`text-sm font-black uppercase tracking-tight ${selectedSolicitudIds.has(sol.id) ? 'text-primary-700 dark:text-primary-400' : 'text-slate-900 dark:text-slate-200'}`}>Solicitud #{sol.id}</p>
                          <p className={`text-xs mt-1 font-medium ${selectedSolicitudIds.has(sol.id) ? 'text-primary-600/80 dark:text-primary-400/60' : 'text-slate-500 dark:text-slate-400'}`}>{sol.descripcion || 'Sin descripción detallada'}</p>
                          <div className="mt-3 flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sol.empleado?.nombre} {sol.empleado?.apellido}</span>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedSolicitudIds.has(sol.id) ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-200 dark:border-slate-700 group-hover:border-primary-400'}`}>
                          {selectedSolicitudIds.has(sol.id) && <CheckIcon className="w-4 h-4 font-black" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Review */}
            <div className="w-full md:w-1/2 p-8 bg-slate-50/30 dark:bg-slate-950/20 overflow-y-auto flex flex-col">
              <div className="flex items-center gap-2 mb-6 px-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-[10px] font-black">2</span>
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Resumen y Proveedor</h4>
              </div>

              <div className="space-y-6 flex-grow">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 ml-1">Seleccionar Proveedor</label>
                  <select value={selectedProveedorId} onChange={e => setSelectedProveedorId(e.target.value)} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all font-semibold">
                    <option value="">-- Proveedor Destino --</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                <div className="flex-grow space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">Items Agrupados ({productosConsolidados.length})</label>
                  {productosConsolidados.length === 0 ? (
                    <div className="p-8 border-2 border-dotted border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 space-y-2">
                       <InformationCircleIcon className="w-8 h-8 opacity-20" />
                       <p className="text-xs font-medium italic">Seleccione solicitudes a la izquierda</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {productosConsolidados.map(p => {
                        const isUnselected = unselectedProductKeys.has(p.uniqueKey);
                        return (
                          <div key={p.uniqueKey} className={`p-4 rounded-2xl border transition-all ${isUnselected ? 'bg-amber-50/30 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20 grayscale opacity-60' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 shadow-sm'}`}>
                            <div className="flex items-center gap-4">
                              <input type="checkbox" checked={!isUnselected} onChange={() => toggleProductSelection(p.uniqueKey)} className="rounded-lg border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 w-6 h-6 cursor-pointer" />
                              <div className="flex-grow min-w-0">
                                <span className={`text-sm font-bold block truncate ${isUnselected ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{p.descripcion}</span>
                                {isUnselected && <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">Rezagado</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">x</span>
                                <input type="number" min="1" value={getProductQuantity(p)} onChange={(e) => handleQuantityChange(p.uniqueKey, e.target.value)} disabled={isUnselected}
                                  className="w-16 p-2 text-center border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-black focus:ring-primary-500" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Area */}
              <div className="mt-8 space-y-4">
                {unselectedProductKeys.size > 0 && (
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex gap-3 items-center">
                    <ExclamationTriangleIcon className="w-6 h-6 text-amber-500 shrink-0" />
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider leading-relaxed">
                      {unselectedProductKeys.size} item(s) serán movidos a la lista de rezagados para futuras órdenes.
                    </p>
                  </div>
                )}

                <button onClick={() => {
                  const finalProds = productosConsolidados.filter(p => !unselectedProductKeys.has(p.uniqueKey));
                  const rezagados = productosConsolidados.filter(p => unselectedProductKeys.has(p.uniqueKey));
                  if (rezagados.length > 0) setShowRezagadosConfirm(rezagados);
                  else executeConsolidacion();
                }} disabled={!selectedProveedorId || productosConsolidados.filter(p => !unselectedProductKeys.has(p.uniqueKey)).length === 0 || submittingConsolidation}
                  className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-500/25 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                  {submittingConsolidation ? <ArrowPathIcon className="w-6 h-6 animate-spin" /> : <CheckCircleIcon className="w-6 h-6" />}
                  {submittingConsolidation ? "Consolidando..." : "Consolidar Ahora"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showRezagadosConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in text-center">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 border border-amber-200 dark:border-amber-900/50 animate-pop-in">
             <div className="flex justify-center mb-6">
                <div className="p-5 bg-amber-100 dark:bg-amber-900/30 rounded-[2rem]">
                  <ExclamationTriangleIcon className="w-12 h-12 text-amber-600" />
                </div>
             </div>
             <h4 className="text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Items Excluidos</h4>
             <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 px-6">¿Desea enviar estos {showRezagadosConfirm.length} productos a la lista de <span className="text-amber-600 font-bold">rezagados</span> y proceder con la consolidación?</p>
             
             <div className="flex gap-4">
                <button onClick={() => setShowRezagadosConfirm(null)} className="flex-1 py-4 text-sm font-bold text-slate-500">Regresar</button>
                <button onClick={() => { setShowRezagadosConfirm(null); executeConsolidacion(); }} className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20">
                  Confirmar y Consolidar
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsolidationModal;

import { InformationCircleIcon as InformationCircleIconOutline } from '@heroicons/react/24/outline';
const InformationCircleIcon = InformationCircleIconOutline;
