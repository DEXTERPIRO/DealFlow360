import React from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';

const COLOR_VARIANTS = {
  blue: {
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    valueText: 'text-white',
    hoverBorder: 'hover:border-blue-500/40',
    subText: 'text-blue-400',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    valueText: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/40',
    subText: 'text-slate-400',
  },
  green: {
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    valueText: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/40',
    subText: 'text-slate-400',
  },
  amber: {
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    valueText: 'text-amber-400',
    hoverBorder: 'hover:border-amber-500/40',
    subText: 'text-slate-400',
  },
  yellow: {
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    valueText: 'text-amber-400',
    hoverBorder: 'hover:border-amber-500/40',
    subText: 'text-slate-400',
  },
  purple: {
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    valueText: 'text-purple-300',
    hoverBorder: 'hover:border-purple-500/40',
    subText: 'text-purple-400',
  },
  rose: {
    iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    valueText: 'text-rose-400',
    hoverBorder: 'hover:border-rose-500/40',
    subText: 'text-rose-400',
  },
  red: {
    iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    valueText: 'text-rose-400',
    hoverBorder: 'hover:border-rose-500/40',
    subText: 'text-rose-400',
  },
  slate: {
    iconBg: 'bg-slate-800/80 border-slate-700 text-slate-300',
    valueText: 'text-slate-100',
    hoverBorder: 'hover:border-slate-700',
    subText: 'text-slate-400',
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
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm animate-pulse ${className}`}>
        <div className="space-y-2">
          <div className="h-3 w-24 bg-slate-800 rounded" />
          <div className="h-7 w-20 bg-slate-800 rounded" />
          <div className="h-3 w-32 bg-slate-800 rounded" />
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-800" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm transition-all duration-200 ${
        isClickable
          ? `cursor-pointer group ${theme.hoverBorder} hover:shadow-lg hover:shadow-black/40`
          : ''
      } ${className}`}
    >
      <div className="flex-1 min-w-0 pr-3">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {badge}
            </span>
          )}
        </div>

        {/* Value */}
        <h3
          className={`text-2xl font-black mt-1 truncate ${
            theme.valueText
          } ${mono ? 'font-mono' : ''}`}
        >
          {value ?? '—'}
        </h3>

        {/* Subtitle or Trend */}
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {trend && (
            <span
              className={`inline-flex items-center text-[11px] font-semibold ${
                trend.direction === 'up'
                  ? 'text-emerald-400'
                  : trend.direction === 'down'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {trend.direction === 'up' && <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />}
              {trend.direction === 'down' && <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
              {trend.value}
              {trend.label && <span className="text-slate-500 font-normal ml-1">{trend.label}</span>}
            </span>
          )}

          {subtitle && !trend && (
            <p className={`text-[11px] font-medium truncate ${theme.subText}`}>
              {subtitle}
            </p>
          )}

          {isClickable && !subtitle && !trend && (
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-0.5 group-hover:text-blue-400 group-hover:underline">
              <span>View details</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Icon */}
      {Icon && (
        <div
          className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 transition-transform ${
            theme.iconBg
          } ${isClickable ? 'group-hover:scale-105' : ''}`}
        >
          {typeof Icon === 'function' ? <Icon className="w-6 h-6" /> : Icon}
        </div>
      )}
    </div>
  );
};

export default KPICard;
