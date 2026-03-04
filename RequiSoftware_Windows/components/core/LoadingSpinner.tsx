
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', message }) => {
  const sizeMap = {
    sm: { container: 'w-10 h-10', outer: 'w-8 h-8', inner: 'w-4 h-4' },
    md: { container: 'w-20 h-20', outer: 'w-16 h-16', inner: 'w-8 h-8' },
    lg: { container: 'w-32 h-32', outer: 'w-24 h-24', inner: 'w-12 h-12' },
  };

  const { container, outer, inner } = sizeMap[size];

  return (
    <div className="flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
      <div className={`relative ${container} flex items-center justify-center`}>
        {/* Glow effect */}
        <div className={`absolute inset-0 bg-primary-500/20 blur-2xl rounded-full animate-pulse`} />

        {/* Outer Ring */}
        <div className={`absolute ${outer} rounded-full border-2 border-t-primary-500 border-r-primary-500 border-b-transparent border-l-transparent animate-spin`} />

        {/* Middle Ring (Reverse Spin) */}
        <div className={`absolute ${outer} rounded-full border-2 border-t-transparent border-r-transparent border-b-blue-400 border-l-blue-400 animate-reverse-spin opacity-50`} />

        {/* Inner Circle */}
        <div className={`absolute ${inner} rounded-full bg-gradient-to-tr from-primary-600 to-blue-400 animate-pulse shadow-lg shadow-primary-500/40`} />
      </div>

      {message && (
        <div className="mt-8 text-center space-y-1">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 animate-pulse text-center">
            {message}
          </p>
          <div className="mx-auto w-12 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent rounded-full opacity-30" />
        </div>
      )}

      <style>{`
        @keyframes reverse-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .animate-reverse-spin {
          animation: reverse-spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;