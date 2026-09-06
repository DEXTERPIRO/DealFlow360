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
  FileText,
  LogOut,
  Mail,
  Award,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { quotationsAPI, negotiationsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
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
      <Clock size={16} strokeWidth={2.5} />
      <span>{display.isExpired ? 'OFFER EXPIRED' : display.text}</span>
    </div>
  );
}

// ─── Sub-Component: Confirm Order Dialog ───────────────────────────────────

function ConfirmModal({ quotation, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 text-slate-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 border-2 border-slate-900 shadow-pop-xs">
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base font-heading font-black text-slate-900">Confirm Quotation</h3>
            <p className="text-xs font-medium text-slate-600">Accept and place binding order</p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-900 bg-[#FFFDF5] p-4 space-y-2 text-xs shadow-pop-xs">
          <div className="flex justify-between text-slate-700 font-medium">
            <span>Quotation #:</span>
            <span className="font-mono font-black text-slate-900">
              {quotation.quotationNumber || quotation.quotation_number}
            </span>
          </div>
          <div className="flex justify-between text-slate-700 font-medium">
            <span>Total Commitment:</span>
            <span className="font-mono font-black text-emerald-700 text-sm">
              {formatINR(quotation.total || 0)}
            </span>
          </div>
        </div>

        <p className="text-xs font-medium text-slate-600 mt-4 leading-relaxed">
          By confirming, you agree to the quoted terms, pricing, and fulfillment schedules. Our sales & operations team will initiate order provisioning immediately.
        </p>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t-2 border-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-800 text-xs font-heading font-bold transition-all shadow-pop-xs"
          >
            Review Terms
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-heading font-black shadow-pop-xs border-2 border-slate-900 transition-all flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
          >
            <Check size={14} strokeWidth={2.5} />
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
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

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
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
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

  const handleQuickAddonRequest = (productName, price) => {
    setMessage(`Please add 1x ${productName} (${formatINR(price)}) to this quotation. Please update the proposal.`);
    const formEl = document.getElementById('negotiation-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNegotiationSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please describe what changes or add-ons you would like');
      return;
    }

    const finalMsg = requestedDeliveryDate
      ? `${message.trim()} [Requested Delivery Date: ${requestedDeliveryDate}]`
      : message.trim();

    try {
      setSubmittingNeg(true);
      const res = await negotiationsAPI.submit(quotation.id, {
        message: finalMsg,
        counterDiscount: Number(counterDiscount),
        requestedBy: 'CUSTOMER',
      });
      toast.success('Request sent! Your rep will respond soon.');
      setMessage('');
      setRequestedDeliveryDate('');
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
        toast.success('Order Confirmed! Your representative will be in touch.');
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
      <div className="min-h-screen bg-[#FFFDF5] flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="p-4 rounded-3xl bg-white border-2 border-slate-900 shadow-pop mb-4 animate-spin text-violet-700">
          <RefreshCw size={28} strokeWidth={2.5} />
        </div>
        <p className="text-sm font-heading font-bold text-slate-900">Loading your secure quotation portal...</p>
        <p className="text-xs font-medium text-slate-500 mt-1">Authenticating encrypted token</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-[#FFFDF5] flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="p-4 rounded-2xl bg-rose-100 border-2 border-slate-900 text-rose-700 mb-4 shadow-pop">
          <AlertTriangle size={36} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 font-heading">Quotation Not Found</h2>
        <p className="text-xs font-medium text-slate-600 max-w-sm text-center mt-2 leading-relaxed">
          {error || 'This portal link is invalid, has expired, or has been revoked. Please contact your sales representative.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-slate-900 flex flex-col selection:bg-violet-600 selection:text-white font-sans">
      {/* ═════════════════════════════════════════════════════════════════════
          HEADER: Isolated Customer Portal Bar (NO internal nav)
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-900 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-pop-sm">
        <div className="flex items-center gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600 border-2 border-slate-900 flex items-center justify-center text-white font-extrabold text-base shadow-pop-sm font-heading">
              D
            </div>
            <span className="font-extrabold text-slate-900 text-base tracking-tight hidden sm:inline font-heading">
              DealFlow<span className="text-violet-600">360</span>
            </span>
          </div>

          <div className="h-5 w-[2px] bg-slate-200 hidden sm:block" />

          {/* Portal badge */}
          <span className="px-3 py-0.5 rounded-full bg-slate-100 border-2 border-slate-900 text-xs font-heading font-bold text-slate-800 shadow-pop-sm">
            Customer Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quotation Number */}
          <span className="font-mono text-xs font-extrabold text-slate-900 bg-violet-50 px-3 py-1 rounded-full border-2 border-slate-900 shadow-pop-sm">
            {quotation.quotationNumber || quotation.quotation_number}
          </span>

          {/* Status chip with indicator light */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-heading font-bold border-2 border-slate-900 shadow-pop-sm ${statusMeta.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full border border-slate-900 ${statusMeta.dotClass}`} />
            {statusMeta.label}
          </div>

          {/* Logout / Exit button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-2 border-slate-900 text-xs font-heading font-bold transition-all shadow-pop-sm cursor-pointer ml-1"
            title="Log out and return to sign in"
          >
            <LogOut size={13} strokeWidth={2.5} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════════════
          MAIN CONTENT CONTAINER
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-8 space-y-8">
        {/* ── 1. HERO: QUOTATION SUMMARY CARD ──────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-slate-900 bg-white p-6 sm:p-8 shadow-pop">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-violet-700 font-extrabold font-heading mb-1">
                Official Commercial Proposal
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading tracking-tight">
                Quotation for{' '}
                <span className="text-violet-700">
                  {quotation.customer?.company_name || quotation.customer?.name || 'Direct Client'}
                </span>
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-2 font-medium">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-slate-500" strokeWidth={2.5} />
                  Prepared by <strong className="text-slate-900 font-bold">{quotation.rep?.name || 'Sales Operations'}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-500" strokeWidth={2.5} />
                  Valid until{' '}
                  <strong className="text-slate-900 font-bold font-mono">
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
                  <span className="text-[10px] uppercase font-heading font-extrabold text-slate-500 tracking-wider">
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
                  href={`http://localhost:5000/api/quotations/${quotation.id}/pdf?token=${token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-sm text-xs font-heading font-bold transition-all"
                >
                  <Download size={14} className="text-violet-700" strokeWidth={2.5} />
                  <span>Download PDF</span>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── 2. ORDER LINES TABLE (Read-Only) ─────────────────────────────── */}
        <section className="rounded-3xl border-2 border-slate-900 bg-white overflow-hidden shadow-pop">
          <div className="px-6 py-4 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-violet-100 border border-slate-900 flex items-center justify-center text-violet-700">
                <Layers size={16} strokeWidth={2.5} />
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 font-heading">Itemized Scope & Pricing</h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-900">
              {lines.length} {lines.length === 1 ? 'item' : 'items'} in proposal
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b-2 border-slate-900 text-[11px] font-heading font-extrabold text-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Product & Service</th>
                  <th className="py-3.5 px-4 text-center">Qty</th>
                  <th className="py-3.5 px-4 text-right">Unit Price</th>
                  <th className="py-3.5 px-4 text-center">Discount</th>
                  <th className="py-3.5 px-6 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
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
                      <tr key={line.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900 font-heading">
                          <div className="flex items-center gap-2.5">
                            <span>{line.product?.name || line.productName || 'Product'}</span>
                            {isSubscription && (
                              <span className="px-2 py-0.5 rounded-full bg-violet-100 border border-slate-900 text-violet-800 font-mono text-[10px] font-bold">
                                Recurring
                              </span>
                            )}
                          </div>
                          {line.product?.sku && (
                            <span className="font-mono text-[10px] text-slate-500 font-medium">
                              SKU: {line.product.sku}
                            </span>
                          )}
                          {!isConfirmed && (
                            <button
                              type="button"
                              onClick={() => {
                                setMessage(`Regarding ${line.product?.name || 'this line'}: Can we request a special discount or adjust the unit count?`);
                                const formEl = document.getElementById('negotiation-form');
                                if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="text-[10px] text-violet-700 hover:text-violet-900 font-heading font-bold flex items-center gap-1 mt-1 cursor-pointer"
                            >
                              <MessageSquare size={10} />
                              <span>Ask question about this item</span>
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-extrabold text-slate-900">
                          {line.quantity}
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-slate-700">
                          {formatINR(unitPrice)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {discount > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-slate-900 text-emerald-900 font-mono font-bold text-xs shadow-pop-sm">
                              -{discount}%
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-extrabold text-slate-900 text-sm">
                          {formatINR(lineTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Add-on & Companion Equipment Requests (Keyboards, Monitors, Deployment) ── */}
          {!isConfirmed && (
            <div className="p-4 sm:p-5 bg-[#FFFDF5] border-t-2 border-slate-900 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-heading font-black text-slate-900 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-violet-700" />
                  <span>Looking to add companion hardware accessories or deployment services?</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 font-bold">1-click attaches request to negotiation thread</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleQuickAddonRequest('Mechanical Keyboard', 4500)}
                  className="p-3 rounded-2xl bg-white border-2 border-slate-900 hover:bg-amber-100/60 shadow-pop-xs transition-all text-left flex items-center justify-between cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                >
                  <div>
                    <p className="text-xs font-heading font-black text-slate-900">⌨️ Mechanical Keyboard</p>
                    <p className="text-[10px] font-mono font-bold text-slate-600">₹4,500 / unit</p>
                  </div>
                  <span className="px-2 py-1 rounded-xl bg-violet-100 text-violet-800 text-[10px] font-heading font-black border border-slate-900">
                    + Request
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAddonRequest('27" 4K Monitor', 28000)}
                  className="p-3 rounded-2xl bg-white border-2 border-slate-900 hover:bg-amber-100/60 shadow-pop-xs transition-all text-left flex items-center justify-between cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                >
                  <div>
                    <p className="text-xs font-heading font-black text-slate-900">🖥️ 27" 4K Monitor</p>
                    <p className="text-[10px] font-mono font-bold text-slate-600">₹28,000 / unit</p>
                  </div>
                  <span className="px-2 py-1 rounded-xl bg-violet-100 text-violet-800 text-[10px] font-heading font-black border border-slate-900">
                    + Request
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAddonRequest('On-site Setup & Config', 15000)}
                  className="p-3 rounded-2xl bg-white border-2 border-slate-900 hover:bg-amber-100/60 shadow-pop-xs transition-all text-left flex items-center justify-between cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                >
                  <div>
                    <p className="text-xs font-heading font-black text-slate-900">🛠️ On-site Setup</p>
                    <p className="text-[10px] font-mono font-bold text-slate-600">₹15,000 deployment</p>
                  </div>
                  <span className="px-2 py-1 rounded-xl bg-violet-100 text-violet-800 text-[10px] font-heading font-black border border-slate-900">
                    + Request
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── 3. ORDER TOTALS CARD ─────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Notes or instructions */}
          <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 space-y-3 shadow-pop">
            <h4 className="text-xs uppercase tracking-wider text-slate-700 font-heading font-extrabold">
              Terms & Delivery Remarks
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {quotation.rep_notes ||
                quotation.repNotes ||
                'All prices are in INR and valid for the indicated duration. Commercial fulfillment is governed under standard master service agreement terms.'}
            </p>
            <div className="pt-3 border-t-2 border-slate-100 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck size={16} className="text-emerald-700" strokeWidth={2.5} />
              <span>Includes standard manufacturer warranty and deployment SLA.</span>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 space-y-3 shadow-pop">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatINR(quotation.subtotal || 0)}
              </span>
            </div>

            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Discount Savings:</span>
              <span className="font-mono font-bold text-emerald-700">
                -{formatINR(quotation.discount_amount || quotation.discountAmount || 0)}
              </span>
            </div>

            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Estimated Tax (GST 18%):</span>
              <span className="font-mono font-bold text-slate-900">
                {formatINR(quotation.tax_amount || quotation.taxAmount || 0)}
              </span>
            </div>

            <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-slate-900 font-heading">TOTAL COMMITMENT:</span>
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-violet-700">
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
              className="btn-candy w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-heading font-extrabold text-base sm:text-lg border-2 border-slate-900 shadow-pop transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <CheckCircle2 size={22} strokeWidth={2.5} />
              <span>Confirm Commercial Quotation</span>
            </button>
            <p className="text-center text-xs font-medium text-slate-500 mt-2">
              Instant digital agreement. Your account executive is immediately notified.
            </p>
          </section>
        ) : (
          <div className="p-5 rounded-2xl border-2 border-slate-900 bg-emerald-50 text-center space-y-1 shadow-pop">
            <p className="text-base font-extrabold text-emerald-900 flex items-center justify-center gap-2 font-heading">
              <Sparkles size={20} className="text-emerald-700" strokeWidth={2.5} />
              <span>Order Confirmed! Your account executive will be in touch.</span>
            </p>
            <p className="text-xs font-medium text-emerald-800">
              Thank you for partnering with us. The fulfillment team has reserved your deployment inventory.
            </p>
          </div>
        )}

        {/* ── 5. NEGOTIATION PANEL ("Negotiate Terms") ───────────────────── */}
        {!isConfirmed && (
          <section className="rounded-3xl border-2 border-slate-900 bg-white p-6 sm:p-8 space-y-6 shadow-pop">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-heading flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-violet-100 border border-slate-900 flex items-center justify-center text-violet-700">
                    <MessageSquare size={18} strokeWidth={2.5} />
                  </span>
                  <span>Negotiate Terms</span>
                </h3>
                <p className="text-xs font-medium text-slate-600 mt-1 pl-10">
                  Have questions or want to request adjustments? Send a message directly to your account executive.
                </p>
              </div>
            </div>

            {/* Negotiation Form */}
            <form id="negotiation-form" onSubmit={handleNegotiationSubmit} className="space-y-4">
              {/* Message field */}
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Your Message or Proposed Adjustments <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Can we add a Mechanical Keyboard to this proposal? Or adjust terms for faster delivery?"
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:outline-none focus:shadow-pop-sm transition-all resize-none"
                />

                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[11px] font-mono text-slate-500 font-bold">Quick requests:</span>
                  <button
                    type="button"
                    onClick={() => setMessage('Can we add 1x Mechanical Keyboard (₹4,500) to this proposal?')}
                    className="px-2.5 py-1 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-900 border border-slate-900 text-[10px] font-heading font-black cursor-pointer shadow-pop-xs transition-transform active:scale-95"
                  >
                    ⌨️ + Add Keyboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessage('Can we bundle a 27" 4K Monitor with this package?')}
                    className="px-2.5 py-1 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-900 border border-slate-900 text-[10px] font-heading font-black cursor-pointer shadow-pop-xs transition-transform active:scale-95"
                  >
                    🖥️ + Add 4K Monitor
                  </button>
                  <button
                    type="button"
                    onClick={() => setCounterDiscount(15)}
                    className="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-slate-900 text-[10px] font-heading font-black cursor-pointer shadow-pop-xs transition-transform active:scale-95"
                  >
                    🏷️ Propose 15% Discount
                  </button>
                </div>
              </div>

              {/* Counter discount slider & Requested Delivery Date (SVG Screen 11) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-slate-900 bg-slate-50 space-y-2 shadow-pop-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-heading font-bold text-slate-700">
                      Requested Discount % (Optional)
                    </span>
                    <span className="font-mono text-violet-700 font-extrabold">
                      Current: {currentAverageDiscount}% — Request: {counterDiscount}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={counterDiscount}
                    onChange={(e) => setCounterDiscount(Number(e.target.value))}
                    className="w-full accent-violet-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl border-2 border-slate-900 bg-slate-50 space-y-2 shadow-pop-xs">
                  <span className="block text-xs font-heading font-bold text-slate-700">
                    Requested Delivery Date (Optional)
                  </span>
                  <input
                    type="date"
                    value={requestedDeliveryDate}
                    onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                    className="w-full bg-white border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:shadow-pop-xs cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingNeg}
                  className="btn-candy flex items-center gap-2 px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-heading font-bold border-2 border-slate-900 shadow-pop transition-all cursor-pointer"
                >
                  <Send size={14} strokeWidth={2.5} />
                  <span>{submittingNeg ? 'Submitting...' : 'Submit Negotiation Request'}</span>
                </button>
              </div>
            </form>

            {/* Negotiation Timeline */}
            {negotiations.length > 0 && (
              <div className="pt-4 border-t-2 border-slate-100 space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-slate-500 font-heading font-extrabold">
                  Negotiation History
                </h4>
                <div className="space-y-2.5">
                  {negotiations.map((neg) => {
                    const isFromCustomer = neg.requested_by === 'CUSTOMER';

                    return (
                      <div
                        key={neg.id}
                        className={`p-4 rounded-xl border-2 border-slate-900 text-xs flex items-start justify-between gap-4 shadow-pop-sm ${
                          isFromCustomer
                            ? 'bg-slate-50'
                            : 'bg-violet-50'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-slate-900">
                              {isFromCustomer ? 'Your Request' : 'Sales Rep Response'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {getRelativeTime(neg.created_at)}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed font-medium">{neg.message}</p>
                          {neg.counter_discount && (
                            <p className="text-[11px] text-violet-700 font-bold font-mono">
                              Requested Discount: {neg.counter_discount}%
                            </p>
                          )}
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold tracking-wide border-2 border-slate-900 shadow-pop-sm flex-shrink-0 ${
                            neg.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : neg.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-amber-100 text-amber-900'
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
        <section className="rounded-3xl border-2 border-slate-900 bg-white p-6 sm:p-8 space-y-4 shadow-pop">
          <h3 className="text-sm font-extrabold text-slate-900 font-heading flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-sky-100 border border-slate-900 flex items-center justify-center text-sky-800">
              <Clock size={16} strokeWidth={2.5} />
            </span>
            <span>Quotation Activity & Audit History</span>
          </h3>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {auditEvents.length === 0 ? (
              <div className="relative">
                <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-violet-100 border-2 border-slate-900" />
                <p className="text-xs font-heading font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText size={14} className="text-violet-700" strokeWidth={2.5} />
                  <span>Quotation Created</span>
                </p>
                <p className="text-[11px] font-mono text-slate-500">{formatDate(quotation.created_at)}</p>
              </div>
            ) : (
              auditEvents.map((event, idx) => {
                let ActionIcon = FileText;
                if (event.action === 'SENT') ActionIcon = Mail;
                else if (event.action === 'UPDATED') ActionIcon = MessageSquare;
                else if (event.action === 'CONFIRMED') ActionIcon = CheckCircle2;
                else if (event.action === 'APPROVED') ActionIcon = Award;

                return (
                  <div key={idx} className="relative group">
                    <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-900 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-heading font-bold text-slate-900 flex items-center gap-1.5">
                      <ActionIcon size={14} className="text-violet-700" strokeWidth={2.5} />
                      <span>{event.details || event.action}</span>
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {getRelativeTime(event.created_at)} · {formatDate(event.created_at)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
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
