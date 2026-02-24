'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

interface ToastMessage {
  id: number;
  message: string;
  isError: boolean;
  leaving: boolean;
}

interface ToastContextValue {
  showToast: (message: string, isError?: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, isError = false) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, isError, leaving: false }]);

    // Start leave animation after 2.7s, remove after 3s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
    }, 2700);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isVisible = mounted && !toast.leaving;

  return (
    <div
      className={`
        flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg
        min-w-[280px] max-w-[400px]
        transition-all duration-300 ease-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${toast.isError ? 'bg-accent-red' : 'bg-accent-green'}
        text-white font-medium text-sm
      `}
      role="alert"
    >
      <span className="flex-shrink-0 text-base">
        {toast.isError ? '\u2716' : '\u2714'}
      </span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 ml-2 text-white/80 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        {'\u2715'}
      </button>
    </div>
  );
}
