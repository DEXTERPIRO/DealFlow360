/**
 * Format currency numbers into clean shorthand (e.g. $45.0M)
 */
export const formatCurrency = (val = 0) => {
  if (val >= 1e9) {
    return `$${(val / 1e9).toFixed(1)}B`;
  }
  if (val >= 1e6) {
    return `$${(val / 1e6).toFixed(1)}M`;
  }
  if (val >= 1e3) {
    return `$${(val / 1e3).toFixed(0)}K`;
  }
  return `$${Number(val).toLocaleString()}`;
};

/**
 * Format date string
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'TBD';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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
