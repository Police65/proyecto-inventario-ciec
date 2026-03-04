
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { EyeIcon, EyeSlashIcon, ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { LIGHT_MODE_LOGO_URL, DARK_MODE_LOGO_URL } from '../../assets/paths';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login: authLogin } = useAuth();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authLogin(email, password);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Error de inicio de sesión. Verifica tus credenciales.");
      } else {
        setError("Ocurrió un error desconocido durante el inicio de sesión.");
      }
      console.error("Falló el inicio de sesión:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Left Side: Visual/Branding (Visible only on large screens) */}
      <div className="hidden lg:flex relative flex-col justify-center p-12 overflow-hidden bg-slate-900">
        {/* Animated Mesh Gradient Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-primary-600/30 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[100px] animate-pulse [animation-delay:2s]" />
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[80px] animate-pulse [animation-delay:4s]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(15,23,42,0.8)_100%)]" />
        </div>

        {/* Content over background */}
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary-500 mr-3 animate-ping" />
            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Sistema de Gestión v3.0</span>
          </div>

          <h1 className="text-6xl font-display font-black text-white leading-[1.1] mb-6">
            Optimiza tu flujo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-blue-400">adquisiciones</span>
          </h1>
          <p className="text-xl text-slate-400 font-medium max-w-lg mb-10 leading-relaxed">
            Gestión inteligente de órdenes de compra, seguimiento en tiempo real y reportes consolidados para tu empresa.
          </p>

          <div className="space-y-4">
            {[
              'Trazabilidad total de cada requerimiento',
              'Consolidación inteligente de pedidos',
              'Control de inventario en tiempo real',
              'Reportes automatizados'
            ].map((feature, i) => (
              <div key={i} className="flex items-center space-x-3 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating elements decoration */}
        <div className="absolute bottom-12 left-12 flex items-center space-x-4 opacity-50">
          <div className="h-px w-12 bg-slate-700" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">CIEC Corp. Powering Enterprises</span>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex items-center justify-center p-8 lg:p-24 relative">
        {/* Background blobs for mobile */}
        <div className="lg:hidden absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100/50 blur-3xl -mr-32 -mt-32 rounded-full" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-100/30 blur-3xl -ml-32 -mb-32 rounded-full" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="mb-12">
            <div className="flex items-center space-x-4 mb-8">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                <img src={LIGHT_MODE_LOGO_URL} className="h-8 w-auto dark:hidden" alt="Logo" />
                <img src={DARK_MODE_LOGO_URL} className="h-8 w-auto hidden dark:block" alt="Logo" />
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Acceso Seguro</span>
            </div>

            <h2 className="text-4xl font-display font-black text-slate-900 dark:text-white mb-4">
              Iniciar Sesión
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Bienvenido de nuevo. Por favor, ingresa tus detalles.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-2xl flex items-center space-x-3 text-sm font-medium animate-shake">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Email</label>
                <div className="relative group">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-6 pr-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-primary-500 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all duration-300 text-slate-900 dark:text-white font-medium"
                    placeholder="ejemplo@empresa.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Contraseña</label>
                  <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">¿Olvidaste la clave?</a>
                </div>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-6 pr-14 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-primary-500 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all duration-300 text-slate-900 dark:text-white font-medium"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-400 hover:text-primary-600 transition-colors"
                  >
                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>


            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all duration-500 shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center space-x-2 group active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Entrar al Sistema</span>
                  <ChevronRightIcon className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
            <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">
              © {new Date().getFullYear()} RequiSoftware CIEC • Inteligencia Operacional
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;