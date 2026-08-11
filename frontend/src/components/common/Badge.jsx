import React from 'react';

const VARIANT_MAP = {
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  critical: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  neutral: 'bg-slate-800 text-slate-400 border-slate-700'
};

export default function Badge({ children, variant = 'neutral', className = '' }) {
  const classes = VARIANT_MAP[variant] || VARIANT_MAP.neutral;

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${classes} ${className}`}>
      {children}
    </span>
  );
}
