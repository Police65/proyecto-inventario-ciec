import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient'; // Path relative to src/components/inventory
import { Proveedor, CategoriaProveedor } from '../../types'; // Path relative to src/components/inventory
import { PlusCircleIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner'; // Path relative to src/components/inventory

const ProviderManagement: React.FC = () => {
  const [providers, setProviders] = useState<Proveedor[]>([]);
  const [allCategorias, setAllCategorias] = useState<CategoriaProveedor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<Partial<Proveedor> & { selectedCategorias?: number[] }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProvidersAndCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data: providersData, error: providersError } = await supabase
        .from('proveedor')
        .select('*, categorias:proveedor_categoria(categoria_id, categoria:categoria_id(id, nombre))')
        .order('nombre', { ascending: true });
      if (providersError) throw providersError;
      setProviders(providersData || []);

      const { data: categoriasData, error: categoriasError } = await supabase
        .from('categoria_proveedor')
        .select('*')
        .order('nombre', { ascending: true });
      if (categoriasError) throw categoriasError;
      setAllCategorias(categoriasData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error al cargar datos.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProvidersAndCategories();
  }, [fetchProvidersAndCategories]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentProvider(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (categoryId: number) => {
    setCurrentProvider(prev => {
        const currentSelected = prev.selectedCategorias || [];
        const newSelected = currentSelected.includes(categoryId)
            ? currentSelected.filter(id => id !== categoryId)
            : [...currentSelected, categoryId];
        return { ...prev, selectedCategorias: newSelected };
    });
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentProvider.nombre || !currentProvider.rif) {
      alert('Nombre y RIF son obligatorios.');
      return;
    }

    const providerData = {
      nombre: currentProvider.nombre,
      rif: currentProvider.rif,
      direccion: currentProvider.direccion || '',
      telefono: currentProvider.telefono || null,
      correo: currentProvider.correo || null,
      pagina_web: currentProvider.pagina_web || null,
    };

    try {
      let savedProviderId: number;

      if (isEditing && currentProvider.id) {
        const { data, error } = await supabase
          .from('proveedor')
          .update(providerData)
          .eq('id', currentProvider.id)
          .select('id')
          .single();
        if (error) throw error;
        if (!data) throw new Error("Failed to update provider.");
        savedProviderId = data.id;

        await supabase.from('proveedor_categoria').delete().eq('proveedor_id', savedProviderId);

      } else {
        const { data, error } = await supabase
          .from('proveedor')
          .insert(providerData)
          .select('id')
          .single();
        if (error) throw error;
        if (!data) throw new Error("Failed to create provider.");
        savedProviderId = data.id;
      }

      if (currentProvider.selectedCategorias && currentProvider.selectedCategorias.length > 0) {
        const categoryLinks = currentProvider.selectedCategorias.map(catId => ({
            proveedor_id: savedProviderId,
            categoria_id: catId
        }));
        const { error: catError } = await supabase.from('proveedor_categoria').insert(categoryLinks);
        if (catError) throw catError;
      }

      setShowModal(false);
      setCurrentProvider({});
      fetchProvidersAndCategories();
    } catch (error) {
      console.error('Error saving provider:', error);
      alert(`Error al guardar proveedor: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEdit = (provider: Proveedor) => {
    const selectedCategorias = provider.categorias?.map(pc => pc.categoria_id) || [];
    setCurrentProvider({ ...provider, selectedCategorias });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de que desea eliminar este proveedor? Esta acción también eliminará sus asociaciones de categorías.')) {
      try {
        await supabase.from('proveedor_categoria').delete().eq('proveedor_id', id);
        const { error } = await supabase.from('proveedor').delete().eq('id', id);
        if (error) throw error;
        fetchProvidersAndCategories();
      } catch (error) {
        console.error('Error deleting provider:', error);
        alert('Error al eliminar proveedor.');
      }
    }
  };

  const openAddModal = () => {
    setCurrentProvider({ selectedCategorias: [] });
    setIsEditing(false);
    setShowModal(true);
  };
  
  const filteredProviders = providers.filter(provider =>
    provider.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.rif.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (provider.correo && provider.correo.toLowerCase().includes(searchTerm.toLowerCase()))
  );


  if (loading) return <LoadingSpinner message="Cargando proveedores..." />;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Proveedores</h2>
        <div className="flex items-center gap-2">
           <input
            type="text"
            placeholder="Buscar proveedor..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={openAddModal}
            className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Añadir Proveedor
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">RIF</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Teléfono</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correo</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categorías</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProviders.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.nombre}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.rif}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.telefono || 'N/A'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.correo || 'N/A'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {p.categorias?.map(cat => cat.categoria?.nombre).join(', ') || 'N/A'}
                </td>
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
             {filteredProviders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron proveedores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {isEditing ? 'Editar' : 'Añadir'} Proveedor
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                <input type="text" name="nombre" id="nombre" value={currentProvider.nombre || ''} onChange={handleInputChange} required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label htmlFor="rif" className="block text-sm font-medium text-gray-700 dark:text-gray-300">RIF</label>
                <input type="text" name="rif" id="rif" value={currentProvider.rif || ''} onChange={handleInputChange} required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dirección</label>
                <textarea name="direccion" id="direccion" value={currentProvider.direccion || ''} onChange={handleInputChange} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                <input type="text" name="telefono" id="telefono" value={currentProvider.telefono || ''} onChange={handleInputChange} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label htmlFor="correo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Correo</label>
                <input type="email" name="correo" id="correo" value={currentProvider.correo || ''} onChange={handleInputChange} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label htmlFor="pagina_web" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Página Web</label>
                <input type="url" name="pagina_web" id="pagina_web" value={currentProvider.pagina_web || ''} onChange={handleInputChange} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categorías de Proveedor</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border dark:border-gray-600 rounded-md">
                    {allCategorias.map(cat => (
                        <div key={cat.id} className="flex items-center">
                            <input
                                id={`cat-${cat.id}`}
                                type="checkbox"
                                checked={currentProvider.selectedCategorias?.includes(cat.id) || false}
                                onChange={() => handleCategoryChange(cat.id)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-500 rounded bg-gray-50 dark:bg-gray-700"
                            />
                            <label htmlFor={`cat-${cat.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">{cat.nombre}</label>
                        </div>
                    ))}
                </div>
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

export default ProviderManagement;