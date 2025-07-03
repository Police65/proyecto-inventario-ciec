import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Producto, CategoriaProducto } from '../../types';
import { PlusCircleIcon, PencilIcon, TrashIcon, ArrowPathIcon, TagIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
const btnPrimaryClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-300 dark:disabled:bg-primary-800";
const btnSecondaryClasses = "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:bg-gray-300 dark:disabled:bg-gray-600";
const btnTealClasses = "flex items-center justify-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-teal-300 dark:disabled:bg-teal-800";


const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [categories, setCategories] = useState<CategoriaProducto[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Producto>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showProductCategoryModal, setShowProductCategoryModal] = useState(false);
  const [newProductCategoryName, setNewProductCategoryName] = useState('');
  const [submittingProductCategory, setSubmittingProductCategory] = useState(false);
  const [productCategoryError, setProductCategoryError] = useState<string | null>(null);
  
  const [productCategorySearchTerm, setProductCategorySearchTerm] = useState('');
  const [isProductCategoryDropdownOpen, setIsProductCategoryDropdownOpen] = useState(false);
  const productCategoryDropdownRef = useRef<HTMLDivElement>(null);


  const fetchData = useCallback(async () => {
    setLoadingData(true);
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
      console.error('Error al obtener datos:', error);
      alert('Error al cargar datos de productos.');
    }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productCategoryDropdownRef.current && !productCategoryDropdownRef.current.contains(event.target as Node)) {
        setIsProductCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentProduct(prev => ({ 
      ...prev, 
      [name]: name === 'categoria_id' || name === 'stock_minimo' || name === 'stock_maximo' 
              ? (value ? parseInt(value) : null) 
              : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingProduct(true);
    if (!currentProduct.descripcion) {
      alert('La descripción es obligatoria.');
      setSubmittingProduct(false);
      return;
    }
     if (currentProduct.categoria_id === undefined || currentProduct.categoria_id === null) {
      alert('La categoría es obligatoria.');
      setSubmittingProduct(false);
      return;
    }

    const productData = {
      descripcion: currentProduct.descripcion,
      categoria_id: currentProduct.categoria_id ? Number(currentProduct.categoria_id) : null,
      stock_minimo: currentProduct.stock_minimo ? Number(currentProduct.stock_minimo) : null,
      stock_maximo: currentProduct.stock_maximo ? Number(currentProduct.stock_maximo) : null,
      unidad_medida: currentProduct.unidad_medida || null,
      codigo_interno: currentProduct.codigo_interno || null,
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
      setProductCategorySearchTerm('');
      fetchData(); 
    } catch (error) {
      const supabaseError = error as { code?: string; message: string };
      if (supabaseError.code === '23505') { 
         if (supabaseError.message.includes('producto_descripcion_key') || supabaseError.message.includes('producto_codigo_interno_key')) { 
            alert('Error: Ya existe un producto con esa descripción o código interno.');
         } else {
            alert(`Error guardando producto: Ya existe un registro con un valor único similar. (${supabaseError.message})`);
         }
      } else {
        alert(`Error guardando producto: ${supabaseError.message}`);
      }
      console.error('Error al guardar producto:', error);
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleEdit = (product: Producto) => {
    setCurrentProduct(product);
    setIsEditing(true);
    setShowModal(true);
    setProductCategorySearchTerm('');
  };

  const handleDelete = async (id: number) => {
    if (submittingProduct) return; 
    if (window.confirm('¿Está seguro de que desea eliminar este producto? Verifique que no esté en uso.')) {
      setSubmittingProduct(true); 
      try {
        const linkedChecks = await Promise.all([
          supabase.from('inventario').select('id', { count: 'exact', head: true }).eq('producto_id', id),
          supabase.from('solicitudcompra_detalle').select('id', { count: 'exact', head: true }).eq('producto_id', id),
          supabase.from('ordencompra_detalle').select('id', { count: 'exact', head: true }).eq('producto_id', id)
        ]);

        const errorMessages = [];
        if (linkedChecks[0].count && linkedChecks[0].count > 0) errorMessages.push("inventario");
        if (linkedChecks[1].count && linkedChecks[1].count > 0) errorMessages.push("solicitudes de compra");
        if (linkedChecks[2].count && linkedChecks[2].count > 0) errorMessages.push("órdenes de compra");

        if (errorMessages.length > 0) {
          alert(`Error: No se puede eliminar el producto porque está asociado a ${errorMessages.join(', ')}.`);
          setSubmittingProduct(false);
          return;
        }

        const { error } = await supabase.from('producto').delete().eq('id', id);
        if (error) throw error;
        fetchData(); 
      } catch (error) {
        console.error('Error al eliminar producto:', error);
        alert('Error al eliminar producto.');
      } finally {
        setSubmittingProduct(false);
      }
    }
  };

  const openAddModal = () => {
    setCurrentProduct({ categoria_id: categories[0]?.id || null });
    setIsEditing(false);
    setShowModal(true);
    setProductCategorySearchTerm('');
  };
  
  const filteredProducts = products.filter(product =>
    product.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.categoria?.nombre && product.categoria.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.codigo_interno && product.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const openAddProductCategoryModal = () => {
    setNewProductCategoryName('');
    setProductCategoryError(null);
    setShowProductCategoryModal(true);
  };

  const handleProductCategoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewProductCategoryName(e.target.value);
  };

  const handleProductCategorySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newProductCategoryName.trim()) {
      setProductCategoryError("El nombre de la categoría es obligatorio.");
      return;
    }
    setSubmittingProductCategory(true);
    setProductCategoryError(null);
    try {
      const { error } = await supabase
        .from('categoria_producto')
        .insert({ nombre: newProductCategoryName.trim() });
      
      if (error) {
        if (error.code === '23505') {
             if (error.message.includes('categoria_producto_nombre_key')) {
                 setProductCategoryError('Error: Ya existe una categoría de producto con ese nombre.');
             } else {
                 setProductCategoryError(`Error al guardar: ${error.message}`);
             }
        } else {
            setProductCategoryError(`Error al guardar la categoría: ${error.message}`);
        }
        throw error;
      }
      
      setShowProductCategoryModal(false);
      setNewProductCategoryName('');
      fetchData(); 
      alert('Categoría de producto añadida exitosamente.');

    } catch (err) {
      console.error('Error al guardar categoría de producto:', err);
       if(!productCategoryError && err instanceof Error) {
         setProductCategoryError(`Error inesperado: ${err.message}`);
      } else if (!productCategoryError) {
         setProductCategoryError('Error inesperado al guardar la categoría.');
      }
    } finally {
      setSubmittingProductCategory(false);
    }
  };
  
  const filteredCategoriesForCombobox = categories.filter(cat =>
    cat.nombre.toLowerCase().includes(productCategorySearchTerm.toLowerCase())
  );


  if (loadingData) return <LoadingSpinner message="Cargando productos..." />;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Productos</h2>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            placeholder="Buscar producto..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full sm:w-auto"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={openAddProductCategoryModal}
            className={btnTealClasses}
            disabled={submittingProduct || submittingProductCategory}
          >
            <TagIcon className="w-5 h-5 mr-2" />
            Añadir Categoría
          </button>
          <button
            onClick={openAddModal}
            className={btnPrimaryClasses}
            disabled={submittingProduct || submittingProductCategory}
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
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cód. Interno</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">U. Medida</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stock Min/Max</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProducts.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{p.descripcion}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.categoria?.nombre || 'N/D'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.codigo_interno || 'N/D'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.unidad_medida || 'N/D'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{p.stock_minimo || '0'} / {p.stock_maximo || 'N/A'}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium space-x-2">
                  <button onClick={() => handleEdit(p)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 p-1 disabled:opacity-50" title="Editar" disabled={submittingProduct}>
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => p.id && handleDelete(p.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 disabled:opacity-50" title="Eliminar" disabled={submittingProduct}>
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {isEditing ? 'Editar' : 'Añadir'} Producto
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción <span className="text-red-500">*</span></label>
                <textarea name="descripcion" id="descripcion" value={currentProduct.descripcion || ''} onChange={handleInputChange} required 
                  className={`mt-1 ${inputFieldClasses}`}
                  onInvalid={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('Por favor, ingrese una descripción para el producto.')}
                  onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div ref={productCategoryDropdownRef} className="md:col-span-2">
                    <label htmlFor="categoria_id_combobox" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría <span className="text-red-500">*</span></label>
                    <div className="relative mt-1">
                      <div className={`flex items-center border rounded-md shadow-sm min-h-[42px] ${inputFieldClasses} ${isProductCategoryDropdownOpen ? 'ring-2 ring-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        <input
                          type="text"
                          id="categoria_id_combobox"
                          placeholder="Buscar o seleccionar categoría..."
                          className="flex-grow p-2 border-none focus:ring-0 focus:outline-none text-sm bg-transparent dark:text-white dark:placeholder-gray-400"
                          value={currentProduct.categoria_id ? categories.find(c => c.id === currentProduct.categoria_id)?.nombre || productCategorySearchTerm : productCategorySearchTerm}
                          onChange={(e) => { 
                            setProductCategorySearchTerm(e.target.value); 
                            setCurrentProduct(prev => ({ ...prev, categoria_id: null }));
                            setIsProductCategoryDropdownOpen(true); 
                          }}
                          onFocus={() => setIsProductCategoryDropdownOpen(true)}
                          onClick={() => setIsProductCategoryDropdownOpen(true)} 
                          autoComplete="off"
                        />
                        {currentProduct.categoria_id && (
                            <button type="button" onClick={() => {setCurrentProduct(prev => ({...prev, categoria_id: null})); setProductCategorySearchTerm(''); setIsProductCategoryDropdownOpen(true);}} className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        )}
                        <button type="button" onClick={() => setIsProductCategoryDropdownOpen(!isProductCategoryDropdownOpen)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${isProductCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {isProductCategoryDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredCategoriesForCombobox.length > 0 ? filteredCategoriesForCombobox.map(cat => (
                            <div key={cat.id}
                              onClick={() => { 
                                setCurrentProduct(prev => ({...prev, categoria_id: cat.id})); 
                                setProductCategorySearchTerm(cat.nombre); 
                                setIsProductCategoryDropdownOpen(false); 
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${currentProduct.categoria_id === cat.id ? 'bg-primary-50 dark:bg-primary-600 font-medium text-primary-700 dark:text-primary-100' : 'text-gray-900 dark:text-gray-200'}`}
                            >
                              {cat.nombre}
                            </div>
                          )) : (
                            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                {categories.length === 0 ? "No hay categorías. Añada una primero." : "No hay categorías que coincidan."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                <div>
                    <label htmlFor="codigo_interno" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Código Interno</label>
                    <input type="text" name="codigo_interno" id="codigo_interno" value={currentProduct.codigo_interno || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} />
                </div>
                 <div>
                    <label htmlFor="unidad_medida" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unidad de Medida</label>
                    <input type="text" name="unidad_medida" id="unidad_medida" value={currentProduct.unidad_medida || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} placeholder="Ej: Unidad, Caja, Kg" />
                </div>
                <div>
                    <label htmlFor="stock_minimo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock Mínimo</label>
                    <input type="number" name="stock_minimo" id="stock_minimo" value={currentProduct.stock_minimo || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} min="0" />
                </div>
                <div>
                    <label htmlFor="stock_maximo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock Máximo</label>
                    <input type="number" name="stock_maximo" id="stock_maximo" value={currentProduct.stock_maximo || ''} onChange={handleInputChange} 
                    className={`mt-1 ${inputFieldClasses}`} min="0" />
                </div>
              </div>


              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={() => {setShowModal(false); setProductCategorySearchTerm('');}}
                  className={btnSecondaryClasses} disabled={submittingProduct}>
                  Cancelar
                </button>
                <button type="submit"
                  className={btnPrimaryClasses} disabled={submittingProduct}>
                  {submittingProduct ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                  {submittingProduct ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProductCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Añadir Nueva Categoría de Producto</h3>
            <form onSubmit={handleProductCategorySubmit} className="space-y-4">
              <div>
                <label htmlFor="newProductCategoryName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre de la Categoría <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" name="newProductCategoryName" id="newProductCategoryName" value={newProductCategoryName}
                  onChange={handleProductCategoryNameChange} required className={`mt-1 ${inputFieldClasses}`} />
                 {productCategoryError && <p className="text-xs text-red-500 mt-1">{productCategoryError}</p>}
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={() => setShowProductCategoryModal(false)}
                  className={btnSecondaryClasses} disabled={submittingProductCategory}>
                  Cancelar
                </button>
                <button type="submit"
                  className={btnTealClasses}
                  disabled={submittingProductCategory}>
                  {submittingProductCategory ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                  {submittingProductCategory ? 'Guardando...' : 'Guardar Categoría'}
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