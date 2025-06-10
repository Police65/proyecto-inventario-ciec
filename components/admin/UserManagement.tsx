
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Empleado, UserProfile, Cargo, Departamento, EmpleadoCargoHistorial, UserProfileRol, EmpleadoEstado } from '../../types';
import { PlusCircleIcon, PencilIcon, TrashIcon, EyeIcon, UserPlusIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';

// Define a more specific type for the raw employee data from the query
// User profile will be joined manually.
interface RawEmpleadoFromQuery extends Omit<Empleado, 'user_profile' | 'cargo' | 'departamento'> {
  cargo: Pick<Cargo, 'id' | 'nombre'> | null;
  departamento: Pick<Departamento, 'id' | 'nombre'> | null;
}

// Define Tailwind classes for reuse
const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white";
const btnPrimaryClasses = "px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-300 dark:disabled:bg-primary-800";
const btnSecondaryClasses = "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:bg-gray-300 dark:disabled:bg-gray-600";


const UserManagement: React.FC = () => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEmpleado, setCurrentEmpleado] = useState<Partial<Empleado>>({});
  const [submittingEmpleado, setSubmittingEmpleado] = useState(false);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedEmpleadoForProfile, setSelectedEmpleadoForProfile] = useState<Empleado | null>(null);
  const [profileFormData, setProfileFormData] = useState<{ email: string; password?: string; rol: UserProfileRol; departamento_id?: number | null }>({ email: '', rol: 'usuario' });
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [showSuccessProfileModal, setShowSuccessProfileModal] = useState(false);
  const [successProfileMessage, setSuccessProfileMessage] = useState('');


  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [cargoHistorial, setCargoHistorial] = useState<EmpleadoCargoHistorial[]>([]);

  const [loadingData, setLoadingData] = useState(true); // Renamed from 'loading' to be specific
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false); // For quick actions like toggle estado

  const fetchData = useCallback(async () => {
    setLoadingData(true);
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
        const user_profile_for_emp: UserProfile | null = user_profile_data 
            ? { 
                id: user_profile_data.id, 
                rol: user_profile_data.rol, 
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
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetProfileForm = () => {
    setProfileFormData({ email: '', password: '', rol: 'usuario', departamento_id: undefined });
    setSelectedEmpleadoForProfile(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentEmpleado(prev => ({ ...prev, [name]: name === 'cargo_actual_id' || name === 'departamento_id' ? (value ? Number(value) : null) : value }));
  };
  
  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({ ...prev, [name]: name === 'departamento_id' ? (value ? Number(value) : null) : value }));
  };

  const handleCedulaInvalid = (event: React.InvalidEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.validity.patternMismatch) {
      target.setCustomValidity("La cédula solo debe contener números y tener entre 7 y 8 dígitos.");
    } else if (target.validity.tooShort || target.validity.tooLong) {
      target.setCustomValidity("La cédula debe tener entre 7 y 8 dígitos de longitud.");
    } else if (target.validity.valueMissing) {
      target.setCustomValidity("La cédula es obligatoria.");
    } else {
      target.setCustomValidity("");
    }
  };

  const handleCedulaInput = (event: React.FormEvent<HTMLInputElement>) => {
    (event.target as HTMLInputElement).setCustomValidity("");
  };

  const handleEmpleadoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingEmpleado(true);

    if (!currentEmpleado.nombre || !currentEmpleado.apellido || !currentEmpleado.cedula || !currentEmpleado.cargo_actual_id || !currentEmpleado.departamento_id) {
      alert('Nombre, apellido, cédula, cargo y departamento son obligatorios para el empleado.');
      setSubmittingEmpleado(false);
      return;
    }
    if (currentEmpleado.cedula && !/^\d{7,8}$/.test(currentEmpleado.cedula)) {
        alert('La cédula debe contener entre 7 y 8 dígitos numéricos.');
        setSubmittingEmpleado(false);
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
      const supabaseError = error as { code?: string; message: string };
      if (supabaseError.code === '23505') { 
        if (supabaseError.message.includes('empleado_cedula_key')) {
          alert('Error: La cédula ingresada ya existe.');
        } else {
          alert(`Error guardando empleado: Ya existe un registro con un valor único similar. (${supabaseError.message})`);
        }
      } else {
        alert(`Error guardando empleado: ${supabaseError.message}`);
      }
      console.error("Error saving empleado:", error);
    } finally {
      setSubmittingEmpleado(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingProfile(true);

    if (!selectedEmpleadoForProfile || !profileFormData.email || !profileFormData.rol || !profileFormData.departamento_id) {
      alert('Email, rol y departamento son obligatorios para el perfil.');
      setSubmittingProfile(false);
      return;
    }
    if (!profileFormData.password || profileFormData.password.length < 6) {
        alert('La contraseña es obligatoria y debe tener al menos 6 caracteres.');
        setSubmittingProfile(false);
        return;
    }
    let authUserId: string | undefined = undefined;
    try {
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: profileFormData.email,
        password: profileFormData.password,
      });
      
      authUserId = authUser.user?.id;

      if (authError && authError.message.toLowerCase().includes('user already registered')) {
        alert('Error: El correo electrónico ya está registrado en el sistema de autenticación. No se puede crear un nuevo perfil con este correo.');
        setShowProfileModal(false);
        resetProfileForm();
        setSubmittingProfile(false);
        return;
      }
      if (authError && authError.message.includes("Email rate limit exceeded")) {
        alert("Error: Se ha excedido el límite de creación de usuarios con este correo. Intente más tarde o use otro correo.");
        setShowProfileModal(false);
        resetProfileForm();
        setSubmittingProfile(false);
        return;
      }
      if (authError) throw authError; 
      if (!authUser.user) throw new Error("No se pudo crear el usuario de autenticación.");

      authUserId = authUser.user.id; // Ensure authUserId is set on success
      const profileData = {
        id: authUser.user.id, 
        empleado_id: selectedEmpleadoForProfile.id,
        departamento_id: profileFormData.departamento_id, 
        rol: profileFormData.rol,
      };
      const { error: profileError } = await supabase.from('user_profile').insert(profileData);
      
      if (profileError) {
        console.error(
          "Error inserting profile into user_profile table, auth user might need manual cleanup. Auth User ID:",
          authUser.user.id,
          "Profile Insertion Error:",
          profileError
        );
        throw profileError; 
      }
      
      setSuccessProfileMessage(`¡Perfil de usuario para ${selectedEmpleadoForProfile.nombre} ${selectedEmpleadoForProfile.apellido} creado exitosamente!`);
      setShowProfileModal(false);
      setShowSuccessProfileModal(true);
      resetProfileForm();
      fetchData();

    } catch (error) {
      const supabaseError = error as { code?: string; message: string; constraint_name?: string };
      let alertMessage = `Error creando perfil de usuario: ${supabaseError.message}`;

      if (supabaseError.code === '23505') { 
        if (supabaseError.message.includes('user_profile_pkey') || (supabaseError.constraint_name === 'user_profile_pkey')) {
          alertMessage = 'Error: El correo electrónico proporcionado ya está vinculado a un perfil de usuario existente.';
        } else if (supabaseError.message.includes('user_profile_empleado_id_key') || (supabaseError.constraint_name === 'user_profile_empleado_id_key')) {
          alertMessage = 'Error: Este empleado ya tiene un perfil de usuario asignado.';
        } else {
          alertMessage = `Error creando perfil: Ya existe un registro con un valor único similar. (${supabaseError.message})`;
        }
      } else if (supabaseError.message && supabaseError.message.toLowerCase().includes('user already registered')) {
        alertMessage = 'Error: El correo electrónico ya está registrado en el sistema de autenticación.';
      } else if (supabaseError.message && supabaseError.message.includes("Email rate limit exceeded")) {
        alertMessage = "Error: Se ha excedido el límite de creación de usuarios con este correo. Intente más tarde.";
      }
      
      alert(alertMessage);
      console.error("Error creating user profile (caught in outer block):", error);
      setShowProfileModal(false); 
      resetProfileForm();
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleToggleEstado = async (empleado: Empleado) => {
    if (actionLoading) return;
    setActionLoading(true);
    const newEstado: EmpleadoEstado = empleado.estado === 'activo' ? 'inactivo' : 'activo';
    if (window.confirm(`¿Seguro que desea cambiar el estado de ${empleado.nombre} a ${newEstado}?`)) {
      try {
        const { error } = await supabase.from('empleado').update({ estado: newEstado }).eq('id', empleado.id);
        if (error) throw error;
        fetchData();
      } catch (error) {
        alert('Error al cambiar estado del empleado.');
        console.error("Error toggling estado:", error);
      }
    }
    setActionLoading(false);
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
        console.error("Error cargando historial:", error);
    }
  };

  const openAddEmpleadoModal = () => { setIsEditing(false); setCurrentEmpleado({}); setShowModal(true); };
  const openAddProfileModal = (empleado: Empleado) => { 
    setSelectedEmpleadoForProfile(empleado); 
    setProfileFormData({ email: '', password: '', rol: 'usuario', departamento_id: empleado.departamento_id }); 
    setShowProfileModal(true); 
  };

  const filteredEmpleados = empleados.filter(emp =>
    `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.cedula && emp.cedula.toLowerCase().includes(searchTerm.toLowerCase())) ||
    emp.cargo?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.departamento?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  

  if (loadingData) return <LoadingSpinner message="Cargando usuarios..." />;

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
            <button onClick={openAddEmpleadoModal} className={`flex items-center ${btnPrimaryClasses}`} disabled={submittingEmpleado || submittingProfile || actionLoading}>
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
                  <button 
                    onClick={() => handleToggleEstado(emp)} 
                    disabled={actionLoading && emp.id === currentEmpleado.id } 
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${emp.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 hover:bg-green-200' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 hover:bg-red-200'} disabled:opacity-50`}
                    title={`Cambiar a ${emp.estado === 'activo' ? 'inactivo' : 'activo'}`}
                  >
                    {actionLoading && emp.id === currentEmpleado.id ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : emp.estado}
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.user_profile ? 'Sí' : 'No'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.user_profile?.rol || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium space-x-1">
                  <button onClick={() => { setIsEditing(true); setCurrentEmpleado(emp); setShowModal(true);}} className="p-1 text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50" title="Editar Empleado" disabled={actionLoading}><PencilIcon className="w-4 h-4"/></button>
                  {!emp.user_profile && emp.estado === 'activo' && <button onClick={() => openAddProfileModal(emp)} className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50" title="Crear Perfil Usuario" disabled={actionLoading}><UserPlusIcon className="w-4 h-4"/></button>}
                  <button onClick={() => emp.id && handleViewHistory(emp.id)} className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50" title="Ver Historial Cargos" disabled={actionLoading}><EyeIcon className="w-4 h-4"/></button>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre <span className="text-red-500">*</span></label>
                            <input type="text" name="nombre" id="nombre" value={currentEmpleado.nombre || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}/>
                        </div>
                        <div>
                            <label htmlFor="apellido" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apellido <span className="text-red-500">*</span></label>
                            <input type="text" name="apellido" id="apellido" value={currentEmpleado.apellido || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}/>
                        </div>
                         <div>
                            <label htmlFor="cedula" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cédula <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                name="cedula" 
                                id="cedula" 
                                value={currentEmpleado.cedula || ''} 
                                onChange={handleInputChange} 
                                onInvalid={handleCedulaInvalid}
                                onInput={handleCedulaInput}
                                required 
                                className={`mt-1 ${inputFieldClasses}`} 
                                minLength={7} 
                                maxLength={8} 
                                pattern="\d{7,8}" 
                            />
                        </div>
                        <div>
                            <label htmlFor="cargo_actual_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cargo <span className="text-red-500">*</span></label>
                            <select name="cargo_actual_id" id="cargo_actual_id" value={currentEmpleado.cargo_actual_id || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}>
                                <option value="">Seleccionar Cargo</option>
                                {cargos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="departamento_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento <span className="text-red-500">*</span></label>
                            <select name="departamento_id" id="departamento_id" value={currentEmpleado.departamento_id || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}>
                                <option value="">Seleccionar Departamento</option>
                                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado <span className="text-red-500">*</span></label>
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
                        <button type="button" onClick={() => { setShowModal(false); setCurrentEmpleado({});}} className={btnSecondaryClasses} disabled={submittingEmpleado}>Cancelar</button>
                        <button type="submit" className={btnPrimaryClasses} disabled={submittingEmpleado}>
                            {submittingEmpleado ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                            {submittingEmpleado ? 'Guardando...' : 'Guardar Empleado'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Modal para Perfil de Usuario */}
      {showProfileModal && selectedEmpleadoForProfile && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Crear Perfil de Usuario para {selectedEmpleadoForProfile.nombre}</h3>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="emailP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email <span className="text-red-500">*</span></label>
                        <input type="email" name="email" id="emailP" value={profileFormData.email} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}/>
                    </div>
                    <div>
                        <label htmlFor="passwordP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña <span className="text-red-500">*</span></label>
                        <input type="password" name="password" id="passwordP" placeholder="Mínimo 6 caracteres" onChange={handleProfileFormChange} required minLength={6} className={`mt-1 ${inputFieldClasses}`} autoComplete="new-password"/>
                    </div>
                     <div>
                        <label htmlFor="departamento_idP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento (Perfil) <span className="text-red-500">*</span></label>
                        <select name="departamento_id" id="departamento_idP" value={profileFormData.departamento_id || ''} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}>
                            <option value="">Seleccionar Departamento</option>
                            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="rolP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rol <span className="text-red-500">*</span></label>
                        <select name="rol" id="rolP" value={profileFormData.rol} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}>
                            <option value="usuario">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={() => {setShowProfileModal(false); resetProfileForm();}} className={btnSecondaryClasses} disabled={submittingProfile}>Cancelar</button>
                        <button type="submit" className={btnPrimaryClasses} disabled={submittingProfile}>
                            {submittingProfile ? <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> : null}
                            {submittingProfile ? 'Creando...' : 'Crear Perfil'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
       {/* Modal de Éxito para Perfil */}
      {showSuccessProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md text-center">
                <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">¡Éxito!</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">{successProfileMessage}</p>
                <button 
                    onClick={() => setShowSuccessProfileModal(false)} 
                    className={btnPrimaryClasses}
                >
                    Cerrar
                </button>
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
