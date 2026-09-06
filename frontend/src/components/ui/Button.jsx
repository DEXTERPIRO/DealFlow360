import React from 'react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-heading font-bold rounded-full border-2 border-slate-900 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-pop-violet focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 shadow-pop-sm hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-pop active:translate-y-0.5 active:translate-x-0.5 active:shadow-none',
    md: 'text-xs sm:text-sm px-4 py-2 gap-2 shadow-pop hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-pop-lg active:translate-y-0.5 active:translate-x-0.5 active:shadow-pop-sm',
    lg: 'text-sm sm:text-base px-6 py-2.5 gap-2.5 shadow-pop hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-pop-lg active:translate-y-0.5 active:translate-x-0.5 active:shadow-pop-sm',
  };

  const variantStyles = {
    primary:
      'bg-pop-violet hover:bg-[#7C3AED] text-white',
    secondary:
      'bg-white hover:bg-pop-yellow text-slate-900',
    candy:
      'bg-pop-pink hover:bg-[#EC4899] text-white',
    mint:
      'bg-pop-mint hover:bg-[#10B981] text-slate-900',
    outline:
      'bg-transparent hover:bg-slate-100 text-slate-900 shadow-pop-sm hover:shadow-pop',
    danger:
      'bg-rose-500 hover:bg-rose-600 text-white',
    ghost:
      'border-transparent shadow-none hover:bg-slate-200/70 text-slate-700 hover:text-slate-900',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
