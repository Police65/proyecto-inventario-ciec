
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Inventario, Producto } from '../../types';
import LoadingSpinner from '../core/LoadingSpinner';
import { MagnifyingGlassIcon, ArrowPathIcon, PencilSquareIcon, CheckCircleIcon, XMarkIcon, PlusIcon, SquaresPlusIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const ViewInventory: React.FC = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<Inventario[]>([]);
  const [allProducts, setAllProducts] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Inventario | 'producto_descripcion'; direction: 'ascending' | 'descending' } | null>(null);

  // Estados para el ajuste de stock manual
  const [editingItem, setEditingItem] = useState<Inventario | null>(null);
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [newMinStockValue, setNewMinStockValue] = useState<number>(0); // NUEVO: Estado para stock mínimo
  const [updatingStock, setUpdatingStock] = useState(false);

  // Estados para añadir/cargar stock
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [initialLocation, setInitialLocation] = useState('Almacén Principal');
  const [initialQuantity, setInitialQuantity] = useState(0);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('inventario')
        .select('*, producto:producto_id(descripcion, stock_minimo, categoria:categoria_id(nombre))')
        .order('fecha_actualizacion', { ascending: false });
        
      if (fetchError) throw fetchError;
      setInventory(data || []);

      const { data: productsData, error: productsError } = await supabase
        .from('producto')
        .select('*')
        .order('descripcion');
      if (productsError) throw productsError;
      setAllProducts(productsData || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar inventario");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    setUpdatingStock(true);
    try {
      // 1. Actualizar existencias en la tabla inventario
      // FIX: Cast from() to any to resolve 'never' type error in Supabase update
      const { error: updateInvError } = await (supabase
        .from('inventario') as any)
        .update({ 
          existencias: newStockValue,
          fecha_actualizacion: new Date().toISOString()
        })
        .eq('id', editingItem.id);

      if (updateInvError) throw updateInvError;

      // 2. Actualizar stock mínimo en la tabla producto
      // FIX: Cast from() to any to resolve 'never' type error in Supabase update
      const { error: updateProdError } = await (supabase
        .from('producto') as any)
        .update({
          stock_minimo: newMinStockValue
        })
        .eq('id', editingItem.producto_id);

      if (updateProdError) throw updateProdError;

      // 3. Actualizar estado local
      setInventory(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { 
              ...item, 
              existencias: newStockValue, 
              fecha_actualizacion: new Date().toISOString(),
              producto: { ...item.producto, stock_minimo: newMinStockValue }
            } 
          : item
      ));
      
      setEditingItem(null);
    } catch (err) {
      alert("Error al actualizar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUpdatingStock(false);
    }
  };

  const handleAddNewInventoryEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    setUpdatingStock(true);
    try {
      // Verificar si ya existe el producto en el inventario para esa ubicación específica
      const { data: existingEntry } = await supabase
        .from('inventario')
        .select('id, existencias')
        .eq('producto_id', selectedProductId)
        .eq('ubicacion', initialLocation)
        .maybeSingle();

      // FIX: Cast existingEntry to any for property access
      if (existingEntry) {
        // Si existe, sumamos la cantidad nueva a la anterior
        const newTotal = ((existingEntry as any).existencias || 0) + initialQuantity;
        // FIX: Cast from() to any to resolve 'never' type error in Supabase update
        const { data: updated, error: updateError } = await (supabase
            .from('inventario') as any)
            .update({
                existencias: newTotal,
                fecha_actualizacion: new Date().toISOString()
            })
            .eq('id', (existingEntry as any).id)
            .select('*, producto:producto_id(descripcion, stock_minimo, categoria:categoria_id(nombre))')
            .single();

        if (updateError) throw updateError;
        setInventory(prev => prev.map(item => item.id === (existingEntry as any).id ? updated as Inventario : item));
      } else {
        // Si no existe, creamos el registro
        // FIX: Cast from() to any to resolve 'never' type error in Supabase insert
        const { data, error: insertError } = await (supabase
            .from('inventario') as any)
            .insert({
                producto_id: selectedProductId,
                ubicacion: initialLocation,
                existencias: initialQuantity,
                fecha_actualizacion: new Date().toISOString()
            })
            .select('*, producto:producto_id(descripcion, stock_minimo, categoria:categoria_id(nombre))')
            .single();

        if (insertError) throw insertError;
        setInventory(prev => [data as Inventario, ...prev]);
      }

      setShowAddStockModal(false);
      setSelectedProductId('');
      setInitialQuantity(0);
      setInitialLocation('Almacén Principal');
    } catch (err) {
      alert("Error al procesar la carga de stock: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUpdatingStock(false);
    }
  };

  const filteredAndSortedInventory = React.useMemo(() => {
    let sortableItems = [...inventory];
    if (searchTerm) {
      sortableItems = sortableItems.filter(item =>
        item.producto?.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ubicacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.producto?.categoria?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'producto_descripcion') {
            valA = a.producto?.descripcion?.toLowerCase() || '';
            valB = b.producto?.descripcion?.toLowerCase() || '';
        } else {
            valA = a[sortConfig.key as keyof Inventario];
            valB = b[sortConfig.key as keyof Inventario];
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortConfig.direction === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [inventory, searchTerm, sortConfig]);

  const requestSort = (key: keyof Inventario | 'producto_descripcion') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: keyof Inventario | 'producto_descripcion') => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };

  if (loading) return <LoadingSpinner message="Cargando inventario..." />;
  if (error) return <div className="p-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md">{error}</div>;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg h-full flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white shrink-0">Existencias de Inventario</h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          <div className="relative min-w-[200px] flex-grow xl:flex-grow-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={() => navigate('/inventory/add-product')}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm text-sm transition-all active:scale-95"
            title="Crear definición de nuevo producto"
          >
            <SquaresPlusIcon className="w-5 h-5 mr-2" />
            Nuevo Producto
          </button>

          <button
            onClick={() => setShowAddStockModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm transition-all active:scale-95"
            title="Registrar stock para un producto"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Cargar Stock
          </button>

          <button
            onClick={fetchInventory}
            className="p-2 text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Actualizar lista"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border dark:border-gray-700 rounded-lg flex-grow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th onClick={() => requestSort('producto_descripcion')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-primary-500">
                Producto {getSortIndicator('producto_descripcion')}
              </th>
              <th onClick={() => requestSort('ubicacion')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-primary-500">
                Ubicación {getSortIndicator('ubicacion')}
              </th>
               <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoría</th>
              <th onClick={() => requestSort('existencias')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-primary-500">
                Stock {getSortIndicator('existencias')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Mínimo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedInventory.length > 0 ? filteredAndSortedInventory.map(item => {
              const isLowStock = item.existencias !== null && item.producto?.stock_minimo !== null && item.existencias < item.producto.stock_minimo;
              
              return (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.producto?.descripcion || 'N/D'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{item.ubicacion || 'Almacén Central'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{item.producto?.categoria?.nombre || 'General'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`font-bold ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {item.existencias ?? '0'}
                    </span>
                    {isLowStock && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase font-bold">Bajo</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500">{item.producto?.stock_minimo || 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => { 
                        setEditingItem(item); 
                        setNewStockValue(item.existencias || 0);
                        setNewMinStockValue(item.producto?.stock_minimo || 0); // NUEVO: Inicializar stock mínimo
                      }}
                      className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 p-1 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20"
                      title="Editar stock manual"
                    >
                      <PencilSquareIcon className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron productos en el inventario.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para Ajustar Stock Manual (Registro ya existente) */}
      {editingItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-60 p-4 animate-fadeIn backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md overflow-hidden transform transition-all border dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ajustar Existencias y Límites</h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleUpdateStock} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Producto</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{editingItem.producto?.descripcion}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="stockInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Actual</label>
                  <input 
                    type="number" 
                    id="stockInput"
                    min="0"
                    autoFocus
                    className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-lg font-bold"
                    value={newStockValue}
                    onChange={(e) => setNewStockValue(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label htmlFor="minStockInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Mínimo <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    id="minStockInput"
                    min="0"
                    className="block w-full px-4 py-2 border border-orange-300 dark:border-orange-900 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-lg font-bold"
                    value={newMinStockValue}
                    onChange={(e) => setNewMinStockValue(parseInt(e.target.value) || 0)}
                    title="Límite para alertas de bajo stock"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={updatingStock} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center transition-all active:scale-95 shadow-md">
                  {updatingStock ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-2" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Cargar Nuevo Stock (Cualquier producto del catálogo) */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-60 p-4 animate-fadeIn backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden transform transition-all border dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cargar Stock al Inventario</h3>
              <button onClick={() => setShowAddStockModal(false)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddNewInventoryEntry} className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800 flex items-start mb-4">
                <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Si selecciona un producto que ya tiene stock, la nueva cantidad se <strong>sumará</strong> automáticamente al registro existente.
                </p>
              </div>

              <div>
                <label htmlFor="productSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seleccionar Producto del Catálogo <span className="text-red-500">*</span></label>
                <select 
                  id="productSelect"
                  required
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                >
                  <option value="">-- Busque y elija un producto --</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.descripcion} (Cód: {p.codigo_interno || 'S/C'})</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="locationInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ubicación</label>
                  <input 
                    type="text" 
                    id="locationInput"
                    placeholder="Ej: Almacén Principal"
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={initialLocation}
                    onChange={(e) => setInitialLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="initialStockInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad a Añadir</label>
                  <input 
                    type="number" 
                    id="initialStockInput"
                    min="1"
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={initialQuantity}
                    onChange={(e) => setInitialQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={() => setShowAddStockModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={updatingStock || !selectedProductId} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center transition-all active:scale-95 shadow-md">
                  {updatingStock ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-2" />}
                  Cargar Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewInventory;
