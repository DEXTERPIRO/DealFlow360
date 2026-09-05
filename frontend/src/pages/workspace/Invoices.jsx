import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  CreditCard,
  Plus,
  Search,
  Filter,
  ExternalLink,
  Send,
  Receipt,
  X,
  Calendar,
  Building,
  User,
  ShieldCheck,
  Check,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { invoicesAPI, quotationsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import Pagination from '../../components/ui/Pagination';

// ─── Formatters & Helpers ──────────────────────────────────────────────────

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

const isPastDue = (dueDateStr) => {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
};

const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  },
  SENT: {
    label: 'Sent',
    bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  PAID: {
    label: 'Paid',
    bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  OVERDUE: {
    label: 'Overdue',
    bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-700/40 text-slate-500 border-slate-700',
  },
};

// ─── Sub-Component: Record Payment Modal ───────────────────────────────────

function RecordPaymentModal({ invoice, onClose, onSuccess }) {
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!paymentRef.trim()) {
      toast.error('Payment reference is required');
      return;
    }

    try {
      setSaving(true);
      await invoicesAPI.markPaid(invoice.id, {
        paymentRef: paymentRef.trim(),
        paymentDate,
      });

      // Trigger celebration animation before closing
      setCelebrating(true);
      toast.success(`Payment recorded for ${invoice.invoice_number}!`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to record payment');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 overflow-hidden">
        {/* Celebration Overlay */}
        {celebrating && (
          <div className="absolute inset-0 bg-slate-950/95 z-20 flex flex-col items-center justify-center text-center p-6 animate-in zoom-in-90 duration-300">
            <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400 mb-3 border border-emerald-500/30 animate-bounce">
              <Sparkles size={42} />
            </div>
            <h3 className="text-xl font-black text-white">Payment Recorded!</h3>
            <p className="text-xs text-slate-400 mt-1">
              Invoice <span className="font-mono text-emerald-400 font-bold">{invoice.invoice_number}</span> is now marked as PAID.
            </p>
            <p className="text-sm font-mono font-bold text-emerald-400 mt-3">
              {formatINR(invoice.amount)} collected
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Record Payment</h3>
              <p className="text-xs text-slate-400">Capture transaction details and settle invoice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Read only info */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Invoice Number:</span>
              <span className="font-mono font-bold text-white">{invoice.invoice_number}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Customer:</span>
              <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                {invoice.quotation?.customer?.name || 'Customer'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
              <span className="text-slate-400 font-medium">Amount Due:</span>
              <span className="font-mono text-lg font-black text-emerald-400">
                {formatINR(invoice.amount)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Reference <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. UTR-98248102 or CHQ-10029"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || celebrating}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Check size={14} />
              {saving ? 'Processing...' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sub-Component: View Receipt Modal ─────────────────────────────────────

function ViewReceiptModal({ invoice, onClose }) {
  const handleDownload = () => {
    invoicesAPI.downloadPDF(invoice.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-emerald-400" />
            <h3 className="text-base font-bold text-white">Payment Receipt</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Receipt Visual Sheet */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">DealFlow360</p>
              <h4 className="text-base font-bold text-white mt-0.5">Payment Acknowledgement</h4>
            </div>
            {/* PAID Stamp */}
            <div className="px-3 py-1 rounded-md border-2 border-emerald-500/80 bg-emerald-500/10 text-emerald-400 text-xs font-black tracking-widest uppercase rotate-3 shadow-lg">
              ✓ PAID
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800/80">
            <div>
              <p className="text-slate-500">Invoice Number</p>
              <p className="font-mono font-bold text-white mt-0.5">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-slate-500">Quotation Ref</p>
              <p className="font-mono text-slate-300 mt-0.5">
                {invoice.quotation?.quotation_number || `QT-${invoice.quotation_id?.slice(0, 8)}`}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Customer</p>
              <p className="font-semibold text-slate-200 mt-0.5">
                {invoice.quotation?.customer?.name || 'Customer'}
              </p>
              {invoice.quotation?.customer?.company_name && (
                <p className="text-[11px] text-slate-400">{invoice.quotation.customer.company_name}</p>
              )}
            </div>
            <div>
              <p className="text-slate-500">Paid On</p>
              <p className="text-slate-200 mt-0.5">
                {formatDate(invoice.paid_at || invoice.updated_at)}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs">
            <div>
              <p className="text-slate-500">Transaction Reference</p>
              <p className="font-mono font-semibold text-slate-200 mt-0.5">
                {invoice.payment_ref || 'Online / Bank Transfer'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Total Settled</p>
              <p className="font-mono text-base font-black text-emerald-400 mt-0.5">
                {formatINR(invoice.amount)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Download size={14} />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Component: Create Invoice Modal ───────────────────────────────────

function CreateInvoiceModal({ onClose, onSuccess }) {
  const [quotations, setQuotations] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchApprovedQuotes = async () => {
      try {
        setLoadingQuotes(true);
        const res = await quotationsAPI.getAll();
        const list = Array.isArray(res) ? res : res?.quotations || [];
        // Eligible for invoice: CONFIRMED or APPROVED
        const eligible = list.filter(
          (q) => q.status === 'CONFIRMED' || q.status === 'APPROVED'
        );
        setQuotations(eligible);
        if (eligible.length > 0) {
          setSelectedQuoteId(eligible[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load eligible quotations');
      } finally {
        setLoadingQuotes(false);
      }
    };
    fetchApprovedQuotes();
  }, []);

  const selectedQuote = useMemo(() => {
    return quotations.find((q) => q.id === selectedQuoteId);
  }, [quotations, selectedQuoteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedQuoteId) {
      toast.error('Please select an approved quotation');
      return;
    }

    try {
      setGenerating(true);
      await invoicesAPI.create({
        quotationId: selectedQuoteId,
        dueDate,
        isRecurring,
      });
      toast.success('Invoice generated successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Generate Invoice</h3>
              <p className="text-xs text-slate-400">Convert an approved quotation into an official invoice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Approved Quotation <span className="text-rose-400">*</span>
            </label>
            {loadingQuotes ? (
              <div className="h-10 rounded-lg bg-slate-800 animate-pulse" />
            ) : quotations.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-xs text-slate-400">
                No approved/confirmed quotations available for invoicing.
              </div>
            ) : (
              <select
                value={selectedQuoteId}
                onChange={(e) => setSelectedQuoteId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quotationNumber || q.quotation_number} —{' '}
                    {q.customer?.name || 'Customer'} (
                    {formatINR(q.total || q.totalAmount || 0)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quotation Details Preview */}
          {selectedQuote && (
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Customer:</span>
                <span className="font-semibold text-white">
                  {selectedQuote.customer?.name || 'Customer'}
                </span>
              </div>
              {selectedQuote.customer?.company_name && (
                <div className="flex justify-between text-slate-400">
                  <span>Company:</span>
                  <span className="text-slate-300">
                    {selectedQuote.customer.company_name}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-300">
                  {formatINR(selectedQuote.subtotal || 0)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tax Amount:</span>
                <span className="font-mono text-slate-300">
                  {formatINR(selectedQuote.tax_amount || selectedQuote.taxAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800 font-bold">
                <span>Invoice Total:</span>
                <span className="font-mono text-emerald-400 text-sm">
                  {formatINR(selectedQuote.total || selectedQuote.totalAmount || 0)}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Due Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">Recurring Invoice</p>
              <p className="text-[11px] text-slate-400">Generate on a subscription schedule</p>
            </div>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || !selectedQuoteId}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus size={14} />
              {generating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Invoices Component ───────────────────────────────────────────────

export default function Invoices() {
  const { user } = useAuthStore();
  const canManageInvoices =
    user?.role === 'FINANCE' || user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // Data state
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [receiptModalInvoice, setReceiptModalInvoice] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ── 1. Fetch Invoices ────────────────────────────────────────────────────

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoicesAPI.getAll();
      const list = Array.isArray(res) ? res : res?.invoices || [];
      setInvoices(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // ── 2. Mark Sent Handler ─────────────────────────────────────────────────

  const handleMarkSent = async (invoiceId) => {
    try {
      await invoicesAPI.markSent(invoiceId);
      toast.success('Invoice marked as SENT');
      loadInvoices();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to mark invoice as sent');
    }
  };

  // ── 3. PDF Download Handler ──────────────────────────────────────────────

  const handleDownloadPDF = (invoiceId) => {
    invoicesAPI.downloadPDF(invoiceId);
  };

  // ── 4. Stats Row Computations ────────────────────────────────────────────

  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let outstanding = 0;
    let overdueCount = 0;

    invoices.forEach((inv) => {
      const amt = Number(inv.amount || 0);
      const st = (inv.status || '').toUpperCase();
      const overdue = st !== 'PAID' && st !== 'CANCELLED' && isPastDue(inv.due_date);

      if (st !== 'CANCELLED') {
        totalInvoiced += amt;
      }

      if (st === 'PAID') {
        totalCollected += amt;
      } else if (st !== 'CANCELLED') {
        outstanding += amt;
      }

      if (overdue) {
        overdueCount += 1;
      }
    });

    return {
      totalInvoiced,
      totalCollected,
      outstanding,
      overdueCount,
    };
  }, [invoices]);

  // ── 5. Filtered Invoices ─────────────────────────────────────────────────

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const st = (inv.status || '').toUpperCase();
      const overdue = st !== 'PAID' && st !== 'CANCELLED' && isPastDue(inv.due_date);

      let matchesTab = true;
      if (filterTab === 'DRAFT') matchesTab = st === 'DRAFT';
      else if (filterTab === 'SENT') matchesTab = st === 'SENT' && !overdue;
      else if (filterTab === 'PAID') matchesTab = st === 'PAID';
      else if (filterTab === 'OVERDUE') matchesTab = overdue || st === 'OVERDUE';

      const q = searchQuery.toLowerCase();
      const invNum = (inv.invoice_number || '').toLowerCase();
      const custName = (inv.quotation?.customer?.name || '').toLowerCase();
      const compName = (inv.quotation?.customer?.company_name || '').toLowerCase();
      const quoteNum = (inv.quotation?.quotation_number || '').toLowerCase();

      const matchesSearch =
        !q ||
        invNum.includes(q) ||
        custName.includes(q) ||
        compName.includes(q) ||
        quoteNum.includes(q);

      return matchesTab && matchesSearch;
    });
  }, [invoices, filterTab, searchQuery]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [filterTab, searchQuery]);

  // Paginated slice
  const pagedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Receipt size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Invoices & Billing
              </h1>
              <p className="text-xs text-slate-400">
                Track receivables, record settlement references, and stream official PDFs
              </p>
            </div>
          </div>
        </div>

        {canManageInvoices && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            Create Invoice
          </button>
        )}
      </div>

      {/* ── 4 Stats Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4.5 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Total Invoiced
            </p>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {formatINR(stats.totalInvoiced)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FileText size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4.5 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Total Collected
            </p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {formatINR(stats.totalCollected)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4.5 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Outstanding Receivables
            </p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-1">
              {formatINR(stats.outstanding)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4.5 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Overdue Invoices
            </p>
            <p className="text-2xl font-black text-rose-400 font-mono mt-1">
              {stats.overdueCount}
              <span className="text-xs font-normal text-slate-500 ml-1.5">unpaid</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
        <div className="relative w-full md:w-80">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, customer, QT ref..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All Invoices' },
            { id: 'DRAFT', label: 'Draft' },
            { id: 'SENT', label: 'Sent' },
            { id: 'PAID', label: 'Paid' },
            { id: 'OVERDUE', label: 'Overdue' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Invoices List Table ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                <th className="py-3.5 px-5 font-semibold">Invoice #</th>
                <th className="py-3.5 px-4 font-semibold">Customer</th>
                <th className="py-3.5 px-4 font-semibold">Quotation Ref</th>
                <th className="py-3.5 px-4 font-semibold text-right">Amount</th>
                <th className="py-3.5 px-4 font-semibold">Issue Date</th>
                <th className="py-3.5 px-4 font-semibold">Due Date</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <FileText size={36} className="mx-auto text-slate-700 mb-2" />
                    <p className="text-sm font-semibold text-slate-400">No invoices found</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Generate an invoice from any approved quotation above.
                    </p>
                  </td>
                </tr>
              ) : (
                pagedInvoices.map((inv) => {
                  const st = (inv.status || 'DRAFT').toUpperCase();
                  const overdue =
                    st !== 'PAID' && st !== 'CANCELLED' && isPastDue(inv.due_date);

                  const displayStatus = overdue ? 'OVERDUE' : st;
                  const statusMeta =
                    STATUS_CONFIG[displayStatus] || STATUS_CONFIG.DRAFT;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Invoice number */}
                      <td className="py-4 px-5">
                        <span className="font-mono font-bold text-white text-xs group-hover:text-indigo-300 transition-colors">
                          {inv.invoice_number}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <p className="font-semibold text-slate-200">
                          {inv.quotation?.customer?.name || 'Direct Customer'}
                        </p>
                        {inv.quotation?.customer?.company_name && (
                          <p className="text-[11px] text-slate-400">
                            {inv.quotation.customer.company_name}
                          </p>
                        )}
                      </td>

                      {/* Quotation Ref */}
                      <td className="py-4 px-4">
                        <span className="font-mono text-indigo-400 font-medium">
                          {inv.quotation?.quotation_number ||
                            `QT-${inv.quotation_id?.slice(0, 8)}`}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatINR(inv.amount)}
                      </td>

                      {/* Issue date */}
                      <td className="py-4 px-4 text-slate-400">
                        {formatDate(inv.created_at)}
                      </td>

                      {/* Due date */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={overdue ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                            {formatDate(inv.due_date)}
                          </span>
                          {overdue && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black tracking-wider">
                              OVERDUE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.bg}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* DRAFT ACTIONS: Mark Sent, Record Payment, Download PDF */}
                          {st === 'DRAFT' && (
                            <>
                              {canManageInvoices && (
                                <button
                                  onClick={() => handleMarkSent(inv.id)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors flex items-center gap-1"
                                >
                                  <Send size={11} className="text-blue-400" />
                                  Mark Sent
                                </button>
                              )}
                              {canManageInvoices && (
                                <button
                                  onClick={() => setPaymentModalInvoice(inv)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
                                >
                                  <CreditCard size={11} />
                                  Record Payment
                                </button>
                              )}
                              <button
                                onClick={() => handleDownloadPDF(inv.id)}
                                title="Download PDF"
                                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              >
                                <Download size={13} />
                              </button>
                            </>
                          )}

                          {/* SENT / OVERDUE ACTIONS: Record Payment, Download PDF */}
                          {(st === 'SENT' || overdue) && (
                            <>
                              {canManageInvoices && (
                                <button
                                  onClick={() => setPaymentModalInvoice(inv)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <CreditCard size={11} />
                                  Record Payment
                                </button>
                              )}
                              <button
                                onClick={() => handleDownloadPDF(inv.id)}
                                title="Download PDF"
                                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              >
                                <Download size={13} />
                              </button>
                            </>
                          )}

                          {/* PAID ACTIONS: Download PDF, View Receipt */}
                          {st === 'PAID' && (
                            <>
                              <button
                                onClick={() => setReceiptModalInvoice(inv)}
                                className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors flex items-center gap-1"
                              >
                                <Receipt size={11} className="text-emerald-400" />
                                View Receipt
                              </button>
                              <button
                                onClick={() => handleDownloadPDF(inv.id)}
                                title="Download PDF"
                                className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              >
                                <Download size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4">
          <Pagination
            currentPage={currentPage}
            totalItems={filteredInvoices.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {paymentModalInvoice && (
        <RecordPaymentModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onSuccess={loadInvoices}
        />
      )}

      {receiptModalInvoice && (
        <ViewReceiptModal
          invoice={receiptModalInvoice}
          onClose={() => setReceiptModalInvoice(null)}
        />
      )}

      {isCreateModalOpen && (
        <CreateInvoiceModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={loadInvoices}
        />
      )}
    </div>
  );
}
