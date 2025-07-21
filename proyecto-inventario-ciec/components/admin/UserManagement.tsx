import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Empleado, UserProfile, Cargo, Departamento, EmpleadoCargoHistorial, UserProfileRol, EmpleadoEstado } from '../../types';
import { PlusCircleIcon, PencilIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../core/LoadingSpinner';
import { AuthError } from '@supabase/supabase-js';

const inputFieldClasses = "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-70 dark:disabled:opacity-50";
const btnPrimaryClasses = "flex items-center justify-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-primary-400 dark:disabled:bg-primary-700 disabled:cursor-not-allowed";
const btnSecondaryClasses = "flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-70 dark:disabled:opacity-50 disabled:cursor-not-allowed";
const btnDangerClasses = "flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm text-sm disabled:bg-red-400 dark:disabled:bg-red-700 disabled:cursor-not-allowed";

type FormData = Partial<Empleado> & 
  Omit<Partial<UserProfile>, 'id' | 'email'> & 
  { 
    password?: string; 
    email?: string;
    countryCode?: string;
    localPhoneNumber?: string;
  };

// Lista de códigos de país
const countryCodes = [
    { name: "Venezuela", code: "+58" }, { name: "United States", code: "+1" }, { name: "Colombia", code: "+57" },
    { name: "Spain", code: "+34" }, { name: "Argentina", code: "+54" }, { name: "Brazil", code: "+55" },
    { name: "Chile", code: "+56" }, { name: "Mexico", code: "+52" }, { name: "Peru", code: "+51" },
    { name: "Afghanistan", code: "+93" }, { name: "Albania", code: "+355" }, { name: "Algeria", code: "+213" },
    { name: "Andorra", code: "+376" }, { name: "Angola", code: "+244" }, { name: "Australia", code: "+61" },
    { name: "Austria", code: "+43" }, { name: "Bahamas", code: "+1-242" }, { name: "Bahrain", code: "+973" },
    { name: "Bangladesh", code: "+880" }, { name: "Belgium", code: "+32" }, { name: "Bolivia", code: "+591" },
    { name: "Canada", code: "+1" }, { name: "China", code: "+86" }, { name: "Costa Rica", code: "+506" },
    { name: "Croatia", code: "+385" }, { name: "Cuba", code: "+53" }, { name: "Cyprus", code: "+357" },
    { name: "Czech Republic", code: "+420" }, { name: "Denmark", code: "+45" }, { name: "Dominican Republic", code: "+1-809" },
    { name: "Ecuador", code: "+593" }, { name: "Egypt", code: "+20" }, { name: "El Salvador", code: "+503" },
    { name: "Finland", code: "+358" }, { name: "France", code: "+33" }, { name: "Germany", code: "+49" },
    { name: "Greece", code: "+30" }, { name: "Guatemala", code: "+502" }, { name: "Honduras", code: "+504" },
    { name: "Hungary", code: "+36" }, { name: "Iceland", code: "+354" }, { name: "India", code: "+91" },
    { name: "Indonesia", code: "+62" }, { name: "Iran", code: "+98" }, { name: "Iraq", code: "+964" },
    { name: "Ireland", code: "+353" }, { name: "Israel", code: "+972" }, { name: "Italy", code: "+39" },
    { name: "Jamaica", code: "+1-876" }, { name: "Japan", code: "+81" }, { name: "Jordan", code: "+962" },
    { name: "Kenya", code: "+254" }, { name: "Kuwait", code: "+965" }, { name: "Lebanon", code: "+961" },
    { name: "Malaysia", code: "+60" }, { name: "Morocco", code: "+212" }, { name: "Netherlands", code: "+31" },
    { name: "New Zealand", code: "+64" }, { name: "Nicaragua", code: "+505" }, { name: "Nigeria", code: "+234" },
    { name: "Norway", code: "+47" }, { name: "Oman", code: "+968" }, { name: "Pakistan", code: "+92" },
    { name: "Panama", code: "+507" }, { name: "Paraguay", code: "+595" }, { name: "Philippines", code: "+63" },
    { name: "Poland", code: "+48" }, { name: "Portugal", code: "+351" }, { name: "Qatar", code: "+974" },
    { name: "Romania", code: "+40" }, { name: "Russia", code: "+7" }, { name: "Saudi Arabia", code: "+966" },
    { name: "Singapore", code: "+65" }, { name: "South Africa", code: "+27" }, { name: "South Korea", code: "+82" },
    { name: "Sweden", code: "+46" }, { name: "Switzerland", code: "+41" }, { name: "Syria", code: "+963" },
    { name: "Taiwan", code: "+886" }, { name: "Thailand", code: "+66" }, { name: "Turkey", code: "+90" },
    { name: "Ukraine", code: "+380" }, { name: "United Arab Emirates", code: "+971" }, { name: "United Kingdom", code: "+44" },
    { name: "Uruguay", code: "+598" }, { name: "Yemen", code: "+967" },
].sort((a, b) => a.name.localeCompare(b.name));


const UserManagement: React.FC = () => {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({});
  
  const [submitting, setSubmitting] = useState(false);
  
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  
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
        .order('apellido', { ascending: true });
      if (empError) throw empError;

      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profile')
        .select('id, rol, empleado_id, departamento_id');
      if (profilesError) throw profilesError;
      
      const profilesMap = new Map<number, Partial<UserProfile>>();
      profilesData?.forEach(p => { if (p.empleado_id) profilesMap.set(p.empleado_id, p); });
      
      const processedEmpData: Empleado[] = (empData || []).map(emp => {
        const profile = emp.id ? profilesMap.get(emp.id) : undefined;
        return {
          ...emp,
          cargo: emp.cargo as Cargo | undefined,
          departamento: emp.departamento as Departamento | undefined,
          user_profile: profile ? { ...profile } : null,
        } as Empleado;
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

  const handleCedulaInvalid = (event: React.InvalidEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.validity.patternMismatch) target.setCustomValidity("La cédula solo debe contener números (7-8 dígitos).");
    else if (target.validity.valueMissing) target.setCustomValidity("La cédula es obligatoria.");
    else target.setCustomValidity("");
  };
  const handleCedulaInput = (event: React.FormEvent<HTMLInputElement>) => (event.target as HTMLInputElement).setCustomValidity("");

  const handleUnifiedSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const { nombre, apellido, cedula, cargo_actual_id, departamento_id, email, password, rol, estado, countryCode, localPhoneNumber } = formData;
    
    const fullPhoneNumber = localPhoneNumber ? `${countryCode || ''}${localPhoneNumber.replace(/\s+/g, '')}` : null;


    // --- Validations ---
    if (!nombre || !apellido || !cedula || !cargo_actual_id || !departamento_id) {
        setFeedbackMessage('Nombre, apellido, cédula, cargo y departamento son obligatorios.'); setFeedbackType('error'); setShowFeedbackModal(true);
        setSubmitting(false); return;
    }
    if (isEditing && formData.id && !formData.user_profile) {
        // This case means we are editing an employee without a profile, so profile fields are not required.
    } else {
        if (!email || !rol) {
            setFeedbackMessage('Email y rol son obligatorios para crear/editar un perfil de usuario.'); setFeedbackType('error'); setShowFeedbackModal(true);
            setSubmitting(false); return;
        }
        if (!isEditing && (!password || password.length < 6)) {
            setFeedbackMessage('La contraseña es obligatoria (mínimo 6 caracteres) para nuevos perfiles.'); setFeedbackType('error'); setShowFeedbackModal(true);
            setSubmitting(false); return;
        }
    }

    let authUserId: string | undefined = isEditing ? formData.user_profile?.id : undefined;
    let newEmpleadoId: number | undefined = isEditing ? formData.id : undefined;
    
    try {
      // --- Create Auth User (only for new employees) ---
      if (!isEditing) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email!,
          password: password!,
        });

        if (signUpError) throw new Error(`Error de autenticación: ${signUpError.message}`);
        if (!signUpData.user) throw new Error('No se pudo crear el usuario en el sistema de autenticación. Es posible que el correo ya exista.');
        authUserId = signUpData.user.id;
      }
      
      // --- Create or Update Empleado ---
      const empleadoPayload = { nombre, apellido, cedula, cargo_actual_id, departamento_id, estado: estado || 'activo', telefono: fullPhoneNumber };
      if (isEditing) {
        const { error: empUpdateError } = await supabase.from('empleado').update(empleadoPayload).eq('id', formData.id!);
        if (empUpdateError) throw new Error(`Error actualizando empleado: ${empUpdateError.message}`);
      } else {
        const { data: empInsertData, error: empInsertError } = await supabase.from('empleado').insert(empleadoPayload).select('id').single();
        if (empInsertError) throw new Error(`Error creando empleado: ${empInsertError.message}`);
        newEmpleadoId = empInsertData.id;
      }
      
      // --- Create or Update User Profile ---
      if (email && rol && departamento_id) { // Only process profile if fields are present
        const profilePayload = {
            id: authUserId,
            empleado_id: newEmpleadoId,
            departamento_id: departamento_id,
            rol: rol as UserProfileRol
        };
        const { error: profileError } = await supabase.from('user_profile').upsert(profilePayload);
        if (profileError) throw new Error(`Error guardando perfil: ${profileError.message}`);
      }

      // --- Create history record for new employees ---
      if (!isEditing) {
        await supabase.from('empleadocargohistorial').insert({ empleado_id: newEmpleadoId!, cargo_id: cargo_actual_id, fecha_inicio: new Date().toISOString().split('T')[0] });
      }

      const successMessage = isEditing
        ? 'Empleado y usuario actualizado exitosamente.'
        : 'Empleado y usuario creado exitosamente. El nuevo usuario deberá confirmar su correo electrónico para poder iniciar sesión.';
      setFeedbackMessage(successMessage);
      setFeedbackType('success');
      setShowFeedbackModal(true);
      setIsModalOpen(false);
      fetchData();

    } catch (error) {
        const err = error as Error;
        let finalMessage = err.message;
        
        if (authUserId && !isEditing) {
            finalMessage += `\n\nACCIÓN MANUAL REQUERIDA: Un usuario de autenticación fue creado para '${email}' (ID: ${authUserId}) pero el proceso falló. Por favor, elimine este usuario desde el panel de Supabase (Authentication > Users) para evitar problemas futuros.`;
        }
        setFeedbackMessage(finalMessage); setFeedbackType('error'); setShowFeedbackModal(true);
    } finally {
        setSubmitting(false);
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
      } catch (error) { setFeedbackMessage('Error al cambiar estado.'); setFeedbackType('error'); setShowFeedbackModal(true); }
    }
    setActionLoadingMap(prev => ({ ...prev, [empleado.id]: false }));
  };

  const handleViewHistory = async (empleadoId: number) => {
    setActionLoadingMap(prev => ({ ...prev, [empleadoId]: true }));
    try {
      const { data, error } = await supabase.from('empleadocargohistorial').select('*, cargo:cargo_id(nombre)').eq('empleado_id', empleadoId).order('fecha_inicio', { ascending: false });
      if (error) throw error;
      setCargoHistorial(data || []); setShowHistoryModal(true);
    } catch (error) { setFeedbackMessage('Error al cargar historial.'); setFeedbackType('error'); setShowFeedbackModal(true); }
    setActionLoadingMap(prev => ({ ...prev, [empleadoId]: false }));
  };

  const openModal = (emp?: Empleado) => {
    if (emp) {
      setIsEditing(true);
      const telefono = emp.telefono || '';
      let countryCode = '+58';
      let localPhoneNumber = '';
      
      const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);
      const foundCode = sortedCodes.find(c => telefono.startsWith(c.code));

      if (foundCode) {
        countryCode = foundCode.code;
        localPhoneNumber = telefono.substring(foundCode.code.length);
      } else if (telefono.startsWith('+')) {
        const firstDigitIndex = telefono.search(/\d/);
        if (firstDigitIndex > 0) {
            countryCode = telefono.substring(0, firstDigitIndex);
            localPhoneNumber = telefono.substring(firstDigitIndex);
        } else {
            localPhoneNumber = telefono;
        }
      } else {
        localPhoneNumber = telefono;
      }
      
      setFormData({
        ...emp,
        email: emp.user_profile?.email || '',
        rol: emp.user_profile?.rol || 'usuario',
        countryCode,
        localPhoneNumber,
      });
    } else {
      setIsEditing(false);
      setFormData({ rol: 'usuario', estado: 'activo', countryCode: '+58', localPhoneNumber: '' });
    }
    setIsModalOpen(true);
  };
  
  const filteredEmpleados = empleados.filter(emp =>
    `${emp.nombre} ${emp.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.cedula || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cargo?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.user_profile?.email && emp.user_profile.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const getProfileStatus = (emp: Empleado): React.ReactNode => {
    if (emp.user_profile) {
      return (<div className="text-green-600 dark:text-green-400 text-xs font-semibold">Perfil Activo</div>);
    }
    return <span className="text-yellow-600 dark:text-yellow-400 text-xs font-medium">Sin Perfil</span>;
  };

  if (loadingData) return <LoadingSpinner message="Cargando usuarios..." />;

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Gestión de Empleados y Usuarios</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <input type="text" placeholder="Buscar..." className={`${inputFieldClasses} flex-grow`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <button onClick={() => openModal()} className={btnPrimaryClasses} disabled={submitting || Object.values(actionLoadingMap).some(Boolean)}>
                <PlusCircleIcon className="w-5 h-5 mr-2" /> Añadir Empleado y Usuario
            </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['Empleado', 'Cédula', 'Teléfono', 'Cargo', 'Perfil', 'Estado Emp.', 'Acciones'].map(header => (
                <th key={header} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmpleados.map(emp => (
              <tr key={emp.id}>
                <td className="px-3 py-2 whitespace-nowrap text-sm"><div className="font-medium text-gray-900 dark:text-white">{emp.nombre} {emp.apellido}</div></td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.cedula}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.telefono || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{emp.cargo?.nombre || 'N/A'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{getProfileStatus(emp)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                  <button onClick={() => handleToggleEstado(emp)} disabled={actionLoadingMap[emp.id]}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full cursor-pointer ${emp.estado === 'activo' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100 hover:bg-green-200' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100 hover:bg-red-200'} disabled:opacity-50`}
                    title={`Cambiar a ${emp.estado === 'activo' ? 'inactivo' : 'activo'}`}>
                    {actionLoadingMap[emp.id] ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : emp.estado}
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium space-x-1">
                  <button onClick={() => openModal(emp)} className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 rounded-md hover:bg-blue-100 dark:hover:bg-blue-700" title="Editar Empleado y Perfil" disabled={actionLoadingMap[emp.id]}><PencilIcon className="w-4 h-4"/></button>
                  <button onClick={() => emp.id && handleViewHistory(emp.id)} className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600" title="Ver Historial Cargos" disabled={actionLoadingMap[emp.id]}><EyeIcon className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
             {filteredEmpleados.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No se encontraron empleados.</td></tr>}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{isEditing ? 'Editar' : 'Añadir'} Empleado y Usuario</h3>
                <form onSubmit={handleUnifiedSubmit} className="space-y-4">
                    <fieldset className="border p-4 rounded-md dark:border-gray-600"><legend className="px-2 text-sm font-medium text-gray-600 dark:text-gray-300">Datos del Empleado</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre <span className="text-red-500">*</span></label><input type="text" name="nombre" id="nombre" value={formData.nombre || ''} onChange={handleFormChange} required className={`mt-1 ${inputFieldClasses}`} /></div>
                            <div><label htmlFor="apellido" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Apellido <span className="text-red-500">*</span></label><input type="text" name="apellido" id="apellido" value={formData.apellido || ''} onChange={handleFormChange} required className={`mt-1 ${inputFieldClasses}`} /></div>
                            <div><label htmlFor="cedula" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cédula <span className="text-red-500">*</span></label><input type="text" name="cedula" id="cedula" value={formData.cedula || ''} onChange={handleFormChange} onInvalid={handleCedulaInvalid} onInput={handleCedulaInput} required className={`mt-1 ${inputFieldClasses}`} pattern="\d{7,8}" /></div>
                            <div>
                                <label htmlFor="localPhoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <select
                                        name="countryCode"
                                        id="countryCode"
                                        value={formData.countryCode || '+58'}
                                        onChange={handleFormChange}
                                        className="block w-28 px-3 py-2 rounded-none rounded-l-md border-r-0 border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        {countryCodes.map(c => <option key={c.name} value={c.code}>{c.name} ({c.code})</option>)}
                                    </select>
                                    <input
                                        type="tel"
                                        name="localPhoneNumber"
                                        id="localPhoneNumber"
                                        value={formData.localPhoneNumber || ''}
                                        onChange={handleFormChange}
                                        className={`flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md ${inputFieldClasses.replace('rounded-md', '')}`}
                                        placeholder="4121234567"
                                        pattern="\d{7,15}"
                                        title="Ingrese solo el número de teléfono, sin el código de país."
                                    />
                                </div>
                            </div>
                            <div><label htmlFor="cargo_actual_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cargo <span className="text-red-500">*</span></label><select name="cargo_actual_id" id="cargo_actual_id" value={formData.cargo_actual_id || ''} onChange={handleFormChange} required className={`mt-1 ${inputFieldClasses}`}><option value="">Seleccionar</option>{cargos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                            <div><label htmlFor="departamento_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento <span className="text-red-500">*</span></label><select name="departamento_id" id="departamento_id" value={formData.departamento_id || ''} onChange={handleFormChange} required className={`mt-1 ${inputFieldClasses}`}><option value="">Seleccionar</option>{departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
                            <div className="md:col-span-2"><label htmlFor="estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado <span className="text-red-500">*</span></label><select name="estado" id="estado" value={formData.estado || 'activo'} onChange={handleFormChange} className={`mt-1 ${inputFieldClasses}`}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                        </div>
                    </fieldset>
                    <fieldset className="border p-4 rounded-md dark:border-gray-600"><legend className="px-2 text-sm font-medium text-gray-600 dark:text-gray-300">Datos de Acceso</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email <span className="text-red-500">*</span></label><input type="email" name="email" id="email" value={formData.email || ''} onChange={handleFormChange} required disabled={isEditing} className={`mt-1 ${inputFieldClasses}`} /></div>
                            {!isEditing && <div><label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña <span className="text-red-500">*</span></label><input type="password" name="password" id="password" placeholder="Mínimo 6 caracteres" onChange={handleFormChange} required minLength={6} className={`mt-1 ${inputFieldClasses}`} autoComplete="new-password"/></div>}
                            <div><label htmlFor="rol" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rol <span className="text-red-500">*</span></label><select name="rol" id="rol" value={formData.rol || 'usuario'} onChange={handleFormChange} required className={`mt-1 ${inputFieldClasses}`}><option value="usuario">Usuario</option><option value="admin">Administrador</option></select></div>
                        </div>
                    </fieldset>
                    <div className="flex justify-end space-x-3 pt-5 border-t dark:border-gray-700"><button type="button" onClick={() => setIsModalOpen(false)} className={btnSecondaryClasses} disabled={submitting}>Cancelar</button><button type="submit" className={btnPrimaryClasses} disabled={submitting}>{submitting && <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" />}{submitting ? 'Guardando...' : 'Guardar Cambios'}</button></div>
                </form>
            </div>
        </div>
      )}
      
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md text-center border-t-4 ${feedbackType === 'success' ? 'border-green-500' : 'border-red-500'}`}>
                {feedbackType === 'success' ? <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" /> : <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{feedbackType === 'success' ? '¡Éxito!' : 'Error'}</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-line text-sm">{feedbackMessage}</p>
                <button onClick={() => setShowFeedbackModal(false)} className={feedbackType === 'success' ? btnPrimaryClasses : btnDangerClasses}>Entendido</button>
            </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 p-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 border-b dark:border-gray-700 pb-3">Historial de Cargos</h3>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cargo</th><th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha Inicio</th><th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha Fin</th></tr></thead>
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