import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Download,
  Copy,
  Check,
  Building,
  User,
  Sparkles,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Sliders,
  Share2,
  Calendar,
  AlertTriangle,
  Layers,
  FileCheck,
  FileText
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { quotationsAPI, negotiationsAPI } from '../../api';
import toast from 'react-hot-toast';

// ─── Formatting Helpers ───────────────────────────────────────────────────

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(d);
  }
};

const getRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
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

// ─── Status Badge Metadata ────────────────────────────────────────────────

const STATUS_CONFIG = {
  SENT_TO_CUSTOMER: {
    label: 'Sent',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  UNDER_NEGOTIATION: {
    label: 'Under Negotiation',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  CONFIRMED: {
    label: 'Confirmed',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  APPROVED: {
    label: 'Approved',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dotClass: 'bg-slate-400',
  },
};

// ─── Sub-Component: Live Countdown Timer ────────────────────────────────────

function CountdownTimer({ expiryDate }) {
  const [display, setDisplay] = React.useState({ text: '', isUrgent: false, isExpired: false });

  React.useEffect(() => {
    const update = () => {
      const diff = new Date(expiryDate) - new Date();
      if (diff <= 0) {
        setDisplay({ text: 'EXPIRED', isUrgent: true, isExpired: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      const isUrgent = diff < 48 * 60 * 60 * 1000;
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      parts.push(`${String(hours).padStart(2, '0')}h`);
      parts.push(`${String(mins).padStart(2, '0')}m`);
      parts.push(`${String(secs).padStart(2, '0')}s`);
      setDisplay({ text: parts.join(' '), isUrgent, isExpired: false });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiryDate]);

  const urgentBg = '#7f1d1d';
  const normalBg = 'rgba(30,58,95,0.95)';
  const urgentBorder = '#ef4444';
  const normalBorder = '#3b82f6';
  const urgentColor = '#f87171';
  const normalColor = '#93c5fd';

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      borderRadius: 9999,
      background: display.isUrgent ? urgentBg : normalBg,
      border: `1px solid ${display.isUrgent ? urgentBorder : normalBorder}`,
      fontFamily: 'monospace',
      fontWeight: 700,
      color: display.isUrgent ? urgentColor : normalColor,
      fontSize: 14,
      boxShadow: display.isUrgent
        ? '0 0 16px rgba(239,68,68,0.35)'
        : '0 0 12px rgba(59,130,246,0.25)',
      animation: display.isUrgent && !display.isExpired ? 'cpulse 1.5s infinite' : 'none',
    }}>
      <style>{`
        @keyframes cpulse {
          0%, 100% { box-shadow: 0 0 16px rgba(239,68,68,0.35); }
          50% { box-shadow: 0 0 28px rgba(239,68,68,0.7); }
        }
      `}</style>
      <span style={{ fontSize: 16 }}>⏳</span>
      <span>{display.isExpired ? 'OFFER EXPIRED' : display.text}</span>
    </div>
  );
}

// ─── Sub-Component: Confirm Order Dialog ───────────────────────────────────

function ConfirmModal({ quotation, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Confirm Quotation</h3>
            <p className="text-xs text-slate-400">Accept and place binding order</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Quotation #:</span>
            <span className="font-mono font-bold text-white">
              {quotation.quotationNumber || quotation.quotation_number}
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Total Commitment:</span>
            <span className="font-mono font-black text-emerald-400 text-sm">
              {formatINR(quotation.total || 0)}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-300 mt-4 leading-relaxed">
          By confirming, you agree to the quoted terms, pricing, and fulfillment schedules. Our sales & operations team will initiate order provisioning immediately.
        </p>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
          >
            Review Terms
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check size={14} />
            {loading ? 'Confirming...' : 'Yes, Confirm Quotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CustomerPortal Page ──────────────────────────────────────────────

export default function CustomerPortal() {
  const { token } = useParams();
  const navigate = useNavigate();

  // Quotation state
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Expiry countdown state (live seconds)
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isUrgent: false,
    isExpired: false,
  });

  // Negotiation form state
  const [message, setMessage] = useState('');
  const [counterDiscount, setCounterDiscount] = useState(0);
  const [submittingNeg, setSubmittingNeg] = useState(false);
  const [negotiations, setNegotiations] = useState([]);

  // Confirm modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Copy link feedback state
  const [copied, setCopied] = useState(false);

  // ── 1. Fetch Quotation by Portal Token ────────────────────────────────────

  const loadQuotation = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await quotationsAPI.getPortal(token);
      const q = res?.quotation || res;
      setQuotation(q);
      setNegotiations(q.negotiations || []);

      // Calculate initial average discount
      const lines = q.lines || [];
      if (lines.length > 0) {
        const avgDiscount = Math.round(
          lines.reduce((acc, l) => acc + (l.discount || 0), 0) / lines.length
        );
        setCounterDiscount(avgDiscount);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Quotation not found or link has expired.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadQuotation();
  }, [loadQuotation]);

  // ── 2. Socket.io Real-time Synchronization ───────────────────────────────

  useEffect(() => {
    if (!token) return;
    const socket = io('http://localhost:5000');

    socket.emit('join_portal', token);

    socket.on('quotation-updated', (data) => {
      if (data?.status) {
        setQuotation((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    });

    socket.on('negotiation-message', (newNeg) => {
      setNegotiations((prev) => {
        const exists = prev.some((n) => n.id === newNeg.id);
        if (exists) {
          return prev.map((n) => (n.id === newNeg.id ? newNeg : n));
        }
        return [newNeg, ...prev];
      });
      toast.success('New negotiation update received from your sales rep!');
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // ── 3. Live Countdown Timer (Ticks Every 1s) ──────────────────────────────

  useEffect(() => {
    if (!quotation?.expiry_date && !quotation?.expiryDate) return;

    const expiryTarget = new Date(
      quotation.expiry_date || quotation.expiryDate
    ).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = expiryTarget - now;

      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isUrgent: true,
          isExpired: true,
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const totalHoursRemaining = days * 24 + hours;
      const isUrgent = totalHoursRemaining < 48;

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        isUrgent,
        isExpired: false,
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [quotation]);

  // ── 4. Handlers ──────────────────────────────────────────────────────────

  const handleNegotiationSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please describe what changes you would like');
      return;
    }

    try {
      setSubmittingNeg(true);
      const res = await negotiationsAPI.submit(quotation.id, {
        message: message.trim(),
        counterDiscount: Number(counterDiscount),
        requestedBy: 'CUSTOMER',
      });
      toast.success('Request sent! Your rep will respond soon.');
      setMessage('');
      if (res) {
        setNegotiations((prev) => [res, ...prev]);
      }
      loadQuotation();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to submit negotiation');
    } finally {
      setSubmittingNeg(false);
    }
  };

  const handleConfirmQuotation = async () => {
    try {
      setConfirming(true);
      const res = await negotiationsAPI.confirm(quotation.id);
      if (res?.needsReapproval) {
        toast.success('Terms updated. Sent for re-approval.');
      } else {
        toast.success('🎉 Order Confirmed! Your rep will be in touch.');
      }
      setIsConfirmModalOpen(false);
      loadQuotation();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to confirm quotation');
    } finally {
      setConfirming(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Portal link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Computed Values ──────────────────────────────────────────────────────

  const lines = useMemo(() => quotation?.lines || [], [quotation]);

  const currentAverageDiscount = useMemo(() => {
    if (lines.length === 0) return 0;
    const avg = lines.reduce((acc, l) => acc + (l.discount || 0), 0) / lines.length;
    return Math.round(avg);
  }, [lines]);

  const auditEvents = useMemo(() => {
    const raw = quotation?.audit_logs || quotation?.auditLogs || [];
    // Sort chronological: oldest to newest
    return [...raw].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [quotation]);

  const currentStatus = (quotation?.status || 'SENT_TO_CUSTOMER').toUpperCase();
  const statusMeta = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.SENT_TO_CUSTOMER;
  const isConfirmed = currentStatus === 'CONFIRMED';

  // ── Render Loading & Error States ────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-4 animate-spin text-blue-400">
          <RefreshCw size={28} />
        </div>
        <p className="text-sm font-semibold text-slate-300">Loading your secure quotation portal...</p>
        <p className="text-xs text-slate-500 mt-1">Authenticating encrypted token</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-4">
          <AlertTriangle size={36} />
        </div>
        <h2 className="text-xl font-black text-white">Quotation Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm text-center mt-2 leading-relaxed">
          {error || 'This portal link is invalid, has expired, or has been revoked. Please contact your sales representative.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* ═════════════════════════════════════════════════════════════════════
          HEADER: Isolated Customer Portal Bar (NO internal nav)
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-base shadow-md shadow-blue-500/20">
              D
            </div>
            <span className="font-extrabold text-white text-base tracking-tight hidden sm:inline">
              DealFlow<span className="text-blue-400">360</span>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Portal badge */}
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300">
            Customer Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quotation Number */}
          <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
            {quotation.quotationNumber || quotation.quotation_number}
          </span>

          {/* Status chip with indicator light */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
            {statusMeta.label}
          </div>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════════════
          MAIN CONTENT CONTAINER
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-8 space-y-8">
        {/* ── 1. HERO: QUOTATION SUMMARY CARD ──────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">
                Official Proposal
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Quotation for{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
                  {quotation.customer?.company_name || quotation.customer?.name || 'Direct Client'}
                </span>
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1.5">
                  <User size={13} className="text-slate-500" />
                  Prepared by <strong className="text-slate-200">{quotation.rep?.name || 'Sales Operations'}</strong>
                </span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-500" />
                  Valid until{' '}
                  <strong className="text-slate-200">
                    {formatDate(quotation.expiry_date || quotation.expiryDate)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Live Countdown Timer + PDF Download */}
            <div className="flex flex-col items-end gap-3">
              {/* CountdownTimer pill */}
              {(quotation.expiry_date || quotation.expiryDate) && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] uppercase font-mono text-slate-500 tracking-widest">
                    Offer Expires In
                  </span>
                  <CountdownTimer
                    expiryDate={quotation.expiry_date || quotation.expiryDate}
                  />
                </div>
              )}

              {/* PDF Download button for non-draft quotations */}
              {quotation.status && quotation.status !== 'DRAFT' && (
                <a
                  href={`http://localhost:5000/api/quotations/${quotation.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors"
                >
                  <Download size={13} className="text-indigo-400" />
                  📄 Download PDF
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── 2. ORDER LINES TABLE (Read-Only) ─────────────────────────────── */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-md">
          <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={17} className="text-blue-400" />
              <h3 className="text-sm font-bold text-white">Itemized Scope & Pricing</h3>
            </div>
            <span className="text-xs text-slate-400">
              {lines.length} {lines.length === 1 ? 'item' : 'items'} in proposal
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                  <th className="py-3.5 px-6 font-semibold">Product & Service</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Qty</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Unit Price</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Discount</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No order lines found.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => {
                    const isSubscription =
                      (line.lineType || line.line_type) === 'SUBSCRIPTION';
                    const unitPrice = Number(line.unitPrice || line.unit_price || 0);
                    const discount = Number(line.discount || 0);
                    const lineTotal =
                      Number(line.lineTotal || line.line_total || 0) ||
                      unitPrice * (line.quantity || 1) * (1 - discount / 100);

                    return (
                      <tr key={line.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-6 font-medium text-white">
                          <div className="flex items-center gap-2.5">
                            <span>{line.product?.name || line.productName || 'Product'}</span>
                            {isSubscription && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-[10px] font-bold">
                                ↺ Monthly
                              </span>
                            )}
                          </div>
                          {line.product?.sku && (
                            <span className="font-mono text-[11px] text-slate-500">
                              SKU: {line.product.sku}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-white">
                          {line.quantity}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-300">
                          {formatINR(unitPrice)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {discount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[11px]">
                              -{discount}%
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-white text-sm">
                          {formatINR(lineTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 3. ORDER TOTALS CARD ─────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Notes or instructions */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              Terms & Delivery Remarks
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {quotation.rep_notes ||
                quotation.repNotes ||
                'All prices are in INR and valid for the indicated duration. Shipping is handled via multi-warehouse direct routing.'}
            </p>
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>Includes standard manufacturer warranty and deployment SLA.</span>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="rounded-3xl border border-slate-800/90 bg-slate-900/80 p-6 space-y-3 shadow-xl backdrop-blur-md">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold text-slate-200">
                {formatINR(quotation.subtotal || 0)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-400">
              <span>Discount Savings:</span>
              <span className="font-mono font-semibold text-emerald-400">
                -{formatINR(quotation.discount_amount || quotation.discountAmount || 0)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-400">
              <span>Estimated Tax (GST 18%):</span>
              <span className="font-mono font-semibold text-slate-200">
                {formatINR(quotation.tax_amount || quotation.taxAmount || 0)}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-sm font-bold text-white">TOTAL COMMITMENT:</span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-blue-400">
                {formatINR(quotation.total || 0)}
              </span>
            </div>
          </div>
        </section>

        {/* ── 4. CONFIRM PROPOSAL ACTION (Full-width prominent button) ─────── */}
        {!isConfirmed ? (
          <section className="pt-2">
            <button
              onClick={() => setIsConfirmModalOpen(true)}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-base sm:text-lg shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <CheckCircle2 size={22} />
              ✓ Confirm Quotation
            </button>
            <p className="text-center text-xs text-slate-500 mt-2">
              Instant digital agreement. Your account manager is immediately notified.
            </p>
          </section>
        ) : (
          <div className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-center space-y-1">
            <p className="text-base font-extrabold text-emerald-300 flex items-center justify-center gap-2">
              <CheckCircle2 size={20} />
              🎉 Order Confirmed! Your rep will be in touch.
            </p>
            <p className="text-xs text-emerald-400/80">
              Thank you for partnering with us. The fulfillment team has reserved your inventory.
            </p>
          </div>
        )}

        {/* ── 5. NEGOTIATION PANEL ("💬 Negotiate Terms") ───────────────────── */}
        {!isConfirmed && (
          <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>💬</span> Negotiate Terms
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Have questions or want to request changes? Send us a message directly.
                </p>
              </div>
            </div>

            {/* Negotiation Form */}
            <form onSubmit={handleNegotiationSubmit} className="space-y-4">
              {/* Message field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Your Message or Proposed Adjustments <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Would it be possible to adjust pricing by 5% if we increase volume? Or clarify delivery timelines?"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Counter discount slider */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Requested Discount Percentage (Optional)
                  </span>
                  <span className="font-mono text-blue-400 font-bold">
                    Current: {currentAverageDiscount}% — Your Request: {counterDiscount}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={counterDiscount}
                  onChange={(e) => setCounterDiscount(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingNeg}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Send size={13} />
                  {submittingNeg ? 'Submitting...' : 'Submit Negotiation Request'}
                </button>
              </div>
            </form>

            {/* Negotiation Timeline */}
            {negotiations.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Negotiation History
                </h4>
                <div className="space-y-2.5">
                  {negotiations.map((neg) => {
                    const isFromCustomer = neg.requested_by === 'CUSTOMER';

                    return (
                      <div
                        key={neg.id}
                        className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-4 ${
                          isFromCustomer
                            ? 'bg-slate-800/40 border-slate-800'
                            : 'bg-blue-500/10 border-blue-500/20'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {isFromCustomer ? 'Your Request' : 'Sales Rep Response'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {getRelativeTime(neg.created_at)}
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{neg.message}</p>
                          {neg.counter_discount && (
                            <p className="text-[11px] text-blue-400 font-semibold font-mono">
                              Requested Discount: {neg.counter_discount}%
                            </p>
                          )}
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border flex-shrink-0 ${
                            neg.status === 'ACCEPTED'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : neg.status === 'REJECTED'
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {neg.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── 6. STATUS TIMELINE (Chronological Audit Logs) ────────────────── */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-8 space-y-4 shadow-xl backdrop-blur-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-blue-400" />
            Quotation Activity & Audit History
          </h3>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {auditEvents.length === 0 ? (
              <div className="relative">
                <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-blue-500/20 border-2 border-blue-500" />
                <p className="text-xs font-semibold text-slate-200">📋 Quotation Created</p>
                <p className="text-[11px] text-slate-500">{formatDate(quotation.created_at)}</p>
              </div>
            ) : (
              auditEvents.map((event, idx) => {
                let icon = '📋';
                if (event.action === 'SENT') icon = '✉️';
                else if (event.action === 'UPDATED') icon = '💬';
                else if (event.action === 'CONFIRMED') icon = '✅';
                else if (event.action === 'APPROVED') icon = '🏆';

                return (
                  <div key={idx} className="relative group">
                    <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-slate-800 border-2 border-blue-500 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-semibold text-slate-200">
                      {icon} {event.details || event.action}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {getRelativeTime(event.created_at)} · {formatDate(event.created_at)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── 7. QR CODE SHARING CARD ──────────────────────────────────────── */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-5">
            {/* QR Code Container */}
            <div className="p-3 bg-white rounded-2xl shadow-xl flex-shrink-0">
              <QRCodeSVG
                value={window.location.href}
                size={96}
                level="M"
                includeMargin={false}
              />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Share2 size={15} className="text-blue-400" />
                Share This Quotation Link
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Scan with any smartphone or share this encrypted URL with authorized colleagues on your procurement team.
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer flex-shrink-0"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Link Copied!' : 'Copy Portal URL'}
          </button>
        </section>
      </main>

      {/* ═════════════════════════════════════════════════════════════════════
          CONFIRM ORDER MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {isConfirmModalOpen && (
        <ConfirmModal
          quotation={quotation}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleConfirmQuotation}
          loading={confirming}
        />
      )}
    </div>
  );
}
