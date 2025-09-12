import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Proveedor } from '../types';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { MagnifyingGlassIcon, GlobeAltIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const UserSupplierListPage: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Proveedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchSuppliers = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error: fetchError } = await supabase
                    .from('proveedor')
                    .select('*, categorias:proveedor_categoria(categoria:categoria_proveedor(id, nombre))')
                    .eq('estado', 'activo')
                    .order('nombre', { ascending: true });

                if (fetchError) throw fetchError;
                setSuppliers(data || []);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Error al cargar los proveedores.";
                setError(errorMessage);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSuppliers();
    }, []);

    const filteredSuppliers = useMemo(() => {
        if (!searchTerm) return suppliers;
        return suppliers.filter(supplier =>
            supplier.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.rif.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (supplier.categorias || []).some(c => c.categoria?.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [suppliers, searchTerm]);

    if (loading) return <LoadingSpinner message="Cargando proveedores..." />;
    if (error) return <div className="p-4 text-center text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-md shadow">{error}</div>;

    return (
        <div className="p-4 md:p-6 space-y-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Consulta de Proveedores</h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                    Aquí puedes ver la lista de proveedores activos y sus especialidades.
                </p>
            </div>
            
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar por nombre, RIF o categoría..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-grow overflow-y-auto -mx-4 md:-mx-6 px-4 md:px-6">
                {filteredSuppliers.length > 0 ? (
                    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredSuppliers.map(supplier => (
                            <li key={supplier.id} className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-full flex flex-col">
                                <div className="flex-grow">
                                    <h3 className="font-semibold text-lg text-primary-700 dark:text-primary-400 truncate" title={supplier.nombre}>{supplier.nombre}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{supplier.rif}</p>

                                    <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-2">
                                        {supplier.telefono && (
                                            <p className="flex items-center"><PhoneIcon className="w-4 h-4 mr-2 text-gray-400" /> {supplier.telefono}</p>
                                        )}
                                        {supplier.correo && (
                                            <p className="flex items-center truncate"><EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400" />
                                                <a href={`mailto:${supplier.correo}`} className="hover:underline truncate">{supplier.correo}</a>
                                            </p>
                                        )}
                                        {supplier.pagina_web && (
                                            <p className="flex items-center truncate"><GlobeAltIcon className="w-4 h-4 mr-2 text-gray-400" />
                                                <a href={supplier.pagina_web} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{supplier.pagina_web}</a>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Categorías</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(supplier.categorias && supplier.categorias.length > 0) ? supplier.categorias.map(c => (
                                            <span key={c.categoria?.id} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-full">
                                                {c.categoria?.nombre}
                                            </span>
                                        )) : <span className="text-xs text-gray-400">Sin categorías asignadas</span>}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-gray-600 dark:text-gray-400">No se encontraron proveedores que coincidan con la búsqueda.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserSupplierListPage;
