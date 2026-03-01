'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// ============================================================
// Types
// ============================================================

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ============================================================
// Context
// ============================================================

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

// ============================================================
// Provider
// ============================================================

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    pending?.resolve(true);
    setPending(null);
  }, [pending]);

  const handleCancel = useCallback(() => {
    pending?.resolve(false);
    setPending(null);
  }, [pending]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <ConfirmDialogOverlay
          options={pending.options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// ============================================================
// Variant Styles
// ============================================================

const VARIANT_STYLES: Record<ConfirmVariant, {
  iconBg: string;
  iconColor: string;
  buttonBg: string;
  buttonHover: string;
}> = {
  danger: {
    iconBg: 'bg-accent-red/15',
    iconColor: 'text-accent-red',
    buttonBg: 'bg-accent-red',
    buttonHover: 'hover:bg-accent-red/80',
  },
  warning: {
    iconBg: 'bg-accent-yellow/15',
    iconColor: 'text-accent-yellow',
    buttonBg: 'bg-accent-yellow',
    buttonHover: 'hover:bg-accent-yellow/80',
  },
  info: {
    iconBg: 'bg-accent/15',
    iconColor: 'text-accent',
    buttonBg: 'bg-accent',
    buttonHover: 'hover:brightness-110',
  },
};

// ============================================================
// Icons
// ============================================================

function DangerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}

// ============================================================
// Dialog Overlay
// ============================================================

function ConfirmDialogOverlay({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const variant = options.variant || 'danger';
  const style = VARIANT_STYLES[variant];
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button on mount, Escape to cancel
  useEffect(() => {
    confirmBtnRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const IconComponent = variant === 'danger' ? DangerIcon : variant === 'warning' ? WarningIcon : InfoIcon;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[modal-overlay-in_0.2s_ease]"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-[380px] bg-bg-card border border-border rounded-2xl shadow-2xl animate-[modal-in_0.25s_ease] overflow-hidden">
        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${style.iconBg}`}>
              <span className={style.iconColor}>
                <IconComponent />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-text-primary">
                {options.title}
              </h3>
              <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
                {options.message}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 px-6 pb-5 pt-1 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-input border border-border rounded-lg hover:bg-hover hover:text-text-primary transition-colors"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all ${style.buttonBg} ${style.buttonHover}`}
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
