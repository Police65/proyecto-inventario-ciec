
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', message }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-20 h-20 border-[6px]',
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} border-t-primary-500 border-r-primary-500 border-b-gray-200 dark:border-b-gray-700 border-l-gray-200 dark:border-l-gray-700`}
      ></div>
      {message && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
    