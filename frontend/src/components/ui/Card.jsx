import React from 'react';

export const Card = ({ children, className = '', hover = false, ...props }) => {
  return (
    <div
      className={`rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl ${
        hover ? 'hover:border-slate-700 hover:shadow-2xl hover:shadow-brand-950/20 transition-all duration-200' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
