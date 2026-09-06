import React from 'react';

export const Input = ({
  label,
  error,
  icon: Icon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block font-heading font-bold text-xs uppercase tracking-wider text-slate-800 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Icon className="w-4 h-4" strokeWidth={2.5} />
          </div>
        )}
        <input
          className={`w-full rounded-xl bg-white border-2 ${
            error ? 'border-rose-500 focus:border-rose-600 focus:shadow-[4px_4px_0px_#EF4444]' : 'border-slate-300 focus:border-slate-900 focus:shadow-pop'
          } text-slate-900 placeholder-slate-400 text-sm px-4 py-2.5 transition-all focus:outline-none ${
            Icon ? 'pl-10' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="font-heading font-bold text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
};

export default Input;
