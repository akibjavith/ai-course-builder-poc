import React from 'react';

const fieldBase =
  'w-full px-3.5 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 ' +
  'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed resize-y';

export default function Textarea({ label, error, hint, id, className = '', containerClassName = '', rows = 4, ...rest }) {
  const inputId = id || rest.name;
  return (
    <div className={['space-y-1.5', containerClassName].join(' ')}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
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
