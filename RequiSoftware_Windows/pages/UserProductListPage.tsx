import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Producto } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { MagnifyingGlassIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

// Se define el tipo de dato esperado de la nueva consulta, que es un producto con su inventario anidado.
type ProductWithInventory = Producto & {
    categoria: { nombre: string } | null;
    inventario: Array<{ existencias: number | null, ubicacion: string }> | null;
};

const UserProductListPage: React.FC = () => {
    const [products, setProducts] = useState<ProductWithInventory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            setError(null);
            try {
                // CORRECCIÓN: Se consulta desde la tabla 'producto' y se hace un LEFT JOIN a 'inventario'.
                // Esto asegura que todos los productos se listen, independientemente de si tienen stock.
                const { data, error: fetchError } = await supabase
                    .from('producto')
                    .select('*, categoria:categoria_id(nombre), inventario!left(*)')
                    .order('descripcion', { ascending: true });
                
                if (fetchError) throw fetchError;
                setProducts(data as ProductWithInventory[] || []);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Error al cargar el catálogo de productos.";
                setError(errorMessage);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const lowercasedFilter = searchTerm.toLowerCase();
        // Se ajusta el filtro a la nueva estructura de datos (propiedades a nivel raíz).
        return products.filter(item =>
            item.descripcion.toLowerCase().includes(lowercasedFilter) ||
            (item.categoria?.nombre && item.categoria.nombre.toLowerCase().includes(lowercasedFilter))
        );
    }, [products, searchTerm]);

    if (loading) return <LoadingSpinner message="Cargando catálogo de productos..." />;
    if (error) return <div className="p-4 text-center text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md shadow">{error}</div>;

    return (
        <div className="p-4 md:p-6 space-y-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Catálogo de Productos</h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    Consulta los productos disponibles y su stock actual en el inventario.
                </p>
            </div>
            
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar por nombre o categoría..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-grow overflow-y-auto -mx-4 md:-mx-6 px-4 md:px-6">
                {filteredProducts.length > 0 ? (
                    <div className="overflow-x-auto shadow-md rounded-lg border dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categoría</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unidad Medida</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Existencias</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ubicación</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredProducts.map(item => (
                                    <tr key={item.id}>
                                        {/* CORRECCIÓN: Se ajusta cómo se accede a los datos para mostrar la información correctamente */}
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.descripcion || 'N/D'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.categoria?.nombre || 'N/D'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.unidad_medida || 'N/D'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-gray-100">{item.inventario?.[0]?.existencias ?? 0}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{item.inventario?.[0]?.ubicacion ?? 'No Almacenado'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10">
                         <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                        <p className="mt-2 text-gray-600 dark:text-gray-400">No se encontraron productos que coincidan con la búsqueda.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProductListPage;