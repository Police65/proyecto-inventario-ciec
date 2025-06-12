
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Proveedor, CategoriaProveedor } from '../../types';
import { PlusCircleIcon, PencilIcon, TrashIcon, ArrowPathIcon, TagIcon, XMarkIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
const btnPrimaryClasses = "px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-300 dark:disabled:bg-primary-800";
const btnSecondaryClasses = "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:bg-gray-300 dark:disabled:bg-gray-600";


const ProviderManagement: React.FC = () => {
  const [providers, setProviders] = useState<Proveedor[]>([]);
  const [allCategorias, setAllCategorias] = useState<CategoriaProveedor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<Partial<Proveedor> & { selectedCategorias?: number[] }>({});
  const [loadingData, setLoadingData] = useState(true);
  const [submittingProvider, setSubmittingProvider] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);


  const fetchProvidersAndCategories = useCallback(async () => {
    setLoadingData(true);
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
      console.error('Error al obtener datos:', error);
      alert('Error al cargar datos.');
    }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchProvidersAndCategories();
  }, [fetchProvidersAndCategories]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentProvider(prev => ({ 
        ...prev, 
        [name]: (name === 'tiempo_entrega_promedio_dias' || name === 'calificacion_promedio') 
                ? (value ? parseFloat(value) : null) 
                : value 
    }));
  };

  const handleToggleCategorySelection = (categoryId: number) => {
    setCurrentProvider(prev => {
        const currentSelected = prev.selectedCategorias || [];
        const newSelected = currentSelected.includes(categoryId)
            ? currentSelected.filter(id => id !== categoryId)
            : [...currentSelected, categoryId];
        return { ...prev, selectedCategorias: newSelected };
    });
  };
  
  const handleRifInvalid = (event: React.InvalidEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.validity.patternMismatch) {
      target.setCustomValidity("Formato de RIF inválido. Ejemplo: J-12345678-9 o V-123456789.");
    } else if (target.validity.valueMissing) {
      target.setCustomValidity("El RIF es obligatorio.");
    } else {
      target.setCustomValidity(""); 
    }
  };

  const handleRifInput = (event: React.FormEvent<HTMLInputElement>) => {
    (event.target as HTMLInputElement).setCustomValidity(""); 
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingProvider(true);
    if (!currentProvider.nombre || !currentProvider.rif) {
      alert('Nombre y RIF son obligatorios.');
      setSubmittingProvider(false);
      return;
    }
    
    if (currentProvider.rif && !/^[JVGjvgeE]-\d{8,9}(-\d)?$/.test(currentProvider.rif)) {
        alert('Formato de RIF inválido. Ejemplo: J-12345678-9 o V-123456789.');
        setSubmittingProvider(false);
        return;
    }

    const providerData = {
      nombre: currentProvider.nombre,
      rif: currentProvider.rif.toUpperCase(), 
      direccion: currentProvider.direccion || '',
      telefono: currentProvider.telefono || null,
      correo: currentProvider.correo || null,
      pagina_web: currentProvider.pagina_web || null,
      tiempo_entrega_promedio_dias: currentProvider.tiempo_entrega_promedio_dias ? Number(currentProvider.tiempo_entrega_promedio_dias) : null,
      calificacion_promedio: currentProvider.calificacion_promedio ? Number(currentProvider.calificacion_promedio) : null,
      estado: currentProvider.estado || 'activo',
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
        if (!data) throw new Error("Error al actualizar proveedor.");
        savedProviderId = data.id;

        await supabase.from('proveedor_categoria').delete().eq('proveedor_id', savedProviderId);

      } else {
        const { data, error } = await supabase
          .from('proveedor')
          .insert(providerData)
          .select('id')
          .single();
        if (error) throw error;
        if (!data) throw new Error("Error al crear proveedor.");
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
      setCategorySearchTerm(''); 
      setIsCategoryDropdownOpen(false);
      fetchProvidersAndCategories(); 
    } catch (error) {
      const supabaseError = error as { code?: string; message: string };
      if (supabaseError.code === '23505') { 
         if (supabaseError.message.includes('proveedor_rif_key')) { 
            alert('Error: El RIF ingresado ya existe.');
         } else {
            alert(`Error guardando proveedor: Ya existe un registro con un valor único similar. (${supabaseError.message})`);
         }
      } else {
        alert(`Error guardando proveedor: ${supabaseError.message}`);
      }
      console.error('Error al guardar proveedor:', error);
    } finally {
      setSubmittingProvider(false);
    }
  };

  const handleEdit = (provider: Proveedor) => {
    const selectedCategorias = provider.categorias?.map(pc => pc.categoria_id) || [];
    setCurrentProvider({ ...provider, selectedCategorias });
    setIsEditing(true);
    setShowModal(true);
    setCategorySearchTerm('');
  };

  const handleDelete = async (id: number) => {
    if (submittingProvider) return;
    if (window.confirm('¿Está seguro de que desea eliminar este proveedor? Esta acción también eliminará sus asociaciones de categorías.')) {
      setSubmittingProvider(true);
      try {
        // Check if provider is used in ordencompra
        const { count: ordenCheckCount, error: ordenCheckError } = await supabase
          .from('ordencompra')
          .select('*', { count: 'exact', head: true })
          .eq('proveedor_id', id);

        if (ordenCheckError) throw ordenCheckError;
        if (ordenCheckCount && ordenCheckCount > 0) {
          alert('Error: No se puede eliminar el proveedor porque está asociado a órdenes de compra.');
          setSubmittingProvider(false);
          return;
        }
        
        // Check if provider is used in ordenes_consolidadas
        const { count: consolidadasCheckCount, error: consolidadasCheckError } = await supabase
          .from('ordenes_consolidadas')
          .select('*', { count: 'exact', head: true })
          .eq('proveedor_id', id);
        if (consolidadasCheckError) throw consolidadasCheckError;
        if (consolidadasCheckCount && consolidadasCheckCount > 0) {
           alert('Error: No se puede eliminar el proveedor porque está asociado a órdenes consolidadas.');
           setSubmittingProvider(false);
           return;
        }


        await supabase.from('proveedor_categoria').delete().eq('proveedor_id', id);
        const { error } = await supabase.from('proveedor').delete().eq('id', id);
        if (error) throw error;
        fetchProvidersAndCategories(); 
      } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        alert('Error al eliminar proveedor.');
      } finally {
        setSubmittingProvider(false);
      }
    }
  };

  const openAddModal = () => {
    setCurrentProvider({ selectedCategorias: [], estado: 'activo' });
    setIsEditing(false);
    setShowModal(true);
    setCategorySearchTerm('');
  };
  
  const filteredProviders = providers.filter(provider =>
    provider.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.rif.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (provider.correo && provider.correo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openAddCategoryModal = () => {
    setNewCategoryName('');
    setCategoryError(null);
    setShowCategoryModal(true);
  };

  const handleCategoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCategoryName(e.target.value);
  };

  const handleCategorySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      setCategoryError("El nombre de la categoría es obligatorio.");
      return;
    }
    setSubmittingCategory(true);
    setCategoryError(null);
    try {
      const { error } = await supabase
        .from('categoria_proveedor')
        .insert({ nombre: newCategoryName.trim() });
      
      if (error) {
        if (error.code === '23505') { 
             if (error.message.includes('categoria_proveedor_nombre_key')) {
                 setCategoryError('Error: Ya existe una categoría con ese nombre.');
             } else {
                setCategoryError(`Error al guardar: ${error.message}`);
             }
        } else {
            setCategoryError(`Error al guardar la categoría: ${error.message}`);
        }
        throw error;
      }
      
      setShowCategoryModal(false);
      setNewCategoryName('');
      fetchProvidersAndCategories();
      alert('Categoría añadida exitosamente.');

    } catch (err) {
      console.error('Error al guardar categoría de proveedor:', err);
      if(!categoryError && err instanceof Error) {
         setCategoryError(`Error inesperado: ${err.message}`);
      } else if (!categoryError) {
         setCategoryError('Error inesperado al guardar la categoría.');
      }
    } finally {
      setSubmittingCategory(false);
    }
  };

  const filteredAllCategorias = allCategorias.filter(cat =>
    cat.nombre.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  if (loadingData) return <LoadingSpinner message="Cargando proveedores..." />;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Proveedores</h2>
        <div className="flex flex-wrap items-center gap-2">
           <input
            type="text"
            placeholder="Buscar proveedor..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={openAddCategoryModal}
            className="flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-teal-300 dark:disabled:bg-teal-800"
            disabled={submittingProvider || submittingCategory}
          >
            <TagIcon className="w-5 h-5 mr-2" />
            Añadir Categoría Prov.
          </button>
          <button
            onClick={openAddModal}
            className={`flex items-center ${btnPrimaryClasses}`}
            disabled={submittingProvider || submittingCategory}
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
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProviders.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.nombre}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.rif}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.telefono || 'N/D'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.correo || 'N/D'}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        {p.categorias?.slice(0, 2).map(cat => (
                            <span key={cat.categoria_id} className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full">
                                {cat.categoria?.nombre}
                            </span>
                        ))}
                        {(p.categorias?.length || 0) > 2 && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full">
                                +{(p.categorias?.length || 0) - 2} más
                            </span>
                        )}
                        {(p.categorias?.length || 0) === 0 && 'N/D'}
                    </div>
                </td>
                 <td className="px-4 py-2 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>
                        {p.estado}
                    </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium space-x-2">
                  <button onClick={() => handleEdit(p)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 p-1 disabled:opacity-50" title="Editar" disabled={submittingProvider}>
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => p.id && handleDelete(p.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 disabled:opacity-50" title="Eliminar" disabled={submittingProvider}>
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
             {filteredProviders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron proveedores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Provider Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {isEditing ? 'Editar' : 'Añadir'} Proveedor
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre <span className="text-red-500">*</span></label>
                <input type="text" name="nombre" id="nombre" value={currentProvider.nombre || ''} onChange={handleInputChange} required 
                  className={`mt-1 ${inputFieldClasses}`} />
              </div>
              <div>
                <label htmlFor="rif" className="block text-sm font-medium text-gray-700 dark:text-gray-300">RIF <span className="text-red-500">*</span></label>
                <input 
                    type="text" name="rif" id="rif" value={currentProvider.rif || ''} 
                    onChange={handleInputChange} onInvalid={handleRifInvalid} onInput={handleRifInput}
                    required pattern="^[JVGjvgeE]-\d{8,9}(-\d)?$"
                    className={`mt-1 ${inputFieldClasses}`} placeholder="Ej: J-12345678-9" />
              </div>
              <div>
                <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dirección</label>
                <textarea name="direccion" id="direccion" value={currentProvider.direccion || ''} onChange={handleInputChange} 
                  className={`mt-1 ${inputFieldClasses}`} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                    <input type="tel" name="telefono" id="telefono" value={currentProvider.telefono || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} />
                </div>
                <div>
                    <label htmlFor="correo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Correo</label>
                    <input type="email" name="correo" id="correo" value={currentProvider.correo || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} />
                </div>
                <div>
                    <label htmlFor="pagina_web" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Página Web</label>
                    <input type="url" name="pagina_web" id="pagina_web" value={currentProvider.pagina_web || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} />
                </div>
                 <div>
                    <label htmlFor="estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                    <select name="estado" id="estado" value={currentProvider.estado || 'activo'} onChange={handleInputChange} className={`mt-1 ${inputFieldClasses}`}>
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="tiempo_entrega_promedio_dias" className="block text-sm font-medium text-gray-700 dark:text-gray-300">T. Entrega Prom. (días)</label>
                    <input type="number" name="tiempo_entrega_promedio_dias" id="tiempo_entrega_promedio_dias" value={currentProvider.tiempo_entrega_promedio_dias || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} min="0" />
                </div>
                <div>
                    <label htmlFor="calificacion_promedio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Calificación (1-5)</label>
                    <input type="number" name="calificacion_promedio" id="calificacion_promedio" value={currentProvider.calificacion_promedio || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} step="0.1" min="1" max="5"/>
                </div>
              </div>
              
              <div ref={categoryDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categorías de Proveedor</label>
                <div className="relative">
                  <div className={`flex flex-wrap gap-1 p-2 border rounded-md cursor-text min-h-[40px] ${inputFieldClasses}`} onClick={() => setIsCategoryDropdownOpen(true)}>
                    {currentProvider.selectedCategorias?.map(catId => {
                      const cat = allCategorias.find(c => c.id === catId);
                      return cat ? (
                        <span key={cat.id} className="flex items-center bg-primary-100 dark:bg-primary-700 text-primary-700 dark:text-primary-200 text-xs font-medium px-2 py-1 rounded-full">
                          {cat.nombre}
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleCategorySelection(cat.id); }} className="ml-1.5 text-primary-500 hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-100">
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                     <input
                      type="text"
                      placeholder={currentProvider.selectedCategorias?.length ? "" : "Buscar o seleccionar categorías..."}
                      className="flex-grow p-0 border-none focus:ring-0 focus:outline-none text-sm bg-transparent dark:text-white dark:placeholder-gray-400"
                      value={categorySearchTerm}
                      onChange={(e) => { setCategorySearchTerm(e.target.value); setIsCategoryDropdownOpen(true); }}
                      onFocus={() => setIsCategoryDropdownOpen(true)}
                    />
                  </div>
                  {isCategoryDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredAllCategorias.length > 0 ? filteredAllCategorias.map(cat => (
                        <div key={cat.id}
                          onClick={() => { handleToggleCategorySelection(cat.id); setCategorySearchTerm(''); /* setIsCategoryDropdownOpen(false); */ }}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${currentProvider.selectedCategorias?.includes(cat.id) ? 'bg-primary-50 dark:bg-primary-600 font-medium' : 'text-gray-900 dark:text-gray-200'}`}
                        >
                          {cat.nombre}
                        </div>
                      )) : (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No hay categorías que coincidan.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={() => { setShowModal(false); setCategorySearchTerm(''); setIsCategoryDropdownOpen(false);}}
                  className={btnSecondaryClasses} disabled={submittingProvider}>
                  Cancelar
                </button>
                <button type="submit"
                  className={btnPrimaryClasses} disabled={submittingProvider}>
                  {submittingProvider ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                  {submittingProvider ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Añadir Nueva Categoría de Proveedor</h3>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label htmlFor="newCategoryName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre de la Categoría <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" name="newCategoryName" id="newCategoryName" value={newCategoryName}
                  onChange={handleCategoryNameChange} required className={`mt-1 ${inputFieldClasses}`} />
                 {categoryError && <p className="text-xs text-red-500 mt-1">{categoryError}</p>}
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={() => setShowCategoryModal(false)}
                  className={btnSecondaryClasses} disabled={submittingCategory}>
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-teal-300 dark:disabled:bg-teal-800"
                  disabled={submittingCategory}>
                  {submittingCategory ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                  {submittingCategory ? 'Guardando...' : 'Guardar Categoría'}
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
