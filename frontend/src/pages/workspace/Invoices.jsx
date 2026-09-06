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
  AlertCircle,
  Database,
  Zap,
  Smartphone,
  Landmark,
  FileCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { invoicesAPI, quotationsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';
import RecordPaymentModal from './RecordPaymentModal';

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
    bg: 'bg-slate-100 text-slate-800',
    icon: Clock,
  },
  SENT: {
    label: 'Sent',
    bg: 'bg-pop-sky text-slate-900',
    icon: Send,
  },
  PAID: {
    label: 'Paid',
    bg: 'bg-pop-mint text-slate-900',
    icon: CheckCircle2,
  },
  OVERDUE: {
    label: 'Overdue',
    bg: 'bg-rose-300 text-rose-950',
    icon: AlertTriangle,
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-200 text-slate-600',
    icon: X,
  },
};

// ─── Sub-Component: View Receipt Modal ─────────────────────────────────────

function ViewReceiptModal({ invoice, onClose }) {
  const handleDownload = () => {
    invoicesAPI.downloadPDF(invoice.id);
  };

  const ref = invoice.payment_ref || '';
  const isRazorpay = ref.includes('RAZORPAY') || ref.includes('pay_');
  const isPayU = ref.includes('PAYU') || ref.includes('payu_');
  const isUPI = ref.includes('UPI');

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border-2 border-slate-900 bg-[#FFFDF5] shadow-pop-xl p-6 text-slate-900">
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900 bg-white -mx-6 -mt-6 p-6 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pop-mint text-slate-900 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center">
              <Receipt size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-extrabold text-slate-900">Payment Receipt</h3>
              <p className="text-xs text-slate-600 font-medium">Official Settle Acknowledgement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white hover:bg-rose-100 text-slate-900 flex items-center justify-center shadow-pop-sm cursor-pointer transition-all active:translate-y-0.5"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Receipt Visual Sheet */}
        <div className="mt-5 rounded-2xl border-2 border-slate-900 bg-white p-5 space-y-4 shadow-pop">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-heading font-black">DEALFLOW360 ENTERPRISE</p>
              <h4 className="text-base font-heading font-extrabold text-slate-900 mt-0.5">Payment Acknowledgement</h4>
            </div>
            {/* PAID Stamp with Gateway Badges */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="px-3.5 py-1 rounded-full border-2 border-slate-900 bg-pop-mint text-slate-900 text-xs font-heading font-black tracking-widest uppercase rotate-2 shadow-pop-sm flex items-center gap-1">
                <CheckCircle2 size={13} strokeWidth={2.5} />
                <span>PAID</span>
              </div>
              {isRazorpay && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pop-violet text-white text-[10px] font-heading font-bold border-2 border-slate-900 shadow-pop-sm">
                  <Zap size={11} strokeWidth={2.5} />
                  Razorpay Verified
                </span>
              )}
              {isPayU && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pop-mint text-slate-900 text-[10px] font-heading font-bold border-2 border-slate-900 shadow-pop-sm">
                  <CreditCard size={11} strokeWidth={2.5} />
                  PayU Verified
                </span>
              )}
              {isUPI && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pop-pink text-white text-[10px] font-heading font-bold border-2 border-slate-900 shadow-pop-sm">
                  <Smartphone size={11} strokeWidth={2.5} />
                  UPI Settled
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t-2 border-slate-900/10">
            <div>
              <p className="text-slate-500 font-heading font-bold text-[11px] uppercase">Invoice Number</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-slate-500 font-heading font-bold text-[11px] uppercase">Quotation Ref</p>
              <p className="font-mono font-bold text-pop-violet mt-0.5">
                {invoice.quotation?.quotation_number || `QT-${invoice.quotation_id?.slice(0, 8)}`}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-heading font-bold text-[11px] uppercase">Customer</p>
              <p className="font-heading font-bold text-slate-900 mt-0.5">
                {invoice.quotation?.customer?.name || 'Customer'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-heading font-bold text-[11px] uppercase">Amount Settled</p>
              <p className="font-mono font-black text-pop-mint text-base mt-0.5">
                {formatINR(invoice.amount)}
              </p>
            </div>
          </div>

          {/* Reference Info Box */}
          <div className="p-3 rounded-xl bg-slate-50 border-2 border-slate-900 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600 font-heading font-bold">Transaction Reference:</span>
              <span className="font-mono font-bold text-slate-900 select-all truncate max-w-[200px]">
                {invoice.payment_ref || 'Official Gateway Record'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-heading font-bold">Paid On:</span>
              <span className="font-mono font-bold text-slate-800">
                {formatDate(invoice.paid_at || invoice.updated_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            onClick={handleDownload}
            className="btn-candy bg-white hover:bg-pop-yellow text-slate-900 text-xs px-4 py-2 gap-1.5 shadow-pop-sm"
          >
            <Download size={13} strokeWidth={2.5} />
            Download PDF
          </button>
          <button
            onClick={onClose}
            className="btn-candy bg-pop-violet hover:bg-[#7C3AED] text-white text-xs px-5 py-2 shadow-pop"
          >
            Done
          </button>
        </div>
      </div>
    </div>
    </Portal>
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
    const fetchQuotations = async () => {
      try {
        setLoadingQuotes(true);
        const data = await quotationsAPI.getAll();
        const available = (Array.isArray(data) ? data : []).filter(
          (q) => q.status === 'APPROVED' || q.status === 'CONFIRMED'
        );
        setQuotations(available);
        if (available.length > 0) {
          setSelectedQuoteId(available[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load eligible quotations');
      } finally {
        setLoadingQuotes(false);
      }
    };
    fetchQuotations();
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
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border-2 border-slate-900 bg-[#FFFDF5] shadow-pop-xl p-6 text-slate-900">
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900 bg-white -mx-6 -mt-6 p-6 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm flex items-center justify-center">
              <Plus size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-extrabold text-slate-900">Generate Invoice</h3>
              <p className="text-xs text-slate-600 font-medium">Convert approved quotation into official invoice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white hover:bg-rose-100 text-slate-900 flex items-center justify-center shadow-pop-sm cursor-pointer transition-all active:translate-y-0.5"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-heading font-bold text-slate-800 uppercase mb-1.5">
              Select Approved Quotation <span className="text-rose-500">*</span>
            </label>
            {loadingQuotes ? (
              <div className="h-10 rounded-xl bg-slate-200 border-2 border-slate-900 animate-pulse" />
            ) : quotations.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-slate-900 text-xs font-heading font-bold text-amber-900">
                No approved/confirmed quotations available for invoicing.
              </div>
            ) : (
              <select
                value={selectedQuoteId}
                onChange={(e) => setSelectedQuoteId(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:shadow-pop transition-all cursor-pointer"
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
            <div className="rounded-2xl border-2 border-slate-900 bg-white p-4 space-y-2 text-xs shadow-pop-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 font-heading font-bold">Customer:</span>
                <span className="font-heading font-extrabold text-slate-900">
                  {selectedQuote.customer?.name || 'Customer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-heading font-bold">Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatINR(selectedQuote.subtotal || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-heading font-bold">Grand Total:</span>
                <span className="font-mono font-black text-pop-mint text-sm">
                  {formatINR(selectedQuote.total || selectedQuote.totalAmount || 0)}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-heading font-bold text-slate-800 uppercase mb-1.5">
              Payment Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:shadow-pop transition-all"
            />
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="isRecurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-slate-900 text-pop-violet focus:ring-0 cursor-pointer"
            />
            <label htmlFor="isRecurring" className="text-xs font-heading font-bold text-slate-800 cursor-pointer select-none">
              Mark as Recurring Monthly Subscription Invoice
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t-2 border-slate-900/10">
            <button
              type="button"
              onClick={onClose}
              className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs px-4 py-2 shadow-pop-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || !selectedQuoteId}
              className="btn-candy bg-pop-violet hover:bg-[#7C3AED] text-white text-xs px-5 py-2 shadow-pop"
            >
              {generating ? 'Generating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

// ─── Main Invoices Page Component ──────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuthStore();
  const canManageInvoices = ['ADMIN', 'SALES_MANAGER', 'FINANCE'].includes(user?.role);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE'

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);

  // Sorting state
  const [sortField, setSortField] = useState('invoice_number');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterTab !== 'ALL') {
        params.status = filterTab;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await invoicesAPI.getAll(params);
      setInvoices(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [filterTab, searchQuery]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle Mark Sent
  const handleMarkSent = async (invoiceId) => {
    try {
      await invoicesAPI.markSent(invoiceId);
      toast.success('Invoice marked as Sent');
      fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update invoice status');
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let outstanding = 0;
    let overdueCount = 0;

    invoices.forEach((inv) => {
      const amt = Number(inv.amount || 0);
      const st = (inv.status || 'DRAFT').toUpperCase();
      const overdue = st !== 'PAID' && st !== 'CANCELLED' && isPastDue(inv.due_date);

      totalInvoiced += amt;
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

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Sorted invoices
  const sortedInvoices = useMemo(() => {
    const arr = [...invoices];
    arr.sort((a, b) => {
      let av, bv;
      if (sortField === 'customer') {
        av = (a.quotation?.customer?.name || '').toLowerCase();
        bv = (b.quotation?.customer?.name || '').toLowerCase();
      } else if (sortField === 'amount') {
        av = Number(a.amount || 0);
        bv = Number(b.amount || 0);
      } else if (sortField === 'due_date') {
        av = new Date(a.due_date || 0).getTime();
        bv = new Date(b.due_date || 0).getTime();
      } else if (sortField === 'updated_at') {
        av = new Date(a.updated_at || a.created_at || 0).getTime();
        bv = new Date(b.updated_at || b.created_at || 0).getTime();
      } else {
        // invoice_number default
        av = (a.invoice_number || '').toLowerCase();
        bv = (b.invoice_number || '').toLowerCase();
      }
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return (a.id || '').localeCompare(b.id || '');
    });
    return arr;
  }, [invoices, sortField, sortOrder]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [filterTab, searchQuery, sortField, sortOrder]);

  // Paginated slice
  const pagedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, currentPage, pageSize]);

  // Sort icon helper
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={11} strokeWidth={2.5} className="text-slate-400 inline ml-1" />;
    return sortOrder === 'asc'
      ? <ArrowUp size={11} strokeWidth={2.5} className="text-pop-violet inline ml-1" />
      : <ArrowDown size={11} strokeWidth={2.5} className="text-pop-violet inline ml-1" />;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm flex items-center justify-center">
            <Receipt size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
              Invoices & Receivables
            </h1>
            <p className="text-xs text-slate-600 font-heading font-bold mt-0.5">
              Track deal cashflow, verify gateway settlements, and generate official PDFs
            </p>
          </div>
        </div>

        {canManageInvoices && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-candy bg-pop-violet hover:bg-[#7C3AED] text-white text-xs px-5 py-2.5 gap-2 shadow-pop"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Create Invoice</span>
          </button>
        )}
      </div>

      {/* ── 4 Stats Cards (Color-Coded for Easy Differentiation) ───────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-violet-600 font-heading font-black">
              Total Invoiced
            </p>
            <p className="text-xl sm:text-2xl font-heading font-black text-slate-900 mt-1 font-mono">
              {formatINR(stats.totalInvoiced)}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 shadow-pop-xs flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText size={20} strokeWidth={2.5} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-heading font-black">
              Total Collected
            </p>
            <p className="text-xl sm:text-2xl font-heading font-black text-emerald-700 mt-1 font-mono">
              {formatINR(stats.totalCollected)}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-pop-mint text-slate-900 border-2 border-slate-900 shadow-pop-xs flex items-center justify-center group-hover:scale-110 transition-transform">
            <CheckCircle2 size={20} strokeWidth={2.5} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-amber-600 font-heading font-black">
              Outstanding Due
            </p>
            <p className="text-xl sm:text-2xl font-heading font-black text-amber-700 mt-1 font-mono">
              {formatINR(stats.outstanding)}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-xs flex items-center justify-center group-hover:scale-110 transition-transform">
            <Clock size={20} strokeWidth={2.5} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-slate-900 rounded-3xl p-4 sm:p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-rose-600 font-heading font-black">
              Overdue Invoices
            </p>
            <p className="text-xl sm:text-2xl font-heading font-black text-rose-600 mt-1">
              {stats.overdueCount}
              <span className="text-xs font-heading font-bold text-slate-500 ml-1.5 font-sans">unpaid</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-200 text-rose-800 border-2 border-slate-900 shadow-pop-xs flex items-center justify-center group-hover:scale-110 transition-transform">
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-pop">
        <div className="relative w-full md:w-80">
          <Search
            size={15}
            strokeWidth={2.5}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, customer, QT ref..."
            className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-full pl-9 pr-3.5 py-1.5 text-xs font-heading font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:shadow-pop transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-heading font-extrabold border-2 border-slate-900 transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === tab.id
                    ? 'bg-slate-900 text-white shadow-pop-sm'
                    : 'bg-white text-slate-700 hover:bg-pop-yellow shadow-none hover:shadow-pop-sm hover:-translate-y-0.5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1.5 ml-auto">
            <select
              value={sortField}
              onChange={(e) => { setSortField(e.target.value); setCurrentPage(1); }}
              className="bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:shadow-pop cursor-pointer shadow-pop-xs"
            >
              <option value="invoice_number">Invoice #</option>
              <option value="customer">Customer</option>
              <option value="amount">Amount</option>
              <option value="due_date">Due Date</option>
              <option value="updated_at">Latest Update</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-pop-yellow shadow-pop-xs transition-all cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc'
                ? <ArrowUp size={14} strokeWidth={2.5} className="text-pop-violet" />
                : <ArrowDown size={14} strokeWidth={2.5} className="text-pop-violet" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Invoices List (Desktop Table + Mobile Cards) ─────────────────── */}
      <div className="rounded-2xl border-2 border-slate-900 bg-white overflow-hidden shadow-pop">
        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800 font-heading font-extrabold">
                <th className="py-3.5 px-5 cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => handleSort('invoice_number')}>
                  Invoice # <SortIcon field="invoice_number" />
                </th>
                <th className="py-3.5 px-4 cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => handleSort('customer')}>
                  Customer <SortIcon field="customer" />
                </th>
                <th className="py-3.5 px-4">Quotation Ref</th>
                <th className="py-3.5 px-4 text-right cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => handleSort('amount')}>
                  Amount <SortIcon field="amount" />
                </th>
                <th className="py-3.5 px-4">Issue Date</th>
                <th className="py-3.5 px-4 cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => handleSort('due_date')}>
                  Due Date <SortIcon field="due_date" />
                </th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-heading font-bold">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-600">
                    <div className="w-12 h-12 rounded-2xl bg-pop-yellow border-2 border-slate-900 shadow-pop-sm flex items-center justify-center mx-auto mb-2">
                      <FileText size={24} strokeWidth={2.5} className="text-slate-900" />
                    </div>
                    <p className="text-sm font-heading font-extrabold text-slate-900">No invoices found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Generate an invoice from any approved quotation.
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
                  const StatusIcon = statusMeta.icon;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-pop-yellow/15 transition-colors group"
                    >
                      {/* Invoice number */}
                      <td className="py-4 px-5">
                        <span className="font-mono font-bold text-slate-900 text-xs group-hover:text-pop-violet transition-colors">
                          {inv.invoice_number}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <p className="font-heading font-bold text-slate-900">
                          {inv.quotation?.customer?.name || 'Direct Customer'}
                        </p>
                        {inv.quotation?.customer?.company_name && (
                          <p className="text-[11px] text-slate-500 font-medium">
                            {inv.quotation.customer.company_name}
                          </p>
                        )}
                      </td>

                      {/* Quotation Ref */}
                      <td className="py-4 px-4">
                        <span className="font-mono text-pop-violet font-bold">
                          {inv.quotation?.quotation_number ||
                            `QT-${inv.quotation_id?.slice(0, 8)}`}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        {formatINR(inv.amount)}
                      </td>

                      {/* Issue date */}
                      <td className="py-4 px-4 text-slate-600 font-heading font-bold">
                        {formatDate(inv.created_at)}
                      </td>

                      {/* Due date */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={overdue ? 'text-rose-600 font-extrabold' : 'text-slate-700 font-heading font-bold'}>
                            {formatDate(inv.due_date)}
                          </span>
                          {overdue && (
                            <span className="px-2 py-0.2 rounded-full bg-rose-400 text-white text-[9px] font-heading font-black border border-slate-900 shadow-pop-sm">
                              OVERDUE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold border-2 border-slate-900 shadow-pop-sm ${statusMeta.bg}`}
                        >
                          <StatusIcon size={12} strokeWidth={2.5} />
                          <span>{statusMeta.label}</span>
                        </span>
                        {st === 'PAID' && inv.payment_ref && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFFDF5] text-[10px] font-heading font-bold text-slate-900 border-2 border-slate-900 shadow-pop-sm">
                              {inv.payment_ref.includes('RAZORPAY') ? (
                                <><Zap size={10} strokeWidth={2.5} className="text-pop-violet" /> Razorpay</>
                              ) : inv.payment_ref.includes('PAYU') ? (
                                <><CreditCard size={10} strokeWidth={2.5} className="text-pop-mint" /> PayU</>
                              ) : inv.payment_ref.includes('UPI') ? (
                                <><Smartphone size={10} strokeWidth={2.5} className="text-pop-pink" /> UPI</>
                              ) : inv.payment_ref.includes('NEFT') ? (
                                <><Landmark size={10} strokeWidth={2.5} className="text-blue-600" /> Wire</>
                              ) : inv.payment_ref.includes('CHEQUE') ? (
                                <><Receipt size={10} strokeWidth={2.5} className="text-amber-600" /> Cheque</>
                              ) : (
                                <><CheckCircle2 size={10} strokeWidth={2.5} className="text-emerald-600" /> Settled</>
                              )}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {st === 'DRAFT' && (
                            <>
                              {canManageInvoices && (
                                <button
                                  onClick={() => handleMarkSent(inv.id)}
                                  className="btn-candy bg-white hover:bg-pop-sky text-slate-900 text-[11px] px-2.5 py-1 gap-1 shadow-pop-sm"
                                >
                                  <Send size={11} strokeWidth={2.5} />
                                  Mark Sent
                                </button>
                              )}
                              {canManageInvoices && (
                                <button
                                  onClick={() => setPaymentModalInvoice(inv)}
                                  className="btn-candy bg-pop-violet hover:bg-[#7C3AED] text-white text-[11px] px-3 py-1 gap-1 shadow-pop-sm"
                                >
                                  <CreditCard size={11} strokeWidth={2.5} />
                                  Record Payment
                                </button>
                              )}
                            </>
                          )}

                          {(st === 'SENT' || st === 'OVERDUE') && (
                            <>
                              {canManageInvoices && (
                                <button
                                  onClick={() => setPaymentModalInvoice(inv)}
                                  className="btn-candy bg-pop-violet hover:bg-[#7C3AED] text-white text-[11px] px-3 py-1 gap-1 shadow-pop-sm"
                                >
                                  <CreditCard size={11} strokeWidth={2.5} />
                                  Record Payment
                                </button>
                              )}
                            </>
                          )}

                          {st === 'PAID' && (
                            <button
                              onClick={() => setReceiptInvoice(inv)}
                              className="btn-candy bg-pop-mint hover:bg-[#10B981] text-slate-900 text-[11px] px-3 py-1 gap-1 shadow-pop-sm"
                            >
                              <Receipt size={11} strokeWidth={2.5} />
                              View Receipt
                            </button>
                          )}

                          <button
                            onClick={() => invoicesAPI.downloadPDF(inv.id)}
                            className="w-7 h-7 rounded-full border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 shadow-pop-sm flex items-center justify-center transition-all active:translate-y-0.5 cursor-pointer"
                            title="Download Official PDF"
                          >
                            <Download size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y-2 divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-heading font-bold">
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-slate-600 px-4">
              <div className="w-12 h-12 rounded-2xl bg-pop-yellow border-2 border-slate-900 shadow-pop-sm flex items-center justify-center mx-auto mb-2">
                <FileText size={24} strokeWidth={2.5} className="text-slate-900" />
              </div>
              <p className="text-sm font-heading font-extrabold text-slate-900">No invoices found</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate an invoice from any approved quotation.
              </p>
            </div>
          ) : (
            pagedInvoices.map((inv) => {
              const st = (inv.status || 'DRAFT').toUpperCase();
              const overdue =
                st !== 'PAID' && st !== 'CANCELLED' && isPastDue(inv.due_date);

              const displayStatus = overdue ? 'OVERDUE' : st;
              const statusMeta =
                STATUS_CONFIG[displayStatus] || STATUS_CONFIG.DRAFT;
              const StatusIcon = statusMeta.icon;

              return (
                <div key={inv.id} className="p-4 space-y-3 hover:bg-pop-yellow/10 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {inv.invoice_number}
                      </span>
                      <p className="font-heading font-bold text-slate-900 text-sm mt-0.5">
                        {inv.quotation?.customer?.name || 'Direct Customer'}
                      </p>
                      {inv.quotation?.customer?.company_name && (
                        <p className="text-[11px] text-slate-500 font-medium">
                          {inv.quotation.customer.company_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-heading font-bold border-2 border-slate-900 shadow-pop-sm shrink-0 ${statusMeta.bg}`}
                    >
                      <StatusIcon size={11} strokeWidth={2.5} />
                      <span>{statusMeta.label}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-paper p-2.5 rounded-xl border border-slate-300 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Amount</span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatINR(inv.amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Quotation Ref</span>
                      <span className="font-mono text-pop-violet font-bold text-xs">
                        {inv.quotation?.quotation_number || `QT-${inv.quotation_id?.slice(0, 8)}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Issue Date</span>
                      <span className="text-slate-700 font-medium text-xs">
                        {formatDate(inv.created_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Due Date</span>
                      <span className={`text-xs font-bold ${overdue ? 'text-rose-600' : 'text-slate-700'}`}>
                        {formatDate(inv.due_date)} {overdue && '(OVERDUE)'}
                      </span>
                    </div>
                  </div>

                  {st === 'PAID' && inv.payment_ref && (
                    <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1.5">
                      <span className="font-bold">Payment:</span>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-sans font-semibold">
                        {inv.payment_ref}
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {st === 'DRAFT' && canManageInvoices && (
                      <>
                        <button
                          onClick={() => handleMarkSent(inv.id)}
                          className="btn-candy bg-white hover:bg-pop-sky text-slate-900 text-[11px] px-2.5 py-1 gap-1 shadow-pop-sm"
                        >
                          <Send size={11} strokeWidth={2.5} />
                          Send
                        </button>
                        <button
                          onClick={() => setPaymentModalInvoice(inv)}
                          className="btn-candy bg-pop-violet hover:bg-[#7C3AED] text-white text-[11px] px-3 py-1 gap-1 shadow-pop-sm"
                        >
                          <CreditCard size={11} strokeWidth={2.5} />
                          Pay
                        </button>
                      </>
                    )}
                    {(st === 'SENT' || st === 'OVERDUE') && canManageInvoices && (
                      <button
                        onClick={() => setPaymentModalInvoice(inv)}
                        className="btn-candy bg-pop-violet hover:bg-[#7C3AED] text-white text-[11px] px-3 py-1 gap-1 shadow-pop-sm"
                      >
                        <CreditCard size={11} strokeWidth={2.5} />
                        Record Payment
                      </button>
                    )}
                    {st === 'PAID' && (
                      <button
                        onClick={() => setReceiptInvoice(inv)}
                        className="btn-candy bg-pop-mint hover:bg-[#10B981] text-slate-900 text-[11px] px-3 py-1 gap-1 shadow-pop-sm"
                      >
                        <Receipt size={11} strokeWidth={2.5} />
                        Receipt
                      </button>
                    )}
                    <button
                      onClick={() => invoicesAPI.downloadPDF(inv.id)}
                      className="w-7 h-7 rounded-full border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 shadow-pop-sm flex items-center justify-center transition-all active:translate-y-0.5 cursor-pointer"
                      title="Download PDF"
                    >
                      <Download size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t-2 border-slate-900 bg-slate-50">
          <Pagination
            currentPage={currentPage}
            totalItems={invoices.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <CreateInvoiceModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchInvoices}
        />
      )}

      {receiptInvoice && (
        <ViewReceiptModal
          invoice={receiptInvoice}
          onClose={() => setReceiptInvoice(null)}
        />
      )}

      {paymentModalInvoice && (
        <RecordPaymentModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onSuccess={fetchInvoices}
        />
      )}
    </div>
  );
}
