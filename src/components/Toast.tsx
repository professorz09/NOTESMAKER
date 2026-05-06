import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

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

const STYLES: Record<ToastType, { container: string; icon: string }> = {
  success: {
    container: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-50',
    icon: 'text-emerald-400',
  },
  error: {
    container: 'bg-red-950/95 border-red-500/40 text-red-50',
    icon: 'text-red-400',
  },
  warning: {
    container: 'bg-amber-950/95 border-amber-500/40 text-amber-50',
    icon: 'text-amber-400',
  },
  info: {
    container: 'bg-slate-900/95 border-slate-500/40 text-slate-100',
    icon: 'text-blue-400',
  },
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastCard({ toast: t, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const style = STYLES[t.type];
  const Icon = ICONS[t.type];

  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), DURATION[t.type]);
    return () => clearTimeout(timer);
  }, [t.id, t.type, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl w-full max-w-sm pointer-events-auto ${style.container}`}
      style={{ animation: 'slideUp 0.25s ease-out' }}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${style.icon}`} />
      <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
      <button
        onClick={() => onRemove(t.id)}
        className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0 ml-1"
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
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))', minWidth: 'min(90vw, 360px)' }}
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
