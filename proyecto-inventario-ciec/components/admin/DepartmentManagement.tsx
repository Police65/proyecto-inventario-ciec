import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Departamento } from '../../types';
import { PlusCircleIcon, PencilIcon, ArrowPathIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
const btnPrimaryClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-400 dark:disabled:bg-primary-700 disabled:cursor-not-allowed";
const btnSecondaryClasses = "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-70 dark:disabled:opacity-50 disabled:cursor-not-allowed";

type FormData = Partial<Departamento>;

const DepartmentManagement: React.FC = () => {
    const [departments, setDepartments] = useState<Departamento[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<FormData>({});
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setLoadingData(true);
        try {
            const { data, error: fetchError } = await supabase.from('departamento').select('*').order('nombre');
            if (fetchError) throw fetchError;
            setDepartments(data || []);
        } catch (err) {
            console.error('Error fetching departments:', err);
            setError('No se pudieron cargar los departamentos.');
        } finally {
            setLoadingData(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openModal = (dept?: Departamento) => {
        setError(null);
        if (dept) {
            setIsEditing(true);
            setFormData(dept);
        } else {
            setIsEditing(false);
            setFormData({ nombre: '', estado: 'activo' });
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.nombre?.trim()) {
            setError('El nombre del departamento es obligatorio.');
            return;
        }
        setSubmitting(true);
        setError(null);

        const departmentPayload = {
            nombre: formData.nombre.trim(),
            estado: formData.estado || 'activo',
        };

        try {
            if (isEditing && formData.id) {
                const { error: updateError } = await supabase.from('departamento').update(departmentPayload).eq('id', formData.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase.from('departamento').insert(departmentPayload);
                if (insertError) throw insertError;
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            const supabaseError = err as { code?: string; message: string };
            if (supabaseError.code === '23505') {
                setError('Error: Ya existe un departamento con ese nombre.');
            } else {
                setError(`Error al guardar el departamento: ${supabaseError.message}`);
            }
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleToggleStatus = async (dept: Departamento) => {
        const newStatus = dept.estado === 'activo' ? 'inactivo' : 'activo';
        if (newStatus === 'inactivo') {
            if (!window.confirm(`¿Está seguro de que desea desactivar el departamento "${dept.nombre}"?`)) return;

            // Check if any active employees are assigned to this department
            setActionLoading(dept.id);
            const { count, error: checkError } = await supabase
                .from('empleado')
                .select('*', { count: 'exact', head: true })
                .eq('departamento_id', dept.id)
                .eq('estado', 'activo');
            
            if (checkError) {
                alert(`Error al verificar empleados: ${checkError.message}`);
                setActionLoading(null);
                return;
            }

            if (count && count > 0) {
                alert(`No se puede desactivar el departamento "${dept.nombre}" porque tiene ${count} empleado(s) activo(s) asignado(s).`);
                setActionLoading(null);
                return;
            }
        }

        try {
            const { error: updateError } = await supabase.from('departamento').update({ estado: newStatus }).eq('id', dept.id);
            if (updateError) throw updateError;
            fetchData();
        } catch (err) {
            alert(`Error al cambiar el estado: ${(err as Error).message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredDepartments = departments.filter(d => d.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loadingData) return <LoadingSpinner message="Cargando departamentos..." />;

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Departamentos</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input type="text" placeholder="Buscar departamento..." className={`${inputFieldClasses} flex-grow`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <button onClick={() => openModal()} className={btnPrimaryClasses}>
                        <PlusCircleIcon className="w-5 h-5 mr-2" /> Añadir Depto.
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredDepartments.map(dept => (
                            <tr key={dept.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{dept.nombre}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <button onClick={() => handleToggleStatus(dept)} disabled={actionLoading === dept.id}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-full cursor-pointer ${dept.estado === 'activo' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100 hover:bg-green-200' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100 hover:bg-red-200'} disabled:opacity-50`}
                                        title={`Cambiar a ${dept.estado === 'activo' ? 'inactivo' : 'activo'}`}>
                                        {actionLoading === dept.id ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : dept.estado}
                                    </button>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                                    <button onClick={() => openModal(dept)} className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700" title="Editar">
                                        <PencilIcon className="w-4 h-4"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredDepartments.length === 0 && (
                            <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron departamentos.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-60 p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{isEditing ? 'Editar' : 'Añadir'} Departamento</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <p className="text-sm text-red-500">{error}</p>}
                            <div>
                                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre <span className="text-red-500">*</span></label>
                                <input type="text" name="nombre" id="nombre" value={formData.nombre || ''} onChange={handleFormChange} required className={`mt-1 ${inputFieldClasses}`} />
                            </div>
                            <div>
                                <label htmlFor="estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                                <select name="estado" id="estado" value={formData.estado || 'activo'} onChange={handleFormChange} className={`mt-1 ${inputFieldClasses}`}>
                                    <option value="activo">Activo</option>
                                    <option value="inactivo">Inactivo</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className={btnSecondaryClasses} disabled={submitting}>Cancelar</button>
                                <button type="submit" className={btnPrimaryClasses} disabled={submitting}>
                                    {submitting && <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />}
                                    {submitting ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentManagement;