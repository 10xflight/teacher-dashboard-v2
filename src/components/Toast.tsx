'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

// ============================================================
// Types
// ============================================================

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  leaving: boolean;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, isError?: boolean) => void;
}

// ============================================================
// Context
// ============================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

// ============================================================
// Provider
// ============================================================

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, isError = false) => {
    const id = nextId.current++;
    const type: ToastType = isError ? 'error' : 'success';
    const duration = DEFAULT_DURATION;

    setToasts((prev) => [...prev, { id, message, type, leaving: false, duration }]);

    // Start leave animation 300ms before removal
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
    }, duration - 300);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ============================================================
// Container
// ============================================================

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ============================================================
// Toast styling config
// ============================================================

const TOAST_STYLES: Record<ToastType, {
  bg: string;
  border: string;
  icon: string;
  progressBg: string;
}> = {
  success: {
    bg: 'bg-[#0a2e1a]',
    border: 'border-accent-green/40',
    icon: 'text-accent-green',
    progressBg: 'bg-accent-green',
  },
  error: {
    bg: 'bg-[#2e0a0a]',
    border: 'border-accent-red/40',
    icon: 'text-accent-red',
    progressBg: 'bg-accent-red',
  },
  info: {
    bg: 'bg-[#0a1a2e]',
    border: 'border-accent/40',
    icon: 'text-accent',
    progressBg: 'bg-accent',
  },
};

// ============================================================
// Icons
// ============================================================

function SuccessIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

const ICONS: Record<ToastType, React.FC> = {
  success: SuccessIcon,
  error: ErrorIcon,
  info: InfoIcon,
};

// ============================================================
// Individual Toast
// ============================================================

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const style = TOAST_STYLES[toast.type];
  const Icon = ICONS[toast.type];

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isVisible = mounted && !toast.leaving;

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl
        min-w-[300px] max-w-[420px]
        border backdrop-blur-sm
        transition-all duration-300 ease-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}
        ${style.bg} ${style.border}
      `}
      role="alert"
    >
      {/* Icon */}
      <span className={`flex-shrink-0 mt-0.5 ${style.icon}`}>
        <Icon />
      </span>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-text-primary leading-snug block">
          {toast.message}
        </span>
        {/* Progress bar */}
        <div className="mt-2 h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${style.progressBg} origin-left`}
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
