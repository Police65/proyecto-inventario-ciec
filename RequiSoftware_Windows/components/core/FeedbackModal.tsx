// components/core/FeedbackModal.tsx
import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface FeedbackModalProps {
  show: boolean;
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ show, type, message, onClose }) => {
  if (!show) return null;

  const isSuccess = type === 'success';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black bg-opacity-60 p-4" aria-modal="true" role="dialog">
      <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md text-center border-t-4 ${isSuccess ? 'border-green-500' : 'border-red-500'}`}>
        {isSuccess ? (
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4 pop-in-animation" />
        ) : (
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4 pop-in-animation" />
        )}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
          {isSuccess ? '¡Éxito!' : 'Error'}
        </h3>
        <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-line text-sm">{message}</p>
        <button
          onClick={onClose}
          className={`w-full flex items-center justify-center px-4 py-2 font-medium rounded-md shadow-sm text-sm text-white transition-transform duration-150 ease-in-out active:scale-95 ${isSuccess ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
};

export default FeedbackModal;
