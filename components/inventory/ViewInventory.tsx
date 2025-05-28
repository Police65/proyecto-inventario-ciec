
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Inventario } from '../../types';
import LoadingSpinner from '../core/LoadingSpinner';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const ViewInventory: React.FC = () => {
  const [inventory, setInventory] = useState<Inventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Inventario | 'producto_descripcion'; direction: 'ascending' | 'descending' } | null>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('inventario')
        .select('*, producto:producto_id(descripcion, categoria:categoria_id(nombre))')
        .order('fecha_actualizacion', { ascending: false });
        
      if (fetchError) throw fetchError;
      setInventory(data || []);
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
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Inventario Actual</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchInventory}
            className="p-2 text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refrescar"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th onClick={() => requestSort('producto_descripcion')} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">
                Producto {getSortIndicator('producto_descripcion')}
              </th>
              <th onClick={() => requestSort('ubicacion')} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">
                Ubicación {getSortIndicator('ubicacion')}
              </th>
               <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
              <th onClick={() => requestSort('existencias')} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">
                Existencias {getSortIndicator('existencias')}
              </th>
              <th onClick={() => requestSort('fecha_actualizacion')} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">
                Últ. Actualización {getSortIndicator('fecha_actualizacion')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedInventory.length > 0 ? filteredAndSortedInventory.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.producto?.descripcion || 'N/A'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.ubicacion || 'N/A'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.producto?.categoria?.nombre || 'N/A'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.existencias ?? '0'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(item.fecha_actualizacion).toLocaleDateString()}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron artículos en el inventario.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewInventory;
    