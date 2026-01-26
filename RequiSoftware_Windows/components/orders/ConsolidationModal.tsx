
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

  const handleSubmitConsolidacion = async () => {
    if (!selectedProveedorId || productosConsolidados.length === 0) return;
    setSubmittingConsolidation(true);
    try {
      const payload = {
        proveedor_id: parseInt(selectedProveedorId),
        productos: productosConsolidados.map(p => ({ producto_id: p.producto_id, descripcion: p.descripcion, cantidad: p.cantidadTotal })),
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

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Consolidar Solicitudes</h3>
          <button onClick={onHide} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
        </div>

        {loadingInitialData ? <LoadingSpinner /> : (
          <div className="flex-grow overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">1. Seleccionar Solicitudes</h4>
              <div className="max-h-96 overflow-y-auto border dark:border-gray-600 rounded-md p-2 space-y-2">
                {solicitudesPendientes.map(sol => (
                  <div key={sol.id} onClick={() => {
                    const newSet = new Set(selectedSolicitudIds);
                    if (newSet.has(sol.id)) newSet.delete(sol.id);
                    else newSet.add(sol.id);
                    setSelectedSolicitudIds(newSet);
                  }} className={`p-2 rounded border cursor-pointer ${selectedSolicitudIds.has(sol.id) ? 'bg-primary-50 border-primary-500' : 'dark:bg-gray-700 border-transparent'}`}>
                    <p className="text-sm font-bold">Solicitud #{sol.id}</p>
                    <p className="text-xs text-gray-500 truncate">{sol.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">2. Proveedor y Resumen</h4>
              <select value={selectedProveedorId} onChange={e => setSelectedProveedorId(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700">
                <option value="">Seleccionar Proveedor...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700">
                <p className="text-xs font-bold mb-2">Productos a consolidar:</p>
                {productosConsolidados.map(p => (
                  <div key={p.uniqueKey} className="text-xs flex justify-between py-1 border-b dark:border-gray-700">
                    <span className="truncate pr-2">{p.descripcion}</span>
                    <span className="font-bold">x{p.cantidadTotal}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleSubmitConsolidacion} disabled={!selectedProveedorId || selectedSolicitudIds.size === 0 || submittingConsolidation} className="w-full py-2 bg-primary-600 text-white rounded font-bold disabled:opacity-50">
                {submittingConsolidation ? "Procesando..." : "Crear Orden Consolidada"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsolidationModal;
