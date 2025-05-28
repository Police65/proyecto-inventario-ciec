import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Empleado, UserProfile, Cargo, Departamento, EmpleadoCargoHistorial, UserProfileRol, EmpleadoEstado } from '../../types';
import { PlusCircleIcon, PencilIcon, TrashIcon, EyeIcon, UserPlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

// Define a more specific type for the raw employee data from the query
// User profile will be joined manually.
interface RawEmpleadoFromQuery extends Omit<Empleado, 'user_profile' | 'cargo' | 'departamento'> {
  cargo: Pick<Cargo, 'id' | 'nombre'> | null;
  departamento: Pick<Departamento, 'id' | 'nombre'> | null;
}

// Define Tailwind classes for reuse
const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
const btnPrimaryClasses = "px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm";
const btnSecondaryClasses = "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none";


const UserManagement: React.FC = () => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEmpleado, setCurrentEmpleado] = useState<Partial<Empleado>>({});
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedEmpleadoForProfile, setSelectedEmpleadoForProfile] = useState<Empleado | null>(null);
  const [profileFormData, setProfileFormData] = useState<{ email: string; password?: string; rol: UserProfileRol; departamento_id?: number | null }>({ email: '', rol: 'usuario' });

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [cargoHistorial, setCargoHistorial] = useState<EmpleadoCargoHistorial[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: empData, error: empError } = await supabase
        .from('empleado')
        .select('*, cargo:cargo_actual_id(id, nombre), departamento:departamento_id(id, nombre)')
        .order('apellido', { ascending: true })
        .returns<RawEmpleadoFromQuery[]>(); 
      if (empError) throw empError;

      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profile')
        .select('id, rol, empleado_id');
      if (profilesError) throw profilesError;
      
      const profilesMap = new Map<number, Pick<UserProfile, 'id' | 'rol'>>();
      if (profilesData) {
        profilesData.forEach(profile => {
          if (profile.empleado_id) {
            profilesMap.set(profile.empleado_id, { id: profile.id, rol: profile.rol as UserProfileRol });
          }
        });
      }

      const processedEmpData = (empData || []).map(rawEmp => {
        const user_profile_data = rawEmp.id ? profilesMap.get(rawEmp.id) : undefined;
        // Ensure the user_profile object matches the UserProfile type structure or is null
        const user_profile_for_emp: UserProfile | null = user_profile_data 
            ? { 
                id: user_profile_data.id, 
                rol: user_profile_data.rol, 
                // empleado_id and departamento_id could be added if fetched and needed for UserProfile type
                empleado_id: rawEmp.id, 
              } 
            : null;

        return {
          ...rawEmp,
          cargo: rawEmp.cargo as Cargo | null | undefined, 
          departamento: rawEmp.departamento as Departamento | null | undefined,
          user_profile: user_profile_for_emp,
        };
      });
      
      setEmpleados(processedEmpData as Empleado[]);

      const { data: cargosData, error: cargosError } = await supabase.from('cargo').select('*');
      if (cargosError) throw cargosError;
      setCargos(cargosData || []);

      const { data: deptosData, error: deptosError } = await supabase.from('departamento').select('*');
      if (deptosError) throw deptosError;
      setDepartamentos(deptosData || []);

    } catch (error) {
      const typedError = error as { message: string, details?: string, code?: string, hint?: string };
      let consoleErrorMessage = 'Error fetching user management data:';
      if (typedError.message) {
        consoleErrorMessage += ` Message: ${typedError.message}`;
        if (typedError.details) consoleErrorMessage += ` Details: ${typedError.details}`;
        if (typedError.code) consoleErrorMessage += ` Code: ${typedError.code}`;
        if (typedError.hint) consoleErrorMessage += ` Hint: ${typedError.hint}`;
        console.error(consoleErrorMessage, typedError);
      } else {
        console.error('Error fetching user management data (unknown structure):', error);
      }
      alert('Error al cargar datos de usuarios. Revise la consola para más detalles.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentEmpleado(prev => ({ ...prev, [name]: name === 'cargo_actual_id' || name === 'departamento_id' ? Number(value) : value }));
  };
  
  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({ ...prev, [name]: name === 'departamento_id' ? (value ? Number(value) : null) : value }));
  };

  const handleEmpleadoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentEmpleado.nombre || !currentEmpleado.apellido || !currentEmpleado.cedula || !currentEmpleado.cargo_actual_id || !currentEmpleado.departamento_id) {
      alert('Todos los campos del empleado son obligatorios.');
      return;
    }
    const empleadoData = {
      nombre: currentEmpleado.nombre,
      apellido: currentEmpleado.apellido,
      cedula: currentEmpleado.cedula,
      cargo_actual_id: Number(currentEmpleado.cargo_actual_id),
      departamento_id: Number(currentEmpleado.departamento_id),
      estado: currentEmpleado.estado || 'activo',
      firma: currentEmpleado.firma || null,
    };

    try {
      if (isEditing && currentEmpleado.id) {
        const { error } = await supabase.from('empleado').update(empleadoData).eq('id', currentEmpleado.id);
        if (error) throw error;
      } else {
        const { data: newEmp, error } = await supabase.from('empleado').insert(empleadoData).select().single();
        if (error) throw error;
        if (newEmp && newEmp.cargo_actual_id) { // Add to history
            await supabase.from('empleadocargohistorial').insert({
                empleado_id: newEmp.id,
                cargo_id: newEmp.cargo_actual_id,
                fecha_inicio: new Date().toISOString().split('T')[0],
            });
        }
      }
      setShowModal(false);
      setCurrentEmpleado({});
      fetchData();
    } catch (error) {
      alert(`Error guardando empleado: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmpleadoForProfile || !profileFormData.email || !profileFormData.rol || !profileFormData.departamento_id) {
      alert('Email, rol y departamento son obligatorios para el perfil.');
      return;
    }
    if (!profileFormData.password || profileFormData.password.length < 6) {
        alert('La contraseña es obligatoria y debe tener al menos 6 caracteres.');
        return;
    }

    try {
      // 1. Create Supabase Auth user
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: profileFormData.email,
        password: profileFormData.password, // Ensure password meets requirements
      });
      if (authError) throw authError;
      if (!authUser.user) throw new Error("No se pudo crear el usuario de autenticación.");

      // 2. Create user_profile linked to auth user and empleado
      const profileData = {
        id: authUser.user.id, // Link to auth.users.id
        empleado_id: selectedEmpleadoForProfile.id,
        departamento_id: Number(profileFormData.departamento_id),
        rol: profileFormData.rol,
      };
      const { error: profileError } = await supabase.from('user_profile').insert(profileData);
      if (profileError) {
        // Attempt to clean up auth user if profile creation fails
        // await supabase.auth.admin.deleteUser(authUser.user.id); // Requires admin privileges
        console.error("Error creating profile, auth user might need manual cleanup:", profileError);
        throw profileError;
      }
      setShowProfileModal(false);
      setSelectedEmpleadoForProfile(null);
      setProfileFormData({ email: '', rol: 'usuario' });
      fetchData();
    } catch (error) {
      alert(`Error creando perfil de usuario: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleToggleEstado = async (empleado: Empleado) => {
    const newEstado: EmpleadoEstado = empleado.estado === 'activo' ? 'inactivo' : 'activo';
    if (window.confirm(`¿Seguro que desea cambiar el estado de ${empleado.nombre} a ${newEstado}?`)) {
      try {
        const { error } = await supabase.from('empleado').update({ estado: newEstado }).eq('id', empleado.id);
        if (error) throw error;
        fetchData();
      } catch (error) {
        alert('Error al cambiar estado del empleado.');
      }
    }
  };

  const handleViewHistory = async (empleadoId: number) => {
    try {
        const { data, error } = await supabase
            .from('empleadocargohistorial')
            .select('*, cargo:cargo_id(nombre)')
            .eq('empleado_id', empleadoId)
            .order('fecha_inicio', { ascending: false });
        if (error) throw error;
        setCargoHistorial(data || []);
        setShowHistoryModal(true);
    } catch (error) {
        alert('Error al cargar historial de cargos.');
    }
  };

  const openAddEmpleadoModal = () => { setIsEditing(false); setCurrentEmpleado({}); setShowModal(true); };
  const openAddProfileModal = (empleado: Empleado) => { 
    setSelectedEmpleadoForProfile(empleado); 
    setProfileFormData({ email: '', rol: 'usuario', departamento_id: empleado.departamento_id }); // Pre-fill department
    setShowProfileModal(true); 
  };

  const filteredEmpleados = empleados.filter(emp =>
    `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cedula.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cargo?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.departamento?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner message="Cargando usuarios..." />;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Empleados y Usuarios</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
                type="text"
                placeholder="Buscar empleado..."
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-grow"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={openAddEmpleadoModal} className={`flex items-center ${btnPrimaryClasses}`}>
                <PlusCircleIcon className="w-5 h-5 mr-2" /> Añadir Empleado
            </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['ID', 'Cédula', 'Nombre', 'Apellido', 'Cargo', 'Departamento', 'Estado', 'Perfil Usuario', 'Rol', 'Acciones'].map(header => (
                <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmpleados.map(emp => (
              <tr key={emp.id}>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{emp.id}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.cedula}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{emp.nombre}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{emp.apellido}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.cargo?.nombre || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.departamento?.nombre || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>
                    {emp.estado}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.user_profile ? 'Sí' : 'No'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.user_profile?.rol || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium space-x-1">
                  <button onClick={() => { setIsEditing(true); setCurrentEmpleado(emp); setShowModal(true);}} className="p-1 text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300" title="Editar Empleado"><PencilIcon className="w-4 h-4"/></button>
                  {!emp.user_profile && <button onClick={() => openAddProfileModal(emp)} className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" title="Crear Perfil Usuario"><UserPlusIcon className="w-4 h-4"/></button>}
                  <button onClick={() => handleToggleEstado(emp)} className={`p-1 ${emp.estado === 'activo' ? 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300' : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300'}`} title={emp.estado === 'activo' ? 'Inactivar' : 'Activar'}><TrashIcon className="w-4 h-4"/></button>
                  <button onClick={() => emp.id && handleViewHistory(emp.id)} className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Ver Historial Cargos"><EyeIcon className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
             {filteredEmpleados.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron empleados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para Empleado */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{isEditing ? 'Editar' : 'Añadir'} Empleado</h3>
                <form onSubmit={handleEmpleadoSubmit} className="space-y-4">
                    {/* Campos del formulario de empleado (nombre, apellido, cédula, cargo, depto, estado, firma) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
                            <input type="text" name="nombre" id="nombre" value={currentEmpleado.nombre || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}/>
                        </div>
                        <div>
                            <label htmlFor="apellido" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apellido</label>
                            <input type="text" name="apellido" id="apellido" value={currentEmpleado.apellido || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}/>
                        </div>
                         <div>
                            <label htmlFor="cedula" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cédula</label>
                            <input type="text" name="cedula" id="cedula" value={currentEmpleado.cedula || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}/>
                        </div>
                        <div>
                            <label htmlFor="cargo_actual_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cargo</label>
                            <select name="cargo_actual_id" id="cargo_actual_id" value={currentEmpleado.cargo_actual_id || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}>
                                <option value="">Seleccionar Cargo</option>
                                {cargos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="departamento_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento</label>
                            <select name="departamento_id" id="departamento_id" value={currentEmpleado.departamento_id || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}>
                                <option value="">Seleccionar Departamento</option>
                                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                            <select name="estado" id="estado" value={currentEmpleado.estado || 'activo'} onChange={handleInputChange} className={`mt-1 ${inputFieldClasses}`}>
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                            </select>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="firma" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Firma (URL o texto)</label>
                        <input type="text" name="firma" id="firma" value={currentEmpleado.firma || ''} onChange={handleInputChange} className={`mt-1 ${inputFieldClasses}`}/>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={() => setShowModal(false)} className={btnSecondaryClasses}>Cancelar</button>
                        <button type="submit" className={btnPrimaryClasses}>Guardar Empleado</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Modal para Perfil de Usuario */}
      {showProfileModal && selectedEmpleadoForProfile && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Crear Perfil de Usuario para {selectedEmpleadoForProfile.nombre}</h3>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="emailP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input type="email" name="email" id="emailP" value={profileFormData.email} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}/>
                    </div>
                    <div>
                        <label htmlFor="passwordP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
                        <input type="password" name="password" id="passwordP" placeholder="Mínimo 6 caracteres" onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}/>
                    </div>
                     <div>
                        <label htmlFor="departamento_idP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento (Perfil)</label>
                        <select name="departamento_id" id="departamento_idP" value={profileFormData.departamento_id || ''} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}>
                            <option value="">Seleccionar Departamento</option>
                            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="rolP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rol</label>
                        <select name="rol" id="rolP" value={profileFormData.rol} onChange={handleProfileFormChange} className={`mt-1 ${inputFieldClasses}`}>
                            <option value="usuario">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={() => setShowProfileModal(false)} className={btnSecondaryClasses}>Cancelar</button>
                        <button type="submit" className={btnPrimaryClasses}>Crear Perfil</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Modal para Historial de Cargos */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Historial de Cargos</h3>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cargo</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Inicio</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Fin</th></tr></thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {cargoHistorial.map(h => (
                            <tr key={h.id}>
                                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{h.cargo?.nombre || 'N/A'}</td>
                                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{new Date(h.fecha_inicio).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{h.fecha_fin ? new Date(h.fecha_fin).toLocaleDateString() : 'Actual'}</td>
                            </tr>
                        ))}
                         {cargoHistorial.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No hay historial de cargos para este empleado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <div className="mt-4 text-right"><button onClick={() => setShowHistoryModal(false)} className={btnSecondaryClasses}>Cerrar</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
