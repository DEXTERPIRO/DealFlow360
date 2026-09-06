import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Send,
  MessageSquare,
  Shield,
  Award,
  Crown,
  CreditCard,
  Zap,
  Activity,
  FileCheck
} from 'lucide-react';

const CONFIG = {
  DRAFT:              { bg: '#F1F5F9', text: '#1E293B', label: 'Draft', icon: Clock },
  PENDING_MANAGER:    { bg: '#FDE68A', text: '#1E293B', label: 'Pending Manager', icon: Clock },
  PENDING_FINANCE:    { bg: '#FCD34D', text: '#1E293B', label: 'Pending Finance', icon: Clock },
  APPROVED:           { bg: '#A7F3D0', text: '#1E293B', label: 'Approved', icon: CheckCircle2 },
  REJECTED:           { bg: '#FECDD3', text: '#1E293B', label: 'Rejected', icon: XCircle },
  SENT_TO_CUSTOMER:   { bg: '#BAE6FD', text: '#1E293B', label: 'Sent to Customer', icon: Send },
  UNDER_NEGOTIATION:  { bg: '#DDD6FE', text: '#1E293B', label: 'Negotiating', icon: MessageSquare },
  CONFIRMED:          { bg: '#6EE7B7', text: '#1E293B', label: 'Confirmed', icon: FileCheck },
  CANCELLED:          { bg: '#E2E8F0', text: '#64748B', label: 'Cancelled', icon: XCircle },
  BRONZE:             { bg: '#FED7AA', text: '#7C2D12', label: 'Bronze', icon: Shield },
  SILVER:             { bg: '#E2E8F0', text: '#1E293B', label: 'Silver', icon: Award },
  GOLD:               { bg: '#FDE047', text: '#713F12', label: 'Gold', icon: Crown },
  PAID:               { bg: '#A7F3D0', text: '#1E293B', label: 'Paid', icon: CheckCircle2 },
  OVERDUE:            { bg: '#FECDD3', text: '#991B1B', label: 'Overdue', icon: AlertCircle },
  ACTIVE:             { bg: '#6EE7B7', text: '#1E293B', label: 'Active', icon: Activity, pulse: true },
};

export default function StatusBadge({ status, size = 'sm', className = '', style = {} }) {
  const normKey = String(status || '').toUpperCase().trim();
  const cfg = CONFIG[normKey] || CONFIG[status] || { bg: '#F1F5F9', text: '#1E293B', label: status || '—', icon: Clock };
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-heading font-bold rounded-full border-2 border-slate-900 shadow-pop-sm whitespace-nowrap select-none ${
        size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-xs px-3.5 py-1'
      } ${className}`}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        ...style
      }}
    >
      {Icon && <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.5} className="shrink-0" />}
      <span>{cfg.label}</span>
    </span>
  );
}

export { CONFIG as STATUS_CONFIG, StatusBadge };
