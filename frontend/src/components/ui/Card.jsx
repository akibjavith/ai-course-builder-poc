import React from 'react';

/**
 * Shared card container primitive — consistent padding, radius, border,
 * and shadow so cards look the same across every page.
 */
export default function Card({ as: Tag = 'div', padded = true, className = '', children, ...rest }) {
  return (
    <Tag
      className={[
        'bg-white rounded-2xl border border-slate-200/80 shadow-sm',
        padded ? 'p-6' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ className = '', children, ...rest }) {
  return (
    <div className={['mb-4 flex items-center justify-between gap-4', className].join(' ')} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...rest }) {
  return (
    <div className={['mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3', className].join(' ')} {...rest}>
      {children}
    </div>
  );
}
