
import React, { useState, useEffect } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

const ThemeToggle: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false; // Por defecto a false si window no está definido (SSR)
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      aria-label="Cambiar tema"
    >
      {isDarkMode ? (
        <SunIcon className="w-5 h-5 sm:w-6 sm:h-6" />
      ) : (
        <MoonIcon className="w-5 h-5 sm:w-6 sm:h-6" />
      )}
    </button>
  );
};

export default ThemeToggle;