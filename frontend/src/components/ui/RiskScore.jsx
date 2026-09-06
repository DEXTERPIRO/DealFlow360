import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

export const getRiskLevel = (score) => {
  const num = Number(score || 0);
  if (num < 5) {
    return {
      level: 'low',
      label: 'Low Risk',
      shortLabel: 'Low',
      bgClass: 'bg-pop-mint text-slate-900',
      icon: ShieldCheck,
      color: '#34D399',
    };
  }
  if (num < 10) {
    return {
      level: 'medium',
      label: 'Medium Risk',
      shortLabel: 'Med',
      bgClass: 'bg-pop-yellow text-slate-900',
      icon: AlertTriangle,
      color: '#FBBF24',
    };
  }
  return {
    level: 'high',
    label: 'High Risk',
    shortLabel: 'High',
    bgClass: 'bg-rose-400 text-white',
    icon: ShieldAlert,
    color: '#F87171',
  };
};

export const RiskScore = ({
  score = 0,
  max = 15,
  variant = 'chip',
  size = 'md',
  showLabel = true,
  showMax = false,
  className = '',
}) => {
  const numScore = Number(score || 0);
  const formattedScore = numScore.toFixed(1);
  const info = getRiskLevel(numScore);
  const Icon = info.icon;
  const percent = Math.min(Math.max((numScore / max) * 100, 0), 100);

  // 1. CHIP VARIANT (default compact table / card pill)
  if (variant === 'chip') {
    const isSm = size === 'sm';
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-heading font-bold rounded-full border-2 border-slate-900 shadow-pop-sm select-none ${
          info.bgClass
        } ${isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${className}`}
      >
        <Icon size={isSm ? 11 : 13} strokeWidth={2.5} className="shrink-0" />
        <span>
          {showLabel ? `${info.shortLabel}: ` : ''}
          {formattedScore}
          {showMax ? ` / ${max}` : ''}
        </span>
      </span>
    );
  }

  // 2. LED VARIANT
  if (variant === 'led') {
    return (
      <div
        className={`inline-flex items-center gap-2 font-heading font-bold rounded-full border-2 border-slate-900 px-3 py-1 shadow-pop-sm select-none ${info.bgClass} ${className}`}
      >
        <Icon size={14} strokeWidth={2.5} />
        <span className="text-xs">
          {formattedScore}
          <span className="opacity-70 font-normal"> / {max}</span>
        </span>
        {showLabel && (
          <span className="text-[10px] uppercase tracking-wider opacity-90">
            ({info.shortLabel})
          </span>
        )}
      </div>
    );
  }

  // 3. BADGE / METER BLOCK VARIANT
  if (variant === 'badge' || variant === 'meter') {
    const isSm = size === 'sm';
    return (
      <div
        className={`rounded-2xl border-2 border-slate-900 shadow-pop-sm flex flex-col items-center justify-center font-heading select-none ${
          info.bgClass
        } ${isSm ? 'w-10 h-10' : 'w-12 h-12'} ${className}`}
      >
        <span className={`font-black ${isSm ? 'text-xs' : 'text-sm'}`}>
          {formattedScore}
        </span>
        {showLabel && (
          <span className="text-[9px] uppercase font-bold tracking-tight opacity-90">
            {info.shortLabel}
          </span>
        )}
      </div>
    );
  }

  // 4. BAR VARIANT
  if (variant === 'bar') {
    return (
      <div className={`space-y-1.5 w-full ${className}`}>
        <div className="flex items-center justify-between text-xs font-heading font-bold">
          <span className="text-slate-700 flex items-center gap-1.5">
            <Icon size={14} strokeWidth={2.5} />
            <span>Risk Index:</span>
            <span className="text-slate-900 font-extrabold">
              {showLabel ? info.label : formattedScore}
            </span>
          </span>
          <span className="font-extrabold text-slate-900">
            {formattedScore}
            <span className="text-slate-500 font-medium"> / {max}</span>
          </span>
        </div>

        {/* Track */}
        <div className="h-3 w-full bg-slate-100 border-2 border-slate-900 rounded-full overflow-hidden relative shadow-pop-sm">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percent}%`,
              backgroundColor: info.color,
            }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 font-heading font-bold">
          <span>0 (Safe)</span>
          <span>5 (Review)</span>
          <span>10 (Escalate)</span>
          <span>15</span>
        </div>
      </div>
    );
  }

  return (
    <span className={`font-heading font-bold text-xs ${className}`}>
      {formattedScore} / {max}
    </span>
  );
};

export default RiskScore;
