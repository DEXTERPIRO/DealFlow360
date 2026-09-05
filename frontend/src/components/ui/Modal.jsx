import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-6xl',
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  size = 'md',
  maxWidth,
  showClose = true,
  closeOnClickOutside = true,
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass = maxWidth || SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity fade-in"
        onClick={closeOnClickOutside ? onClose : undefined}
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative w-full ${widthClass} rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-black/60 z-10 my-auto overflow-hidden fade-in ${className}`}
        style={{ animationDuration: '200ms' }}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3 pr-4">
              {Icon && (
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div>
                {title && (
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors flex-shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="px-6 py-5 max-h-[calc(85vh-120px)] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
