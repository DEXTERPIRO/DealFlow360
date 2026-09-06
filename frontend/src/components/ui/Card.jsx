import React from 'react';

export const Card = ({ children, className = '', hover = true, shadow = 'pop', ...props }) => {
  const shadowClass = {
    'pop': 'shadow-pop',
    'pop-lg': 'shadow-pop-lg',
    'pop-sm': 'shadow-pop-sm',
    'none': '',
  }[shadow] || 'shadow-pop';

  return (
    <div
      className={`bg-white rounded-2xl border-2 border-slate-900 p-5 text-slate-900 ${shadowClass} ${
        hover ? 'hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-pop-lg transition-all duration-200' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
