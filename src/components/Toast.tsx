import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import '../liquid-panels.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

// Module-level store so hooks outside React tree can call showToast
let _dispatch: ((toast: ToastItem) => void) | null = null;

export function registerToastDispatch(fn: (toast: ToastItem) => void) {
  _dispatch = fn;
}

function emit(message: string, type: ToastType) {
  if (_dispatch) {
    _dispatch({ id: crypto.randomUUID(), message, type });
  } else {
    // Fallback before provider mounts
    if (type === 'error') console.error('[Toast Error]', message);
    else console.warn('[Toast]', type, message);
  }
}

export const toast = {
  show: (message: string, type: ToastType = 'info') => emit(message, type),
  error: (message: string) => emit(message, 'error'),
  success: (message: string) => emit(message, 'success'),
  warning: (message: string) => emit(message, 'warning'),
  info: (message: string) => emit(message, 'info'),
};

const DURATION: Record<ToastType, number> = {
  error: 7000,
  warning: 5000,
  success: 3500,
  info: 4000,
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastCard({ toast: t, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const Icon = ICONS[t.type];

  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), DURATION[t.type]);
    return () => clearTimeout(timer);
  }, [t.id, t.type, onRemove]);

  return (
    <div
      role={t.type === 'error' ? 'alert' : 'status'}
      className="nm-raised nm-toast flex items-center gap-2.5 pl-2 pr-2 py-2 w-full max-w-sm pointer-events-auto"
      style={{ animation: 'slideUp 0.28s var(--nm-spring) both' }}
    >
      <span className={`nm-toast-dot ${t.type}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <p className="nm-head text-[13px] font-semibold flex-1 leading-snug py-1">{t.message}</p>
      <button
        onClick={() => onRemove(t.id)}
        className="nm-icon-btn nm-muted !w-8 !h-8 !rounded-full flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((t: ToastItem) => {
    setToasts(prev => [...prev.slice(-4), t]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    registerToastDispatch(addToast);
    return () => { _dispatch = null; };
  }, [addToast]);

  return (
    <>
      {children}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none"
        style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', width: 'min(calc(100vw - 32px), 384px)' }}
      >
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};
