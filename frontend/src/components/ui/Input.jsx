import React from 'react';

const fieldBase =
  'w-full h-11 px-3.5 rounded-xl border text-sm text-slate-900 placeholder-slate-400 ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 ' +
  'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

/**
 * Shared text input primitive with consistent label/help/error spacing.
 * Renders a plain <input> under the hood so existing value/onChange/etc.
 * props work exactly as before.
 */
export default function Input({ label, error, hint, id, className = '', containerClassName = '', ...rest }) {
  const inputId = id || rest.name;
  return (
    <div className={['space-y-1.5', containerClassName].join(' ')}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          fieldBase,
          error ? 'border-red-400 focus:ring-red-500/40 focus:border-red-500' : 'border-slate-300',
          className,
        ].join(' ')}
        {...rest}
      />
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
