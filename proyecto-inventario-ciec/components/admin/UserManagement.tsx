import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Empleado, UserProfile, Cargo, Departamento, EmpleadoCargoHistorial, UserProfileRol, EmpleadoEstado } from '../../types';
import { PlusCircleIcon, PencilIcon, UserPlusIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { User } from '@supabase/supabase-js';

interface RawEmpleadoFromQuery extends Omit<Empleado, 'user_profile' | 'cargo' | 'departamento'> {
  cargo: Pick<Cargo, 'id' | 'nombre'> | null;
  departamento: Pick<Departamento, 'id' | 'nombre'> | null;
}

const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-70 dark:disabled:opacity-50";
const btnPrimaryClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-400 dark:disabled:bg-primary-700 disabled:cursor-not-allowed";
const btnSecondaryClasses = "flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-70 dark:disabled:opacity-50 disabled:cursor-not-allowed";
const btnDangerClasses = "flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-red-400 dark:disabled:bg-red-700 disabled:cursor-not-allowed";

const UserManagement: React.FC = () => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  
  const [showEmpleadoModal, setShowEmpleadoModal] = useState(false);
  const [isEditingEmpleado, setIsEditingEmpleado] = useState(false);
  const [currentEmpleado, setCurrentEmpleado] = useState<Partial<Empleado>>({});
  const [submittingEmpleado, setSubmittingEmpleado] = useState(false);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedEmpleadoForProfile, setSelectedEmpleadoForProfile] = useState<Empleado | null>(null);
  const [profileFormData, setProfileFormData] = useState<{ email: string; password?: string; rol: UserProfileRol; departamento_id?: number | null }>({ email: '', rol: 'usuario' });
  
  const [submittingProfileState, setSubmittingProfileState] = useState(false); 
  const [showCreatingProfileLoadingModal, setShowCreatingProfileLoadingModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  
  const isProfileSubmittingRef = useRef(false); 

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [cargoHistorial, setCargoHistorial] = useState<EmpleadoCargoHistorial[]>([]);

  const [loadingData, setLoadingData] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<number, boolean>>({});


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
        .select('id, rol, empleado_id, departamento_id'); 
      if (profilesError) throw profilesError;
      
      const profilesMap = new Map<number, { id: string; rol: UserProfileRol | null; departamento_id: number | null; }>();
      if (profilesData) {
        profilesData.forEach(profile => {
          if (profile.empleado_id) {
            profilesMap.set(profile.empleado_id, { 
              id: profile.id, 
              rol: profile.rol as UserProfileRol | null, 
              departamento_id: profile.departamento_id
            });
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
                departamento_id: user_profile_data.departamento_id,
                empleado: undefined, 
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
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

      const { data: cargosData, error: cargosError } = await supabase.from('cargo').select('*').order('nombre');
      if (cargosError) throw cargosError;
      setCargos(cargosData || []);

      const { data: deptosData, error: deptosError } = await supabase.from('departamento').select('*').order('nombre');
      if (deptosError) throw deptosError;
      setDepartamentos(deptosData || []);

    } catch (error) {
        const typedError = error as any;
        const message = `Error al cargar datos: ${typedError.message || 'Error desconocido.'} ${typedError.details ? 'Detalles: ' + typedError.details : ''}`;
        console.error(message, typedError);
        setFeedbackMessage(message);
        setFeedbackType('error');
        setShowFeedbackModal(true);
    }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetProfileForm = (empleado?: Empleado | null) => {
    let emailForForm = '';
    if (empleado && empleado.user_profile && empleado.user_profile.email) {
        emailForForm = empleado.user_profile.email;
    }
    
    setProfileFormData({ 
        email: emailForForm, 
        password: '', 
        rol: empleado?.user_profile?.rol || 'usuario', 
        departamento_id: empleado?.user_profile?.departamento_id || empleado?.departamento_id || null 
    });
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
    if (target.validity.patternMismatch) target.setCustomValidity("La cédula solo debe contener números (7-8 dígitos).");
    else if (target.validity.valueMissing) target.setCustomValidity("La cédula es obligatoria.");
    else target.setCustomValidity("");
  };
  const handleCedulaInput = (event: React.FormEvent<HTMLInputElement>) => (event.target as HTMLInputElement).setCustomValidity("");

  const handleEmployeeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingEmpleado(true);

    if (!currentEmpleado.nombre || !currentEmpleado.apellido || !currentEmpleado.cedula || !currentEmpleado.cargo_actual_id || !currentEmpleado.departamento_id) {
      setFeedbackMessage('Nombre, apellido, cédula, cargo y departamento son obligatorios.'); setFeedbackType('error'); setShowFeedbackModal(true);
      setSubmittingEmpleado(false); return;
    }
    if (currentEmpleado.cedula && !/^\d{7,8}$/.test(currentEmpleado.cedula)) {
      setFeedbackMessage('La cédula debe contener entre 7 y 8 dígitos numéricos.'); setFeedbackType('error'); setShowFeedbackModal(true);
      setSubmittingEmpleado(false); return;
    }

    const empleadoData = {
      nombre: currentEmpleado.nombre, apellido: currentEmpleado.apellido, cedula: currentEmpleado.cedula,
      cargo_actual_id: Number(currentEmpleado.cargo_actual_id), departamento_id: Number(currentEmpleado.departamento_id),
      estado: currentEmpleado.estado || 'activo', firma: currentEmpleado.firma || null,
    };

    try {
      if (isEditingEmpleado && currentEmpleado.id) {
        const { error } = await supabase.from('empleado').update(empleadoData).eq('id', currentEmpleado.id);
        if (error) throw error;
      } else {
        const { data: newEmp, error } = await supabase.from('empleado').insert(empleadoData).select().single();
        if (error) throw error;
        if (newEmp && newEmp.cargo_actual_id) { 
            await supabase.from('empleadocargohistorial').insert({
                empleado_id: newEmp.id, cargo_id: newEmp.cargo_actual_id,
                fecha_inicio: new Date().toISOString().split('T')[0],
            });
        }
      }
      setShowEmpleadoModal(false); setCurrentEmpleado({}); fetchData();
      setFeedbackMessage(`Empleado ${isEditingEmpleado ? 'actualizado' : 'creado'} exitosamente.`); setFeedbackType('success'); setShowFeedbackModal(true);
    } catch (error) {
      const err = error as any;
      const userMessage = err.code === '23505' && err.message.includes('empleado_cedula_key') ? 'Error: La cédula ingresada ya existe.' : `Error guardando empleado: ${err.message}`;
      setFeedbackMessage(userMessage); setFeedbackType('error'); setShowFeedbackModal(true);
      console.error("Error saving empleado:", err);
    } finally {
      setSubmittingEmpleado(false);
    }
  };
  
  const createOrphanedProfileErrorMessage = (authId: string, email: string, emp: Empleado): string => {
    return `El correo '${email}' (Auth ID: ${authId}) ya está registrado y asociado a un perfil de aplicación que NO ESTÁ VINCULADO a un empleado específico (Empleado ID es NULO en el perfil existente).\nNo se puede usar este correo para ${emp.nombre} ${emp.apellido} (ID: ${emp.id}).\n\nAcciones posibles para el administrador:\n1. Si el perfil ${authId} debe pertenecer al empleado ${emp.id}: actualice 'empleado_id' del perfil ${authId} a ${emp.id} en la tabla 'user_profile'.\n2. Si el perfil ${authId} es incorrecto: elimine el registro de 'user_profile' con id ${authId} Y el usuario correspondiente en 'auth.users'. Luego intente de nuevo.\n3. Use un correo DIFERENTE para el empleado ${emp.id}.`;
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isProfileSubmittingRef.current) return;
    if (!selectedEmpleadoForProfile || !profileFormData.email || !profileFormData.rol || !profileFormData.departamento_id) {
      setFeedbackMessage('Email, rol y departamento del perfil son obligatorios.'); setFeedbackType('error'); setShowFeedbackModal(true); return;
    }
    if (!isEditingProfile && (!profileFormData.password || profileFormData.password.length < 6)) {
      setFeedbackMessage('La contraseña es obligatoria (mínimo 6 caracteres) para nuevos perfiles.'); setFeedbackType('error'); setShowFeedbackModal(true); return;
    }

    isProfileSubmittingRef.current = true; setSubmittingProfileState(true);
    setShowProfileModal(false); setShowCreatingProfileLoadingModal(true);

    let authUserId: string | undefined = undefined;
    let signUpUser: User | null = null;

    try {
      if (!isEditingProfile) {
        const { data: empProfile, error: empProfileError } = await supabase
          .from('user_profile').select('id').eq('empleado_id', selectedEmpleadoForProfile.id).maybeSingle();
        if (empProfileError) throw new Error(`Error DB (verif. empleado): ${empProfileError.message}`);
        if (empProfile) throw new Error(`El empleado ${selectedEmpleadoForProfile.nombre} ya tiene un perfil. Use la opción de editar.`);
      }
      
      if (isEditingProfile && selectedEmpleadoForProfile.user_profile?.id) {
          authUserId = selectedEmpleadoForProfile.user_profile.id;
      } else { 
          const { data: signUpResponse, error: signUpError } = await supabase.auth.signUp({
              email: profileFormData.email, password: profileFormData.password!,
          });
          signUpUser = signUpResponse?.user ?? null;

          if (signUpError) {
              if (signUpError.message.toLowerCase().includes('user already registered')) {
                  // Attempt to get current session user, if their email matches, we might have their ID.
                  // This is a client-side limitation; server-side admin API would be more direct.
                  const {data: { user: sessionUserAfterAttempt }} = await supabase.auth.getUser();
                  if(sessionUserAfterAttempt?.email === profileFormData.email) {
                      authUserId = sessionUserAfterAttempt.id;
                      signUpUser = sessionUserAfterAttempt; // Treat this as the user if session matches
                      console.warn(`[UserManagement] Email ${profileFormData.email} already registered. Using current session user ID: ${authUserId}. Manual verification might be needed if this isn't the intended existing user.`);
                  } else {
                      // If not the current session user, then it's another existing user.
                      // We don't have their ID client-side without admin rights.
                      throw new Error(`El correo '${profileFormData.email}' ya está registrado en el sistema de autenticación para otro usuario. No se puede obtener su ID automáticamente desde el cliente. Por favor, use un correo diferente o contacte a soporte para enlazar manualmente si es necesario.`);
                  }
              } else { throw new Error(`Error Auth (signUp): ${signUpError.message}`); }
          } else { 
              if (!signUpUser?.id) throw new Error("SignUp exitoso pero sin ID de usuario.");
              authUserId = signUpUser.id;
          }
      }

      if (!isEditingProfile && authUserId) {
        let profileForAuthIdToCheck: (Partial<UserProfile> & { empleado: { nombre: string; apellido: string; } | null }) | null = null;

        const { data: rawProfileData, error: profileCheckError } = await supabase
          .from('user_profile')
          .select('id, empleado_id, rol, departamento_id') 
          .eq('id', authUserId)
          .maybeSingle();

        if (profileCheckError) throw new Error(`Error DB (verif. perfil para Auth ID): ${profileCheckError.message}`);

        if (rawProfileData) {
            profileForAuthIdToCheck = { 
                id: rawProfileData.id,
                empleado_id: rawProfileData.empleado_id,
                rol: rawProfileData.rol as UserProfileRol | null,
                departamento_id: rawProfileData.departamento_id,
                empleado: null,
            };

            if (rawProfileData.empleado_id) {
                const { data: empData, error: empError } = await supabase
                    .from('empleado')
                    .select('nombre, apellido')
                    .eq('id', rawProfileData.empleado_id)
                    .single<{nombre: string; apellido: string;}>();
                
                if (empError) {
                    console.warn(`No se pudo obtener detalles del empleado para empleado_id ${rawProfileData.empleado_id}: ${empError.message}`);
                }
                if (empData && profileForAuthIdToCheck) { 
                    profileForAuthIdToCheck.empleado = empData;
                }
            }
        }
        
        if (profileForAuthIdToCheck) {
          if (profileForAuthIdToCheck.empleado_id === null) {
            throw new Error(createOrphanedProfileErrorMessage(authUserId, profileFormData.email, selectedEmpleadoForProfile));
          } else if (profileForAuthIdToCheck.empleado_id !== selectedEmpleadoForProfile.id) {
            const existingEmpName = profileForAuthIdToCheck.empleado ? `${profileForAuthIdToCheck.empleado.nombre} ${profileForAuthIdToCheck.empleado.apellido}` : 'OTRO EMPLEADO';
            throw new Error(`El correo '${profileFormData.email}' (Auth ID: ${authUserId}) ya está en uso por ${existingEmpName}.`);
          }
        }
      }

      const profilePayload: Omit<UserProfile, 'created_at' | 'updated_at' | 'empleado' | 'departamento' | 'email'> & { id: string } = {
        id: authUserId!, 
        empleado_id: selectedEmpleadoForProfile.id,
        departamento_id: profileFormData.departamento_id,
        rol: profileFormData.rol,
      };

      const { error: upsertError } = await supabase.from('user_profile').upsert(profilePayload, { onConflict: 'id' });
      if (upsertError) {
        if (upsertError.code === '23503' && upsertError.message.includes('user_profile_empleado_id_fkey')) {
             throw new Error(`Error de FK: El empleado ID ${selectedEmpleadoForProfile.id} no es válido o ya está vinculado a otro perfil de autenticación.`);
        }
        throw new Error(`Error al guardar perfil: ${upsertError.message}`);
      }
  
      setFeedbackMessage(`Perfil para ${selectedEmpleadoForProfile.nombre} ${isEditingProfile ? 'actualizado' : 'creado'} exitosamente.`);
      setFeedbackType('success'); setShowFeedbackModal(true);
      resetProfileForm(); fetchData();
  
    } catch (error) {
      const err = error as Error;
      setFeedbackMessage(err.message); setFeedbackType('error'); setShowFeedbackModal(true);
      console.error("Error detallado en handleProfileSubmit:", err.message, err);
    } finally {
      setShowCreatingProfileLoadingModal(false); setSubmittingProfileState(false); isProfileSubmittingRef.current = false;
    }
  };

  const handleToggleEstado = async (empleado: Empleado) => {
    setActionLoadingMap(prev => ({ ...prev, [empleado.id]: true }));
    const newEstado: EmpleadoEstado = empleado.estado === 'activo' ? 'inactivo' : 'activo';
    if (window.confirm(`¿Seguro que desea cambiar el estado de ${empleado.nombre} a ${newEstado}?`)) {
      try {
        const { error } = await supabase.from('empleado').update({ estado: newEstado }).eq('id', empleado.id);
        if (error) throw error;
        fetchData();
      } catch (error) {
        setFeedbackMessage('Error al cambiar estado.'); setFeedbackType('error'); setShowFeedbackModal(true);
      }
    }
    setActionLoadingMap(prev => ({ ...prev, [empleado.id]: false }));
  };

  const handleViewHistory = async (empleadoId: number) => {
    setActionLoadingMap(prev => ({ ...prev, [empleadoId]: true }));
    try {
        const { data, error } = await supabase.from('empleadocargohistorial').select('*, cargo:cargo_id(nombre)')
            .eq('empleado_id', empleadoId).order('fecha_inicio', { ascending: false });
        if (error) throw error;
        setCargoHistorial(data || []); setShowHistoryModal(true);
    } catch (error) {
        setFeedbackMessage('Error al cargar historial.'); setFeedbackType('error'); setShowFeedbackModal(true);
    }
    setActionLoadingMap(prev => ({ ...prev, [empleadoId]: false }));
  };

  const openAddEmpleadoModal = () => { setIsEditingEmpleado(false); setCurrentEmpleado({}); setShowEmpleadoModal(true); };
  const openEditEmpleadoModal = (emp: Empleado) => { setIsEditingEmpleado(true); setCurrentEmpleado(emp); setShowEmpleadoModal(true); };
  
  const openCreateProfileModal = (emp: Empleado) => { 
    setIsEditingProfile(false); resetProfileForm(emp); setSelectedEmpleadoForProfile(emp); setShowProfileModal(true); 
  };
  const openEditProfileModal = (emp: Empleado) => {
    if (!emp.user_profile) {
        setFeedbackMessage("Este empleado no tiene un perfil para editar. Por favor, cree uno.");
        setFeedbackType('error'); setShowFeedbackModal(true); return;
    }
    setIsEditingProfile(true); resetProfileForm(emp); setSelectedEmpleadoForProfile(emp); setShowProfileModal(true);
  };

  const filteredEmpleados = empleados.filter(emp =>
    `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.cedula || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cargo?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.departamento?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.user_profile?.id && emp.user_profile.id.toLowerCase().includes(searchTerm.toLowerCase())) 
  );
  
  const getProfileStatus = (emp: Empleado): React.ReactNode => {
    if (emp.user_profile) {
      // Prefer email if available from auth for display, otherwise use ID
      const displayIdentifier = emp.user_profile.email || `Auth ID: ${emp.user_profile.id.substring(0,8)}...`;
      
      return (
        <div className="text-green-600 dark:text-green-400 text-xs">
          <p className="font-semibold" title={emp.user_profile.email || emp.user_profile.id}>
            {displayIdentifier}
          </p>
          <p>Rol: {emp.user_profile.rol || 'N/A'}</p>
        </div>
      );
    }
    return <span className="text-yellow-600 dark:text-yellow-400 text-xs font-medium">No Creado</span>;
  };

  if (loadingData && !showCreatingProfileLoadingModal) return <LoadingSpinner message="Cargando usuarios..." />;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Empleados y Usuarios</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <input type="text" placeholder="Buscar..." className={`${inputFieldClasses} flex-grow`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <button onClick={openAddEmpleadoModal} className={btnPrimaryClasses} disabled={submittingEmpleado || submittingProfileState || Object.values(actionLoadingMap).some(Boolean)}>
                <PlusCircleIcon className="w-5 h-5 mr-2" /> Añadir Empleado
            </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['Empleado (ID)', 'Cédula', 'Cargo', 'Dpto.', 'Estado Emp.', 'Perfil (Auth ID/Rol)', 'Acciones'].map(header => (
                <th key={header} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmpleados.map(emp => (
              <tr key={emp.id}>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">{emp.nombre} {emp.apellido}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {emp.id}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.cedula}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.cargo?.nombre || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.departamento?.nombre || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                  <button onClick={() => handleToggleEstado(emp)} disabled={actionLoadingMap[emp.id]}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full cursor-pointer ${emp.estado === 'activo' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100 hover:bg-green-200' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100 hover:bg-red-200'} disabled:opacity-50`}
                    title={`Cambiar a ${emp.estado === 'activo' ? 'inactivo' : 'activo'}`}>
                    {actionLoadingMap[emp.id] ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : emp.estado}
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">{getProfileStatus(emp)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium space-x-1">
                  <button onClick={() => openEditEmpleadoModal(emp)} className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700" title="Editar Empleado" disabled={actionLoadingMap[emp.id]}><PencilIcon className="w-4 h-4"/></button>
                  {emp.user_profile ? 
                    <button onClick={() => openEditProfileModal(emp)} className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-700" title="Editar Perfil Usuario" disabled={actionLoadingMap[emp.id]}><UserPlusIcon className="w-4 h-4"/></button>
                    : (emp.estado === 'activo' && 
                      <button onClick={() => openCreateProfileModal(emp)} className="p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50 rounded-md hover:bg-green-100 dark:hover:bg-green-700" title="Crear Perfil Usuario" disabled={actionLoadingMap[emp.id]}><UserPlusIcon className="w-4 h-4"/></button>)
                  }
                  <button onClick={() => emp.id && handleViewHistory(emp.id)} className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600" title="Ver Historial Cargos" disabled={actionLoadingMap[emp.id]}><EyeIcon className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
             {filteredEmpleados.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron empleados.</td></tr>}
          </tbody>
        </table>
      </div>

      {showEmpleadoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{isEditingEmpleado ? 'Editar' : 'Añadir'} Empleado</h3>
                <form onSubmit={handleEmployeeSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre <span className="text-red-500">*</span></label><input type="text" name="nombre" id="nombre" value={currentEmpleado.nombre || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}/></div>
                        <div><label htmlFor="apellido" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apellido <span className="text-red-500">*</span></label><input type="text" name="apellido" id="apellido" value={currentEmpleado.apellido || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}/></div>
                        <div><label htmlFor="cedula" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cédula <span className="text-red-500">*</span></label><input type="text" name="cedula" id="cedula" value={currentEmpleado.cedula || ''} onChange={handleInputChange} onInvalid={handleCedulaInvalid} onInput={handleCedulaInput} required className={`mt-1 ${inputFieldClasses}`} pattern="\d{7,8}" /></div>
                        <div><label htmlFor="cargo_actual_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cargo <span className="text-red-500">*</span></label><select name="cargo_actual_id" id="cargo_actual_id" value={currentEmpleado.cargo_actual_id || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}><option value="">Seleccionar Cargo</option>{cargos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                        <div><label htmlFor="departamento_id_empleado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento <span className="text-red-500">*</span></label><select name="departamento_id" id="departamento_id_empleado" value={currentEmpleado.departamento_id || ''} onChange={handleInputChange} required className={`mt-1 ${inputFieldClasses}`}><option value="">Seleccionar Depto.</option>{departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
                        <div><label htmlFor="estado_empleado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado <span className="text-red-500">*</span></label><select name="estado" id="estado_empleado" value={currentEmpleado.estado || 'activo'} onChange={handleInputChange} className={`mt-1 ${inputFieldClasses}`}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                    </div>
                    <div><label htmlFor="firma" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Firma (URL o texto)</label><input type="text" name="firma" id="firma" value={currentEmpleado.firma || ''} onChange={handleInputChange} className={`mt-1 ${inputFieldClasses}`}/></div>
                    <div className="flex justify-end space-x-3 pt-5 border-t dark:border-gray-700"><button type="button" onClick={() => { setShowEmpleadoModal(false); setCurrentEmpleado({});}} className={btnSecondaryClasses} disabled={submittingEmpleado}>Cancelar</button><button type="submit" className={btnPrimaryClasses} disabled={submittingEmpleado}>{submittingEmpleado && <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />}{submittingEmpleado ? 'Guardando...' : 'Guardar Empleado'}</button></div>
                </form>
            </div>
        </div>
      )}

      {showProfileModal && selectedEmpleadoForProfile && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{isEditingProfile ? 'Editar' : 'Crear'} Perfil para {selectedEmpleadoForProfile.nombre}</h3>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div><label htmlFor="emailP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email <span className="text-red-500">*</span></label><input type="email" name="email" id="emailP" value={profileFormData.email} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}/></div>
                    {!isEditingProfile && <div><label htmlFor="passwordP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña <span className="text-red-500">*</span></label><input type="password" name="password" id="passwordP" placeholder="Mínimo 6 caracteres" onChange={handleProfileFormChange} required minLength={6} className={`mt-1 ${inputFieldClasses}`} autoComplete="new-password"/></div>}
                    <div><label htmlFor="departamento_idP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dpto. del Perfil <span className="text-red-500">*</span></label><select name="departamento_id" id="departamento_idP" value={profileFormData.departamento_id || ''} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}><option value="">Seleccionar Depto.</option>{departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
                    <div><label htmlFor="rolP" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rol <span className="text-red-500">*</span></label><select name="rol" id="rolP" value={profileFormData.rol} onChange={handleProfileFormChange} required className={`mt-1 ${inputFieldClasses}`}><option value="usuario">Usuario</option><option value="admin">Administrador</option></select></div>
                    <div className="flex justify-end space-x-3 pt-5 border-t dark:border-gray-700"><button type="button" onClick={() => {setShowProfileModal(false); resetProfileForm();}} className={btnSecondaryClasses} disabled={submittingProfileState}>Cancelar</button><button type="submit" className={btnPrimaryClasses} disabled={submittingProfileState}>{submittingProfileState && <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />}{submittingProfileState ? 'Procesando...' : (isEditingProfile ? 'Actualizar Perfil' : 'Crear Perfil')}</button></div>
                </form>
            </div>
        </div>
      )}

      {showCreatingProfileLoadingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-white dark:bg-gray-800 p-10 rounded-lg shadow-xl text-center"><LoadingSpinner message="Procesando perfil, por favor espere..." size="lg" /></div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md text-center border-t-4 ${feedbackType === 'success' ? 'border-green-500' : 'border-red-500'}`}>
                {feedbackType === 'success' ? <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" /> : <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{feedbackType === 'success' ? '¡Éxito!' : 'Error'}</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-line text-sm">{feedbackMessage}</p>
                <button onClick={() => {setShowFeedbackModal(false); setFeedbackMessage('');}} className={feedbackType === 'success' ? btnPrimaryClasses : btnDangerClasses}>Entendido</button>
            </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 p-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 border-b dark:border-gray-700 pb-3">Historial de Cargos</h3>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cargo</th><th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Inicio</th><th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Fin</th></tr></thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {cargoHistorial.length > 0 ? cargoHistorial.map(h => (
                            <tr key={h.id}><td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{h.cargo?.nombre || 'N/A'}</td><td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{new Date(h.fecha_inicio).toLocaleDateString()}</td><td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{h.fecha_fin ? new Date(h.fecha_fin).toLocaleDateString() : 'Actual'}</td></tr>
                        )) : <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">No hay historial.</td></tr>}
                    </tbody>
                </table>
                <div className="mt-6 text-right"><button onClick={() => setShowHistoryModal(false)} className={btnSecondaryClasses}>Cerrar</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
