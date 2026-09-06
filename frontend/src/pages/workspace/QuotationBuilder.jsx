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
  ShieldAlert,
  MessageSquare,
  Check,
  Clock,
} from 'lucide-react';
import { productsAPI, quotationsAPI, usersAPI, negotiationsAPI } from '../../api';
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

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

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

// ── Detect products mentioned in customer negotiation requests ─────────────
const detectProductInNegotiation = (msg, productList) => {
  if (!msg || !productList || !productList.length) return null;
  const lower = msg.toLowerCase();

  // 1. Direct or alias match against product catalog
  for (const prod of productList) {
    if (!prod?.name) continue;
    const pName = prod.name.toLowerCase();
    const pSku = (prod.sku || '').toLowerCase();
    if (lower.includes(pName) || (pSku && lower.includes(pSku))) {
      let qty = 1;
      const qtyMatch = msg.match(/(\d+)\s*(?:x|unit|piece|pcs|qty)/i) || msg.match(/add\s+(\d+)/i);
      if (qtyMatch && qtyMatch[1]) {
        const parsed = parseInt(qtyMatch[1], 10);
        if (!isNaN(parsed) && parsed > 0) qty = parsed;
      }
      return { product: prod, quantity: qty };
    }
  }

  // 2. Fallback aliases for catalog items
  if (lower.includes('keyboard')) {
    const found = productList.find((p) => p.name.toLowerCase().includes('keyboard'));
    if (found) return { product: found, quantity: 1 };
  }
  if (lower.includes('monitor')) {
    const found = productList.find((p) => p.name.toLowerCase().includes('monitor'));
    if (found) return { product: found, quantity: 1 };
  }
  if (lower.includes('cabling') || lower.includes('onsite') || lower.includes('deployment') || lower.includes('setup')) {
    const found = productList.find((p) => p.name.toLowerCase().includes('setup') || p.name.toLowerCase().includes('deployment'));
    if (found) return { product: found, quantity: 1 };
  }

  return null;
};

// ─── ProductPicker Dropdown ────────────────────────────────────────────────
function ProductPicker({ products: initialProducts, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState(initialProducts || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const params = {};
        if (search && search.trim()) {
          params.search = search.trim();
        }
        const res = await productsAPI.getAll(params);
        const list = Array.isArray(res) ? res : res?.products || [];
        setItems(list);
      } catch (err) {
        console.error('Failed to search products from database:', err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border-2 border-slate-900 rounded-3xl shadow-pop-xl flex flex-col max-h-[70vh] text-slate-900 overflow-hidden">
        <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex items-center gap-2.5">
          {loading ? (
            <Loader2 className="w-4 h-4 text-violet-600 animate-spin shrink-0" strokeWidth={2.5} />
          ) : (
            <Search className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={2.5} />
          )}
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products in database by name, SKU, or description..."
            className="flex-1 bg-transparent text-sm font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1 rounded-xl hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 p-2">
          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-heading font-bold">
              {loading ? 'Searching database...' : 'No products found'}
            </div>
          ) : (
            items.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); onClose(); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl hover:bg-amber-50/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-100 border-2 border-slate-900 flex items-center justify-center shrink-0 shadow-pop-xs">
                  <ShoppingBag className="w-4 h-4 text-violet-700" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-heading font-bold text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 font-mono font-bold">{p.sku}</div>
                </div>
                <div className="text-sm font-mono font-black text-slate-900 shrink-0">{formatINR(p.base_price)}</div>
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
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
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

  // Negotiation thread state
  const [negotiations, setNegotiations] = useState([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [actioningNegId, setActioningNegId] = useState(null);

  // Real-time Clock state for live updates
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sidebar collapsed state (from AppLayout)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Load Products & Customers ──────────────────────────────────────────────
  useEffect(() => {
    productsAPI.getAll({ active: true }).then((res) => {
      const arr = Array.isArray(res) ? res : [];
      setProducts(arr.filter((p) => p.is_active));
    }).catch(() => {
      toast.error('Could not load product catalog');
    }).finally(() => setLoadingProducts(false));

    usersAPI.getAll({ role: 'CUSTOMER' }).then((res) => {
      const arr = Array.isArray(res) ? res : [];
      setCustomers(arr);
    }).catch((err) => {
      console.error('Could not load customers', err);
    });
  }, []);

  // ── Load Existing Quotation ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const cleanId = id.trim().replace(/\s+/g, '-');

    const loadQuotation = async () => {
      setLoading(true);
      try {
        const q = await quotationsAPI.getOne(cleanId);
        setQuotation(q);
        setNegotiations(q.negotiations || []);
        setCustomerId(q.customer_id || q.customerId || q.customer?.id || '');
        setCustomerTier(q.customer_tier || q.customerTier || 'BRONZE');
        setRepNotes(q.rep_notes || q.repNotes || '');
        let expStr = '';
        if (q.expiry_date || q.expiryDate) {
          try {
            expStr = new Date(q.expiry_date || q.expiryDate).toISOString().split('T')[0];
          } catch (e) {
            expStr = '';
          }
        }
        setExpiryDate(expStr);

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
    customerId: customerId || null,
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
        toast.success(`Quotation ${saved.quotationNumber || ''} created!`);
        navigate(`/quotations/${saved.id}`);
      } else {
        saved = await quotationsAPI.update(id, payload);
        setQuotation(saved);
        toast.success('Quotation saved successfully');
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
      toast.success('Submitted for approval routing!', { duration: 4000 });
      navigate('/pipeline');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit quotation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNegotiatedProduct = async (detected, discountVal, autoSave = true) => {
    if (!detected || !detected.product) return;
    const { product: prod, quantity: qty } = detected;

    const disc = discountVal !== undefined && discountVal !== null ? Number(discountVal) : 0;
    const newLine = {
      _id: genId(),
      product_id: prod.id,
      product: prod,
      line_type: prod.is_subscription ? 'RECURRING' : 'ONE_TIME',
      quantity: Number(qty || 1),
      unit_price: Number(prod.base_price || 0),
      cost_price: Number(prod.cost_price || 0),
      discount: disc,
      tax: Number(prod.tax || 18),
      notes: 'Added via accepted customer negotiation request',
    };

    const existingValid = lines.filter((l) => l.product_id);
    const adjustedExisting = discountVal !== undefined && discountVal !== null
      ? existingValid.map((l) => ({ ...l, discount: Number(discountVal) }))
      : existingValid;
    const updatedLines = [...adjustedExisting, newLine];
    setLines(updatedLines);

    if (autoSave && id) {
      try {
        const cleanId = id.trim().replace(/\s+/g, '-');
        const savePayload = {
          customerId,
          customerTier,
          expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
          repNotes,
          lines: updatedLines.map((l) => ({
            productId: l.product_id,
            lineType: l.line_type,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unit_price),
            costPrice: Number(l.cost_price),
            discount: Number(l.discount),
            tax: Number(l.tax),
            notes: l.notes || null,
          })),
        };
        await quotationsAPI.update(cleanId, savePayload);
        const refreshed = await quotationsAPI.getOne(cleanId);
        setQuotation(refreshed);
        toast.success(`Added ${qty}x ${prod.name} to order lines & saved!`);
      } catch (err) {
        console.error('Failed to auto-save added product line:', err);
        toast.success(`Added ${qty}x ${prod.name} to order lines (click Save Draft to commit)`);
      }
    } else {
      toast.success(`Added ${qty}x ${prod.name} to order lines!`);
    }
  };

  const handleNegotiationDecision = async (negId, decisionStatus, discountVal, detectedProduct = null) => {
    setActioningNegId(negId);
    try {
      await negotiationsAPI.respond(negId, {
        status: decisionStatus,
        notes: `${decisionStatus === 'ACCEPTED' ? 'Accepted' : 'Declined'} by sales operations.`
      });
      toast.success(`Negotiation counter-offer ${decisionStatus.toLowerCase()}!`);
      // Update local negotiation status
      setNegotiations((prev) =>
        prev.map((n) => (n.id === negId ? { ...n, status: decisionStatus } : n))
      );

      // If accepted and customer requested a product, automatically add it into order lines!
      if (decisionStatus === 'ACCEPTED' && detectedProduct) {
        await handleAddNegotiatedProduct(detectedProduct, discountVal, true);
      } else if (decisionStatus === 'ACCEPTED' && discountVal !== undefined && discountVal !== null) {
        // If accepted discount only, apply discount to line items
        setLines((prev) =>
          prev.map((l) => ({
            ...l,
            discount: Number(discountVal),
          }))
        );
      }

      // Refresh quotation data from database
      if (id) {
        const cleanId = id.trim().replace(/\s+/g, '-');
        const updated = await quotationsAPI.getOne(cleanId);
        setQuotation(updated);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update negotiation');
    } finally {
      setActioningNegId(null);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !id) return;
    setSendingReply(true);
    const cleanId = id.trim().replace(/\s+/g, '-');
    try {
      const payload = {
        message: replyMessage.trim(),
        requestedBy: 'SALES_REP',
      };
      await negotiationsAPI.submit(quotation?.id || cleanId, payload);
      toast.success('Response sent to customer portal!');
      setReplyMessage('');
      try {
        const negRes = await negotiationsAPI.getAll(quotation?.id || cleanId);
        const list = Array.isArray(negRes) ? negRes : (negRes?.data || []);
        setNegotiations(list);
      } catch {
        const q = await quotationsAPI.getOne(cleanId);
        setNegotiations(q.negotiations || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSendingReply(false);
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
  const isNegotiating = status === 'UNDER_NEGOTIATION' || status === 'NEGOTIATING';
  const canEdit = isDraft || isNegotiating || status === 'REJECTED';
  const canSubmit = (isDraft || isNegotiating) && lines.filter((l) => l.product_id).length > 0;
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
    <div className="space-y-6 pb-12">
      {/* ── TOP HEADER BAR ───────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border-2 border-slate-900 shadow-pop">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 font-heading tracking-tight flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-violet-100 border-2 border-slate-900 flex items-center justify-center text-violet-700 shadow-pop-sm">
                <Layers className="w-5 h-5" strokeWidth={2.5} />
              </span>
              {isNew ? 'New Quotation' : `Quotation: ${quotation?.quotation_number || quotation?.quotationNumber || id}`}
            </h1>
            {status && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-sm uppercase">
                {status}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-600 mt-1 pl-12">
            Build your CPQ deal — margins, tier pricing, and risk auto-update in real-time
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* PDF Download (non-draft only) */}
          {canDownloadPDF && (
            <button
              onClick={() => {
                const token = useAuthStore.getState().accessToken;
                window.open(`http://localhost:5000/api/quotations/${id}/pdf?token=${token}`, '_blank');
              }}
              className="px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 shadow-pop-sm hover:shadow-pop text-xs font-heading font-bold flex items-center gap-1.5 transition-all"
              title="Download PDF"
            >
              <Download className="w-4 h-4 text-violet-700" strokeWidth={2.5} />
              <span>Download PDF</span>
            </button>
          )}

          {/* Save Draft */}
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 shadow-pop-sm hover:shadow-pop text-xs font-heading font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-slate-700" strokeWidth={2.5} />}
              <span>Save Draft</span>
            </button>
          )}

          {/* Submit for Approval */}
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-candy px-5 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-heading font-bold flex items-center gap-2 border-2 border-slate-900 shadow-pop transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2.5} />}
              <span>Submit for Approval</span>
            </button>
          )}
        </div>
      </div>

      {/* ── QUOTATION META ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customer Account */}
        <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl p-4">
          <label className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
            <span className="w-6 h-6 rounded-lg bg-violet-100 border border-slate-900 flex items-center justify-center text-violet-800">
              <Building className="w-3.5 h-3.5" strokeWidth={2.5} />
            </span>
            Target Customer
          </label>
          <select
            value={customerId}
            onChange={(e) => {
              const selectedId = e.target.value;
              setCustomerId(selectedId);
              const found = customers.find((c) => c.id === selectedId);
              if (found?.customer_tier) {
                setCustomerTier(found.customer_tier);
              }
            }}
            disabled={!canEdit}
            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-2.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm disabled:opacity-50 transition-all truncate"
          >
            <option value="">-- Direct Customer Account --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name || c.name} ({c.name})
              </option>
            ))}
          </select>
        </div>

        {/* Customer Tier */}
        <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl p-4">
          <label className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
            <span className="w-6 h-6 rounded-lg bg-amber-100 border border-slate-900 flex items-center justify-center text-amber-800">
              <User className="w-3.5 h-3.5" strokeWidth={2.5} />
            </span>
            Customer Tier
          </label>
          <select
            value={customerTier}
            onChange={(e) => setCustomerTier(e.target.value)}
            disabled={!canEdit}
            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-2.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm disabled:opacity-50 transition-all"
          >
            <option value="BRONZE">Bronze — Standard Pricing</option>
            <option value="SILVER">Silver — Preferred Rates</option>
            <option value="GOLD">Gold — VIP Pricing</option>
          </select>
        </div>

        {/* Expiry Date */}
        <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl p-5">
          <label className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-lg bg-sky-100 border border-slate-900 flex items-center justify-center text-sky-800">
              <Calendar className="w-3.5 h-3.5" strokeWidth={2.5} />
            </span>
            Valid Until (Expiry)
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={!canEdit}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm disabled:opacity-50 transition-all"
          />
        </div>

        {/* Risk Summary from API */}
        <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 border border-slate-900 flex items-center justify-center text-emerald-800">
                <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
              Deal Intelligence
            </label>
            {computingRisk && <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />}
          </div>
          {riskData ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-heading font-bold text-slate-500">Risk Score</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded-md border border-slate-900 shadow-pop-sm ${riskData.blendedRiskScore < 5
                      ? 'bg-emerald-100 text-emerald-900'
                      : riskData.blendedRiskScore < 10
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                >
                  {Number(riskData.blendedRiskScore || 0).toFixed(2)} / 15
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-heading font-bold text-slate-500">Approval Route</span>
                <div>
                  {riskData.approvalRequired === 'NONE' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-900 font-heading font-bold text-[11px] bg-emerald-100 text-emerald-900">
                      <CheckCircle2 size={12} strokeWidth={2.5} /> Auto
                    </span>
                  ) : riskData.approvalRequired === 'MANAGER_ONLY' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-900 font-heading font-bold text-[11px] bg-amber-100 text-amber-900">
                      <AlertTriangle size={12} strokeWidth={2.5} /> Manager
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-900 font-heading font-bold text-[11px] bg-rose-100 text-rose-900">
                      <ShieldAlert size={12} strokeWidth={2.5} /> Mgr + Finance
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500">
              {lines.filter((l) => l.product_id).length
                ? 'Computing risk metrics...'
                : 'Add products to compute deal intelligence'}
            </p>
          )}
        </div>
      </div>

      {/* ── CUSTOMER PORTAL NEGOTIATION ROOM ────────────────────────────── */}
      {negotiations && negotiations.length > 0 && (
        <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b-2 border-slate-900 bg-amber-50 gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-200 border-2 border-slate-900 flex items-center justify-center text-amber-900 shadow-pop-xs">
                <MessageSquare className="w-4 h-4" strokeWidth={2.5} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900 font-heading">
                    Customer Portal Negotiation Room
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-300 text-amber-950 border border-slate-900 shadow-pop-xs">
                    {negotiations.length} {negotiations.length === 1 ? 'Message' : 'Messages'}
                  </span>
                  {(quotation?.status === 'UNDER_NEGOTIATION' || negotiations.some((n) => (n.status || '').toUpperCase() === 'PENDING')) && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-black bg-purple-600 text-white border border-slate-900 shadow-pop-xs flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      Pending Counter-Offer
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-slate-600">
                  Live counter-offers, requested line additions, and discount proposals from the client portal
                </p>
              </div>
            </div>

            {/* Real-time Live Date & Clock */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-slate-900 bg-white shadow-pop-xs">
              <Clock className="w-3.5 h-3.5 text-violet-700 animate-spin" style={{ animationDuration: '10s' }} />
              <span className="text-[11px] font-heading font-extrabold text-slate-800">
                {currentTime.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span className="text-[11px] font-mono font-black text-violet-800 px-2 py-0.5 bg-violet-100 border border-slate-900 rounded-full">
                {currentTime.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>
          </div>

          {/* Negotiation Items List */}
          <div className="p-5 space-y-3 bg-slate-50/50">
            {negotiations.map((neg, idx) => {
              const isPending = (neg.status || '').toUpperCase() === 'PENDING';
              const isAccepted = (neg.status || '').toUpperCase() === 'ACCEPTED';
              const isCustomer = (neg.requested_by || '').toUpperCase().includes('CUSTOMER');
              const detected = detectProductInNegotiation(neg.message, products);
              const isAlreadyInLines = detected && lines.some((l) => l.product_id === detected.product.id);

              return (
                <div
                  key={neg.id || idx}
                  className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-pop-sm flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-heading font-black border border-slate-900 ${isCustomer ? 'bg-indigo-100 text-indigo-900' : 'bg-emerald-100 text-emerald-900'
                          }`}
                      >
                        {isCustomer ? 'Customer Request' : 'Sales Team Response'}
                      </span>

                      {neg.counter_discount !== null && neg.counter_discount !== undefined && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-purple-100 text-purple-900 border border-slate-900">
                          Requested Discount: {neg.counter_discount}%
                        </span>
                      )}

                      {detected && (
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-heading font-black bg-amber-100 text-amber-900 border border-slate-900 flex items-center gap-1.5 shadow-pop-xs">
                          <ShoppingBag className="w-3 h-3 text-amber-800" strokeWidth={2.5} />
                          <span>Add-on: {detected.quantity}x {detected.product.name} ({formatINR(detected.product.base_price)})</span>
                          {isAlreadyInLines && (
                            <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-800 font-bold ml-1 flex items-center gap-0.5">
                              <CheckCircle2 size={10} strokeWidth={3} /> In Order Lines
                            </span>
                          )}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white text-slate-800 border border-slate-900 shadow-pop-xs">
                        <Clock className="w-3 h-3 text-violet-700" strokeWidth={2.5} />
                        <span>
                          {neg.created_at
                            ? new Date(neg.created_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                            : ''}
                        </span>
                        {neg.created_at && (
                          <span className="text-violet-700 font-black ml-0.5">
                            • {formatTimeAgo(neg.created_at)}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="text-xs font-heading font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
                      {neg.message}
                    </div>
                  </div>

                  {/* Status & Decision Actions */}
                  <div className="flex flex-col sm:flex-row md:flex-col items-end gap-2 shrink-0">
                    {isPending ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleNegotiationDecision(neg.id, 'ACCEPTED', neg.counter_discount, detected)}
                          disabled={actioningNegId === neg.id}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-slate-900 shadow-pop-xs text-xs font-heading font-black flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                          title={detected ? `Accept proposal and add ${detected.product.name} to order lines` : 'Accept customer proposal'}
                        >
                          {actioningNegId === neg.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          )}
                          <span>{detected ? `Accept & Add ${detected.product.name}` : 'Accept'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNegotiationDecision(neg.id, 'REJECTED')}
                          disabled={actioningNegId === neg.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border-2 border-slate-900 shadow-pop-xs text-xs font-heading font-black flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                          title="Decline counter proposal"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={3} />
                          <span>Decline</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs ${isAccepted
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-rose-100 text-rose-900'
                            }`}
                        >
                          {neg.status}
                        </span>

                        {detected && !isAlreadyInLines && (
                          <button
                            type="button"
                            onClick={() => handleAddNegotiatedProduct(detected, neg.counter_discount, true)}
                            className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white border-2 border-slate-900 shadow-pop-xs text-xs font-heading font-black flex items-center gap-1.5 transition-all cursor-pointer"
                            title={`Add ${detected.product.name} to order lines`}
                          >
                            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                            <span> Add {detected.product.name} to Order</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Reply Box to Portal */}
          <div className="p-4 bg-white border-t-2 border-slate-900">
            <form onSubmit={handleSendReply} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Reply directly to customer portal (e.g., 'Added Mechanical Keyboard and approved 17% discount')..."
                className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
              />
              <button
                type="submit"
                disabled={sendingReply || !replyMessage.trim()}
                className="btn-candy px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-heading font-black flex items-center justify-center gap-1.5 border-2 border-slate-900 shadow-pop transition-all disabled:opacity-50 shrink-0"
              >
                {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2.5} />}
                <span>Send to Portal</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── ORDER LINES ──────────────────────────────────────────────────── */}
      <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-900 bg-slate-50">
          <h2 className="text-base font-extrabold text-slate-900 font-heading flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-violet-100 border border-slate-900 flex items-center justify-center text-violet-700">
              <Layers className="w-4 h-4" strokeWidth={2.5} />
            </span>
            <span>Order Lines</span>
            <span className="ml-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white text-slate-800 border-2 border-slate-900 shadow-pop-sm">
              {lines.filter((l) => l.product_id).length} / {lines.length}
            </span>
          </h2>
          {canEdit && (
            <button
              onClick={handleAddLine}
              className="btn-candy px-4 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-heading font-bold text-xs flex items-center gap-1.5 border-2 border-slate-900 shadow-pop-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>Add Line</span>
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b-2 border-slate-900 text-[11px] font-heading font-extrabold text-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-3 text-center">Type</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-center">Disc %</th>
                <th className="py-3 px-3 text-center">Tax %</th>
                <th className="py-3 px-3 text-right">Line Total</th>
                <th className="py-3 px-3 text-center">Margin</th>
                {canEdit && <th className="py-3 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {lines.map((line, idx) => {
                const { lineTotal, margin } = lineTotals[idx] || { lineTotal: 0, margin: 0 };
                const marginColor =
                  margin >= 25
                    ? 'text-emerald-700 bg-emerald-100 border-emerald-900'
                    : margin >= 15
                      ? 'text-amber-700 bg-amber-100 border-amber-900'
                      : 'text-rose-700 bg-rose-100 border-rose-900';
                const discExcessive = line.discount > 15;

                return (
                  <tr key={line._id} className={`hover:bg-amber-50/50 transition-colors ${discExcessive ? 'bg-amber-50/70' : ''}`}>
                    {/* Product Cell */}
                    <td className="py-3.5 px-4">
                      {line.product ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-violet-100 border-2 border-slate-900 flex items-center justify-center shrink-0 shadow-pop-sm">
                            <ShoppingBag className="w-4 h-4 text-violet-700" strokeWidth={2.5} />
                          </div>
                          <div>
                            <div className="font-heading font-bold text-slate-900">{line.product.name}</div>
                            <div className="text-[10px] font-mono font-bold text-slate-500">{line.product.sku}</div>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => {
                                setPickerTargetLineId(line._id);
                                setShowPicker(true);
                              }}
                              className="ml-1 p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                              title="Change product"
                            >
                              <RefreshCw className="w-3 h-3" strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPickerTargetLineId(line._id);
                            setShowPicker(true);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-dashed border-slate-400 hover:border-slate-900 hover:bg-violet-50 text-slate-600 hover:text-slate-900 font-heading font-bold transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                          <span>Select product...</span>
                        </button>
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-3 text-center">
                      <select
                        value={line.line_type}
                        onChange={(e) => handleLineChange(line._id, 'line_type', e.target.value)}
                        disabled={!canEdit}
                        className="bg-slate-50 border-2 border-slate-900 rounded-lg px-2 py-1 text-[11px] font-heading font-bold text-slate-800 focus:bg-white focus:outline-none disabled:opacity-50"
                      >
                        <option value="ONE_TIME">One-Time</option>
                        <option value="SUBSCRIPTION">Recurring</option>
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(line._id, 'quantity', Math.max(1, Number(e.target.value)))
                        }
                        disabled={!canEdit}
                        className="w-16 bg-slate-50 border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 text-center focus:bg-white focus:outline-none disabled:opacity-50"
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="py-3.5 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unit_price}
                        onChange={(e) =>
                          handleLineChange(line._id, 'unit_price', Number(e.target.value))
                        }
                        disabled={!canEdit}
                        className="w-28 bg-slate-50 border-2 border-slate-900 rounded-lg px-2 py-1 text-xs text-slate-900 text-right focus:bg-white focus:outline-none disabled:opacity-50 font-mono font-bold"
                      />
                    </td>

                    {/* Discount % */}
                    <td className="py-3.5 px-3 text-center">
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
                          className={`w-16 bg-slate-50 border-2 rounded-lg px-2 py-1 text-xs text-slate-900 text-center focus:bg-white focus:outline-none disabled:opacity-50 font-mono font-bold ${discExcessive ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-slate-900'
                            }`}
                        />
                        {discExcessive && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 absolute -right-4" strokeWidth={2.5} title="High discount — risk flagged" />
                        )}
                      </div>
                    </td>

                    {/* Tax % */}
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={line.tax}
                        onChange={(e) =>
                          handleLineChange(line._id, 'tax', Number(e.target.value))
                        }
                        disabled={!canEdit}
                        className="w-16 bg-slate-50 border-2 border-slate-900 rounded-lg px-2 py-1 text-xs text-slate-900 text-center focus:bg-white focus:outline-none disabled:opacity-50 font-mono font-bold"
                      />
                    </td>

                    {/* Line Total */}
                    <td className="py-3.5 px-3 text-right font-mono font-extrabold text-slate-900">
                      {formatINR(lineTotal)}
                    </td>

                    {/* Margin */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md border font-mono font-bold text-xs ${marginColor}`}>
                        {Number(margin || 0).toFixed(1)}%
                      </span>
                    </td>

                    {/* Remove */}
                    {canEdit && (
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleRemoveLine(line._id)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-slate-900 hover:bg-rose-100 text-slate-500 hover:text-rose-700 transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
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

      {/* ── LIVE MARGIN & DEAL METRICS PANEL (DOCKED) ───────────────────── */}
      <LiveMarginBar lines={lines} />

      {/* ── REP NOTES ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl p-5">
        <label className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-lg bg-pink-100 border border-slate-900 flex items-center justify-center text-pink-800">
            <StickyNote className="w-3.5 h-3.5" strokeWidth={2.5} />
          </span>
          Rep Notes (Visible to reviewers)
        </label>
        <textarea
          value={repNotes}
          onChange={(e) => setRepNotes(e.target.value)}
          disabled={!canEdit}
          placeholder="Add deal context, special pricing justification, or strategic background..."
          rows={3}
          className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl p-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:shadow-pop-sm disabled:opacity-50 resize-none transition-all"
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
    </div>
  );
}
