import { useState, useCallback } from 'react';
import Toast from '../components/Toast';

let toastId = 0;
let toastListeners = [];

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = toastId++;
    const newToast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, newToast]);
    
    // Auto remove after duration + fade out time
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration + 300);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-[9999] space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );

  return { showToast, ToastContainer };
};

// Simple toast utility function for use without hook
let globalToastContainer = null;

export const setToastContainer = (container) => {
  globalToastContainer = container;
};

export const showToastMessage = (message, type = 'success', duration = 3000) => {
  if (globalToastContainer) {
    globalToastContainer(message, type, duration);
  } else {
    // Fallback to console if toast container not set
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};
