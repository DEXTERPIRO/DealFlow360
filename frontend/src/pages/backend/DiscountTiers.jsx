import React, { useState, useEffect } from 'react';
import {
  Percent,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Edit3,
  Save,
  HelpCircle,
  Layers,
  Sparkles,
  Info,
  Check,
  X
} from 'lucide-react';
import { productsAPI } from '../../api';
import toast from 'react-hot-toast';

export default function DiscountTiers() {
  const [tiers, setTiers] = useState({
    BRONZE: { maxDiscount: 5.0, requiresManager: false, requiresFinance: false },
    SILVER: { maxDiscount: 10.0, requiresManager: true, requiresFinance: false },
    GOLD: { maxDiscount: 15.0, requiresManager: true, requiresFinance: true },
  });
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [savingTier, setSavingTier] = useState(null);

  // Categories list & edit modal
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catMaxDiscount, setCatMaxDiscount] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // ── 1. Fetch Tiers & Categories ──────────────────────────────────────────

  const loadData = async () => {
    try {
      setLoadingTiers(true);
      const resTiers = await productsAPI.getDiscountTiers();
      if (Array.isArray(resTiers)) {
        const tierMap = { ...tiers };
        resTiers.forEach((t) => {
          const key = (t.tier || '').toUpperCase();
          if (tierMap[key]) {
            tierMap[key] = {
              maxDiscount: t.max_discount ?? t.maxDiscount ?? tierMap[key].maxDiscount,
              requiresManager: t.requires_manager ?? t.requiresManager ?? tierMap[key].requiresManager,
              requiresFinance: t.requires_finance ?? t.requiresFinance ?? tierMap[key].requiresFinance,
            };
          }
        });
        setTiers(tierMap);
      }
    } catch (err) {
      console.error('Error fetching discount tiers:', err);
    } finally {
      setLoadingTiers(false);
    }

    try {
      setLoadingCategories(true);
      const resCats = await productsAPI.getCategories();
      if (Array.isArray(resCats)) {
        setCategories(resCats);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── 2. Save Tier Handler ─────────────────────────────────────────────────

  const handleSaveTier = async (tierKey) => {
    try {
      setSavingTier(tierKey);
      await productsAPI.updateDiscountTier(tierKey, {
        maxDiscount: parseFloat(tiers[tierKey].maxDiscount),
        requiresManager: tiers[tierKey].requiresManager,
        requiresFinance: tiers[tierKey].requiresFinance,
      });
      toast.success(`${tierKey} Tier configuration saved!`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || `Failed to save ${tierKey} tier`);
    } finally {
      setSavingTier(null);
    }
  };

  // ── 3. Category Edit Handler ─────────────────────────────────────────────

  const handleOpenCatModal = (cat) => {
    setEditingCategory(cat);
    setCatMaxDiscount(cat.maxDiscount ?? cat.max_discount ?? 15);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      setSavingCategory(true);
      await productsAPI.updateCategory(editingCategory.id, {
        maxDiscount: parseFloat(catMaxDiscount),
      });
      toast.success(`Category "${editingCategory.name}" limit updated!`);
      setEditingCategory(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update category');
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Percent size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Discount Tiers & Approval Chains
            </h1>
            <p className="text-xs text-slate-400">
              Configure maximum allowable discounts per customer tier and automated multi-level approval triggers
            </p>
          </div>
        </div>
      </div>

      {/* ── 1. TIER CARDS (3 Cards) ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* BRONZE CARD */}
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-slate-900/60 to-slate-900 p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xl font-extrabold text-amber-400 flex items-center gap-2">
                <span>🥉</span> Bronze Tier
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                Standard
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Max Discount Allowed (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={tiers.BRONZE.maxDiscount}
                  onChange={(e) =>
                    setTiers({
                      ...tiers,
                      BRONZE: { ...tiers.BRONZE, maxDiscount: e.target.value },
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                  %
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2 border-t border-slate-800/80 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Requires Manager Approval:</span>
                <span className="flex items-center gap-1 font-semibold text-slate-400">
                  No ❌
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Requires Finance Approval:</span>
                <span className="flex items-center gap-1 font-semibold text-slate-400">
                  No ❌
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSaveTier('BRONZE')}
            disabled={savingTier === 'BRONZE'}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save size={14} />
            {savingTier === 'BRONZE' ? 'Saving...' : 'Save Bronze Tier'}
          </button>
        </div>

        {/* SILVER CARD */}
        <div className="rounded-3xl border border-slate-400/30 bg-gradient-to-b from-slate-400/10 via-slate-900/60 to-slate-900 p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xl font-extrabold text-slate-200 flex items-center gap-2">
                <span>🥈</span> Silver Tier
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-400/20 text-slate-200 border border-slate-400/40 text-[11px] font-bold">
                Preferred
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Max Discount Allowed (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={tiers.SILVER.maxDiscount}
                  onChange={(e) =>
                    setTiers({
                      ...tiers,
                      SILVER: { ...tiers.SILVER, maxDiscount: e.target.value },
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-slate-400 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                  %
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2 border-t border-slate-800/80 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Requires Manager Approval:</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  Yes ✅
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Requires Finance Approval:</span>
                <span className="flex items-center gap-1 font-semibold text-slate-400">
                  No ❌
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSaveTier('SILVER')}
            disabled={savingTier === 'SILVER'}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-600/20 hover:bg-slate-600/30 border border-slate-400/40 text-slate-200 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save size={14} />
            {savingTier === 'SILVER' ? 'Saving...' : 'Save Silver Tier'}
          </button>
        </div>

        {/* GOLD CARD */}
        <div className="rounded-3xl border border-yellow-500/40 bg-gradient-to-b from-yellow-500/10 via-slate-900/60 to-slate-900 p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xl font-extrabold text-yellow-300 flex items-center gap-2">
                <span>🥇</span> Gold Tier
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[11px] font-bold">
                Enterprise VIP
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Max Discount Allowed (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={tiers.GOLD.maxDiscount}
                  onChange={(e) =>
                    setTiers({
                      ...tiers,
                      GOLD: { ...tiers.GOLD, maxDiscount: e.target.value },
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-yellow-500 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                  %
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2 border-t border-slate-800/80 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>Requires Manager Approval:</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  Yes ✅
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Requires Finance Approval:</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  Yes ✅
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSaveTier('GOLD')}
            disabled={savingTier === 'GOLD'}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save size={14} />
            {savingTier === 'GOLD' ? 'Saving...' : 'Save Gold Tier'}
          </button>
        </div>
      </div>

      {/* ── 2. APPROVAL CHAIN VISUALIZATION ───────────────────────────────── */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 md:p-8 space-y-6 shadow-xl backdrop-blur-md">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-400" />
            Approval Chain Routing Logic
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated compliance engine evaluates total quote discount overage vs tier and category limits
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Level 1: 0-5% */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-emerald-500/30 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-mono font-bold">
                [0 - 5%]
              </span>
              <span className="text-[11px] font-bold text-emerald-400">Level 0</span>
            </div>
            <p className="text-sm font-bold text-white mb-1">No Approval Needed</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Discounts within standard parameters are <strong className="text-emerald-300">Auto Approved</strong>. Sales rep can send directly to customer.
            </p>
          </div>

          {/* Level 2: 5-10% */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-amber-500/30 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-mono font-bold">
                [5 - 10%]
              </span>
              <span className="text-[11px] font-bold text-amber-400">Level 1</span>
            </div>
            <p className="text-sm font-bold text-white mb-1">Sales Manager Review</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Routed to manager queue. Quotation enters <strong className="text-amber-300">PENDING_MANAGER</strong> state until reviewed.
            </p>
          </div>

          {/* Level 3: 10%+ */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-rose-500/30 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-mono font-bold">
                [10%+]
              </span>
              <span className="text-[11px] font-bold text-rose-400">Level 2 (Dual)</span>
            </div>
            <p className="text-sm font-bold text-white mb-1">Manager → Finance</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Requires sequential dual sign-off. <strong className="text-rose-300">Both Sales Manager & Finance</strong> must approve.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. CATEGORY DISCOUNTS & RISK EXPLAINER ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Discounts Table */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Category Max Discounts</h3>
              <p className="text-xs text-slate-400">Category-level maximum discount guardrails</p>
            </div>
            <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
              Most Restrictive Wins
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 font-semibold">Category</th>
                  <th className="py-2.5 font-semibold text-center">Max Discount</th>
                  <th className="py-2.5 font-semibold text-center">Override Tier Max?</th>
                  <th className="py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Loading categories...
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 font-semibold text-white">{c.name}</td>
                      <td className="py-3 text-center font-mono font-bold text-amber-400">
                        {c.maxDiscount ?? c.max_discount ?? 15}%
                      </td>
                      <td className="py-3 text-center text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                          Capped by Tier
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleOpenCatModal(c)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> Category limits apply on top of tier limits. The effective allowed discount is the lower of the customer tier limit and product category limit.
            </span>
          </div>
        </div>

        {/* Risk Score Explainer Card */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4 shadow-xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              Blended Risk Score Calculation Engine
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Weighted algorithm calculating discount excess across mixed line-item orders
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-3 font-mono text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <p className="font-bold">Item 1: Laptop (Hardware)</p>
              <p className="text-[11px] text-slate-300">12% given, 15% allowed → OK (0% overage)</p>
            </div>

            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <p className="font-bold">Item 2: Setup Service (Services)</p>
              <p className="text-[11px] text-slate-300">18% given, 10% allowed → <strong className="text-rose-400">+8% over limit</strong></p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-sans">
              <span className="text-slate-300 font-bold">Blended Risk Score: <span className="text-amber-400 font-mono text-sm">8.4</span></span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                Manager Approval Required
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            The blended risk score normalizes line values by line-total weights, preventing reps from inflating discount overages on minor accessories to bypass approval tiers.
          </p>
        </div>
      </div>

      {/* ── Edit Category Modal ──────────────────────────────────────────── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                Edit {editingCategory.name} Limit
              </h3>
              <button
                onClick={() => setEditingCategory(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category Max Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  value={catMaxDiscount}
                  onChange={(e) => setCatMaxDiscount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                >
                  {savingCategory ? 'Saving...' : 'Update Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
