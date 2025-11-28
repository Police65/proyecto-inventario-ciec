import React, { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseAdmin } from '../../supabaseClient';
import { Empleado, UserProfile, Cargo, Departamento, EmpleadoCargoHistorial, UserProfileRol, EmpleadoEstado, Database } from '../../types';
import { PlusCircleIcon, PencilIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, TrashIcon, NoSymbolIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { AuthError, User } from '@supabase/supabase-js'; 

const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-70 dark:disabled:opacity-50";
const btnPrimaryClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-400 dark:disabled:bg-primary-700 disabled:cursor-not-allowed";
const btnSecondaryClasses = "flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-70 dark:disabled:opacity-50 disabled:cursor-not-allowed";
const btnDangerClasses = "flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-red-400 dark:disabled:bg-red-700 disabled:cursor-not-allowed";

type EmpleadoWithProfile = Empleado & {
  user_profile?: Partial<UserProfile> | null;
};

type FormData = Partial<EmpleadoWithProfile> & 
  Omit<Partial<UserProfile>, 'id' | 'departamento'> & 
  { 
    password?: string; 
    email?: string;
  };

export const UserManagement: React.FC = () => {
  const [empleados, setEmpleados] = useState<EmpleadoWithProfile[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({});
  
  const [submitting, setSubmitting] = useState(false);
  
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<number, boolean>>({});

  const [showPassword, setShowPassword] = useState(false);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      // Usar supabaseAdmin para obtener la lista de usuarios con sus correos
      const { data: authUsersResponse, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
      if (authUsersError) throw authUsersError;
      const authUsersMap = new Map<string, User>();
      authUsersResponse.users.forEach(u => authUsersMap.set(u.id, u));

      const { data: empData, error: empError } = await supabase
        .from('empleado')
        .select('*, cargo:cargo_actual_id(id, nombre), departamento:departamento_id(id, nombre)')
        .order('apellido', { ascending: true });
      if (empError) throw empError;

      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profile')
        .select('id, rol, empleado_id, departamento_id')
        .returns<Pick<UserProfile, 'id' | 'rol' | 'empleado_id' | 'departamento_id'>[]>();
      if (profilesError) throw profilesError;
      
      const profilesMap = new Map<number, Partial<UserProfile>>();
      (profilesData || []).forEach(p => { 
        if (p.empleado_id) {
            const authUser = authUsersMap.get(p.id);
            profilesMap.set(p.empleado_id, { ...p, email: authUser?.email });
        }
      });
      
      const processedEmpData: EmpleadoWithProfile[] = (empData || []).map(emp => {
        const profile = emp.id ? profilesMap.get(emp.id) : undefined;
        return {
          ...emp,
          cargo: emp.cargo as Cargo | undefined,
          departamento: emp.departamento as Pick<Departamento, 'id' | 'nombre'> | undefined,
          user_profile: profile ? { ...profile } : null,
        } as EmpleadoWithProfile;
      });
      
      setEmpleados(processedEmpData);

      const { data: cargosData, error: cargosError } = await supabase.from('cargo').select('*').order('nombre');
      if (cargosError) throw cargosError;
      setCargos(cargosData || []);

      const { data: deptosData, error: deptosError } = await supabase.from('departamento').select('*').order('nombre');
      if (deptosError) throw deptosError;
      setDepartamentos(deptosData || []);

    } catch (error) {
        const typedError = error as AuthError;
        let message = `Error al cargar datos: ${typedError.message || 'Error desconocido.'}`;
        if (typedError.message.includes("service_role key")) {
            message += "\n\nNOTA: Para listar usuarios se requiere una clave de 'service_role' en la configuración de Supabase. El resto de la funcionalidad puede operar con la clave anónima, pero la visualización de emails de usuarios fallará.";
        }
        console.error(message, typedError);
        setFeedbackMessage(message); setFeedbackType('error'); setShowFeedbackModal(true);
    }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['cargo_actual_id', 'departamento_id'].includes(name) ? (value ? Number(value) : null) : value }));
  };

  const validatePassword = (password: string): string | null => {
    const errors: string[] = [];
    if (password.length < 6) {
      errors.push("Debe tener al menos 6 caracteres.");
    }
    // Añadir más validaciones si es necesario
    return errors.length > 0 ? errors.join(" ") : null;
  };

  const openModal = (emp?: EmpleadoWithProfile) => {
    setFeedbackMessage('');
    setShowFeedbackModal(false);
    if (emp) {
      setIsEditing(true);
      setFormData({
        ...emp,
        rol: emp.user_profile?.rol || 'usuario',
        email: emp.user_profile?.email || '',
        password: '', 
      });
    } else {
      setIsEditing(false);
      setFormData({
        estado: 'activo',
        rol: 'usuario',
        departamento_id: departamentos.length > 0 ? departamentos[0].id : undefined,
        cargo_actual_id: cargos.length > 0 ? cargos[0].id : undefined,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMessage('');

    try {
        if (!formData.nombre || !formData.apellido || !formData.cedula || !formData.departamento_id || !formData.cargo_actual_id) {
            throw new Error("Por favor complete todos los campos obligatorios del empleado.");
        }

        if (formData.password && !isEditing) {
             const passError = validatePassword(formData.password);
             if (passError) throw new Error(`Contraseña inválida: ${passError}`);
        }

        let empleadoId = formData.id;

        // 1. Crear o Actualizar Empleado
        const empleadoPayload = {
            nombre: formData.nombre,
            apellido: formData.apellido,
            cedula: formData.cedula,
            telefono: formData.telefono,
            cargo_actual_id: formData.cargo_actual_id,
            departamento_id: formData.departamento_id,
            estado: formData.estado || 'activo',
        };

        if (isEditing && empleadoId) {
            const { error: empError } = await supabase.from('empleado').update(empleadoPayload).eq('id', empleadoId);
            if (empError) throw empError;
        } else {
            const { data: newEmp, error: empError } = await supabase.from('empleado').insert(empleadoPayload).select().single();
            if (empError) throw empError;
            empleadoId = newEmp.id;
        }

        // 2. Gestionar Usuario de Autenticación (Si se proporciona email)
        if (formData.email) {
            let userId = formData.user_profile?.id;

            if (isEditing && userId && formData.password) {
                 // Actualizar contraseña si se proporcionó una nueva
                 const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: formData.password });
                 if (updateAuthError) throw updateAuthError;
            } else if (!isEditing && formData.password) {
                // Crear nuevo usuario de Auth
                const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
                    email: formData.email,
                    password: formData.password,
                    email_confirm: true
                });
                if (createAuthError) throw createAuthError;
                userId = authData.user.id;
            }

            // 3. Crear o Actualizar Perfil de Usuario (Vincular Auth y Empleado)
            if (userId) {
                const profilePayload = {
                    id: userId,
                    empleado_id: empleadoId,
                    departamento_id: formData.departamento_id,
                    rol: formData.rol || 'usuario',
                };
                
                // Usar upsert para manejar tanto creación como actualización del perfil
                const { error: profileError } = await supabase.from('user_profile').upsert(profilePayload);
                if (profileError) throw profileError;
            }
        }

        setFeedbackMessage(isEditing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
        setFeedbackType('success');
        setShowFeedbackModal(true);
        setIsModalOpen(false);
        fetchData();

    } catch (error) {
        console.error("Error submitting user form:", error);
        setFeedbackMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        setFeedbackType('error');
        setShowFeedbackModal(true);
    } finally {
        setSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: EmpleadoWithProfile) => {
      if (!emp.id) return;
      const newStatus = emp.estado === 'activo' ? 'inactivo' : 'activo';
      setActionLoadingMap(prev => ({ ...prev, [emp.id]: true }));
      
      try {
          const { error } = await supabase.from('empleado').update({ estado: newStatus }).eq('id', emp.id);
          if (error) throw error;
          fetchData();
      } catch (error) {
          console.error("Error toggling status:", error);
          alert("Error al cambiar el estado del empleado.");
      } finally {
          setActionLoadingMap(prev => ({ ...prev, [emp.id]: false }));
      }
  };

  const filteredEmpleados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cedula.includes(searchTerm)
  );

  if (loadingData) return <LoadingSpinner message="Cargando usuarios..." />;

  return (
    <div>
        {/* Feedback Modal */}
        {showFeedbackModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full border-t-4 ${feedbackType === 'success' ? 'border-green-500' : 'border-red-500'}`}>
                    <div className="flex items-center mb-4">
                        {feedbackType === 'success' ? <CheckCircleIcon className="w-8 h-8 text-green-500 mr-3"/> : <ExclamationTriangleIcon className="w-8 h-8 text-red-500 mr-3"/>}
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feedbackType === 'success' ? 'Éxito' : 'Error'}</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">{feedbackMessage}</p>
                    <button onClick={() => setShowFeedbackModal(false)} className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-md transition-colors">Cerrar</button>
                </div>
            </div>
        )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Usuarios y Empleados</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <input type="text" placeholder="Buscar..." className={`${inputFieldClasses} flex-grow`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <button onClick={() => openModal()} className={btnPrimaryClasses}>
                <PlusCircleIcon className="w-5 h-5 mr-2" /> Añadir Usuario
            </button>
        </div>
      </div>

      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cédula</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cargo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Departamento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email (Acceso)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmpleados.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{emp.nombre} {emp.apellido}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{emp.cedula}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{emp.cargo?.nombre || 'N/D'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{emp.departamento?.nombre || 'N/D'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{emp.user_profile?.email || <span className="text-gray-400 italic">Sin acceso</span>}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {emp.user_profile?.rol ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${emp.user_profile.rol === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                            {emp.user_profile.rol}
                        </span>
                    ) : '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${emp.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                        {emp.estado}
                    </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                  <button onClick={() => openModal(emp)} className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300" title="Editar">
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleToggleStatus(emp)} disabled={!!actionLoadingMap[emp.id]} className={`${emp.estado === 'activo' ? 'text-red-600 hover:text-red-900 dark:text-red-400' : 'text-green-600 hover:text-green-900 dark:text-green-400'}`} title={emp.estado === 'activo' ? "Desactivar" : "Activar"}>
                    {actionLoadingMap[emp.id] ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : (emp.estado === 'activo' ? <NoSymbolIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />)}
                  </button>
                </td>
              </tr>
            ))}
            {filteredEmpleados.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron empleados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{isEditing ? 'Editar' : 'Añadir'} Usuario / Empleado</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre <span className="text-red-500">*</span></label>
                        <input type="text" name="nombre" value={formData.nombre || ''} onChange={handleFormChange} required className={inputFieldClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apellido <span className="text-red-500">*</span></label>
                        <input type="text" name="apellido" value={formData.apellido || ''} onChange={handleFormChange} required className={inputFieldClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cédula <span className="text-red-500">*</span></label>
                        <input type="text" name="cedula" value={formData.cedula || ''} onChange={handleFormChange} required className={inputFieldClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                        <input type="text" name="telefono" value={formData.telefono || ''} onChange={handleFormChange} className={inputFieldClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento <span className="text-red-500">*</span></label>
                        <select name="departamento_id" value={formData.departamento_id || ''} onChange={handleFormChange} required className={inputFieldClasses}>
                            <option value="">Seleccionar...</option>
                            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cargo <span className="text-red-500">*</span></label>
                        <select name="cargo_actual_id" value={formData.cargo_actual_id || ''} onChange={handleFormChange} required className={inputFieldClasses}>
                            <option value="">Seleccionar...</option>
                            {cargos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">Acceso al Sistema</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (Usuario)</label>
                            <input type="email" name="email" value={formData.email || ''} onChange={handleFormChange} className={inputFieldClasses} placeholder="Para acceso al sistema" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rol</label>
                            <select name="rol" value={formData.rol || 'usuario'} onChange={handleFormChange} className={inputFieldClasses}>
                                <option value="usuario">Usuario</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {isEditing ? 'Nueva Contraseña (Dejar en blanco para no cambiar)' : 'Contraseña'}
                            </label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    name="password" 
                                    value={formData.password || ''} 
                                    onChange={handleFormChange} 
                                    className={`${inputFieldClasses} pr-10`}
                                    placeholder={isEditing ? "********" : "Mínimo 6 caracteres"}
                                    required={!isEditing && !!formData.email} // Requerido solo si se crea nuevo usuario con email
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
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