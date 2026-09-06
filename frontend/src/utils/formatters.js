/**
 * Format currency numbers into clean shorthand (e.g. $45.0M)
 */
export const formatCurrency = (val = 0) => {
  const n = Number(val || 0);
  if (n >= 1e9) {
    return `$${(n / 1e9).toFixed(1)}B`;
  }
  if (n >= 1e6) {
    return `$${(n / 1e6).toFixed(1)}M`;
  }
  if (n >= 1e3) {
    return `$${(n / 1e3).toFixed(0)}K`;
  }
  return `$${n.toLocaleString()}`;
};

/**
 * Safely parse any date string as UTC if no timezone is specified.
 * Prevents UTC timestamps stored in database without 'Z' from being misparsed as local time.
 */
export const parseUTCDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  const str = String(d).trim();
  if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  return new Date(str);
};

/**
 * Format relative time (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = parseUTCDate(dateStr);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return formatDate(dateStr);
};

/**
 * Format date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  return parseUTCDate(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Pipeline stages configuration
 */
export const STAGES = [
  { id: 'LEAD', label: 'Lead Inflow', color: 'border-slate-500 text-slate-400 bg-slate-500/10' },
  { id: 'QUALIFICATION', label: 'Qualification', color: 'border-blue-500 text-blue-400 bg-blue-500/10' },
  { id: 'DUE_DILIGENCE', label: 'Due Diligence', color: 'border-amber-500 text-amber-400 bg-amber-500/10' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'border-purple-500 text-purple-400 bg-purple-500/10' },
  { id: 'CLOSED_WON', label: 'Closed Won', color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
  { id: 'CLOSED_LOST', label: 'Closed Lost', color: 'border-rose-500 text-rose-400 bg-rose-500/10' },
];

export const PRIORITY_COLORS = {
  LOW: 'text-slate-400 bg-slate-800 border-slate-700',
  MEDIUM: 'text-sky-400 bg-sky-950/60 border-sky-800',
  HIGH: 'text-amber-400 bg-amber-950/60 border-amber-800',
  URGENT: 'text-rose-400 bg-rose-950/60 border-rose-800',
};
