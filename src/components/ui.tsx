import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import type { ToastItem } from '../state/store';
import { cls } from '../lib/utils';

export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', className, title,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 select-none';
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-5 py-3 text-base',
  };
  const variants = {
    primary: 'bg-brand-gradient text-white shadow-glow hover:brightness-110 active:brightness-95',
    secondary: 'bg-ink-700 text-ink-100 border border-ink-600 hover:bg-ink-600',
    ghost: 'text-ink-200 hover:text-white hover:bg-ink-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  };
  return (
    <button title={title} type={type} disabled={disabled} onClick={onClick}
      className={cls(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  );
}

export function Chip({
  children, active, onClick, onRemove, className,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        'group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-brand-400 bg-brand-500/15 text-brand-100 shadow-[inset_0_0_0_1px_rgba(168,117,255,0.4)]'
          : 'border-ink-600 bg-ink-800/60 text-ink-200 hover:border-ink-500 hover:text-white',
        className
      )}
    >
      {children}
      {onRemove && (
        <span
          role="button"
          aria-label="Remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 rounded-full p-0.5 text-ink-300 hover:bg-ink-700 hover:text-white"
        >
          <X size={12} />
        </span>
      )}
    </button>
  );
}

export function Card({ children, className, padding = true }: { children: React.ReactNode; className?: string; padding?: boolean }) {
  return (
    <div className={cls(
      'rounded-xl border border-ink-700 bg-ink-850 bg-panel-gradient',
      padding && 'p-4',
      className
    )}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-300">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function TextInput({
  value, onChange, placeholder, type = 'text', autoFocus, className, onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type={type}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      className={cls(
        'w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder-ink-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30',
        className
      )}
    />
  );
}

export function Textarea({ value, onChange, placeholder, rows = 3, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cls(
        'w-full resize-none rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder-ink-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30',
        className
      )}
    />
  );
}

export function Select<T extends string>({ value, onChange, options, className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cls(
        'w-full appearance-none rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30',
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-900">
          {o.label}{o.hint ? ` — ${o.hint}` : ''}
        </option>
      ))}
    </select>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-10" onClick={onClose}>
      <div
        className={cls('relative w-full rounded-2xl border border-ink-700 bg-ink-900 shadow-soft', wide ? 'max-w-4xl' : 'max-w-xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
          <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cls('animate-spin', className)} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <span className={cls(
        'relative inline-flex h-5 w-9 items-center rounded-full transition',
        checked ? 'bg-brand-500' : 'bg-ink-600'
      )}
        onClick={() => onChange(!checked)}
      >
        <span className={cls(
          'absolute h-4 w-4 transform rounded-full bg-white transition',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )} />
      </span>
      {label && <span className="text-sm text-ink-100">{label}</span>}
    </label>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-3 lg:bottom-4">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const ms = toast.kind === 'error' ? 6500 : 4500;
    const t = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(t);
  }, [toast.id, toast.kind, onDismiss]);

  const tone = toast.kind === 'error' ? 'border-rose-500/60 bg-rose-500/15 text-rose-100'
    : toast.kind === 'success' ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-100'
    : 'border-brand-400/60 bg-brand-500/15 text-brand-100';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={cls('pointer-events-auto max-w-md rounded-lg border px-4 py-2 text-sm shadow-soft backdrop-blur', tone)}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1">{toast.message}</span>
        <button onClick={() => onDismiss(toast.id)} className="text-current opacity-70 hover:opacity-100"><X size={14} /></button>
      </div>
    </motion.div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 inline-block text-xs font-semibold uppercase tracking-wider text-ink-200">{label}</span>
      {hint && <span className="ml-2 text-xs text-ink-400">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function AccordionCard({
  title, subtitle, summary, action, defaultOpen = false, children,
}: {
  title: string;
  subtitle?: string;
  /** Short one-line summary of the section's current value (e.g. "3 themes · 2 styles"). Shown when collapsed. */
  summary?: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card padding={false}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">{title}</h3>
            {!open && summary && (
              <span className="truncate text-xs text-ink-300">· {summary}</span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-ink-300">
          {action}
          <ChevronDown
            size={16}
            className={cls('transition-transform', open && 'rotate-180')}
          />
        </div>
      </button>
      {open && <div className="border-t border-ink-700 px-4 py-4">{children}</div>}
    </Card>
  );
}

export function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-600 p-8 text-center">
      <div className="text-ink-400">{icon}</div>
      <div className="text-sm font-medium text-ink-100">{title}</div>
      {hint && <div className="max-w-sm text-xs text-ink-400">{hint}</div>}
    </div>
  );
}
