import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Layers,
  Plus,
  Edit3,
  Check,
  X,
  Sparkles,
  Clock,
  ShieldCheck,
  RotateCcw,
  Zap,
  LayoutGrid,
  List,
  Search,
  Filter
} from 'lucide-react';
import { subscriptionsAPI } from '../../api';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';

const CYCLE_THEMES = {
  MONTHLY: {
    label: 'Monthly Plan',
    tag: 'Standard Cadence',
    cardBg: 'bg-gradient-to-b from-blue-50/80 via-indigo-50/30 to-white',
    badgeBg: 'bg-blue-600 text-white',
    accentText: 'text-blue-700',
    iconBg: 'bg-blue-100 text-blue-700',
    policyBg: 'bg-blue-50/90 text-blue-950 border-blue-200',
    borderTop: 'border-t-4 border-t-blue-500',
  },
  QUARTERLY: {
    label: 'Quarterly Plan',
    tag: 'Mid-Term Flex',
    cardBg: 'bg-gradient-to-b from-emerald-50/80 via-teal-50/30 to-white',
    badgeBg: 'bg-emerald-600 text-white',
    accentText: 'text-emerald-700',
    iconBg: 'bg-emerald-100 text-emerald-700',
    policyBg: 'bg-emerald-50/90 text-emerald-950 border-emerald-200',
    borderTop: 'border-t-4 border-t-emerald-500',
  },
  YEARLY: {
    label: 'Yearly Plan',
    tag: 'High Value Annual',
    cardBg: 'bg-gradient-to-b from-purple-50/80 via-pink-50/30 to-white',
    badgeBg: 'bg-pop-violet text-white',
    accentText: 'text-purple-700',
    iconBg: 'bg-purple-100 text-purple-700',
    policyBg: 'bg-purple-50/90 text-purple-950 border-purple-200',
    borderTop: 'border-t-4 border-t-purple-500',
  },
};

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Plan Modal state
  const [planModalData, setPlanModalData] = useState(null); // null = closed, {} = add, plan = edit
  const [savingPlan, setSavingPlan] = useState(false);

  // View Mode & Filters
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('ALL');

  // Pagination
  const [planPage, setPlanPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const cycle = (plan.billing_cycle || plan.billingCycle || 'MONTHLY').toUpperCase();
      if (selectedCycle !== 'ALL' && cycle !== selectedCycle) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = plan.name?.toLowerCase().includes(q);
        const matchPolicy = plan.cancel_policy?.toLowerCase().includes(q);
        if (!matchName && !matchPolicy) return false;
      }
      return true;
    });
  }, [plans, selectedCycle, searchQuery]);

  useEffect(() => {
    setPlanPage(1);
  }, [searchQuery, selectedCycle]);

  const pagedPlans = useMemo(() => {
    return filteredPlans.slice((planPage - 1) * pageSize, planPage * pageSize);
  }, [filteredPlans, planPage, pageSize]);

  // ── 1. Load Subscription Plans ───────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await subscriptionsAPI.getPlans();
      const list = Array.isArray(res) ? res : res?.plans || [];
      setPlans(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // ── 2. Save Plan Handler (Create or Update) ──────────────────────────────

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const { id, name, billingCycle, prorateOnChange, cancelPolicy, partialRefund } = planModalData;

    if (!name || !name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    try {
      setSavingPlan(true);
      if (id) {
        await subscriptionsAPI.updatePlan(id, {
          name: name.trim(),
          billingCycle,
          prorateOnChange: Boolean(prorateOnChange),
          cancelPolicy: cancelPolicy?.trim() || null,
          partialRefund: Boolean(partialRefund),
        });
        toast.success(`Plan "${name}" updated!`);
      } else {
        await subscriptionsAPI.createPlan({
          name: name.trim(),
          billingCycle,
          prorateOnChange: Boolean(prorateOnChange),
          cancelPolicy: cancelPolicy?.trim() || null,
          partialRefund: Boolean(partialRefund),
        });
        toast.success(`Plan "${name}" created!`);
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

  // ── 3. Quick Toggle Prorate on Change ────────────────────────────────────

  const handleQuickToggleProrate = async (plan) => {
    const newVal = !plan.prorate_on_change;
    try {
      await subscriptionsAPI.updatePlan(plan.id, {
        name: plan.name,
        billingCycle: plan.billing_cycle || plan.billingCycle,
        prorateOnChange: newVal,
        cancelPolicy: plan.cancel_policy,
        partialRefund: plan.partial_refund,
      });
      toast.success(`Proration ${newVal ? 'enabled' : 'disabled'} for ${plan.name}`);
      loadPlans();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update proration setting');
    }
  };

  // ── 4. Quick Toggle Partial Refund ───────────────────────────────────────

  const handleQuickToggleRefund = async (plan) => {
    const newVal = !plan.partial_refund;
    try {
      await subscriptionsAPI.updatePlan(plan.id, {
        name: plan.name,
        billingCycle: plan.billing_cycle || plan.billingCycle,
        prorateOnChange: plan.prorate_on_change,
        cancelPolicy: plan.cancel_policy,
        partialRefund: newVal,
      });
      toast.success(`Partial refund ${newVal ? 'enabled' : 'disabled'} for ${plan.name}`);
      loadPlans();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update refund setting');
    }
  };

  return (
    <div className="space-y-8 pb-12 antialiased">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-pop-violet border-2 border-slate-900 text-white flex items-center justify-center shadow-pop-sm">
            <Calendar size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight">
                Subscription Plans Configuration
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pop-yellow text-slate-900 border-2 border-slate-900 font-mono text-[10px] font-black uppercase shadow-pop-xs">
                <Sparkles size={10} strokeWidth={2.5} /> Live CPQ
              </span>
            </div>
            <p className="text-xs font-medium text-slate-600 mt-0.5">
              Define recurring billing cycles, proration formulas, and cancellation terms
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            setPlanModalData({
              name: '',
              billingCycle: 'MONTHLY',
              prorateOnChange: true,
              cancelPolicy: '30 days notice required prior to next billing date.',
              partialRefund: false,
            })
          }
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-pop-violet hover:bg-violet-700 text-white text-xs font-heading font-black border-2 border-slate-900 shadow-pop transition-all cursor-pointer hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add Subscription Plan
        </button>
      </div>

      {/* ── Filter & View Mode Toolbar ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-3xl border-2 border-slate-900 shadow-pop">
        {/* Cadence Filters */}
        <div className="flex items-center gap-1 bg-slate-100 border-2 border-slate-900 rounded-2xl p-1 text-xs overflow-x-auto">
          {['ALL', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map((cycle) => (
            <button
              key={cycle}
              onClick={() => setSelectedCycle(cycle)}
              className={`px-3 py-1.5 rounded-xl font-heading font-black transition-all cursor-pointer ${
                selectedCycle === cycle
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cycle === 'ALL' ? 'All Plans' : cycle.charAt(0) + cycle.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" strokeWidth={2.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plans by name or terms..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-heading font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 border-2 border-slate-900 rounded-xl p-0.5 shadow-pop-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-heading font-black transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 border border-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Compact Cards View"
            >
              <LayoutGrid size={13} strokeWidth={2.5} />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-heading font-black transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 border border-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="High-Density Table View"
            >
              <List size={13} strokeWidth={2.5} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Plans Display: Grid vs Table ─────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-3xl bg-white border-2 border-slate-900 animate-pulse shadow-pop" />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border-2 border-slate-900 bg-white shadow-pop">
          <Layers size={36} className="mx-auto text-slate-400 mb-2" strokeWidth={2} />
          <p className="text-sm font-heading font-bold text-slate-700">No matching subscription plans found</p>
          {(searchQuery || selectedCycle !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCycle('ALL');
              }}
              className="mt-2 text-xs font-bold text-pop-violet underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── COMPACT PLAN CARDS VIEW (Space Efficient) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedPlans.map((plan) => {
            const cycleKey = (plan.billing_cycle || plan.billingCycle || 'MONTHLY').toUpperCase();
            const theme = CYCLE_THEMES[cycleKey] || CYCLE_THEMES.MONTHLY;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 border-slate-900 ${theme.cardBg} p-4 flex flex-col justify-between gap-3 shadow-pop hover:shadow-pop-md transition-all hover:-translate-y-0.5 group relative overflow-hidden`}
              >
                {/* Decorative Top Accent Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${cycleKey === 'MONTHLY' ? 'bg-blue-500' : cycleKey === 'QUARTERLY' ? 'bg-emerald-500' : 'bg-pop-violet'}`} />

                <div className="space-y-2.5 pt-0.5">
                  {/* Top row: Badges & Edit Button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black border-2 border-slate-900 shadow-pop-xs shrink-0 ${theme.badgeBg}`}
                      >
                        {theme.label}
                      </span>
                      <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-white/90 text-[9px] font-heading font-bold text-slate-700 border border-slate-300 truncate">
                        {theme.tag}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setPlanModalData({
                          id: plan.id,
                          name: plan.name,
                          billingCycle: cycleKey,
                          prorateOnChange: plan.prorate_on_change ?? true,
                          cancelPolicy: plan.cancel_policy || '',
                          partialRefund: plan.partial_refund ?? false,
                        })
                      }
                      className="p-1.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 shadow-pop-xs transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0.5 shrink-0"
                      title="Edit Plan"
                    >
                      <Edit3 size={13} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-base font-heading font-black text-slate-900 group-hover:text-violet-700 transition-colors truncate">
                    {plan.name}
                  </h3>

                  {/* Feature Toggles (Compact Inline Pills) */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {/* Prorate on Change */}
                    <button
                      onClick={() => handleQuickToggleProrate(plan)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-black border-2 border-slate-900 shadow-pop-xs flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 ${
                        plan.prorate_on_change
                          ? 'bg-pop-mint text-slate-900'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                      title="Click to toggle mid-cycle proration"
                    >
                      <Zap size={12} strokeWidth={2.5} className={plan.prorate_on_change ? 'text-slate-900 fill-slate-900' : 'text-slate-400'} />
                      <span>Prorate: {plan.prorate_on_change ? 'On' : 'Off'}</span>
                    </button>

                    {/* Partial Refund */}
                    <button
                      onClick={() => handleQuickToggleRefund(plan)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-black border-2 border-slate-900 shadow-pop-xs flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 ${
                        plan.partial_refund
                          ? 'bg-pop-mint text-slate-900'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                      title="Click to toggle cancellation refund"
                    >
                      <RotateCcw size={12} strokeWidth={2.5} className={plan.partial_refund ? 'text-slate-900' : 'text-rose-600'} />
                      <span>Refund: {plan.partial_refund ? 'On' : 'Off'}</span>
                    </button>
                  </div>

                  {/* Cancellation Policy (Compact Single Line) */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-[11px] font-medium truncate mt-1"
                    title={plan.cancel_policy || 'Immediate cancel, no penalty.'}
                  >
                    <Clock size={12} className="text-amber-700 shrink-0" strokeWidth={2.5} />
                    <span className="font-mono text-[9px] font-black uppercase tracking-wider shrink-0 text-amber-800">Policy:</span>
                    <span className="truncate">{plan.cancel_policy || 'Immediate cancel, no penalty.'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── HIGH-DENSITY TABLE VIEW (Handles 100+ Plans) ── */
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-mono font-black text-slate-800 tracking-wider">
                  <th className="py-3 px-4">Plan Name</th>
                  <th className="py-3 px-4">Billing Cadence</th>
                  <th className="py-3 px-4 text-center hidden md:table-cell">Proration Formula</th>
                  <th className="py-3 px-4 text-center hidden md:table-cell">Partial Refund</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Cancellation Policy</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {pagedPlans.map((plan) => {
                  const cycleKey = (plan.billing_cycle || plan.billingCycle || 'MONTHLY').toUpperCase();
                  const theme = CYCLE_THEMES[cycleKey] || CYCLE_THEMES.MONTHLY;

                  return (
                    <tr key={plan.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-heading font-black text-slate-900 text-sm">{plan.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black border border-slate-900 ${theme.badgeBg}`}>
                          {theme.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center hidden md:table-cell">
                        <button
                          onClick={() => handleQuickToggleProrate(plan)}
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black border border-slate-900 shadow-pop-xs transition-transform active:translate-y-0.5 cursor-pointer ${
                            plan.prorate_on_change
                              ? 'bg-pop-mint text-slate-900'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {plan.prorate_on_change ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center hidden md:table-cell">
                        <button
                          onClick={() => handleQuickToggleRefund(plan)}
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black border border-slate-900 shadow-pop-xs transition-transform active:translate-y-0.5 cursor-pointer ${
                            plan.partial_refund
                              ? 'bg-pop-mint text-slate-900'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {plan.partial_refund ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span
                          className="font-medium text-slate-600 line-clamp-1 max-w-xs text-[11px]"
                          title={plan.cancel_policy || 'Immediate cancel, no penalty.'}
                        >
                          {plan.cancel_policy || 'Immediate cancel, no penalty.'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            setPlanModalData({
                              id: plan.id,
                              name: plan.name,
                              billingCycle: cycleKey,
                              prorateOnChange: plan.prorate_on_change ?? true,
                              cancelPolicy: plan.cancel_policy || '',
                              partialRefund: plan.partial_refund ?? false,
                            })
                          }
                          className="p-1.5 rounded-lg bg-white hover:bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all cursor-pointer inline-flex items-center gap-1 font-heading font-bold text-[11px]"
                          title="Edit Plan"
                        >
                          <Edit3 size={12} strokeWidth={2.5} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription Plans Pagination */}
      {filteredPlans.length > 0 && (
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-3 shadow-pop">
          <Pagination
            currentPage={planPage}
            totalItems={filteredPlans.length}
            pageSize={pageSize}
            onPageChange={setPlanPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPlanPage(1);
            }}
            pageSizeOptions={[5, 6, 12, 24, 48, 100, 200]}
          />
        </div>
      )}

      {/* ── Modal: Add / Edit Subscription Plan ──────────────────────────── */}
      {planModalData && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
              <div className="flex items-center gap-2.5">
                <Calendar size={18} className="text-indigo-700" strokeWidth={2.5} />
                <h3 className="text-base font-heading font-black text-slate-900">
                  {planModalData.id ? 'Edit Plan' : 'Add Subscription Plan'}
                </h3>
              </div>
              <button
                onClick={() => setPlanModalData(null)}
                className="text-slate-500 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-heading font-bold text-slate-800 mb-1.5">
                  Plan Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={planModalData.name || ''}
                  onChange={(e) =>
                    setPlanModalData({ ...planModalData, name: e.target.value })
                  }
                  placeholder="e.g. Enterprise Monthly SLA"
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-800 mb-1.5">
                  Billing Cycle <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['MONTHLY', 'QUARTERLY', 'YEARLY'].map((cycle) => (
                    <button
                      type="button"
                      key={cycle}
                      onClick={() =>
                        setPlanModalData({ ...planModalData, billingCycle: cycle })
                      }
                      className={`py-2 px-3 rounded-2xl border-2 border-slate-900 text-xs font-heading font-bold transition-all shadow-pop-xs ${
                        planModalData.billingCycle === cycle
                          ? 'bg-indigo-600 text-white shadow-pop-sm'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-2xl border-2 border-slate-900 bg-[#FFFDF5] p-3.5 flex items-center justify-between shadow-pop-xs">
                  <div>
                    <p className="text-xs font-heading font-bold text-slate-900">Prorate on Change</p>
                    <p className="text-[11px] text-slate-500 font-medium">Prorate upgrade charges</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(planModalData.prorateOnChange)}
                    onChange={(e) =>
                      setPlanModalData({
                        ...planModalData,
                        prorateOnChange: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 border-2 border-slate-900 cursor-pointer"
                  />
                </div>

                <div className="rounded-2xl border-2 border-slate-900 bg-[#FFFDF5] p-3.5 flex items-center justify-between shadow-pop-xs">
                  <div>
                    <p className="text-xs font-heading font-bold text-slate-900">Partial Refund</p>
                    <p className="text-[11px] text-slate-500 font-medium">Refund on early cancel</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(planModalData.partialRefund)}
                    onChange={(e) =>
                      setPlanModalData({
                        ...planModalData,
                        partialRefund: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 border-2 border-slate-900 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-800 mb-1.5">
                  Cancellation Policy Terms
                </label>
                <textarea
                  rows={3}
                  value={planModalData.cancelPolicy || ''}
                  onChange={(e) =>
                    setPlanModalData({
                      ...planModalData,
                      cancelPolicy: e.target.value,
                    })
                  }
                  placeholder="e.g. 30 days notice required prior to next billing date."
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setPlanModalData(null)}
                  className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-heading font-black text-white border-2 border-slate-900 shadow-pop-xs transition-all active:translate-x-0.5 active:translate-y-0.5"
                >
                  {savingPlan ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
    )}
  </div>
);
}
