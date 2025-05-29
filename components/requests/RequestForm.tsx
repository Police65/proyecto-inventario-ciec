import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Producto } from '../../types';
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';

interface ProductLine {
  id: string;
  productId: string;
  quantity: number;
}

interface RequestFormProps {
  onSubmit: (data: { products: ProductLine[] | null; description: string | null, customRequest: boolean }) => void;
  onCancel: () => void;
}

const RequestForm: React.FC<RequestFormProps> = ({ onSubmit, onCancel }) => {
  const [products, setProducts] = useState<ProductLine[]>([{ id: uuidv4(), productId: '', quantity: 1 }]);
  const [customRequest, setCustomRequest] = useState(false);
  const [description, setDescription] = useState('');
  const [fetchedProducts, setFetchedProducts] = useState<Producto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchProductList = async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase.from('producto').select('id, descripcion');
      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setFetchedProducts(data || []);
      }
      setLoadingProducts(false);
    };
    fetchProductList();
  }, []);

  const handleAddProduct = () => {
    setProducts([...products, { id: uuidv4(), productId: '', quantity: 1 }]);
  };

  const handleRemoveProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleProductChange = (id: string, field: keyof ProductLine, value: string | number) => {
    setProducts(products.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (customRequest && !description.trim()) {
      alert('Por favor, ingrese una descripción para la requisición especial.');
      return;
    }
    if (!customRequest && products.some(p => !p.productId || p.quantity < 1)) {
      alert('Por favor, complete todos los campos de productos correctamente (seleccione un producto y cantidad mayor a 0).');
      return;
    }
    onSubmit({
      products: customRequest ? null : products.map(p => ({...p, quantity: Number(p.quantity)})), // ensure quantity is number
      description: customRequest ? description : null,
      customRequest: customRequest
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!customRequest && (
        <div className="space-y-4">
          {products.map((product, index) => (
            <div key={product.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <div className="flex-grow">
                <label htmlFor={`product-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Producto
                </label>
                <select
                  id={`product-${product.id}`}
                  value={product.productId}
                  onChange={(e) => handleProductChange(product.id, 'productId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required={!customRequest}
                >
                  <option value="">{loadingProducts ? "Cargando..." : "Seleccionar producto"}</option>
                  {fetchedProducts.map((prod) => (
                    <option key={prod.id} value={prod.id.toString()}>{prod.descripcion}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label htmlFor={`quantity-${product.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  id={`quantity-${product.id}`}
                  value={product.quantity}
                  onChange={(e) => handleProductChange(product.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required={!customRequest}
                />
              </div>
              {products.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveProduct(product.id)}
                  className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 self-end mb-0.5"
                  title="Eliminar producto"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddProduct}
            disabled={customRequest}
            className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Añadir Producto
          </button>
        </div>
      )}

      <div className="flex items-center">
        <input
          id="customRequest"
          name="customRequest"
          type="checkbox"
          checked={customRequest}
          onChange={(e) => setCustomRequest(e.target.checked)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700"
        />
        <label htmlFor="customRequest" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
          Requisición especial (describir abajo)
        </label>
      </div>

      {customRequest && (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Descripción de la Requisición Especial
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            required={customRequest}
          />
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Enviar Solicitud
        </button>
      </div>
    </form>
  );
};

export default RequestForm;
    