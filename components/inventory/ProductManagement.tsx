
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Producto, CategoriaProducto } from '../../types';
import { PlusCircleIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [categories, setCategories] = useState<CategoriaProducto[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Producto>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('producto')
        .select('*, categoria:categoria_id(id, nombre)')
        .order('descripcion', { ascending: true });
      if (productsError) throw productsError;
      setProducts(productsData || []);

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categoria_producto')
        .select('*')
        .order('nombre', { ascending: true });
      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error al cargar datos de productos.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ ...prev, [name]: name === 'categoria_id' ? (value ? parseInt(value) : null) : value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentProduct.descripcion || !currentProduct.categoria_id) {
      alert('Descripción y categoría son obligatorias.');
      return;
    }

    const productData = {
      descripcion: currentProduct.descripcion,
      categoria_id: currentProduct.categoria_id ? Number(currentProduct.categoria_id) : null,
    };

    try {
      if (isEditing && currentProduct.id) {
        const { error } = await supabase.from('producto').update(productData).eq('id', currentProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('producto').insert(productData);
        if (error) throw error;
      }
      setShowModal(false);
      setCurrentProduct({});
      fetchData(); 
    } catch (error) {
      console.error('Error saving product:', error);
      alert(`Error al guardar producto: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEdit = (product: Producto) => {
    setCurrentProduct(product);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de que desea eliminar este producto?')) {
      try {
        const { error } = await supabase.from('producto').delete().eq('id', id);
        if (error) throw error;
        fetchData(); 
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error al eliminar producto.');
      }
    }
  };

  const openAddModal = () => {
    setCurrentProduct({});
    setIsEditing(false);
    setShowModal(true);
  };
  
  const filteredProducts = products.filter(product =>
    product.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.categoria?.nombre && product.categoria.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <LoadingSpinner message="Cargando productos..." />;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Productos</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar producto..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={openAddModal}
            className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Añadir Producto
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProducts.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.descripcion}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.categoria?.nombre || 'N/A'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium space-x-2">
                  <button onClick={() => handleEdit(p)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 p-1" title="Editar">
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => p.id && handleDelete(p.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1" title="Eliminar">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {isEditing ? 'Editar' : 'Añadir'} Producto
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
                <textarea name="descripcion" id="descripcion" value={currentProduct.descripcion || ''} onChange={handleInputChange} required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label htmlFor="categoria_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
                <select name="categoria_id" id="categoria_id" value={currentProduct.categoria_id || ''} onChange={handleInputChange} required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Seleccionar categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
    