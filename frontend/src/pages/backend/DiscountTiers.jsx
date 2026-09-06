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
  X,
  Award,
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
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-slate-900">
            <Percent size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-slate-900 tracking-tight">
              Discount Tiers & Approval Chains
            </h1>
            <p className="text-xs md:text-sm font-medium text-slate-600">
              Configure maximum allowable discounts per customer tier and automated multi-level approval triggers
            </p>
          </div>
        </div>
      </div>

      {/* ── 1. TIER CARDS (3 Cards) ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* BRONZE CARD */}
        <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 flex flex-col justify-between shadow-pop hover:-translate-y-1 transition-all relative overflow-hidden">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-amber-800">
                  <Award className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <span className="text-xl font-heading font-extrabold text-slate-900">
                  Bronze Tier
                </span>
              </div>
              <span className="px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 border-2 border-slate-900 text-xs font-heading font-extrabold">
                Standard
              </span>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs font-bold">
                  %
                </span>
              </div>
            </div>

            <div className="pt-3 space-y-2.5 border-t-2 border-slate-100 text-xs font-medium">
              <div className="flex items-center justify-between text-slate-700">
                <span>Requires Manager Approval:</span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                  <XCircle size={14} strokeWidth={2.5} /> No
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Requires Finance Approval:</span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                  <XCircle size={14} strokeWidth={2.5} /> No
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSaveTier('BRONZE')}
            disabled={savingTier === 'BRONZE'}
            className="mt-6 w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 border-2 border-slate-900 text-slate-900 font-heading font-extrabold text-xs shadow-pop-sm hover:shadow-pop active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save size={15} strokeWidth={2.5} />
            {savingTier === 'BRONZE' ? 'Saving...' : 'Save Bronze Tier'}
          </button>
        </div>

        {/* SILVER CARD */}
        <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 flex flex-col justify-between shadow-pop hover:-translate-y-1 transition-all relative overflow-hidden">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-slate-700">
                  <Award className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <span className="text-xl font-heading font-extrabold text-slate-900">
                  Silver Tier
                </span>
              </div>
              <span className="px-3 py-0.5 rounded-full bg-slate-100 text-slate-800 border-2 border-slate-900 text-xs font-heading font-extrabold">
                Preferred
              </span>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs font-bold">
                  %
                </span>
              </div>
            </div>

            <div className="pt-3 space-y-2.5 border-t-2 border-slate-100 text-xs font-medium">
              <div className="flex items-center justify-between text-slate-700">
                <span>Requires Manager Approval:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  <CheckCircle2 size={14} strokeWidth={2.5} /> Yes
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Requires Finance Approval:</span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                  <XCircle size={14} strokeWidth={2.5} /> No
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSaveTier('SILVER')}
            disabled={savingTier === 'SILVER'}
            className="mt-6 w-full py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-100 border-2 border-slate-900 text-slate-900 font-heading font-extrabold text-xs shadow-pop-sm hover:shadow-pop active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save size={15} strokeWidth={2.5} />
            {savingTier === 'SILVER' ? 'Saving...' : 'Save Silver Tier'}
          </button>
        </div>

        {/* GOLD CARD */}
        <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 flex flex-col justify-between shadow-pop hover:-translate-y-1 transition-all relative overflow-hidden">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-pop-yellow border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-slate-900">
                  <Award className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <span className="text-xl font-heading font-extrabold text-slate-900">
                  Gold Tier
                </span>
              </div>
              <span className="px-3 py-0.5 rounded-full bg-pop-yellow text-slate-900 border-2 border-slate-900 text-xs font-heading font-extrabold">
                Enterprise VIP
              </span>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs font-bold">
                  %
                </span>
              </div>
            </div>

            <div className="pt-3 space-y-2.5 border-t-2 border-slate-100 text-xs font-medium">
              <div className="flex items-center justify-between text-slate-700">
                <span>Requires Manager Approval:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  <CheckCircle2 size={14} strokeWidth={2.5} /> Yes
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Requires Finance Approval:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  <CheckCircle2 size={14} strokeWidth={2.5} /> Yes
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSaveTier('GOLD')}
            disabled={savingTier === 'GOLD'}
            className="mt-6 w-full py-3 px-4 rounded-xl bg-pop-yellow hover:bg-amber-300 border-2 border-slate-900 text-slate-900 font-heading font-extrabold text-xs shadow-pop-sm hover:shadow-pop active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save size={15} strokeWidth={2.5} />
            {savingTier === 'GOLD' ? 'Saving...' : 'Save Gold Tier'}
          </button>
        </div>
      </div>

      {/* ── 2. APPROVAL CHAIN VISUALIZATION ───────────────────────────────── */}
      <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 md:p-8 space-y-6 shadow-pop">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm flex items-center justify-center">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-lg font-heading font-extrabold text-slate-900">
              Approval Chain Routing Logic
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Automated compliance engine evaluates total quote discount overage vs tier and category limits
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Level 1: 0-5% */}
          <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-slate-900 shadow-pop-sm relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-200 text-emerald-950 border-2 border-slate-900 text-xs font-mono font-bold">
                  [0 - 5%]
                </span>
                <span className="text-xs font-heading font-extrabold text-emerald-800">Level 0</span>
              </div>
              <p className="text-sm font-heading font-extrabold text-slate-900 mb-1.5">No Approval Needed</p>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Discounts within standard parameters are <strong className="text-emerald-800 font-bold">Auto Approved</strong>. Sales rep can send directly to customer.
              </p>
            </div>
          </div>

          {/* Level 2: 5-10% */}
          <div className="p-5 rounded-2xl bg-amber-50 border-2 border-slate-900 shadow-pop-sm relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-950 border-2 border-slate-900 text-xs font-mono font-bold">
                  [5 - 10%]
                </span>
                <span className="text-xs font-heading font-extrabold text-amber-800">Level 1</span>
              </div>
              <p className="text-sm font-heading font-extrabold text-slate-900 mb-1.5">Sales Manager Review</p>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Routed to manager queue. Quotation enters <strong className="text-amber-800 font-bold">PENDING_MANAGER</strong> state until reviewed.
              </p>
            </div>
          </div>

          {/* Level 3: 10%+ */}
          <div className="p-5 rounded-2xl bg-rose-50 border-2 border-slate-900 shadow-pop-sm relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-rose-200 text-rose-950 border-2 border-slate-900 text-xs font-mono font-bold">
                  [10%+]
                </span>
                <span className="text-xs font-heading font-extrabold text-rose-800">Level 2 (Dual)</span>
              </div>
              <p className="text-sm font-heading font-extrabold text-slate-900 mb-1.5">Manager → Finance</p>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Requires sequential dual sign-off. <strong className="text-rose-800 font-bold">Both Sales Manager & Finance</strong> must approve.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. CATEGORY DISCOUNTS & RISK EXPLAINER ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Discounts Table */}
        <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 space-y-4 shadow-pop">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-heading font-extrabold text-slate-900">Category Max Discounts</h3>
              <p className="text-xs font-medium text-slate-500">Category-level maximum discount guardrails</p>
            </div>
            <span className="text-xs text-slate-900 bg-amber-200 border-2 border-slate-900 px-3 py-0.5 rounded-full font-heading font-extrabold shadow-pop-sm">
              Most Restrictive Wins
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 text-slate-600 font-heading font-bold uppercase tracking-wider">
                  <th className="py-2.5">Category</th>
                  <th className="py-2.5 text-center">Max Discount</th>
                  <th className="py-2.5 text-center hidden sm:table-cell">Override Tier Max?</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 font-medium">
                      Loading categories...
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-heading font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 text-center font-mono font-extrabold text-slate-900 text-sm">
                        {c.maxDiscount ?? c.max_discount ?? 15}%
                      </td>
                      <td className="py-3 text-center text-slate-600 font-medium hidden sm:table-cell">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-300 text-[11px] font-bold">
                          Capped by Tier
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleOpenCatModal(c)}
                          className="p-1.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 shadow-pop-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
                        >
                          <Edit3 size={14} strokeWidth={2.5} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50 border-2 border-slate-900 text-xs font-medium text-slate-700 flex items-start gap-2 shadow-pop-sm">
            <Info size={16} strokeWidth={2.5} className="text-sky-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-900">Note:</strong> Category limits apply on top of tier limits. The effective allowed discount is the lower of the customer tier limit and product category limit.
            </span>
          </div>
        </div>

        {/* Risk Score Explainer Card */}
        <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 space-y-4 shadow-pop">
          <div>
            <h3 className="text-base font-heading font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles size={18} strokeWidth={2.5} className="text-pop-violet" />
              Blended Risk Score Engine
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Weighted algorithm calculating discount excess across mixed line-item orders
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 border-2 border-slate-900 p-4 space-y-3 font-mono text-xs shadow-pop-sm">
            <div className="p-2.5 rounded-xl bg-emerald-100 border-2 border-slate-900 text-emerald-950">
              <p className="font-bold">Item 1: Laptop (Hardware)</p>
              <p className="text-[11px] text-slate-700">12% given, 15% allowed → OK (0% overage)</p>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-100 border-2 border-slate-900 text-rose-950">
              <p className="font-bold">Item 2: Setup Service (Services)</p>
              <p className="text-[11px] text-slate-700">18% given, 10% allowed → <strong className="text-rose-900 font-black">+8% over limit</strong></p>
            </div>

            <div className="pt-2 border-t-2 border-slate-200 flex items-center justify-between text-xs font-sans">
              <span className="text-slate-800 font-bold">Blended Risk Score: <span className="text-slate-900 font-mono text-sm font-extrabold">8.4</span></span>
              <span className="px-3 py-1 rounded-full bg-amber-200 border-2 border-slate-900 text-slate-900 text-xs font-heading font-extrabold">
                Manager Approval Required
              </span>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            The blended risk score normalizes line values by line-total weights, preventing reps from inflating discount overages on minor accessories to bypass approval tiers.
          </p>
        </div>
      </div>

      {/* ── Edit Category Modal ──────────────────────────────────────────── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100">
              <h3 className="text-base font-heading font-extrabold text-slate-900">
                Edit {editingCategory.name} Limit
              </h3>
              <button
                onClick={() => setEditingCategory(null)}
                className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
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
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t-2 border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 text-xs font-heading font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-2 rounded-xl bg-pop-violet hover:bg-violet-600 text-xs font-heading font-extrabold text-white border-2 border-slate-900 shadow-pop-sm active:translate-x-0.5 active:translate-y-0.5 transition-all"
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
