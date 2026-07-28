import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-sky-600 text-white shadow-sm shadow-sky-600/20 hover:bg-sky-700 focus-visible:ring-sky-500 disabled:hover:bg-sky-600',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-slate-400 disabled:hover:bg-white',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 focus-visible:ring-red-500 disabled:hover:bg-red-600',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400 disabled:hover:bg-transparent',
  warning: 'bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 focus-visible:ring-amber-500 disabled:hover:bg-amber-500',
  success: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600 focus-visible:ring-emerald-500 disabled:hover:bg-emerald-500',
  indigo: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 focus-visible:ring-indigo-500 disabled:hover:bg-indigo-600',
  // Secondary buttons with a semantic accent hover (e.g. edit/delete icon buttons in a list)
  'secondary-amber': 'bg-white text-slate-600 border border-slate-300 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 focus-visible:ring-amber-400 disabled:hover:bg-white',
  'secondary-danger': 'bg-white text-slate-600 border border-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 focus-visible:ring-red-400 disabled:hover:bg-white',
  // Solid white button for use on a colored (e.g. sky-600) card background
  white: 'bg-white text-sky-600 shadow-sm hover:bg-sky-50 focus-visible:ring-white/60 disabled:hover:bg-white',
  // Low-emphasis tinted action on a light background
  tinted: 'bg-sky-50 text-sky-600 border border-sky-100 hover:bg-sky-100 focus-visible:ring-sky-400 disabled:hover:bg-sky-50',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-xs gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  xl: 'h-14 px-10 text-base gap-2.5',
};

/**
 * Shared button primitive. Pure presentation — forwards all native button
 * props (onClick, type, disabled, etc.) untouched so it's a drop-in
 * replacement for hand-rolled `<button className="...">` markup.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap',
        'transition-all duration-150 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
