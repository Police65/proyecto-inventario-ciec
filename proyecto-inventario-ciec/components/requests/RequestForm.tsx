import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Producto } from '../../types';
import { PlusCircleIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';

interface ProductLine {
  id: string; // ID único para la línea en el frontend
  productId: string; // ID del producto de la base de datos
  quantity: number;
}

interface RequestFormProps {
  onSubmit: (data: { products: ProductLine[] | null; description: string | null, customRequest: boolean }) => void;
  onCancel: () => void;
  isSubmitting: boolean; // Para controlar el estado de envío desde el padre
}

export const RequestForm: React.FC<RequestFormProps> = ({ onSubmit, onCancel, isSubmitting }) => {
  const [products, setProducts] = useState<ProductLine[]>([{ id: uuidv4(), productId: '', quantity: 1 }]);
  const [customRequest, setCustomRequest] = useState(false); // ¿Es una requisición especial (solo descripción)?
  const [description, setDescription] = useState(''); // Descripción para requisiciones especiales
  const [fetchedProducts, setFetchedProducts] = useState<Pick<Producto, 'id' | 'descripcion'>[]>([]); // Lista de productos de la DB
  const [loadingProducts, setLoadingProducts] = useState(false); // Initial state false, set to true only when fetching

  useEffect(() => {
    const fetchProductList = async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase.from('producto').select('id, descripcion');
      if (error) {
        console.error('Error al obtener productos:', error);
      } else {
        setFetchedProducts(data || []);
      }
      setLoadingProducts(false);
    };

    if (!customRequest) {
      fetchProductList();
    } else {
      // If it's a custom request, clear product lines and ensure no loading state for products.
      setProducts([{ id: uuidv4(), productId: '', quantity: 1 }]);
      setLoadingProducts(false);
    }
  }, [customRequest]);

  const handleAddProduct = () => {
    setProducts([...products, { id: uuidv4(), productId: '', quantity: 1 }]);
  };

  const handleRemoveProduct = (id: string) => {
    if (products.length > 1) { // Solo permitir remover si hay más de un producto
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleProductChange = (id: string, field: keyof ProductLine, value: string | number) => {
    setProducts(products.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validaciones antes de enviar
    if (customRequest && !description.trim()) {
      alert('Por favor, ingrese una descripción para la requisición especial.');
      return;
    }
    if (!customRequest && products.some(p => !p.productId || Number(p.quantity) < 1)) {
      alert('Por favor, complete todos los campos de productos correctamente (seleccione un producto y cantidad mayor a 0).');
      return;
    }
    onSubmit({
      products: customRequest ? null : products.map(p => ({...p, quantity: Number(p.quantity)})),
      description: customRequest ? description.trim() : null, // Pasar la descripción principal si es personalizada
      customRequest: customRequest
    });
  };

  const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
  const btnPrimaryClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-300 dark:disabled:bg-primary-800";
  const btnSecondaryClasses = "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="customRequest"
          checked={customRequest}
          onChange={(e) => setCustomRequest(e.target.checked)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
        />
        <label htmlFor="customRequest" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
          ¿Es una Requisición Especial (sin productos específicos)?
        </label>
      </div>

      {customRequest ? (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Descripción para Requisición Especial <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className={`mt-1 ${inputFieldClasses}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required={customRequest}
            placeholder="Especifique detalladamente su requisición especial aquí..."
            onInvalid={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('Por favor, ingrese una descripción para la requisición.')}
            onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {loadingProducts && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                Cargando lista de productos...
            </div>
          )}
          {!loadingProducts && products.map((product, _) => (
            <div key={product.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700/30">
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor={`product-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Producto <span className="text-red-500">*</span>
                  </label>
                  <select
                    id={`product-${product.id}`}
                    name={`product-${product.id}`}
                    value={product.productId}
                    onChange={(e) => handleProductChange(product.id, 'productId', e.target.value)}
                    required={!customRequest}
                    className={`mt-1 ${inputFieldClasses}`}
                    onInvalid={(e) => (e.target as HTMLSelectElement).setCustomValidity('Por favor, seleccione un producto.')}
                    onInput={(e) => (e.target as HTMLSelectElement).setCustomValidity('')}
                  >
                    <option value="">-- Seleccionar Producto --</option>
                    {fetchedProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={`quantity-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name={`quantity-${product.id}`}
                    id={`quantity-${product.id}`}
                    min="1"
                    value={product.quantity}
                    onChange={(e) => handleProductChange(product.id, 'quantity', e.target.value)}
                    required={!customRequest}
                    className={`mt-1 ${inputFieldClasses}`}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingrese una cantidad válida (mayor a 0).')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  />
                </div>
                
                {products.length > 1 && (
                  <div className="sm:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(product.id)}
                      className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700/50 transition-colors"
                      title="Eliminar producto"
                    >
                      <TrashIcon className="h-5 w-5" />
                      <span className="sr-only">Eliminar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!loadingProducts && (
            <button
                type="button"
                onClick={handleAddProduct}
                className="flex items-center px-3 py-2 border border-dashed border-gray-400 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none"
            >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Añadir Producto
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-5 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className={btnSecondaryClasses}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={btnPrimaryClasses}
          disabled={isSubmitting || loadingProducts}
        >
          {isSubmitting ? (
            <>
              <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
              Enviando...
            </>
          ) : 'Enviar Solicitud'}
        </button>
      </div>
    </form>
  );
};