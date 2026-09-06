import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity fade-in"
        onClick={closeOnClickOutside ? onClose : undefined}
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative w-full ${widthClass} rounded-3xl bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-xl z-10 my-auto overflow-hidden fade-in text-slate-900 ${className}`}
        style={{ animationDuration: '200ms' }}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-900 bg-white">
            <div className="flex items-center gap-3 pr-4">
              {Icon && (
                <div className="w-10 h-10 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
              )}
              <div>
                {title && (
                  <h3 className="text-lg font-black text-slate-900 tracking-tight font-heading">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs font-bold text-slate-600 mt-0.5 font-heading">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-pop-xs"
                title="Close"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 max-h-[calc(85vh-130px)] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-slate-900 bg-white">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};

export default Modal;
