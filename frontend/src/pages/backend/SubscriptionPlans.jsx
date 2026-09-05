import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Layers,
  Plus,
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  X,
  Save,
  Check,
  ShieldAlert,
  Info
} from 'lucide-react';
import { subscriptionsAPI } from '../../api';
import toast from 'react-hot-toast';

const CYCLE_BADGES = {
  MONTHLY: {
    label: 'Monthly',
    bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
  QUARTERLY: {
    label: 'Quarterly',
    bg: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  },
  YEARLY: {
    label: 'Yearly',
    bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
};

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Plan Modal state
  const [planModalData, setPlanModalData] = useState(null); // null = closed, {} = add, plan = edit
  const [savingPlan, setSavingPlan] = useState(false);

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
      toast.error(err.response?.data?.detail || 'Failed to save subscription plan');
    } finally {
      setSavingPlan(false);
    }
  };

  // ── 3. Toggle Quick Flags ────────────────────────────────────────────────

  const handleQuickToggleProrate = async (plan) => {
    try {
      const updatedProrate = !plan.prorate_on_change;
      await subscriptionsAPI.updatePlan(plan.id, {
        name: plan.name,
        billingCycle: plan.billing_cycle,
        prorateOnChange: updatedProrate,
        cancelPolicy: plan.cancel_policy,
        partialRefund: plan.partial_refund,
      });
      toast.success(`Proration ${updatedProrate ? 'enabled' : 'disabled'} for ${plan.name}`);
      loadPlans();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update proration setting');
    }
  };

  const handleQuickToggleRefund = async (plan) => {
    try {
      const updatedRefund = !plan.partial_refund;
      await subscriptionsAPI.updatePlan(plan.id, {
        name: plan.name,
        billingCycle: plan.billing_cycle,
        prorateOnChange: plan.prorate_on_change,
        cancelPolicy: plan.cancel_policy,
        partialRefund: updatedRefund,
      });
      toast.success(`Partial refund ${updatedRefund ? 'allowed' : 'prohibited'} for ${plan.name}`);
      loadPlans();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update refund setting');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Calendar size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Subscription Plans Configuration
              </h1>
              <p className="text-xs text-slate-400">
                Define recurring billing cycles, proration formulas, and cancellation terms
              </p>
            </div>
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
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          Add Subscription Plan
        </button>
      </div>

      {/* ── Plan Cards Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-3xl bg-slate-900 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-slate-800/80 bg-slate-900/40">
          <Layers size={36} className="mx-auto text-slate-700 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No subscription plans found</p>
          <p className="text-xs text-slate-600 mt-1">
            Create standard monthly, quarterly, or yearly plans to link with recurring quotation lines.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const cycleKey = (plan.billing_cycle || plan.billingCycle || 'MONTHLY').toUpperCase();
            const cycleMeta = CYCLE_BADGES[cycleKey] || CYCLE_BADGES.MONTHLY;

            return (
              <div
                key={plan.id}
                className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-all group"
              >
                <div className="space-y-4">
                  {/* Top row: Badge & Edit Button */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${cycleMeta.bg}`}
                    >
                      {cycleMeta.label} Plan
                    </span>
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
                      className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {plan.name}
                    </h3>
                  </div>

                  {/* Toggles Display / Interactive Cards */}
                  <div className="space-y-2.5 pt-2">
                    <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800/60 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">Prorate on Change</p>
                        <p className="text-[11px] text-slate-400">Prorate costs on mid-cycle upgrades</p>
                      </div>
                      <button
                        onClick={() => handleQuickToggleProrate(plan)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                          plan.prorate_on_change
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}
                      >
                        {plan.prorate_on_change ? '✓ Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800/60 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">Partial Refund</p>
                        <p className="text-[11px] text-slate-400">Allow refunds on cancellation</p>
                      </div>
                      <button
                        onClick={() => handleQuickToggleRefund(plan)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                          plan.partial_refund
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}
                      >
                        {plan.partial_refund ? '✓ Allowed' : 'Prohibited'}
                      </button>
                    </div>
                  </div>

                  {/* Cancel Policy */}
                  <div className="pt-3 border-t border-slate-800/70">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                      Cancellation Policy
                    </p>
                    <p className="text-xs text-slate-300 italic leading-relaxed">
                      {plan.cancel_policy || 'Standard 30-day cancellation notice required.'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Add / Edit Subscription Plan ──────────────────────────── */}
      {planModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  {planModalData.id ? 'Edit Plan' : 'Add Subscription Plan'}
                </h3>
              </div>
              <button
                onClick={() => setPlanModalData(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Plan Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={planModalData.name || ''}
                  onChange={(e) =>
                    setPlanModalData({ ...planModalData, name: e.target.value })
                  }
                  placeholder="e.g. Enterprise Monthly SLA"
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
                      onClick={() =>
                        setPlanModalData({ ...planModalData, billingCycle: cycle })
                      }
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        planModalData.billingCycle === cycle
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300 shadow-md'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
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
                    <p className="text-[11px] text-slate-400">Prorate upgrade charges</p>
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
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
                  />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Partial Refund</p>
                    <p className="text-[11px] text-slate-400">Refund on early cancel</p>
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
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPlanModalData(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-indigo-600/20"
                >
                  {savingPlan ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
