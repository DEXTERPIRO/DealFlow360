import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  ArrowRight,
  TrendingUp,
  Tag,
  Search,
  Sliders,
  Check,
  X,
  Package,
  Layers,
  Star,
  Zap,
  Info
} from 'lucide-react';
import { productsAPI } from '../../api';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';

export default function UpsellRules() {
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Rule Modal
  const [ruleModalData, setRuleModalData] = useState(null); // null = closed, {} = add, rule = edit
  const [savingRule, setSavingRule] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // ── 1. Load Rules and Products ───────────────────────────────────────────

  const loadData = useCallback(async (q = searchQuery) => {
    try {
      setLoading(true);
      const params = {};
      if (q && q.trim()) params.search = q.trim();

      const [rulesRes, prodsRes] = await Promise.all([
        productsAPI.getUpsellRules(params),
        products.length === 0 ? productsAPI.getAll() : Promise.resolve(products),
      ]);
      setRules(Array.isArray(rulesRes) ? rulesRes : []);
      if (products.length === 0) {
        setProducts(Array.isArray(prodsRes) ? prodsRes : prodsRes?.products || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load upsell intelligence rules');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, products]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, loadData]);

  // ── 2. Save Rule (Create or Edit) ────────────────────────────────────────

  const handleSaveRule = async (e) => {
    e.preventDefault();
    const { id, sourceProductId, targetProductId, score, isPromoted, minMargin } = ruleModalData;

    if (!sourceProductId || !targetProductId) {
      toast.error('Source and Target products are required');
      return;
    }
    if (sourceProductId === targetProductId) {
      toast.error('Source and Target product cannot be identical');
      return;
    }

    try {
      setSavingRule(true);
      if (id) {
        await productsAPI.updateUpsellRule(id, {
          sourceProductId,
          targetProductId,
          score: parseInt(score, 10) || 50,
          isPromoted: Boolean(isPromoted),
          minMargin: parseFloat(minMargin) || 0,
        });
        toast.success('Upsell rule updated!');
      } else {
        await productsAPI.createUpsellRule({
          sourceProductId,
          targetProductId,
          score: parseInt(score, 10) || 50,
          isPromoted: Boolean(isPromoted),
          minMargin: parseFloat(minMargin) || 0,
        });
        toast.success('New upsell rule activated!');
      }
      setRuleModalData(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save upsell rule');
    } finally {
      setSavingRule(false);
    }
  };

  // ── 3. Toggle Promoted Switch ────────────────────────────────────────────

  const handleTogglePromoted = async (rule) => {
    try {
      const newPromoted = !rule.is_promoted;
      await productsAPI.updateUpsellRule(rule.id, {
        sourceProductId: rule.source_product_id,
        targetProductId: rule.target_product_id,
        score: rule.score,
        isPromoted: newPromoted,
        minMargin: rule.min_margin,
      });
      toast.success(
        `Rule for "${rule.target_product?.name || 'Target'}" ${
          newPromoted ? 'promoted' : 'demoted'
        }`
      );
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle promotion status');
    }
  };

  // ── 4. Delete Rule ───────────────────────────────────────────────────────

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this upsell rule?')) return;
    try {
      await productsAPI.deleteUpsellRule(id);
      toast.success('Upsell rule deleted');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete rule');
    }
  };

  // ── Database Queried Rules ───────────────────────────────────────────────
  const filteredRules = rules;

  // Pagination
  const [rulePage, setRulePage] = useState(1);
  const rulePageSize = 6;

  useEffect(() => {
    setRulePage(1);
  }, [searchQuery]);

  const pagedRules = useMemo(() => {
    const start = (rulePage - 1) * rulePageSize;
    return filteredRules.slice(start, start + rulePageSize);
  }, [filteredRules, rulePage, rulePageSize]);

  // Promoted products list from rules
  const promotedRules = useMemo(() => {
    return rules.filter((r) => r.is_promoted);
  }, [rules]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Upsell & Cross-Sell Intelligence
              </h1>
              <p className="text-xs text-slate-400">
                Automated recommendation rules, affinity scoring, and prioritized margins
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            setRuleModalData({
              sourceProductId: products[0]?.id || '',
              targetProductId: products[1]?.id || '',
              score: 75,
              isPromoted: true,
              minMargin: 15,
            })
          }
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          Add Upsell Rule
        </button>
      </div>

      {/* ── Description Card ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-slate-900/60 to-slate-900/80 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2">
            <Zap size={16} className="text-purple-400" />
            Real-Time CPQ Recommendation Engine
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            When a sales rep adds <strong>Product A</strong> to an active quotation, the system dynamically calculates and presents <strong>Product B</strong> based on affinity score, minimum margin safety gates, and executive promotion tags.
          </p>
        </div>
        <div className="px-4 py-2 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs font-mono font-bold flex-shrink-0">
          {rules.length} Active Rules
        </div>
      </div>

      {/* ── Promotion Tags Section ───────────────────────────────────────── */}
      {promotedRules.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Star size={16} className="text-yellow-400 fill-yellow-400/20" />
            Currently Promoted Recommendations
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {promotedRules.map((pr) => (
              <div
                key={pr.id}
                className="rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-4 flex items-center justify-between"
              >
                <div className="space-y-1 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-[10px] font-bold">
                    PROMOTED
                  </span>
                  <p className="text-xs font-bold text-white truncate">
                    {pr.target_product?.name || 'Target Product'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Suggested when buying: {pr.source_product?.name}
                  </p>
                </div>
                <button
                  onClick={() => handleTogglePromoted(pr)}
                  title="Demote Recommendation"
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 flex-shrink-0"
                >
                  Demote
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rules Table ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search source or target product..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing {filteredRules.length} rules
          </span>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                  <th className="py-3.5 px-6 font-semibold">Source Product</th>
                  <th className="py-3.5 px-3 font-semibold text-center">Suggests</th>
                  <th className="py-3.5 px-4 font-semibold">Target Product</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Score</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Promoted</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Min Margin</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Loading intelligence rules...
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No upsell rules found. Create your first cross-sell recommendation rule above.
                    </td>
                  </tr>
                ) : (
                  pagedRules.map((rule) => {
                    const src = rule.source_product;
                    const tgt = rule.target_product;

                    return (
                      <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Source Product */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-semibold">
                              {src?.name || 'Source Product'}
                            </span>
                          </div>
                        </td>

                        {/* Suggests Arrow */}
                        <td className="py-4 px-3 text-center text-purple-400">
                          <ArrowRight size={16} className="mx-auto" />
                        </td>

                        {/* Target Product */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 font-semibold">
                              {tgt?.name || 'Target Product'}
                            </span>
                          </div>
                        </td>

                        {/* Score (out of 100) */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-mono font-black text-sm text-emerald-400">
                            {rule.score}/100
                          </span>
                        </td>

                        {/* Promoted Toggle */}
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => handleTogglePromoted(rule)}
                            className={`px-3 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                              rule.is_promoted
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                                : 'bg-slate-800 text-slate-500 border-slate-700'
                            }`}
                          >
                            {rule.is_promoted ? '★ PROMOTED' : 'Standard'}
                          </button>
                        </td>

                        {/* Min Margin */}
                        <td className="py-4 px-4 text-center font-mono font-bold text-slate-300">
                          {rule.min_margin}%
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                setRuleModalData({
                                  id: rule.id,
                                  sourceProductId: rule.source_product_id,
                                  targetProductId: rule.target_product_id,
                                  score: rule.score,
                                  isPromoted: rule.is_promoted,
                                  minMargin: rule.min_margin,
                                })
                              }
                              className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            >
                              <Trash2 size={13} />
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

          {/* Upsell Rules Pagination */}
          <div className="p-4 border-t border-slate-800">
            <Pagination
              currentPage={rulePage}
              totalItems={filteredRules.length}
              pageSize={rulePageSize}
              onPageChange={setRulePage}
            />
          </div>
        </div>
      </div>

      {/* ── Modal: Add / Edit Upsell Rule ─────────────────────────────────── */}
      {ruleModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {ruleModalData.id ? 'Edit Upsell Rule' : 'Add New Upsell Rule'}
                </h3>
              </div>
              <button
                onClick={() => setRuleModalData(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Source Product (Triggers Recommendation) <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={ruleModalData.sourceProductId}
                  onChange={(e) =>
                    setRuleModalData({
                      ...ruleModalData,
                      sourceProductId: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || 'No SKU'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Product (Suggested to Rep) <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={ruleModalData.targetProductId}
                  onChange={(e) =>
                    setRuleModalData({
                      ...ruleModalData,
                      targetProductId: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  {products
                    .filter((p) => p.id !== ruleModalData.sourceProductId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku || 'No SKU'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-slate-300">Affinity Score (1 - 100)</span>
                  <span className="font-mono font-bold text-purple-400">
                    {ruleModalData.score || 50}/100
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={ruleModalData.score || 50}
                  onChange={(e) =>
                    setRuleModalData({
                      ...ruleModalData,
                      score: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Minimum Required Margin (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={ruleModalData.minMargin || 0}
                  onChange={(e) =>
                    setRuleModalData({
                      ...ruleModalData,
                      minMargin: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Promoted Recommendation</p>
                  <p className="text-[11px] text-slate-400">
                    Pin recommendation to top of suggestions list
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(ruleModalData.isPromoted)}
                  onChange={(e) =>
                    setRuleModalData({
                      ...ruleModalData,
                      isPromoted: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRuleModalData(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-purple-600/20"
                >
                  {savingRule ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
