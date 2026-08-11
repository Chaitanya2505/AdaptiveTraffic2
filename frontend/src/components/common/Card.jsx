import React from 'react';

export default function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-md transition-all ${className}`}>
      {(title || subtitle || action) && (
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-bold text-white leading-none">{title}</h3>}
            {subtitle && <p className="mt-1.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
