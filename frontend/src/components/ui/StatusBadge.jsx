import React from 'react';

const CONFIG = {
  DRAFT:              { color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'Draft' },
  PENDING_MANAGER:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Pending Manager' },
  PENDING_FINANCE:    { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'Pending Finance' },
  APPROVED:           { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Approved' },
  REJECTED:           { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Rejected' },
  SENT_TO_CUSTOMER:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Sent to Customer' },
  UNDER_NEGOTIATION:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'Negotiating' },
  CONFIRMED:          { color: '#10b981', bg: 'rgba(16,185,129,0.2)', label: 'Confirmed' },
  CANCELLED:          { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Cancelled' },
  BRONZE:             { color: '#b45309', bg: 'rgba(180,83,9,0.15)', label: 'Bronze' },
  SILVER:             { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', label: 'Silver' },
  GOLD:               { color: '#d97706', bg: 'rgba(217,119,6,0.15)', label: 'Gold' },
  PAID:               { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Paid' },
  OVERDUE:            { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Overdue' },
  ACTIVE:             { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Active', pulse: true },
};

export default function StatusBadge({ status, size = 'sm', className = '', style = {} }) {
  const normKey = String(status || '').toUpperCase().trim();
  const cfg = CONFIG[normKey] || CONFIG[status] || { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: status || '—' };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: size === 'sm' ? '3px 10px' : '5px 14px',
        borderRadius: 9999,
        fontFamily: 'monospace',
        fontWeight: 600,
        fontSize: size === 'sm' ? 11 : 13,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.color,
          animation: cfg.pulse ? 'pulse 1.5s infinite' : 'none',
          boxShadow: cfg.pulse ? `0 0 6px ${cfg.color}` : 'none',
          flexShrink: 0
        }}
      />
      {cfg.label}
    </span>
  );
}

export { CONFIG as STATUS_CONFIG, StatusBadge };
