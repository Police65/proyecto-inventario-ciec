
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { ProductoRezagado, UserProfile } from '../../types';
import {
  ArchiveBoxXMarkIcon,
  ShoppingCartIcon,
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface RezagadosPanelProps {
  userProfile: UserProfile;
  onCreateOrder: (products: Array<{
    id: number | null;
    descripcion: string;
    quantity: number;
    precio_unitario: number;
    selected: boolean;
    isNewProduct: boolean;
    categoria_id?: number | null;
    codigo_interno?: string | null;
    unidad_medida?: string | null;
  }>, solicitudesIds: number[]) => void;
}

const RezagadosPanel: React.FC<RezagadosPanelProps> = ({ userProfile, onCreateOrder }) => {
  const [rezagados, setRezagados] = useState<ProductoRezagado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fetchRezagados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('productos_rezagados')
        .select(`
          id, orden_compra_id, producto_id, cantidad, motivo, solicitud_id, created_at, updated_at,
          producto:producto_id(id, descripcion, unidad_medida, codigo_interno),
          orden_compra:orden_compra_id(id, codigo_visible),
          solicitud:solicitud_id(id, codigo_visible)
        `)
        .order('created_at', { ascending: false })
        .returns<ProductoRezagado[]>();

      if (fetchError) throw fetchError;
      setRezagados(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los productos rezagados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRezagados();
  }, [fetchRezagados]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === rezagados.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rezagados.map(r => r.id)));
    }
  };

  const handleCreateOrder = () => {
    const selectedRezagados = rezagados.filter(r => selected.has(r.id));
    if (selectedRezagados.length === 0) return;

    const products = selectedRezagados.map(r => {
      const customMatch = r.motivo?.match(/\[CUSTOM:(.+?)\]/);
      const isCustom = r.producto_id === null && customMatch;

      return {
        id: r.producto_id,
        descripcion: isCustom ? customMatch[1].trim() : (r.producto?.descripcion || `Producto #${r.producto_id}`),
        quantity: r.cantidad,
        precio_unitario: 0,
        selected: true,
        isNewProduct: !!isCustom,
        codigo_interno: r.producto?.codigo_interno ?? null,
        unidad_medida: r.producto?.unidad_medida ?? null,
      };
    });

    const solicitudesIds = [
      ...new Set(
        selectedRezagados
          .map(r => r.solicitud_id)
          .filter((id): id is number => id !== null && id !== undefined)
      ),
    ];

    onCreateOrder(products, solicitudesIds);
  };

  const allSelected = rezagados.length > 0 && selected.size === rezagados.length;
  const someSelected = selected.size > 0 && selected.size < rezagados.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-3 text-slate-500 dark:text-slate-400">
        <ArrowPathIcon className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Cargando productos rezagados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400 text-sm">
        <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
        <span>{error}</span>
        <button onClick={fetchRezagados} className="ml-auto underline text-xs font-bold">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
            <ArchiveBoxXMarkIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Productos Rezagados
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {rezagados.length === 0
                ? 'Sin productos pendientes de re-orden'
                : `${rezagados.length} producto${rezagados.length !== 1 ? 's' : ''} pendiente${rezagados.length !== 1 ? 's' : ''} de re-orden`}
            </p>
          </div>
        </div>

        {rezagados.length > 0 && (
          <button
            onClick={handleCreateOrder}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-amber-500/25 disabled:shadow-none"
          >
            <ShoppingCartIcon className="w-4 h-4" />
            Crear Orden con Seleccionados
            {selected.size > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-black">
                {selected.size}
              </span>
            )}
          </button>
        )}
      </div>

      {rezagados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
            <ArchiveBoxXMarkIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No hay productos rezagados registrados.</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Los productos pendientes de entrega aparecerán aquí.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-amber-200 dark:border-amber-900/50 rounded-3xl overflow-hidden shadow-lg shadow-amber-100/50 dark:shadow-none">
          <table className="min-w-full divide-y divide-amber-100 dark:divide-amber-900/30">
            <thead className="bg-amber-50 dark:bg-amber-900/20">
              <tr>
                {/* Select-all checkbox */}
                <th className="pl-5 pr-3 py-4">
                  <button
                    onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      allSelected
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : someSelected
                        ? 'bg-amber-200 border-amber-400 text-amber-700'
                        : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900'
                    }`}
                    title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  >
                    {(allSelected || someSelected) && <CheckIcon className="w-3 h-3" />}
                  </button>
                </th>
                {['Producto', 'Cantidad', 'Orden Origen', 'Solicitud', 'Motivo', 'Fecha'].map(col => (
                  <th
                    key={col}
                    scope="col"
                    className="px-4 py-4 text-left text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-[0.2em]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-amber-50 dark:divide-amber-900/20">
              {rezagados.map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <tr
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="pl-5 pr-3 py-4" onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}>
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3" />}
                      </div>
                    </td>

                    {/* Producto */}
                    <td className="px-4 py-4">
                      <div className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                        {item.producto_id === null && item.motivo?.match(/\[CUSTOM:(.+?)\]/) ? (
                          <>
                            {item.motivo.match(/\[CUSTOM:(.+?)\]/)![1].trim()}
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">Custom</span>
                          </>
                        ) : (
                          item.producto?.descripcion || `Producto #${item.producto_id}`
                        )}
                      </div>
                      {item.producto?.codigo_interno && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          Cód: {item.producto.codigo_interno}
                        </div>
                      )}
                    </td>

                    {/* Cantidad */}
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-black">
                        {item.cantidad}
                        {item.producto?.unidad_medida && (
                          <span className="text-xs font-medium opacity-70">{item.producto.unidad_medida}</span>
                        )}
                      </span>
                    </td>

                    {/* Orden Origen */}
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {item.orden_compra ? (
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          #{item.orden_compra.codigo_visible || item.orden_compra_id}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Solicitud */}
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {item.solicitud ? (
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          #{item.solicitud.codigo_visible || item.solicitud_id}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Motivo */}
                    <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                      {item.motivo ? (
                        <span className="truncate block max-w-[200px]" title={item.motivo}>
                          {item.motivo.replace(/\[CUSTOM:(.+?)\]\s*/, '')}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 italic text-xs">Sin motivo</span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-4 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString('es-VE', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RezagadosPanel;
