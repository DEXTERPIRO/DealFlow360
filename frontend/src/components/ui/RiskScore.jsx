import React from 'react';

export const getRiskLevel = (score) => {
  const num = Number(score || 0);
  if (num < 5) {
    return {
      level: 'low',
      label: 'Low Risk',
      shortLabel: 'Low',
      color: '#10b981',
      textClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/30',
      glow: 'rgba(16,185,129,0.4)',
    };
  }
  if (num < 10) {
    return {
      level: 'medium',
      label: 'Medium Risk',
      shortLabel: 'Med',
      color: '#f59e0b',
      textClass: 'text-amber-400',
      bgClass: 'bg-amber-500/10',
      borderClass: 'border-amber-500/30',
      glow: 'rgba(245,158,11,0.4)',
    };
  }
  return {
    level: 'high',
    label: 'High Risk',
    shortLabel: 'High',
    color: '#ef4444',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    glow: 'rgba(239,68,68,0.4)',
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
  const percent = Math.min(Math.max((numScore / max) * 100, 0), 100);

  // 1. CHIP VARIANT (default compact table / card pill)
  if (variant === 'chip') {
    const isSm = size === 'sm';
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full border transition-all ${
          info.bgClass
        } ${info.textClass} ${info.borderClass} ${
          isSm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        } ${className}`}
      >
        <span
          className="rounded-full flex-shrink-0"
          style={{
            width: isSm ? 5 : 6,
            height: isSm ? 5 : 6,
            backgroundColor: info.color,
            boxShadow: `0 0 5px ${info.glow}`,
          }}
        />
        <span>
          {showLabel ? `${info.shortLabel}: ` : ''}
          {formattedScore}
          {showMax ? ` / ${max}` : ''}
        </span>
      </span>
    );
  }

  // 2. LED VARIANT (inline glowing ticker indicator)
  if (variant === 'led') {
    return (
      <div
        className={`inline-flex items-center gap-2 font-mono rounded-full border px-3 py-1 ${info.textClass} ${className}`}
        style={{
          background: `${info.color}15`,
          borderColor: `${info.color}40`,
        }}
      >
        <span
          className="rounded-full flex-shrink-0 animate-pulse-dot"
          style={{
            width: 7,
            height: 7,
            backgroundColor: info.color,
            boxShadow: `0 0 7px ${info.color}`,
          }}
        />
        <span className="text-xs font-bold">
          {formattedScore}
          <span className="text-slate-500 font-normal"> / {max}</span>
        </span>
        {showLabel && (
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
            ({info.shortLabel})
          </span>
        )}
      </div>
    );
  }

  // 3. BADGE / METER BLOCK VARIANT (square card / queue visual box)
  if (variant === 'badge' || variant === 'meter') {
    const isSm = size === 'sm';
    return (
      <div
        className={`rounded-xl border flex flex-col items-center justify-center font-mono ${
          info.bgClass
        } ${info.borderClass} ${
          isSm ? 'w-10 h-10' : 'w-12 h-12'
        } ${className}`}
      >
        <span className={`font-black ${info.textClass} ${isSm ? 'text-xs' : 'text-sm'}`}>
          {formattedScore}
        </span>
        {showLabel && (
          <span className={`text-[9px] uppercase font-bold tracking-tight text-slate-400`}>
            {info.shortLabel}
          </span>
        )}
      </div>
    );
  }

  // 4. BAR VARIANT (linear gauge with thresholds)
  if (variant === 'bar') {
    return (
      <div className={`space-y-1.5 w-full ${className}`}>
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: info.color }}
            />
            <span>Risk Index:</span>
            <span className={`font-bold ${info.textClass}`}>
              {showLabel ? info.label : formattedScore}
            </span>
          </span>
          <span className="font-bold text-white">
            {formattedScore}
            <span className="text-slate-500"> / {max}</span>
          </span>
        </div>

        {/* Track */}
        <div className="h-2 w-full bg-slate-950 border border-slate-800 rounded-full overflow-hidden relative">
          {/* Threshold markers */}
          <div
            className="absolute top-0 bottom-0 w-[1px] bg-slate-700/60 z-10"
            style={{ left: '33.3%' }}
            title="Medium risk threshold (5.0)"
          />
          <div
            className="absolute top-0 bottom-0 w-[1px] bg-slate-700/60 z-10"
            style={{ left: '66.6%' }}
            title="High risk threshold (10.0)"
          />

          {/* Fill */}
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percent}%`,
              backgroundColor: info.color,
              boxShadow: `0 0 8px ${info.glow}`,
            }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0 (Safe)</span>
          <span>5 (Review)</span>
          <span>10 (Escalate)</span>
          <span>15</span>
        </div>
      </div>
    );
  }

  // Fallback to chip
  return (
    <span className={`font-mono text-xs font-bold ${info.textClass} ${className}`}>
      {formattedScore} / {max}
    </span>
  );
};

export default RiskScore;
