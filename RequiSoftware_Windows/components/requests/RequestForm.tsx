import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Producto, CategoriaProducto } from '../../types';
import { PlusCircleIcon, TrashIcon, ArrowPathIcon, TagIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';
// FIX: Import LoadingSpinner component.
import LoadingSpinner from '../core/LoadingSpinner';

interface ProductLine {
  id: string; // ID único para la línea en el frontend
  isNew: boolean; // True si el usuario está definiendo un nuevo producto
  
  // Para productos existentes
  productId: string; 
  
  // Para productos nuevos
  newProductDescription: string;
  newProductCategoryId: string; // puede ser un string numérico o 'new'
  newProductNewCategoryName: string; // para el nombre de la nueva categoría

  // Común
  quantity: number;
}

interface RequestFormProps {
  onSubmit: (data: { products: ProductLine[] }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export const RequestForm: React.FC<RequestFormProps> = ({ onSubmit, onCancel, isSubmitting }) => {
  const [products, setProducts] = useState<ProductLine[]>([{ id: uuidv4(), productId: '', quantity: 1, isNew: false, newProductDescription: '', newProductCategoryId: '', newProductNewCategoryName: '' }]);
  const [fetchedProducts, setFetchedProducts] = useState<Pick<Producto, 'id' | 'descripcion'>[]>([]);
  const [categories, setCategories] = useState<CategoriaProducto[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(true);

  useEffect(() => {
    const fetchDependencies = async () => {
      setLoadingDependencies(true);
      try {
        const { data: productData, error: productError } = await supabase.from('producto').select('id, descripcion');
        if (productError) throw productError;
        setFetchedProducts(productData || []);

        const { data: categoryData, error: categoryError } = await supabase.from('categoria_producto').select('*');
        if (categoryError) throw categoryError;
        setCategories(categoryData || []);
      } catch (error) {
        console.error('Error al obtener dependencias del formulario:', error);
      }
      setLoadingDependencies(false);
    };

    fetchDependencies();
  }, []);

  const handleAddProduct = () => {
    setProducts([...products, { id: uuidv4(), productId: '', quantity: 1, isNew: false, newProductDescription: '', newProductCategoryId: '', newProductNewCategoryName: '' }]);
  };

  const handleRemoveProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleProductChange = (id: string, field: keyof ProductLine, value: any) => {
    setProducts(products.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (products.some(p => 
        (p.isNew && (!p.newProductDescription.trim() || !p.newProductCategoryId || (p.newProductCategoryId === 'new' && !p.newProductNewCategoryName.trim()))) ||
        (!p.isNew && !p.productId) ||
        Number(p.quantity) < 1
    )) {
      alert('Por favor, complete todos los campos de productos. Para productos nuevos, asegúrese de llenar la descripción y seleccionar o crear una categoría.');
      return;
    }
    
    // El 'customRequest' flag es ahora implícito y no necesita ser pasado.
    // El backend determinará si es personalizado si producto_id es null.
    onSubmit({ products: products.map(p => ({...p, quantity: Number(p.quantity)})) });
  };

  const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
  const btnPrimaryClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-300 dark:disabled:bg-primary-800";
  const btnSecondaryClasses = "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {loadingDependencies ? <LoadingSpinner message="Cargando datos..." /> : (
        <div className="space-y-4">
          {products.map((product, _) => (
            <div key={product.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700/30">
              <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center">
                    <input type="checkbox" id={`isNew-${product.id}`} checked={product.isNew} onChange={e => handleProductChange(product.id, 'isNew', e.target.checked)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded" />
                    <label htmlFor={`isNew-${product.id}`} className="ml-2 text-sm font-medium text-gray-800 dark:text-gray-200">Crear Nuevo Producto</label>
                 </div>
                 {products.length > 1 && (
                    <button type="button" onClick={() => handleRemoveProduct(product.id)} className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700/50" title="Eliminar producto">
                        <TrashIcon className="h-5 w-5" />
                    </button>
                 )}
              </div>
              
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-5">
                {product.isNew ? (
                    <>
                        <div className="sm:col-span-3">
                            <label htmlFor={`newDesc-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">Desc. Nuevo Producto <span className="text-red-500">*</span></label>
                            <input type="text" id={`newDesc-${product.id}`} value={product.newProductDescription} onChange={e => handleProductChange(product.id, 'newProductDescription', e.target.value)} required={product.isNew} className={`mt-1 ${inputFieldClasses}`} />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor={`newCat-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría Sugerida <span className="text-red-500">*</span></label>
                            <select id={`newCat-${product.id}`} value={product.newProductCategoryId} onChange={e => handleProductChange(product.id, 'newProductCategoryId', e.target.value)} required={product.isNew} className={`mt-1 ${inputFieldClasses}`}>
                                <option value="">-- Seleccionar Categoría --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                <option value="new" className="font-bold text-primary-600 dark:text-primary-400">-- Crear Nueva Categoría --</option>
                            </select>
                            {product.newProductCategoryId === 'new' && (
                                <div className="mt-2">
                                    <label htmlFor={`newCatName-${product.id}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">Nombre Nueva Categoría <span className="text-red-500">*</span></label>
                                    <input type="text" id={`newCatName-${product.id}`} value={product.newProductNewCategoryName} onChange={e => handleProductChange(product.id, 'newProductNewCategoryName', e.target.value)} required={product.newProductCategoryId === 'new'} className={`mt-1 ${inputFieldClasses}`} placeholder="Ej: Material para Eventos"/>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="sm:col-span-3">
                      <label htmlFor={`product-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">Producto Existente <span className="text-red-500">*</span></label>
                      <select id={`product-${product.id}`} value={product.productId} onChange={(e) => handleProductChange(product.id, 'productId', e.target.value)} required={!product.isNew} className={`mt-1 ${inputFieldClasses}`}>
                        <option value="">-- Seleccionar Producto --</option>
                        {fetchedProducts.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                      </select>
                    </div>
                )}
                
                <div className="sm:col-span-2">
                  <label htmlFor={`quantity-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cantidad <span className="text-red-500">*</span></label>
                  <input type="number" name={`quantity-${product.id}`} id={`quantity-${product.id}`} min="1" value={product.quantity} onChange={(e) => handleProductChange(product.id, 'quantity', e.target.value)} required className={`mt-1 ${inputFieldClasses}`} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={handleAddProduct} className="flex items-center px-3 py-2 border border-dashed border-gray-400 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none">
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              Añadir Otro Ítem
          </button>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-5 border-t dark:border-gray-700">
        <button type="button" onClick={onCancel} className={btnSecondaryClasses} disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className={btnPrimaryClasses} disabled={isSubmitting || loadingDependencies}>
          {isSubmitting ? <><ArrowPathIcon className="animate-spin h-5 w-5 mr-2" /> Enviando...</> : 'Enviar Solicitud'}
        </button>
      </div>
    </form>
  );
};