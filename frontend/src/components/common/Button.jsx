import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const VARIANT_MAP = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent focus:ring-emerald-500',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 focus:ring-slate-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent focus:ring-red-500',
  outline: 'bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 focus:ring-slate-500'
};

export default function Button({ 
  children, 
  variant = 'primary', 
  onClick, 
  type = 'button',
  disabled = false, 
  loading = false,
  className = '',
  icon: Icon
}) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = VARIANT_MAP[variant] || VARIANT_MAP.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${className}`}
    >
      {loading && <LoadingSpinner className="h-4 w-4" />}
      {!loading && Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
