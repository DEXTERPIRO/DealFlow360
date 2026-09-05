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
  Check,
  X
} from 'lucide-react';
import { subscriptionsAPI, productsAPI, quotationsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

// ─── Formatters & Date Utilities ──────────────────────────────────────────

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

const getDaysUntil = (targetDate) => {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(targetDate);
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const CYCLE_BADGES = {
  MONTHLY: {
    label: 'MONTHLY',
    bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
  QUARTERLY: {
    label: 'QUARTERLY',
    bg: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  },
  YEARLY: {
    label: 'YEARLY',
    bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
};

// ─── Sub-Component: Cancel Confirmation Modal ──────────────────────────────

function CancelModal({ sub, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cancel Subscription</h3>
            <p className="text-xs text-slate-400">This action will stop all future recurring billings</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Customer:</span>
            <span className="font-semibold">{sub.quotation?.customer?.name || 'Customer'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Product:</span>
            <span className="font-semibold">{sub.productName || 'Subscription Item'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Recurring Amount:</span>
            <span className="font-mono font-bold text-emerald-400">
              {formatINR(Number(sub.unit_price || sub.unitPrice || 0) * (sub.quantity || 1))}
            </span>
          </div>
        </div>

        <p className="text-xs text-rose-300/80 mt-4 leading-relaxed">
          Are you sure you want to cancel this subscription? The customer will no longer be invoiced for subsequent renewal periods.
        </p>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
          >
            Keep Active
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm(sub.id)}
            className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition-all"
          >
            {loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Component: Plan Modal (Add / Edit) ────────────────────────────────

function PlanModal({ initialPlan, onClose, onSave, loading }) {
  const isEdit = Boolean(initialPlan?.id);
  const [name, setName] = useState(initialPlan?.name || '');
  const [billingCycle, setBillingCycle] = useState(initialPlan?.billing_cycle || initialPlan?.billingCycle || 'MONTHLY');
  const [prorateOnChange, setProrateOnChange] = useState(
    initialPlan?.prorate_on_change !== undefined ? initialPlan.prorate_on_change : true
  );
  const [cancelPolicy, setCancelPolicy] = useState(initialPlan?.cancel_policy || '');
  const [partialRefund, setPartialRefund] = useState(
    initialPlan?.partial_refund !== undefined ? initialPlan.partial_refund : false
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a plan name');
      return;
    }
    onSave({
      id: initialPlan?.id,
      name: name.trim(),
      billingCycle,
      prorateOnChange,
      cancelPolicy: cancelPolicy.trim() || null,
      partialRefund,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEdit ? 'Edit Subscription Plan' : 'Add Subscription Plan'}
              </h3>
              <p className="text-xs text-slate-400">Configure recurring billing tiers and policy rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Plan Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Enterprise Annual SLA"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Billing Cycle <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['MONTHLY', 'QUARTERLY', 'YEARLY'].map((cycle) => (
                <button
                  type="button"
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                    billingCycle === cycle
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300 shadow-md shadow-indigo-500/10'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Prorate on Change</p>
                <p className="text-[11px] text-slate-400">Prorate charges if plan upgrades</p>
              </div>
              <input
                type="checkbox"
                checked={prorateOnChange}
                onChange={(e) => setProrateOnChange(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Partial Refund</p>
                <p className="text-[11px] text-slate-400">Allow refunds on early exit</p>
              </div>
              <input
                type="checkbox"
                checked={partialRefund}
                onChange={(e) => setPartialRefund(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Cancellation Policy <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={cancelPolicy}
              onChange={(e) => setCancelPolicy(e.target.value)}
              placeholder="e.g. 30 days notice required prior to auto-renewal. No penalty if canceled within trial."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all"
            >
              {loading ? 'Saving...' : isEdit ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Subscriptions Component ──────────────────────────────────────────

export default function Subscriptions() {
  const { user } = useAuthStore();
  const canManagePlans = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // Active Tab: 'active' | 'schedule' | 'plans'
  const [activeTab, setActiveTab] = useState('active');

  // Subscriptions data
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'CANCELLED'

  // Plans data
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Products map for enriching product names if needed
  const [productsMap, setProductsMap] = useState({});

  // Modals state
  const [cancelModalSub, setCancelModalSub] = useState(null);
  const [cancellingSub, setCancellingSub] = useState(false);
  const [planModalData, setPlanModalData] = useState(null); // null = closed, {} = add, plan = edit
  const [savingPlan, setSavingPlan] = useState(false);

  // ── Load Subscriptions ───────────────────────────────────────────────────

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoadingSubs(true);
      const res = await subscriptionsAPI.getAll();
      const list = Array.isArray(res) ? res : res?.subscriptions || [];
      setSubscriptions(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  // ── Load Plans ───────────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      const res = await subscriptionsAPI.getPlans();
      const list = Array.isArray(res) ? res : res?.plans || [];
      setPlans(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  // ── Load Products Catalog for Lookup ─────────────────────────────────────

  const loadProducts = useCallback(async () => {
    try {
      const res = await productsAPI.getAll();
      const list = Array.isArray(res) ? res : res?.products || [];
      const map = {};
      list.forEach((p) => {
        map[p.id] = p.name;
      });
      setProductsMap(map);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadPlans();
    loadProducts();
  }, [loadSubscriptions, loadPlans, loadProducts]);

  // ── Enriched Subscriptions ───────────────────────────────────────────────

  const enrichedSubs = useMemo(() => {
    return subscriptions.map((sub) => {
      // Find matching quotation line if possible
      const lines = sub.quotation?.lines || [];
      const matchingLine = lines.find(
        (l) => (l.product_id || l.productId) === sub.product_id
      );
      const productName =
        matchingLine?.product?.name ||
        productsMap[sub.product_id] ||
        'Recurring Service / SaaS License';

      const cycle = sub.plan?.billing_cycle || 'MONTHLY';
      const qty = sub.quantity || 1;
      const unitPrice = Number(sub.unit_price || sub.unitPrice || 0);
      const totalPerPeriod = unitPrice * qty;
      const daysUntil = getDaysUntil(sub.next_billing_date || sub.nextBillingDate);

      return {
        ...sub,
        productName,
        billingCycle: cycle,
        totalPerPeriod,
        daysUntil,
      };
    });
  }, [subscriptions, productsMap]);

  // Filtered subscriptions for Tab 1
  const filteredSubs = useMemo(() => {
    return enrichedSubs.filter((s) => {
      const matchesStatus =
        filterStatus === 'ALL' ? true : s.status === filterStatus;
      const q = searchQuery.toLowerCase();
      const custName = (s.quotation?.customer?.name || '').toLowerCase();
      const compName = (s.quotation?.customer?.company_name || '').toLowerCase();
      const prod = (s.productName || '').toLowerCase();
      const matchesSearch =
        !q || custName.includes(q) || compName.includes(q) || prod.includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [enrichedSubs, filterStatus, searchQuery]);

  // ── Stats Computations ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const activeSubs = enrichedSubs.filter((s) => s.status === 'ACTIVE');
    const totalMRR = activeSubs.reduce((sum, s) => {
      let multiplier = 1;
      if (s.billingCycle === 'QUARTERLY') multiplier = 1 / 3;
      if (s.billingCycle === 'YEARLY') multiplier = 1 / 12;
      return sum + s.totalPerPeriod * multiplier;
    }, 0);

    const upcomingCount = activeSubs.filter(
      (s) => s.daysUntil !== null && s.daysUntil <= 30 && s.daysUntil >= 0
    ).length;

    return {
      activeCount: activeSubs.length,
      totalMRR,
      upcomingCount,
      totalCount: enrichedSubs.length,
    };
  }, [enrichedSubs]);

  // ── Billing Schedule Timeline Grouped by Month ───────────────────────────

  const scheduleGroups = useMemo(() => {
    // Collect active subscription next billing dates
    const active = enrichedSubs.filter((s) => s.status === 'ACTIVE' && s.next_billing_date);
    const sorted = [...active].sort(
      (a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date)
    );

    const groups = {};
    sorted.forEach((item) => {
      const d = new Date(item.next_billing_date);
      const monthKey = d.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      if (!groups[monthKey]) {
        groups[monthKey] = {
          month: monthKey,
          items: [],
          totalAmount: 0,
        };
      }
      groups[monthKey].items.push(item);
      groups[monthKey].totalAmount += item.totalPerPeriod;
    });

    return Object.values(groups);
  }, [enrichedSubs]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCancelConfirm = async (subId) => {
    try {
      setCancellingSub(true);
      await subscriptionsAPI.cancel(subId);
      toast.success('Subscription cancelled successfully');
      setCancelModalSub(null);
      loadSubscriptions();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setCancellingSub(false);
    }
  };

  const handleSavePlan = async (planData) => {
    try {
      setSavingPlan(true);
      if (planData.id) {
        await subscriptionsAPI.updatePlan(planData.id, planData);
        toast.success(`Plan "${planData.name}" updated`);
      } else {
        await subscriptionsAPI.createPlan(planData);
        toast.success(`Plan "${planData.name}" created`);
      }
      setPlanModalData(null);
      loadPlans();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <RefreshCw size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Subscription Hub
              </h1>
              <p className="text-xs text-slate-400">
                Recurring revenue, automated renewal schedules, and contract plans
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-lg">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard size={14} />
            Active Subscriptions
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono">
              {stats.activeCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'schedule'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar size={14} />
            Billing Schedule
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'plans'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={14} />
            Subscription Plans
          </button>
        </div>
      </div>

      {/* ── Key Metrics Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4.5 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Active Subscriptions
            </p>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {stats.activeCount}
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                of {stats.totalCount} total
              </span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4.5 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Est. Monthly Recurring Revenue (MRR)
            </p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {formatINR(stats.totalMRR)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4.5 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Renewals (Next 30 Days)
            </p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-1">
              {stats.upcomingCount}
              <span className="text-xs font-normal text-slate-500 ml-1.5">events</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 1: ACTIVE SUBSCRIPTIONS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
            <div className="relative w-full sm:w-72">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer, company, product..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {['ALL', 'ACTIVE', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterStatus === st
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Subscriptions Grid */}
          {loadingSubs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-60 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : filteredSubs.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40">
              <Package size={38} className="mx-auto text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No subscriptions found</p>
              <p className="text-xs text-slate-600 mt-1">
                Recurring line items from confirmed quotations automatically generate active subscriptions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubs.map((sub) => {
                const isCancelled = sub.status === 'CANCELLED';
                const cycleMeta =
                  CYCLE_BADGES[sub.billingCycle] || CYCLE_BADGES.MONTHLY;

                return (
                  <div
                    key={sub.id}
                    className={`group relative rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between ${
                      isCancelled
                        ? 'border-slate-800/60 bg-slate-950/40 opacity-75'
                        : 'border-slate-800/90 bg-slate-900/70 hover:border-slate-700 hover:shadow-2xl hover:shadow-indigo-950/10'
                    }`}
                  >
                    <div>
                      {/* Top row: Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cycleMeta.bg}`}
                        >
                          [{cycleMeta.label}]
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            isCancelled
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          [{sub.status}]
                        </span>
                      </div>

                      {/* Customer info */}
                      <div className="mb-3">
                        <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                          {sub.quotation?.customer?.name || 'Direct Customer'}
                        </h3>
                        {sub.quotation?.customer?.company_name && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                            <Building size={12} className="text-slate-500 flex-shrink-0" />
                            {sub.quotation.customer.company_name}
                          </p>
                        )}
                      </div>

                      {/* Product */}
                      <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 mb-3.5">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                          Subscribed Item
                        </p>
                        <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">
                          {sub.productName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Quantity Subscribed:{' '}
                          <span className="font-mono font-bold text-white">{sub.quantity}</span> units
                        </p>
                      </div>

                      {/* Pricing calculation */}
                      <div className="flex items-baseline justify-between pt-1 pb-3 border-b border-slate-800/70 text-xs">
                        <span className="text-slate-400">
                          {formatINR(sub.unit_price || sub.unitPrice || 0)} × {sub.quantity} =
                        </span>
                        <span className="font-mono font-black text-emerald-400 text-base">
                          {formatINR(sub.totalPerPeriod)}
                          <span className="text-[11px] font-normal text-slate-400">
                            /{sub.billingCycle.toLowerCase()}
                          </span>
                        </span>
                      </div>

                      {/* Dates & Countdown */}
                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Start Date:</span>
                          <span className="text-slate-300">{formatDate(sub.start_date || sub.startDate)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Next Billing:</span>
                          <span className="text-slate-200 font-medium">
                            {formatDate(sub.next_billing_date || sub.nextBillingDate)}
                          </span>
                        </div>
                      </div>

                      {/* Countdown badge */}
                      {!isCancelled && sub.daysUntil !== null && (
                        <div className="mt-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              sub.daysUntil <= 5
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            <Clock size={12} />
                            {sub.daysUntil === 0
                              ? 'Billing today'
                              : sub.daysUntil > 0
                              ? `${sub.daysUntil} days to next billing`
                              : `Overdue by ${Math.abs(sub.daysUntil)} days`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-500">
                        {sub.quotation?.quotation_number || `SUB-${sub.id.slice(0, 8)}`}
                      </span>

                      {!isCancelled && (
                        <button
                          onClick={() => setCancelModalSub(sub)}
                          className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 2: BILLING SCHEDULE (Timeline View)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Projected Billing Timeline</h3>
                <p className="text-xs text-slate-400">
                  Recurring charges grouped by calendar month with rolling revenue summaries
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {scheduleGroups.reduce((sum, g) => sum + g.items.length, 0)} upcoming events
            </span>
          </div>

          {scheduleGroups.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40">
              <Calendar size={38} className="mx-auto text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No scheduled billings</p>
              <p className="text-xs text-slate-600 mt-1">
                Active recurring subscriptions will project upcoming renewals here.
              </p>
            </div>
          ) : (
            scheduleGroups.map((group, gIdx) => (
              <div
                key={gIdx}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl"
              >
                {/* Month Banner */}
                <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <h4 className="text-base font-bold text-white tracking-wide">
                      {group.month}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                      {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Running Total for Month:</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">
                      {formatINR(group.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Event Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-950/30 text-slate-400">
                        <th className="py-3 px-5 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Customer</th>
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold text-right">Amount</th>
                        <th className="py-3 px-5 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {group.items.map((item, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-5 font-mono text-slate-300">
                            {formatDate(item.next_billing_date || item.nextBillingDate)}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-white">
                              {item.quotation?.customer?.name || 'Customer'}
                            </p>
                            {item.quotation?.customer?.company_name && (
                              <p className="text-[11px] text-slate-400">
                                {item.quotation.customer.company_name}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-200">
                            {item.productName}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatINR(item.totalPerPeriod)}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                              <CheckCircle2 size={11} /> SCHEDULED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 3: SUBSCRIPTION PLANS (Config)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {/* Header & Add Button */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Layers size={18} className="text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Subscription Plans Configuration</h3>
                <p className="text-xs text-slate-400">
                  Standardized billing frequencies, proration terms, and cancellation policies
                </p>
              </div>
            </div>

            {canManagePlans && (
              <button
                onClick={() => setPlanModalData({})}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus size={15} />
                Add Plan
              </button>
            )}
          </div>

          {/* Plan Cards Grid */}
          {loadingPlans ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40">
              <Layers size={38} className="mx-auto text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No subscription plans found</p>
              <p className="text-xs text-slate-600 mt-1">
                Create recurring plans to attach SaaS or SLA terms to quotations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const cycle = plan.billing_cycle || plan.billingCycle || 'MONTHLY';
                const cycleMeta = CYCLE_BADGES[cycle] || CYCLE_BADGES.MONTHLY;

                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cycleMeta.bg}`}
                        >
                          [{cycleMeta.label}]
                        </span>
                        {canManagePlans && (
                          <button
                            onClick={() => setPlanModalData(plan)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-white mb-2">{plan.name}</h4>

                      <div className="space-y-2 mt-4 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-800/60">
                          <span className="text-slate-400">Prorate on Change:</span>
                          <span
                            className={`font-semibold ${
                              plan.prorate_on_change || plan.prorateOnChange
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {plan.prorate_on_change || plan.prorateOnChange
                              ? '✓ Enabled'
                              : '✗ Disabled'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-800/60">
                          <span className="text-slate-400">Partial Refund:</span>
                          <span
                            className={`font-semibold ${
                              plan.partial_refund || plan.partialRefund
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {plan.partial_refund || plan.partialRefund
                              ? '✓ Allowed'
                              : '✗ Prohibited'}
                          </span>
                        </div>
                      </div>

                      {/* Cancel policy */}
                      <div className="mt-4 pt-3 border-t border-slate-800/70">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                          Cancellation Policy
                        </p>
                        <p className="text-xs text-slate-300 italic leading-relaxed">
                          {plan.cancel_policy ||
                            plan.cancelPolicy ||
                            'Standard 30-day cancellation notice required.'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {cancelModalSub && (
        <CancelModal
          sub={cancelModalSub}
          onClose={() => setCancelModalSub(null)}
          onConfirm={handleCancelConfirm}
          loading={cancellingSub}
        />
      )}

      {planModalData !== null && (
        <PlanModal
          initialPlan={planModalData}
          onClose={() => setPlanModalData(null)}
          onSave={handleSavePlan}
          loading={savingPlan}
        />
      )}
    </div>
  );
}
