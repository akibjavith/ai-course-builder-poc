import React from 'react';

const VARIANTS = {
  slate: 'bg-slate-100 text-slate-700',
  sky: 'bg-sky-100 text-sky-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

export default function Badge({ variant = 'slate', className = '', children, ...rest }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
        VARIANTS[variant] || VARIANTS.slate,
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </span>
  );
}
