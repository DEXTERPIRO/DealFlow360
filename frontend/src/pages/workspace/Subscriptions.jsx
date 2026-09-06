import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Calendar,
  Layers,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Plus,
  Edit3,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Package,
  Building,
  User,
  ShieldAlert,
  Sparkles,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Database,
  Info,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { subscriptionsAPI, productsAPI, quotationsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';

// Format Indian Rupee currency
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

const CYCLE_BADGES = {
  MONTHLY: {
    label: 'Monthly',
    bg: 'bg-pop-sky/30 text-sky-950 border-2 border-slate-900 shadow-pop-sm',
  },
  QUARTERLY: {
    label: 'Quarterly',
    bg: 'bg-pop-mint/30 text-emerald-950 border-2 border-slate-900 shadow-pop-sm',
  },
  YEARLY: {
    label: 'Yearly',
    bg: 'bg-pop-violet/20 text-purple-950 border-2 border-slate-900 shadow-pop-sm',
  },
};

const getTierBadge = (tier) => {
  const t = String(tier || 'BRONZE').toUpperCase();
  if (t === 'PLATINUM') return 'bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm';
  if (t === 'GOLD') return 'bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-sm';
  if (t === 'SILVER') return 'bg-slate-200 text-slate-900 border-2 border-slate-900 shadow-pop-sm';
  return 'bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-sm';
};

// ─── Sub-Component: Cancel Confirmation Modal ──────────────────────────────
function CancelModal({ sub, onClose, onConfirm, loading }) {
  if (!sub) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-pop-pink/30 text-rose-950 border-2 border-slate-900 shadow-pop-sm">
            <ShieldAlert size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-heading font-extrabold text-slate-900">Cancel Subscription</h3>
            <p className="text-xs text-slate-600 font-medium">This action will stop all future recurring billings</p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-900 bg-paper p-4 space-y-2 text-xs shadow-inner">
          <div className="flex justify-between text-slate-800">
            <span className="text-slate-500 font-medium">Customer:</span>
            <span className="font-bold">{sub.quotation?.customer?.name || 'Customer'}</span>
          </div>
          <div className="flex justify-between text-slate-800">
            <span className="text-slate-500 font-medium">Plan:</span>
            <span className="font-bold text-slate-900">{sub.plan?.name}</span>
          </div>
          <div className="flex justify-between text-slate-800">
            <span className="text-slate-500 font-medium">Billing Cycle:</span>
            <span className="font-mono font-bold text-pop-violet">{sub.plan?.billing_cycle}</span>
          </div>
          <div className="flex justify-between text-slate-800">
            <span className="text-slate-500 font-medium">Cancellation Terms:</span>
            <span className="text-slate-700 font-medium text-right">{sub.plan?.cancel_policy || 'Standard cancellation policy'}</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 font-medium">
          Are you sure you want to cancel this recurring subscription?
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-4 py-2 rounded-xl border-2 border-slate-900 shadow-pop-sm"
          >
            Keep Active
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="btn-candy bg-pop-pink/40 hover:bg-pop-pink/60 text-rose-950 text-xs font-black px-5 py-2 rounded-xl border-2 border-slate-900 shadow-pop disabled:opacity-50"
          >
            {loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ─── Sub-Component: Create / Edit Subscription Plan Modal ───────────────────
function PlanModal({ plan, onClose, onSave }) {
  const isEdit = Boolean(plan?.id);
  const [name, setName] = useState(plan?.name || '');
  const [billingCycle, setBillingCycle] = useState(plan?.billing_cycle || 'MONTHLY');
  const [prorateOnChange, setProrateOnChange] = useState(
    plan?.prorate_on_change !== undefined ? plan.prorate_on_change : true
  );
  const [partialRefund, setPartialRefund] = useState(plan?.partial_refund || false);
  const [cancelPolicy, setCancelPolicy] = useState(plan?.cancel_policy || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: name.trim(),
        billingCycle,
        prorateOnChange,
        partialRefund,
        cancelPolicy: cancelPolicy.trim() || null,
      };

      if (isEdit) {
        await subscriptionsAPI.updatePlan(plan.id, payload);
        toast.success(`Plan "${name}" updated successfully!`);
      } else {
        await subscriptionsAPI.createPlan(payload);
        toast.success(`Plan "${name}" created successfully!`);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pop-sky border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
              <CreditCard size={18} className="stroke-[2.5]" />
            </div>
            <h3 className="text-base font-heading font-extrabold text-slate-900">
              {isEdit ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl border-2 border-slate-900 hover:bg-slate-100 text-slate-900 shadow-pop-sm">
            <X size={16} className="stroke-[2.5]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Plan Name <span className="text-pop-pink font-black">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Care Plan 2yr, Support SLA"
              className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-pop-violet"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Billing Cycle <span className="text-pop-pink font-black">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['MONTHLY', 'QUARTERLY', 'YEARLY'].map((cycle) => (
                <button
                  type="button"
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`py-2 px-3 rounded-2xl border-2 border-slate-900 text-xs font-mono font-bold transition-all ${
                    billingCycle === cycle
                      ? 'bg-slate-900 text-white shadow-pop-sm'
                      : 'bg-paper text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-2 border-slate-900 bg-paper p-3 flex items-center justify-between shadow-inner">
              <div>
                <p className="text-xs font-bold text-slate-900">Prorate on Change</p>
                <p className="text-[10px] text-slate-500 font-medium">Prorate on plan change</p>
              </div>
              <input
                type="checkbox"
                checked={prorateOnChange}
                onChange={(e) => setProrateOnChange(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-slate-900 text-pop-violet focus:ring-pop-violet"
              />
            </div>

            <div className="rounded-2xl border-2 border-slate-900 bg-paper p-3 flex items-center justify-between shadow-inner">
              <div>
                <p className="text-xs font-bold text-slate-900">Partial Refund</p>
                <p className="text-[10px] text-slate-500 font-medium">Allow early exit refund</p>
              </div>
              <input
                type="checkbox"
                checked={partialRefund}
                onChange={(e) => setPartialRefund(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-slate-900 text-pop-violet focus:ring-pop-violet"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Cancellation Policy <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={cancelPolicy}
              onChange={(e) => setCancelPolicy(e.target.value)}
              placeholder="e.g. 30 days notice required prior to auto-renewal"
              className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pop-violet"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-4 py-2 rounded-xl border-2 border-slate-900 shadow-pop-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-candy bg-pop-violet hover:bg-pop-violet/90 text-white text-xs font-bold px-5 py-2 rounded-xl border-2 border-slate-900 shadow-pop disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEdit ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

// ─── Main Subscriptions Component ──────────────────────────────────────────
export default function Subscriptions() {
  const { user } = useAuthStore();
  const canManagePlans = ['ADMIN', 'SALES_MANAGER'].includes(user?.role);

  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter: 'ALL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for Subscriptions Table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Active Subscription for the Billing Detail Modal
  const [activeDetailSub, setActiveDetailSub] = useState(null);

  // Modals
  const [cancelModalSub, setCancelModalSub] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlanToEdit, setSelectedPlanToEdit] = useState(null);

  // Load subscriptions & plans
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [subsRes, plansRes] = await Promise.all([
        subscriptionsAPI.getAll(),
        subscriptionsAPI.getPlans(),
      ]);
      setSubscriptions(Array.isArray(subsRes) ? subsRes : subsRes?.subscriptions || []);
      setPlans(Array.isArray(plansRes) ? plansRes : plansRes?.plans || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subscriptions data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute status counts for Top Badges
  const counts = useMemo(() => {
    let active = 0;
    let paused = 0;
    let cancelled = 0;
    subscriptions.forEach((s) => {
      const st = (s.status || 'ACTIVE').toUpperCase();
      if (st === 'ACTIVE') active++;
      else if (st === 'PAUSED') paused++;
      else if (st === 'CANCELLED') cancelled++;
    });
    return { active, paused, cancelled, total: subscriptions.length };
  }, [subscriptions]);

  // Filtered subscriptions list
  const filteredSubscriptions = useMemo(() => {
    let list = subscriptions;

    if (statusFilter !== 'ALL') {
      list = list.filter((s) => (s.status || 'ACTIVE').toUpperCase() === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const cust = (s.quotation?.customer?.name || s.quotation?.customer?.company_name || '').toLowerCase();
        const plan = (s.plan?.name || '').toLowerCase();
        const num = (s.quotation?.quotation_number || '').toLowerCase();
        return cust.includes(q) || plan.includes(q) || num.includes(q);
      });
    }

    return list;
  }, [subscriptions, statusFilter, searchQuery]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  // Paginated list
  const paginatedSubscriptions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSubscriptions.slice(start, start + pageSize);
  }, [filteredSubscriptions, currentPage, pageSize]);

  // Cancel handler
  const handleConfirmCancel = async () => {
    if (!cancelModalSub) return;
    try {
      setCancelling(true);
      await subscriptionsAPI.cancel(cancelModalSub.id);
      toast.success(`Subscription for ${cancelModalSub.quotation?.customer?.name || 'Customer'} cancelled`);
      setCancelModalSub(null);
      if (activeDetailSub?.id === cancelModalSub.id) {
        setActiveDetailSub(null);
      }
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  // Extract one-time lines and recurring lines for the active subscription
  const detailLinesBreakdown = useMemo(() => {
    if (!activeDetailSub?.quotation?.lines) return { oneTime: [], recurring: [] };
    const lines = activeDetailSub.quotation.lines;

    const oneTime = lines.filter((l) => (l.line_type || l.lineType) !== 'SUBSCRIPTION');
    const recurring = lines.filter((l) => (l.line_type || l.lineType) === 'SUBSCRIPTION');

    return { oneTime, recurring };
  }, [activeDetailSub]);

  // Navigation in modal
  const currentIndex = useMemo(() => {
    if (!activeDetailSub) return -1;
    return filteredSubscriptions.findIndex((s) => s.id === activeDetailSub.id);
  }, [activeDetailSub, filteredSubscriptions]);

  const handlePrev = () => {
    if (currentIndex > 0) setActiveDetailSub(filteredSubscriptions[currentIndex - 1]);
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < filteredSubscriptions.length - 1) {
      setActiveDetailSub(filteredSubscriptions[currentIndex + 1]);
    }
  };

  // Keyboard escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && activeDetailSub) setActiveDetailSub(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDetailSub]);

  return (
    <div className="space-y-6 antialiased pb-16">
      {/* ── TOP HEADER & SUMMARY PILLS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 flex items-center justify-center shadow-pop-sm">
              <RefreshCw className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Subscriptions</span>
                <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border-2 border-slate-900 shadow-pop-xs">
                  Global Ledger
                </span>
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Every recurring plan across every customer, regardless of which order it came from
              </p>
            </div>
          </div>
        </div>

        {/* Status Summary Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Pill with Animated Radar */}
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`btn-candy px-3.5 py-1.5 rounded-xl text-xs font-mono font-black border-2 border-slate-900 flex items-center gap-2 shadow-pop-sm transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-pop-mint text-slate-900 ring-2 ring-slate-900'
                : 'bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600 border border-slate-900"></span>
            </span>
            <span>{counts.active} Active</span>
          </button>

          {/* Paused Pill */}
          <button
            onClick={() => setStatusFilter('PAUSED')}
            className={`btn-candy px-3.5 py-1.5 rounded-xl text-xs font-mono font-black border-2 border-slate-900 flex items-center gap-2 shadow-pop-sm transition-all ${
              statusFilter === 'PAUSED'
                ? 'bg-pop-yellow text-slate-900 ring-2 ring-slate-900'
                : 'bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-900" />
            <span>{counts.paused} Paused</span>
          </button>

          {/* Cancelled Pill */}
          <button
            onClick={() => setStatusFilter('CANCELLED')}
            className={`btn-candy px-3.5 py-1.5 rounded-xl text-xs font-mono font-black border-2 border-slate-900 flex items-center gap-2 shadow-pop-sm transition-all ${
              statusFilter === 'CANCELLED'
                ? 'bg-pop-pink text-slate-900 ring-2 ring-slate-900'
                : 'bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-900" />
            <span>{counts.cancelled} Cancelled</span>
          </button>

          {/* All Filter Pill */}
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`btn-candy px-3.5 py-1.5 rounded-xl text-xs font-bold border-2 border-slate-900 shadow-pop-sm transition-all ${
              statusFilter === 'ALL'
                ? 'bg-pop-violet text-white ring-2 ring-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            All ({counts.total})
          </button>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-candy p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 ml-1"
            title="Refresh"
          >
            <RefreshCw size={14} className={`stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── TOOLBAR & CALLOUT HINT BANNER ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-3xl border-2 border-slate-900 shadow-pop">
          {/* Search Input */}
          <div className="relative flex-1 w-full max-w-lg">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, plan name, or order #..."
              className="w-full bg-paper border-2 border-slate-900 rounded-2xl pl-10 pr-10 py-2 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pop-violet"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Action: + New Plan (Admin) Button */}
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            {canManagePlans && (
              <button
                onClick={() => {
                  setSelectedPlanToEdit(null);
                  setIsPlanModalOpen(true);
                }}
                className="btn-candy px-4 py-2 rounded-2xl bg-pop-violet hover:bg-pop-violet/90 text-white font-bold text-xs flex items-center gap-1.5 border-2 border-slate-900 shadow-pop transition-all"
              >
                <Plus size={14} className="stroke-[2.5]" />
                <span>New Plan (Admin)</span>
              </button>
            )}
          </div>
        </div>

        {/* Callout Hint Banner */}
        <div className="bg-amber-50 border-2 border-slate-900 rounded-2xl px-4 py-2.5 text-xs text-slate-800 font-semibold shadow-pop-sm flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-700 stroke-[2.5] shrink-0" />
          <span>Click a subscription row to open its billing detail and proration history.</span>
        </div>
      </div>

      {/* ── SUBSCRIPTIONS HIGH-DENSITY LIST TABLE ── */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-[10px] uppercase font-mono font-black text-slate-800 tracking-wider">
                <th className="p-3.5 font-bold">Customer</th>
                <th className="p-3.5 font-bold">Plan</th>
                <th className="p-3.5 font-bold">Cycle</th>
                <th className="p-3.5 font-bold">Next Bill</th>
                <th className="p-3.5 font-bold">Status</th>
                <th className="p-3.5 font-bold text-right">Recurring Rate</th>
                <th className="p-3.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-600 font-bold">
                    <div className="w-6 h-6 border-3 border-slate-900 border-t-pop-violet rounded-full animate-spin mx-auto mb-2" />
                    Loading subscriptions...
                  </td>
                </tr>
              ) : paginatedSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-medium text-xs">
                    No subscriptions found matching the filter "{statusFilter}".
                  </td>
                </tr>
              ) : (
                paginatedSubscriptions.map((sub) => {
                  const statusKey = (sub.status || 'ACTIVE').toUpperCase();
                  const cycleInfo = CYCLE_BADGES[sub.plan?.billing_cycle] || CYCLE_BADGES.MONTHLY;

                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setActiveDetailSub(sub)}
                      className="cursor-pointer hover:bg-amber-50/40 transition-colors group"
                    >
                      {/* Customer */}
                      <td className="p-3.5">
                        <div className="font-heading font-extrabold text-slate-900 group-hover:text-pop-violet transition-colors">
                          {sub.quotation?.customer?.name || sub.quotation?.customer?.company_name || 'Customer'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="font-bold">Order: {sub.quotation?.quotation_number || 'QT'}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${getTierBadge(
                              sub.quotation?.customer_tier
                            )}`}
                          >
                            {sub.quotation?.customer_tier || 'BRONZE'}
                          </span>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{sub.plan?.name || 'Care Plan'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Qty: {sub.quantity} seat{sub.quantity === 1 ? '' : 's'}
                        </div>
                      </td>

                      {/* Cycle */}
                      <td className="p-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-xl text-[11px] font-mono font-black ${cycleInfo.bg}`}>
                          {cycleInfo.label}
                        </span>
                      </td>

                      {/* Next Bill */}
                      <td className="p-3.5 text-slate-700 font-mono font-semibold">
                        {statusKey === 'CANCELLED' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-500 stroke-[2.5]" />
                            <span>{formatDate(sub.next_billing_date)}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[11px] font-mono font-black border-2 border-slate-900 shadow-pop-sm ${
                            statusKey === 'ACTIVE'
                              ? 'bg-pop-mint text-slate-900'
                              : statusKey === 'PAUSED'
                              ? 'bg-pop-yellow text-slate-900'
                              : 'bg-pop-pink text-slate-900'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full border border-slate-900 ${
                              statusKey === 'ACTIVE'
                                ? 'bg-emerald-600 animate-pulse'
                                : statusKey === 'PAUSED'
                                ? 'bg-amber-600'
                                : 'bg-rose-600'
                            }`}
                          />
                          <span>{statusKey === 'ACTIVE' ? 'Active' : statusKey === 'PAUSED' ? 'Paused' : 'Cancelled'}</span>
                        </span>
                      </td>

                      {/* Recurring Rate */}
                      <td className="p-3.5 text-right font-mono font-black text-slate-900 text-sm">
                        {formatINR(sub.unit_price * (sub.quantity || 1))}
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          /{sub.plan?.billing_cycle === 'YEARLY' ? 'yr' : sub.plan?.billing_cycle === 'QUARTERLY' ? 'qtr' : 'mo'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveDetailSub(sub)}
                            className="btn-candy bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs px-3 py-1 rounded-xl border-2 border-slate-900 shadow-pop-sm flex items-center gap-1"
                          >
                            <Eye size={12} className="stroke-[2.5]" />
                            <span>View Billing</span>
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

        {/* Pagination Footer */}
        {filteredSubscriptions.length > 0 && (
          <div className="border-t-2 border-slate-900 p-3 bg-paper">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredSubscriptions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         BILLING DETAIL MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {activeDetailSub && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-white border-2 border-slate-900 rounded-3xl shadow-pop-xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b-2 border-slate-900 bg-amber-50/70 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-heading font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Billing Detail:</span>
                  <span className="text-pop-violet">
                    {activeDetailSub.quotation?.customer?.name || activeDetailSub.quotation?.customer?.company_name || 'Customer'}
                  </span>
                  <span className="text-slate-400 font-normal">—</span>
                  <span className="text-slate-800 font-bold">{activeDetailSub.plan?.name}</span>
                </h2>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Opened by clicking a row on the Subscriptions list
                </p>
              </div>

              {/* Navigation & Close Buttons */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-paper border-2 border-slate-900 rounded-xl p-0.5 shadow-pop-sm">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex <= 0}
                    className="p-1.5 text-slate-700 hover:text-slate-900 disabled:opacity-30"
                    title="Previous Subscription"
                  >
                    <ChevronLeft size={16} className="stroke-[2.5]" />
                  </button>
                  <span className="text-[10px] font-mono font-bold px-1 text-slate-600">
                    {currentIndex + 1} / {filteredSubscriptions.length}
                  </span>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex >= filteredSubscriptions.length - 1}
                    className="p-1.5 text-slate-700 hover:text-slate-900 disabled:opacity-30"
                    title="Next Subscription"
                  >
                    <ChevronRight size={16} className="stroke-[2.5]" />
                  </button>
                </div>

                <button
                  onClick={() => setActiveDetailSub(null)}
                  className="p-1.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-900 shadow-pop-sm"
                >
                  <X size={16} className="stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-black border-2 border-slate-900 shadow-pop-sm ${
                    activeDetailSub.status === 'ACTIVE'
                      ? 'bg-pop-mint text-slate-900'
                      : activeDetailSub.status === 'PAUSED'
                      ? 'bg-pop-yellow text-slate-900'
                      : 'bg-pop-pink text-slate-900'
                  }`}
                >
                  Status: {activeDetailSub.status || 'ACTIVE'}
                </span>
                <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-sm">
                  Order: {activeDetailSub.quotation?.quotation_number || 'QT'}
                </span>
                <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-sm ml-auto">
                  Next Renewal: {formatDate(activeDetailSub.next_billing_date)}
                </span>
              </div>

              {/* ── SECTION 1: ONE-TIME LINES ── */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-heading font-black uppercase tracking-wider text-slate-600 font-mono">
                  One-Time Lines (from originating order)
                </h3>
                <div className="overflow-x-auto rounded-2xl border-2 border-slate-900 bg-paper shadow-inner">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-[10px] uppercase font-mono font-black text-slate-800">
                        <th className="p-3">Product</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100">
                      {detailLinesBreakdown.oneTime.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-slate-500 text-xs italic">
                            No one-time physical lines in this originating order.
                          </td>
                        </tr>
                      ) : (
                        detailLinesBreakdown.oneTime.map((l, idx) => (
                          <tr key={l.id || idx} className="hover:bg-amber-50/40">
                            <td className="p-3 font-bold text-slate-900">
                              {l.product?.name || l.productName || 'Product Item'}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {l.quantity}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-slate-900">
                              {formatINR(l.line_total || l.unit_price * l.quantity)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── SECTION 2: RECURRING LINES ── */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-heading font-black uppercase tracking-wider text-slate-600 font-mono">
                  Recurring Lines
                </h3>
                <div className="overflow-x-auto rounded-2xl border-2 border-slate-900 bg-paper shadow-inner">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-[10px] uppercase font-mono font-black text-slate-800">
                        <th className="p-3">Plan</th>
                        <th className="p-3 text-center">Cycle</th>
                        <th className="p-3 text-center">Next Bill Date</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100">
                      <tr className="hover:bg-amber-50/40">
                        <td className="p-3 font-bold text-slate-900">
                          <div>{activeDetailSub.plan?.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            Qty: {activeDetailSub.quantity} seat{activeDetailSub.quantity === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-mono text-pop-violet font-black">
                            {activeDetailSub.plan?.billing_cycle}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700">
                          {formatDate(activeDetailSub.next_billing_date)}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-800">
                          {formatINR(activeDetailSub.unit_price * (activeDetailSub.quantity || 1))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── SECTION 3: PRORATION & CANCELLATION POLICY DETAILS ── */}
              <div className="rounded-2xl border-2 border-slate-900 bg-paper p-4 space-y-3 shadow-inner">
                <div className="text-[11px] font-heading font-black uppercase tracking-wider text-slate-700 font-mono">
                  Governance & Proration Policy
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-pop-sm space-y-1">
                    <span className="text-slate-500 font-bold">Prorate on Plan Change:</span>
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600 stroke-[2.5]" />
                      <span>{activeDetailSub.plan?.prorate_on_change ? 'Enabled (Prorated charges applied)' : 'Disabled'}</span>
                    </p>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-pop-sm space-y-1">
                    <span className="text-slate-500 font-bold">Partial Refund Policy:</span>
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-sky-600 stroke-[2.5]" />
                      <span>{activeDetailSub.plan?.partial_refund ? 'Supported on early termination' : 'No refund'}</span>
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-700 bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-pop-sm">
                  <span className="font-black text-slate-900">Cancellation Terms: </span>
                  {activeDetailSub.plan?.cancel_policy || 'Standard 30 days notice required prior to renewal.'}
                </div>
              </div>

              {/* ── ACTION BUTTONS ── */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-slate-100">
                <div className="flex items-center gap-3">
                  {/* Modify Subscription Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanToEdit(activeDetailSub.plan);
                      setIsPlanModalOpen(true);
                    }}
                    className="btn-candy px-5 py-2.5 rounded-2xl bg-pop-violet hover:bg-pop-violet/90 text-white font-bold text-xs transition-all border-2 border-slate-900 shadow-pop flex items-center gap-1.5"
                  >
                    <Edit3 size={14} className="stroke-[2.5]" />
                    <span>Modify Subscription</span>
                  </button>

                  {/* Cancel Subscription Button */}
                  {activeDetailSub.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => setCancelModalSub(activeDetailSub)}
                      className="btn-candy px-4 py-2.5 rounded-2xl border-2 border-slate-900 bg-pop-pink/30 hover:bg-pop-pink/50 text-rose-950 font-bold text-xs transition-all shadow-pop-sm flex items-center gap-1.5"
                    >
                      <XCircle size={14} className="stroke-[2.5]" />
                      <span>Cancel Subscription</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveDetailSub(null)}
                  className="btn-candy px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold border-2 border-slate-900 shadow-pop-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    )}

      {/* Plan Create / Edit Modal */}
      {isPlanModalOpen && (
        <PlanModal
          plan={selectedPlanToEdit}
          onClose={() => {
            setIsPlanModalOpen(false);
            setSelectedPlanToEdit(null);
          }}
          onSave={loadData}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalSub && (
        <CancelModal
          sub={cancelModalSub}
          onClose={() => setCancelModalSub(null)}
          onConfirm={handleConfirmCancel}
          loading={cancelling}
        />
      )}
    </div>
  );
}
