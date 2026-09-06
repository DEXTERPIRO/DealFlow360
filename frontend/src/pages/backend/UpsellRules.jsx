import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  ArrowRight,
  Search,
  Star,
  Zap,
  X,
} from 'lucide-react';
import { productsAPI } from '../../api';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';

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
    const { id, sourceProductId, targetProductId, score, isPromoted, minMargin } =
      ruleModalData;

    if (!sourceProductId || !targetProductId) {
      toast.error('Both source and target products are required');
      return;
    }
    if (sourceProductId === targetProductId) {
      toast.error('Source and target cannot be the same product');
      return;
    }

    try {
      setSavingRule(true);
      if (id) {
        await productsAPI.updateUpsellRule(id, {
          sourceProductId,
          targetProductId,
          score: parseInt(score, 10),
          isPromoted: Boolean(isPromoted),
          minMargin: parseFloat(minMargin) || 0,
        });
        toast.success('Upsell rule updated successfully!');
      } else {
        await productsAPI.createUpsellRule({
          sourceProductId,
          targetProductId,
          score: parseInt(score, 10),
          isPromoted: Boolean(isPromoted),
          minMargin: parseFloat(minMargin) || 0,
        });
        toast.success('Upsell rule created successfully!');
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

  // ── 3. Toggle Promoted Status ────────────────────────────────────────────

  const handleTogglePromoted = async (rule) => {
    const newPromoted = !rule.is_promoted;
    try {
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
  const [rulePageSize, setRulePageSize] = useState(10);

  // Promoted products list from rules
  const promotedRules = useMemo(() => {
    return rules.filter((r) => r.is_promoted);
  }, [rules]);

  // Pagination for Promoted Rules
  const [promotedPage, setPromotedPage] = useState(1);
  const [promotedPageSize, setPromotedPageSize] = useState(6);

  useEffect(() => {
    setRulePage(1);
    setPromotedPage(1);
  }, [searchQuery]);

  const pagedRules = useMemo(() => {
    const start = (rulePage - 1) * rulePageSize;
    return filteredRules.slice(start, start + rulePageSize);
  }, [filteredRules, rulePage, rulePageSize]);

  const pagedPromotedRules = useMemo(() => {
    const start = (promotedPage - 1) * promotedPageSize;
    return promotedRules.slice(start, start + promotedPageSize);
  }, [promotedRules, promotedPage, promotedPageSize]);

  return (
    <div className="space-y-8 pb-12 antialiased">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 border-2 border-slate-900 text-purple-700 flex items-center justify-center shadow-pop-xs">
            <Sparkles size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight">
              Upsell & Cross-Sell Intelligence
            </h1>
            <p className="text-xs font-medium text-slate-600 mt-0.5">
              Automated recommendation rules, affinity scoring, and prioritized margins
            </p>
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
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-heading font-black shadow-pop border-2 border-slate-900 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add Upsell Rule
        </button>
      </div>

      {/* ── Description Card ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-pop">
        <div className="space-y-1.5">
          <h3 className="text-sm font-heading font-black text-slate-900 flex items-center gap-2">
            <Zap size={16} className="text-purple-700" strokeWidth={2.5} />
            Real-Time CPQ Recommendation Engine
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl font-medium">
            When a sales rep adds <strong className="text-slate-900">Product A</strong> to an active quotation, the system dynamically calculates and presents <strong className="text-slate-900">Product B</strong> based on affinity score, minimum margin safety gates, and executive promotion tags.
          </p>
        </div>
        <div className="px-4 py-2 rounded-2xl bg-purple-100 border-2 border-slate-900 text-purple-900 text-xs font-mono font-black shadow-pop-xs flex-shrink-0">
          {rules.length} Active Rules
        </div>
      </div>

      {/* ── Promotion Tags Section ───────────────────────────────────────── */}
      {promotedRules.length > 0 && (
        <div className="space-y-4 bg-amber-50/40 border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-heading font-black text-slate-900 flex items-center gap-2">
              <Star size={16} className="text-amber-500 fill-amber-500" strokeWidth={2.5} />
              Currently Promoted Recommendations ({promotedRules.length})
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-600">
              High-priority suggestions pinned to top of quote builder
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pagedPromotedRules.map((pr) => (
              <div
                key={pr.id}
                className="rounded-2xl border-2 border-slate-900 bg-white p-4 flex items-center justify-between shadow-pop-xs hover:-translate-y-0.5 transition-all"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-amber-200 text-slate-900 border border-slate-900">
                      PROMOTED
                    </span>
                    <span className="text-[11px] font-mono font-bold text-purple-700">
                      Score {pr.score}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-heading font-bold text-slate-900 truncate mt-1">
                    {pr.target_product?.name || 'Target Product'}
                  </p>
                  <p className="text-[11px] text-slate-600 truncate font-medium">
                    When buying: <span className="font-bold text-slate-800">{pr.source_product?.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleTogglePromoted(pr)}
                  title="Demote Recommendation"
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-heading font-bold border-2 border-slate-900 shadow-pop-xs flex-shrink-0 cursor-pointer"
                >
                  Demote
                </button>
              </div>
            ))}
          </div>

          {/* Promoted Pagination */}
          <div className="bg-white border-2 border-slate-900 rounded-2xl p-3 shadow-pop-xs">
            <Pagination
              currentPage={promotedPage}
              totalItems={promotedRules.length}
              pageSize={promotedPageSize}
              onPageChange={setPromotedPage}
              onPageSizeChange={setPromotedPageSize}
              pageSizeOptions={[3, 5, 6, 9, 12, 24, 75]}
            />
          </div>
        </div>
      )}

      {/* ── Rules Table ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-3xl border-2 border-slate-900 shadow-pop">
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              strokeWidth={2.5}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search source or target product..."
              className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl pl-10 pr-3 py-2 text-xs font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-600">
            Showing {filteredRules.length} rules
          </span>
        </div>

        <div className="rounded-3xl border-2 border-slate-900 bg-white overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] font-mono font-black text-slate-700 uppercase tracking-wider">
                  <th className="py-3.5 px-6 font-black">Source Product</th>
                  <th className="py-3.5 px-3 font-black text-center">Suggests</th>
                  <th className="py-3.5 px-4 font-black">Target Product</th>
                  <th className="py-3.5 px-4 font-black text-center">Score</th>
                  <th className="py-3.5 px-4 font-black text-center hidden sm:table-cell">Promoted</th>
                  <th className="py-3.5 px-4 font-black text-center hidden md:table-cell">Min Margin</th>
                  <th className="py-3.5 px-6 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-heading font-bold">
                      Loading intelligence rules...
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-heading font-bold text-xs">
                      No upsell rules found. Create your first cross-sell recommendation rule above.
                    </td>
                  </tr>
                ) : (
                  pagedRules.map((rule) => {
                    const src = rule.source_product;
                    const tgt = rule.target_product;

                    return (
                      <tr key={rule.id} className="hover:bg-amber-50/40 transition-colors">
                        {/* Source Product */}
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 rounded-xl bg-slate-100 border-2 border-slate-900 text-slate-900 font-heading font-bold text-xs shadow-pop-xs">
                            {src?.name || 'Source Product'}
                          </span>
                        </td>

                        {/* Suggests Arrow */}
                        <td className="py-4 px-3 text-center text-purple-700">
                          <ArrowRight size={16} className="mx-auto" strokeWidth={2.5} />
                        </td>

                        {/* Target Product */}
                        <td className="py-4 px-4">
                          <span className="px-3 py-1 rounded-xl bg-purple-100 border-2 border-slate-900 text-purple-900 font-heading font-bold text-xs shadow-pop-xs">
                            {tgt?.name || 'Target Product'}
                          </span>
                        </td>

                        {/* Score (out of 100) */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-mono font-black text-sm text-emerald-700">
                            {rule.score}/100
                          </span>
                        </td>

                        {/* Promoted Toggle */}
                        <td className="py-4 px-4 text-center hidden sm:table-cell">
                          <button
                            onClick={() => handleTogglePromoted(rule)}
                            className={`px-3 py-1 rounded-full text-xs font-mono font-bold border-2 border-slate-900 transition-all inline-flex items-center gap-1.5 shadow-pop-xs ${
                              rule.is_promoted
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {rule.is_promoted ? (
                              <>
                                <Star size={12} strokeWidth={2.5} className="fill-amber-500 text-amber-600" />
                                <span>PROMOTED</span>
                              </>
                            ) : (
                              'Standard'
                            )}
                          </button>
                        </td>

                        {/* Min Margin */}
                        <td className="py-4 px-4 text-center font-mono font-black text-slate-900 text-xs hidden md:table-cell">
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
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-900 shadow-pop-xs transition-all"
                            >
                              <Edit3 size={14} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-2 rounded-xl border-2 border-slate-900 bg-rose-100 hover:bg-rose-200 text-rose-700 shadow-pop-xs transition-all"
                            >
                              <Trash2 size={14} strokeWidth={2.5} />
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
          <div className="p-4 border-t-2 border-slate-900 bg-slate-50">
            <Pagination
              currentPage={rulePage}
              totalItems={filteredRules.length}
              pageSize={rulePageSize}
              onPageChange={setRulePage}
              onPageSizeChange={setRulePageSize}
              pageSizeOptions={[5, 10, 25, 50, 100, 200]}
            />
          </div>
        </div>
      </div>

      {/* ── Modal: Add / Edit Upsell Rule ─────────────────────────────────── */}
      {ruleModalData && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-purple-700" strokeWidth={2.5} />
                <h3 className="text-base font-heading font-black text-slate-900">
                  {ruleModalData.id ? 'Edit Upsell Rule' : 'Add New Upsell Rule'}
                </h3>
              </div>
              <button
                onClick={() => setRuleModalData(null)}
                className="text-slate-500 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-heading font-bold text-slate-800 mb-1.5">
                  Source Product (Triggers Recommendation) <span className="text-rose-600">*</span>
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
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || 'No SKU'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-800 mb-1.5">
                  Target Product (Suggested to Rep) <span className="text-rose-600">*</span>
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
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
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
                <div className="flex justify-between items-center text-xs mb-1.5 font-heading font-bold text-slate-800">
                  <span>Affinity Score (1 - 100)</span>
                  <span className="font-mono font-black text-purple-700">
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
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-800 mb-1.5">
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
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FFFDF5] border-2 border-slate-900 flex items-center justify-between shadow-pop-xs">
                <div>
                  <p className="text-xs font-heading font-bold text-slate-900">Promoted Recommendation</p>
                  <p className="text-[11px] text-slate-500 font-medium">
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
                  className="w-4 h-4 rounded text-purple-600 focus:ring-0 border-2 border-slate-900 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setRuleModalData(null)}
                  className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-xs font-heading font-black text-white border-2 border-slate-900 shadow-pop-xs transition-all active:translate-x-0.5 active:translate-y-0.5"
                >
                  {savingRule ? 'Saving...' : 'Save Rule'}
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
