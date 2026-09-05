import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Send,
  FileText,
  Download,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  Info,
  ShoppingBag,
  StickyNote,
  RefreshCw,
  User,
  Building,
  Calendar,
  TrendingUp,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { productsAPI, quotationsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import LiveMarginBar from '../../components/ui/LiveMarginBar';

// ── Helpers ────────────────────────────────────────────────────────────────

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const genId = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;

const defaultLine = (product = null) => ({
  _id: genId(),
  product_id: product?.id || '',
  product: product,
  line_type: 'ONE_TIME',
  quantity: 1,
  unit_price: product ? Number(product.base_price || 0) : 0,
  cost_price: product ? Number(product.cost_price || 0) : 0,
  discount: 0,
  tax: product ? Number(product.tax || 18) : 18,
  notes: '',
});

// ─── ProductPicker Dropdown ────────────────────────────────────────────────
function ProductPicker({ products, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = products.filter((p) =>
    `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[70vh]">
        <div className="p-3.5 border-b border-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No products found</div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/80 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{p.sku}</div>
                </div>
                <div className="text-sm font-bold text-slate-200 shrink-0">{formatINR(p.base_price)}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main QuotationBuilder ─────────────────────────────────────────────────

export default function QuotationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isNew = !id;

  // ── State ──────────────────────────────────────────────────────────────────
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [lines, setLines] = useState([defaultLine()]);
  const [customerTier, setCustomerTier] = useState('BRONZE');
  const [expiryDate, setExpiryDate] = useState('');
  const [repNotes, setRepNotes] = useState('');

  // Products catalog
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTargetLineId, setPickerTargetLineId] = useState(null);

  // Risk state (from API compute)
  const [riskData, setRiskData] = useState(null);
  const [computingRisk, setComputingRisk] = useState(false);

  // Sidebar collapsed state (from AppLayout)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Load Products ──────────────────────────────────────────────────────────
  useEffect(() => {
    productsAPI.getAll({ active: true }).then((res) => {
      const arr = Array.isArray(res) ? res : [];
      setProducts(arr.filter((p) => p.is_active));
    }).catch(() => {
      toast.error('Could not load product catalog');
    }).finally(() => setLoadingProducts(false));
  }, []);

  // ── Load Existing Quotation ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const loadQuotation = async () => {
      setLoading(true);
      try {
        const q = await quotationsAPI.getOne(id);
        setQuotation(q);
        setCustomerTier(q.customer_tier || q.customerTier || 'BRONZE');
        setRepNotes(q.rep_notes || q.repNotes || '');
        setExpiryDate(
          q.expiry_date || q.expiryDate
            ? new Date(q.expiry_date || q.expiryDate).toISOString().split('T')[0]
            : ''
        );

        // Hydrate lines
        const hydratedLines = (q.lines || []).map((l) => ({
          _id: l.id || genId(),
          product_id: l.product_id || l.productId || l.product?.id || '',
          product: l.product || null,
          line_type: l.line_type || l.lineType || 'ONE_TIME',
          quantity: Number(l.quantity || 1),
          unit_price: Number(l.unit_price ?? l.unitPrice ?? 0),
          cost_price: Number(l.cost_price ?? l.costPrice ?? 0),
          discount: Number(l.discount || 0),
          tax: Number(l.tax ?? 18),
          notes: l.notes || '',
        }));
        setLines(hydratedLines.length ? hydratedLines : [defaultLine()]);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to load quotation');
        navigate('/quotations');
      } finally {
        setLoading(false);
      }
    };

    loadQuotation();
  }, [id]);

  // ── Live Risk Score Compute (debounced) ───────────────────────────────────
  useEffect(() => {
    const validLines = lines.filter((l) => l.product_id);
    if (!validLines.length) { setRiskData(null); return; }

    const timer = setTimeout(async () => {
      setComputingRisk(true);
      try {
        const payload = {
          lines: validLines.map((l) => ({
            productId: l.product_id,
            quantity: l.quantity,
            unitPrice: l.unit_price,
            costPrice: l.cost_price,
            discount: l.discount,
            tax: l.tax,
          })),
          customerTier,
        };
        const res = await quotationsAPI.computeRisk(payload);
        setRiskData(res);
      } catch {
        // Silently fail — LiveMarginBar will estimate locally
      } finally {
        setComputingRisk(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [lines, customerTier]);

  // ── Line Handlers ──────────────────────────────────────────────────────────

  const handleLineChange = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((l) =>
        l._id === lineId ? { ...l, [field]: value } : l
      )
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, defaultLine()]);
  };

  const handleRemoveLine = (lineId) => {
    if (lines.length === 1) {
      toast.error('Quotation must have at least one line item');
      return;
    }
    setLines((prev) => prev.filter((l) => l._id !== lineId));
  };

  const handlePickProduct = (product) => {
    if (pickerTargetLineId) {
      setLines((prev) =>
        prev.map((l) =>
          l._id === pickerTargetLineId
            ? {
                ...l,
                product_id: product.id,
                product,
                unit_price: Number(product.base_price || 0),
                cost_price: Number(product.cost_price || 0),
                tax: Number(product.tax || 18),
                line_type: product.is_subscription ? 'SUBSCRIPTION' : 'ONE_TIME',
              }
            : l
        )
      );
    }
    setPickerTargetLineId(null);
  };

  // ── Save / Submit ──────────────────────────────────────────────────────────

  const buildPayload = () => ({
    customerTier,
    expiryDate: expiryDate || null,
    repNotes: repNotes.trim() || null,
    lines: lines
      .filter((l) => l.product_id)
      .map((l) => ({
        productId: l.product_id,
        lineType: l.line_type,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unit_price),
        costPrice: Number(l.cost_price),
        discount: Number(l.discount),
        tax: Number(l.tax),
        notes: l.notes || null,
      })),
  });

  const handleSave = async () => {
    const validLines = lines.filter((l) => l.product_id);
    if (!validLines.length) {
      toast.error('Add at least one product line to save');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      let saved;
      if (isNew) {
        saved = await quotationsAPI.create(payload);
        toast.success(`Quotation ${saved.quotationNumber || ''} created!`, { icon: '📋' });
        navigate(`/quotations/${saved.id}`);
      } else {
        saved = await quotationsAPI.update(id, payload);
        setQuotation(saved);
        toast.success('Quotation saved successfully', { icon: '💾' });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const validLines = lines.filter((l) => l.product_id);
    if (!validLines.length) {
      toast.error('Add at least one product before submitting for approval');
      return;
    }
    setSubmitting(true);
    try {
      // Save first
      let targetId = id;
      if (isNew) {
        const saved = await quotationsAPI.create(buildPayload());
        targetId = saved.id;
        setQuotation(saved);
        navigate(`/quotations/${saved.id}`, { replace: true });
      } else {
        await quotationsAPI.update(id, buildPayload());
      }
      // Submit for approval
      await quotationsAPI.submit(targetId);
      toast.success('Submitted for approval routing!', { icon: '🚀', duration: 4000 });
      navigate('/pipeline');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit quotation');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Computed totals (for display) ─────────────────────────────────────────

  const lineTotals = useMemo(() => {
    return lines.map((l) => {
      const qty = Number(l.quantity || 1);
      const price = Number(l.unit_price || 0);
      const disc = Number(l.discount || 0);
      const tax = Number(l.tax || 18);
      const effective = price * (1 - disc / 100);
      const lineRev = effective * qty;
      const lineTotal = lineRev * (1 + tax / 100);
      const cost = Number(l.cost_price || 0) * qty;
      const margin = lineRev > 0 ? ((lineRev - cost) / lineRev) * 100 : 0;
      return { lineTotal, margin };
    });
  }, [lines]);

  const grandTotal = lineTotals.reduce((s, l) => s + l.lineTotal, 0);

  // ── Status helpers ─────────────────────────────────────────────────────────

  const status = quotation?.status;
  const isDraft = !status || status === 'DRAFT';
  const canEdit = isDraft;
  const canSubmit = isDraft && lines.filter((l) => l.product_id).length > 0;
  const canDownloadPDF = status && status !== 'DRAFT';

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading quotation builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-6">
      {/* ── TOP HEADER BAR ───────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              {isNew ? 'New Quotation' : `Editing — ${quotation?.quotation_number || quotation?.quotationNumber || id}`}
            </h1>
            {status && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase">
                {status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Build your CPQ deal — margins and risk auto-update in real-time
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* PDF Download (non-draft only) */}
          {canDownloadPDF && (
            <button
              onClick={() => window.open(`http://localhost:5000/api/quotations/${id}/pdf`, '_blank')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Download PDF"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              📄 Download PDF
            </button>
          )}

          {/* Save Draft */}
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-600 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
          )}

          {/* Submit for Approval */}
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit for Approval
            </button>
          )}
        </div>
      </div>

      {/* ── QUOTATION META ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Tier */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
            <User className="w-3.5 h-3.5 text-slate-400" />
            Customer Tier
          </label>
          <select
            value={customerTier}
            onChange={(e) => setCustomerTier(e.target.value)}
            disabled={!canEdit}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="BRONZE">🥉 Bronze — Standard Pricing</option>
            <option value="SILVER">🥈 Silver — Preferred Rates</option>
            <option value="GOLD">🥇 Gold — VIP Pricing</option>
          </select>
        </div>

        {/* Expiry Date */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Valid Until (Expiry)
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={!canEdit}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Risk Summary from API */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              Deal Intelligence
            </label>
            {computingRisk && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
          </div>
          {riskData ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Risk Score</span>
                <span
                  className={`font-mono font-bold ${
                    riskData.blendedRiskScore < 5
                      ? 'text-emerald-400'
                      : riskData.blendedRiskScore < 10
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {Number(riskData.blendedRiskScore || 0).toFixed(2)} / 15
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Approval</span>
                <span className="text-slate-200 font-medium text-[11px]">
                  {riskData.approvalRequired === 'NONE'
                    ? '✅ Auto'
                    : riskData.approvalRequired === 'MANAGER_ONLY'
                    ? '⚠️ Manager'
                    : '🔴 Mgr + Finance'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {lines.filter((l) => l.product_id).length
                ? 'Computing risk...'
                : 'Add products to see risk analysis'}
            </p>
          )}
        </div>
      </div>

      {/* ── ORDER LINES ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/30">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Order Lines
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
              {lines.filter((l) => l.product_id).length} / {lines.length}
            </span>
          </h2>
          {canEdit && (
            <button
              onClick={handleAddLine}
              className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800/60 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-3 text-center">Type</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-center">Disc %</th>
                <th className="py-2.5 px-3 text-center">Tax %</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
                <th className="py-2.5 px-3 text-center">Margin</th>
                {canEdit && <th className="py-2.5 px-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {lines.map((line, idx) => {
                const { lineTotal, margin } = lineTotals[idx] || { lineTotal: 0, margin: 0 };
                const marginColor =
                  margin >= 25
                    ? 'text-emerald-400'
                    : margin >= 15
                    ? 'text-amber-400'
                    : 'text-rose-400';
                const discExcessive = line.discount > 15;

                return (
                  <tr key={line._id} className={`hover:bg-slate-800/30 transition-colors ${discExcessive ? 'bg-amber-500/3' : ''}`}>
                    {/* Product Cell */}
                    <td className="py-3 px-4">
                      {line.product ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                            <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100">{line.product.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">{line.product.sku}</div>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => {
                                setPickerTargetLineId(line._id);
                                setShowPicker(true);
                              }}
                              className="ml-1 text-slate-600 hover:text-blue-400 transition-colors"
                              title="Change product"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPickerTargetLineId(line._id);
                            setShowPicker(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-700 hover:border-blue-500 hover:bg-blue-500/5 text-slate-400 hover:text-blue-400 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Select product...</span>
                        </button>
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-3 text-center">
                      <select
                        value={line.line_type}
                        onChange={(e) => handleLineChange(line._id, 'line_type', e.target.value)}
                        disabled={!canEdit}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none disabled:opacity-50"
                      >
                        <option value="ONE_TIME">One-Time</option>
                        <option value="SUBSCRIPTION">Recurring</option>
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(line._id, 'quantity', Math.max(1, Number(e.target.value)))
                        }
                        disabled={!canEdit}
                        className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unit_price}
                        onChange={(e) =>
                          handleLineChange(line._id, 'unit_price', Number(e.target.value))
                        }
                        disabled={!canEdit}
                        className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                      />
                    </td>

                    {/* Discount % */}
                    <td className="py-3 px-3 text-center">
                      <div className="relative inline-flex items-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={line.discount}
                          onChange={(e) =>
                            handleLineChange(
                              line._id,
                              'discount',
                              Math.min(100, Math.max(0, Number(e.target.value)))
                            )
                          }
                          disabled={!canEdit}
                          className={`w-16 bg-slate-950 border rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none disabled:opacity-50 font-mono ${
                            discExcessive ? 'border-amber-500/60 text-amber-300' : 'border-slate-800 focus:border-blue-500'
                          }`}
                        />
                        {discExcessive && (
                          <AlertTriangle className="w-3 h-3 text-amber-400 absolute -right-4" title="High discount — risk flagged" />
                        )}
                      </div>
                    </td>

                    {/* Tax % */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={line.tax}
                        onChange={(e) =>
                          handleLineChange(line._id, 'tax', Number(e.target.value))
                        }
                        disabled={!canEdit}
                        className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                      />
                    </td>

                    {/* Line Total */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">
                      {formatINR(lineTotal)}
                    </td>

                    {/* Margin */}
                    <td className={`py-3 px-3 text-center font-mono font-bold ${marginColor}`}>
                      {margin.toFixed(1)}%
                    </td>

                    {/* Remove */}
                    {canEdit && (
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleRemoveLine(line._id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-600 hover:text-rose-400 transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REP NOTES ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
          <StickyNote className="w-3.5 h-3.5 text-slate-400" />
          Rep Notes (Visible to reviewers)
        </label>
        <textarea
          value={repNotes}
          onChange={(e) => setRepNotes(e.target.value)}
          disabled={!canEdit}
          placeholder="Add context, special pricing justification, or deal background..."
          rows={3}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      {/* ── PRODUCT PICKER MODAL ─────────────────────────────────────────── */}
      {showPicker && (
        <ProductPicker
          products={products}
          onSelect={handlePickProduct}
          onClose={() => { setShowPicker(false); setPickerTargetLineId(null); }}
        />
      )}

      {/* ── LIVE MARGIN BAR (STICKY BOTTOM) ─────────────────────────────── */}
      <LiveMarginBar lines={lines} sidebarCollapsed={sidebarCollapsed} />
    </div>
  );
}
