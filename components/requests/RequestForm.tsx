
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
  const [loadingProducts, setLoadingProducts] = useState(true);

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
    if (!customRequest) { // Solo obtener si no es una requisición especial inicialmente
      fetchProductList();
    } else {
      setLoadingProducts(false); // No se necesita cargar productos para requisiciones especiales
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
    if (!customRequest && products.some(p => !p.productId || p.quantity < 1)) {
      alert('Por favor, complete todos los campos de productos correctamente (seleccione un producto y cantidad mayor a 0).');
      return;
    }
    onSubmit({
      products: customRequest ? null : products.map(p => ({...p, quantity: Number(p.quantity)})),
      description: customRequest ? description.trim() : null, // Pasar la descripción principal si es personalizada
      customRequest: customRequest
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="customRequest"
          checked={customRequest}
          onChange={(e) => setCustomRequest(e.target.checked)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
        />
        <label htmlFor="customRequest" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Requisición Especial (solo descripción, sin productos específicos)
        </label>
      </div>

      {customRequest ? (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Descripción de la Requisición <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle su necesidad aquí. Ej: 'Servicio de mantenimiento para aire acondicionado central', 'Materiales varios para evento de marketing'"
            required
          />
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Productos</h3>
          {loadingProducts ? <p className="text-sm text-gray-500 dark:text-gray-400">Cargando lista de productos...</p> : (
            products.map((product, index) => (
            <div key={product.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3 bg-gray-50 dark:bg-gray-700/30">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-3 items-end">
                <div className="sm:col-span-6">
                  <label htmlFor={`product-${product.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Producto <span className="text-red-500">*</span>
                  </label>
                  <select
                    id={`product-${product.id}`}
                    value={product.productId}
                    onChange={(e) => handleProductChange(product.id, 'productId', e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Seleccione un producto</option>
                    {fetchedProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor={`quantity-${product.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id={`quantity-${product.id}`}
                    value={product.quantity}
                    onChange={(e) => handleProductChange(product.id, 'quantity', parseInt(e.target.value) || 1)}
                    min="1"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-3 flex items-end">
                  {products.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(product.id)}
                      className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-700/50 w-full sm:w-auto transition-colors"
                      title="Eliminar producto"
                    >
                      <TrashIcon className="w-5 h-5 mx-auto sm:mx-0" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            ))
          )}
          <button
            type="button"
            onClick={handleAddProduct}
            disabled={loadingProducts}
            className="mt-2 flex items-center px-3 py-2 border border-dashed border-gray-400 dark:border-gray-500 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none disabled:opacity-50"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Añadir Producto
          </button>
        </div>
      )}

      <div className="pt-6 border-t dark:border-gray-700 flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || loadingProducts}
          className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {isSubmitting && <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />}
          {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
        </button>
      </div>
    </form>
  );
};
