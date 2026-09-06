import React from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';

const COLOR_VARIANTS = {
  blue: {
    iconBg: 'bg-pop-violet text-white',
    badgeBg: 'bg-violet-100 text-violet-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  emerald: {
    iconBg: 'bg-pop-mint text-slate-900',
    badgeBg: 'bg-emerald-100 text-emerald-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  green: {
    iconBg: 'bg-pop-mint text-slate-900',
    badgeBg: 'bg-emerald-100 text-emerald-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  amber: {
    iconBg: 'bg-pop-yellow text-slate-900',
    badgeBg: 'bg-amber-100 text-amber-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  yellow: {
    iconBg: 'bg-pop-yellow text-slate-900',
    badgeBg: 'bg-amber-100 text-amber-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  purple: {
    iconBg: 'bg-pop-violet text-white',
    badgeBg: 'bg-purple-100 text-purple-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  rose: {
    iconBg: 'bg-pop-pink text-white',
    badgeBg: 'bg-pink-100 text-pink-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  red: {
    iconBg: 'bg-rose-500 text-white',
    badgeBg: 'bg-rose-100 text-rose-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
  slate: {
    iconBg: 'bg-slate-900 text-white',
    badgeBg: 'bg-slate-100 text-slate-900',
    hoverBorder: 'hover:border-slate-900',
    subText: 'text-slate-600',
  },
};

export const KPICard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  trend,
  badge,
  onClick,
  loading = false,
  mono = false,
  className = '',
}) => {
  const theme = COLOR_VARIANTS[variant] || COLOR_VARIANTS.blue;
  const isClickable = Boolean(onClick);

  if (loading) {
    return (
      <div className={`bg-white border-2 border-slate-900 rounded-2xl p-5 flex items-center justify-between shadow-pop animate-pulse ${className}`}>
        <div className="space-y-2">
          <div className="h-3 w-24 bg-slate-200 rounded-full" />
          <div className="h-8 w-24 bg-slate-200 rounded-xl" />
          <div className="h-3 w-32 bg-slate-200 rounded-full" />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-slate-200 border-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white border-2 border-slate-900 rounded-2xl p-5 flex items-center justify-between shadow-pop transition-all duration-200 select-none ${
        isClickable
          ? 'cursor-pointer group hover:-translate-y-1 hover:-translate-x-1 hover:shadow-pop-lg active:translate-y-0.5 active:translate-x-0.5 active:shadow-pop-sm'
          : 'hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-pop-lg'
      } ${className}`}
    >
      <div className="flex-1 min-w-0 pr-3">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <p className="text-xs font-heading font-bold text-slate-600 uppercase tracking-wider truncate">
            {title}
          </p>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-heading font-bold border-2 border-slate-900 bg-slate-100 text-slate-900 shadow-pop-sm">
              {badge}
            </span>
          )}
        </div>

        {/* Value */}
        <h3
          className={`text-2xl sm:text-3xl font-heading font-extrabold mt-1 truncate text-slate-900 ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value ?? '—'}
        </h3>

        {/* Subtitle or Trend */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {trend && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-heading font-bold border-2 border-slate-900 shadow-pop-sm ${
                trend.direction === 'up'
                  ? 'bg-pop-mint text-slate-900'
                  : trend.direction === 'down'
                  ? 'bg-rose-300 text-slate-900'
                  : 'bg-slate-100 text-slate-900'
              }`}
            >
              {trend.direction === 'up' && <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" strokeWidth={2.5} />}
              {trend.direction === 'down' && <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" strokeWidth={2.5} />}
              {trend.value}
              {trend.label && <span className="text-slate-700 font-medium ml-1">({trend.label})</span>}
            </span>
          )}

          {subtitle && !trend && (
            <p className={`text-xs font-medium truncate ${theme.subText}`}>
              {subtitle}
            </p>
          )}

          {isClickable && !subtitle && !trend && (
            <span className="text-xs text-slate-600 font-bold flex items-center gap-0.5 group-hover:text-pop-violet group-hover:underline">
              <span>View details</span>
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>

      {/* Geometric Icon */}
      {Icon && (
        <div
          className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border-2 border-slate-900 shadow-pop-sm flex items-center justify-center flex-shrink-0 transition-transform ${
            theme.iconBg
          } ${isClickable ? 'group-hover:scale-105 group-hover:-rotate-3' : ''}`}
        >
          {typeof Icon === 'function' ? <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} /> : Icon}
        </div>
      )}
    </div>
  );
};

export default KPICard;
