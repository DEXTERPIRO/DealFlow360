import React from 'react';

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-900',
    brand: 'bg-pop-violet text-white',
    success: 'bg-pop-mint text-slate-900',
    warning: 'bg-pop-yellow text-slate-900',
    danger: 'bg-rose-500 text-white',
    pink: 'bg-pop-pink text-white',
    sky: 'bg-pop-sky text-slate-900',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold border-2 border-slate-900 shadow-pop-sm uppercase tracking-wide ${
        variantStyles[variant] || variantStyles.default
      } ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
