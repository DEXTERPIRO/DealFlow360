import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Truck,
  SplitSquareHorizontal,
  RefreshCw,
  Edit3,
  X,
  Layers,
  Boxes,
  CircleDot,
  ShieldCheck,
  Search,
  Check,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { fulfillmentAPI, quotationsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

// ─── Formatters & Style Constants ──────────────────────────────────────────

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const STATUS_CONFIG = {
  PENDING_FULFILLMENT: {
    label: 'Pending Fulfillment',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  PARTIALLY_FULFILLED: {
    label: 'Partially Fulfilled',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  FULFILLED: {
    label: 'Fulfilled',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
};

const getStockBadgeStyle = (available) => {
  if (available <= 0) {
    return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
  }
  if (available < 10) {
    return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  }
  return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
};

// ─── Sub-Component: Quotation Left Card ─────────────────────────────────────

function QuotationCard({ q, isSelected, onClick }) {
  const lines = q.lines || [];
  const physicalLines = lines.filter(
    (l) => (l.lineType || l.line_type) !== 'SUBSCRIPTION'
  );
  const totalQtyNeeded = physicalLines.reduce((acc, l) => acc + (l.quantity || 0), 0);

  // Derive fulfillment status based on fulfillments if available
  let statusKey = 'PENDING_FULFILLMENT';
  if (q.fulfillments && q.fulfillments.length > 0) {
    const allFulfilled = q.fulfillments.every(
      (f) => f.status === 'FULFILLED' || (f.quantity_fulfilled >= f.quantity_needed)
    );
    const anyFulfilled = q.fulfillments.some(
      (f) => f.status === 'FULFILLED' || f.quantity_fulfilled > 0
    );
    if (allFulfilled) statusKey = 'FULFILLED';
    else if (anyFulfilled) statusKey = 'PARTIALLY_FULFILLED';
  } else if (q.status === 'CONFIRMED' || q.status === 'APPROVED') {
    statusKey = 'PENDING_FULFILLMENT';
  }

  const statusMeta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.PENDING_FULFILLMENT;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`group relative rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
          : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
          {q.quotationNumber || q.quotation_number || `QT-${q.id.slice(0, 8)}`}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
          {statusMeta.label}
        </span>
      </div>

      <p className="text-sm font-medium text-slate-200 truncate">
        {q.customer?.name || q.customer?.company_name || 'Direct Customer'}
      </p>
      {q.customer?.company_name && (
        <p className="text-xs text-slate-400 truncate">{q.customer.company_name}</p>
      )}

      <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Layers size={13} className="text-slate-500" />
            <span>
              {physicalLines.length} {physicalLines.length === 1 ? 'item' : 'items'}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Boxes size={13} className="text-slate-500" />
            <span>{totalQtyNeeded} units</span>
          </span>
        </div>
        <span className="font-semibold text-slate-300">
          {formatINR(q.total || q.totalAmount || 0)}
        </span>
      </div>
    </div>
  );
}

// ─── Sub-Component: Manual Override Modal ───────────────────────────────────

function ManualOverrideModal({
  lines,
  warehouses,
  onClose,
  onApply,
}) {
  // Structure: { [productId]: { [warehouseId]: quantity } }
  const [allocation, setAllocation] = useState(() => {
    const init = {};
    lines.forEach((l) => {
      const pid = l.product_id || l.productId;
      init[pid] = {};
    });
    return init;
  });

  const handleQtyChange = (productId, warehouseId, val) => {
    const parsed = Math.max(0, parseInt(val, 10) || 0);
    setAllocation((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [warehouseId]: parsed,
      },
    }));
  };

  const handleSave = () => {
    onApply(allocation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Edit3 size={18} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Manual Warehouse Assignment</h3>
              <p className="text-xs text-slate-400">
                Override smart split algorithm and assign warehouse quantities manually
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {lines.map((line) => {
            const pid = line.product_id || line.productId;
            const productName = line.product?.name || line.productName || 'Product';
            const neededQty = line.quantity || 0;
            const currentAlloc = allocation[pid] || {};
            const totalAssigned = Object.values(currentAlloc).reduce((sum, v) => sum + (v || 0), 0);
            const remaining = neededQty - totalAssigned;

            return (
              <div
                key={line.id || pid}
                className="rounded-xl border border-slate-800 bg-slate-800/30 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{productName}</h4>
                    <p className="text-xs text-slate-400">
                      Total Needed:{' '}
                      <span className="font-mono font-bold text-slate-200">{neededQty}</span> units
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        remaining === 0
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : remaining > 0
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {remaining === 0
                        ? 'Fully Allocated'
                        : remaining > 0
                        ? `${remaining} unassigned`
                        : `${Math.abs(remaining)} over-assigned`}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/60">
                  {warehouses.map((wh) => {
                    const stockRecord = (wh.stocks || []).find((s) => s.product_id === pid);
                    const inStock = stockRecord?.quantity || 0;
                    const reserved = stockRecord?.reserved || 0;
                    const available = Math.max(0, inStock - reserved);
                    const assignedVal = currentAlloc[wh.id] ?? '';

                    return (
                      <div
                        key={wh.id}
                        className="flex items-center justify-between gap-3 bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/60"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 truncate">{wh.name}</p>
                          <p className="text-[11px] text-slate-500">
                            Available:{' '}
                            <span
                              className={`font-semibold ${
                                available > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {available}
                            </span>{' '}
                            units · Shipping: {formatINR(wh.shipping_cost || 0)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={available || 9999}
                            value={assignedVal}
                            onChange={(e) => handleQtyChange(pid, wh.id, e.target.value)}
                            placeholder="0"
                            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white text-right focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                          <span className="text-xs text-slate-400">units</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all"
          >
            Apply Allocation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Component: Stock Update Modal ──────────────────────────────────────

function StockUpdateModal({ entry, onClose, onUpdated }) {
  const [newQty, setNewQty] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newQty === '' || isNaN(newQty) || Number(newQty) < 0) {
      toast.error('Please enter a valid non-negative quantity');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for the stock update');
      return;
    }

    try {
      setSaving(true);
      await fulfillmentAPI.updateStock(entry.warehouseId, entry.productId, {
        quantity: parseInt(newQty, 10),
        reserved: entry.reserved || 0,
        reason: reason.trim(),
      });
      const updatedAvailable = parseInt(newQty, 10) - (entry.reserved || 0);
      toast.success(
        `Stock updated! New available: ${updatedAvailable} units (${entry.productName} @ ${entry.warehouseName})`
      );
      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Warehouse size={18} className="text-indigo-400" />
            <h3 className="text-base font-bold text-white">Stock Update</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3 space-y-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Warehouse (Locked)
              </p>
              <p className="text-sm font-semibold text-white">{entry.warehouseName}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Product (Locked)
              </p>
              <p className="text-sm font-semibold text-white">{entry.productName}</p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Current In Stock:</span>
              <span className="font-mono text-slate-300 font-bold">{entry.quantity} units</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Reserved:</span>
              <span className="font-mono text-slate-300 font-bold">{entry.reserved} units</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Available:</span>
              <span
                className={`font-mono font-bold ${
                  entry.available > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {entry.available} units
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              New In-Stock Quantity <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              required
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="e.g. 50"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for Update <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Shipment received from vendor, cycle count correction..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-all"
            >
              {saving ? 'Updating...' : 'Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Fulfillment Page Component ───────────────────────────────────────

export default function Fulfillment() {
  const { user } = useAuthStore();
  const canManageStock =
    user?.role === 'ADMIN' || user?.role === 'FINANCE' || user?.role === 'SALES_MANAGER';

  // Left panel state
  const [quotations, setQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);

  // Right panel quotation detail & split
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recommendedSplit, setRecommendedSplit] = useState([]);
  const [loadingSplit, setLoadingSplit] = useState(false);
  const [acceptingSplit, setAcceptingSplit] = useState(false);

  // Warehouse stock overview tab
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'stock'
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [stockModalEntry, setStockModalEntry] = useState(null);

  // ── 1. Fetch Quotations for Left Panel ───────────────────────────────────

  const loadQuotations = useCallback(async (q = searchQuery) => {
    try {
      setLoadingQuotations(true);
      const params = {};
      if (q && q.trim()) params.search = q.trim();
      const res = await quotationsAPI.getAll(params);
      const list = Array.isArray(res) ? res : res?.quotations || [];

      // Filter quotations that have confirmed or approved status, or have lines
      const eligible = list.filter(
        (item) =>
          item.status === 'CONFIRMED' ||
          item.status === 'APPROVED' ||
          item.status === 'SENT_TO_CUSTOMER'
      );
      setQuotations(eligible);

      // Auto-select first if none selected
      if (eligible.length > 0 && !selectedQuotationId) {
        setSelectedQuotationId(eligible[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load fulfillment quotations');
    } finally {
      setLoadingQuotations(false);
    }
  }, [selectedQuotationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQuotations(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, loadQuotations]);

  // ── 2. Fetch Warehouses for Stock Overview & Dropdowns ───────────────────

  const loadWarehouses = useCallback(async () => {
    try {
      setLoadingWarehouses(true);
      const res = await fulfillmentAPI.getWarehouseStock();
      const list = Array.isArray(res) ? res : res?.warehouses || [];
      setWarehouses(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warehouse stock details');
    } finally {
      setLoadingWarehouses(false);
    }
  }, []);

  // ── 3. Fetch Selected Quotation Details & Recommended Split ──────────────

  const loadQuotationData = useCallback(async (id) => {
    if (!id) return;
    try {
      setLoadingDetail(true);
      setLoadingSplit(true);

      const [quotationRes, splitRes] = await Promise.all([
        quotationsAPI.getOne(id),
        fulfillmentAPI.getSplit(id),
      ]);

      const qData = quotationRes?.quotation || quotationRes;
      setSelectedQuotation(qData);

      // Ensure split array
      const rawSplits = Array.isArray(splitRes) ? splitRes : splitRes?.splits || [];
      setRecommendedSplit(rawSplits);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load quotation split information');
    } finally {
      setLoadingDetail(false);
      setLoadingSplit(false);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    loadQuotations();
    loadWarehouses();
  }, [loadQuotations, loadWarehouses]);

  // Reload details whenever selection changes
  useEffect(() => {
    if (selectedQuotationId) {
      loadQuotationData(selectedQuotationId);
    }
  }, [selectedQuotationId, loadQuotationData]);

  // ── Database Queried Quotations ──────────────────────────────────────────
  const filteredQuotations = quotations;

  // Non-subscription lines for the active quotation
  const physicalLines = useMemo(() => {
    if (!selectedQuotation?.lines) return [];
    return selectedQuotation.lines.filter(
      (l) => (l.lineType || l.line_type) !== 'SUBSCRIPTION'
    );
  }, [selectedQuotation]);

  // ── Shipping & Split Computations ────────────────────────────────────────

  // Match each split entry with product name from lines
  const enrichedSplit = useMemo(() => {
    if (!recommendedSplit || recommendedSplit.length === 0) return [];
    return recommendedSplit.map((s) => {
      const matchingLine = physicalLines.find(
        (l) => (l.product_id || l.productId) === s.productId
      );
      return {
        ...s,
        productName:
          s.productName || matchingLine?.product?.name || matchingLine?.productName || 'Product',
      };
    });
  }, [recommendedSplit, physicalLines]);

  const uniqueWarehouses = useMemo(() => {
    const ids = enrichedSplit
      .filter((s) => s.warehouseId && !s.isBackorder && s.status !== 'BACKORDERED')
      .map((s) => s.warehouseId);
    return [...new Set(ids)];
  }, [enrichedSplit]);

  const totalShipments = uniqueWarehouses.length;
  const estShippingCost = enrichedSplit.reduce(
    (sum, s) => sum + (s.shippingCost || 0),
    0
  );

  const backorderItems = useMemo(() => {
    return enrichedSplit.filter(
      (s) => s.isBackorder || s.status === 'BACKORDERED' || !s.warehouseId
    );
  }, [enrichedSplit]);

  const hasBackorder = backorderItems.length > 0;
  const totalBackorderUnits = backorderItems.reduce((sum, s) => sum + (s.quantity || 0), 0);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAcceptSplit = async () => {
    if (!selectedQuotationId) return;
    try {
      setAcceptingSplit(true);
      await fulfillmentAPI.acceptSplit(selectedQuotationId);
      const whCount = Math.max(1, totalShipments);
      toast.success(
        `Stock reserved across ${whCount} warehouse${whCount === 1 ? '' : 's'}`
      );
      // Refresh details and warehouse stock
      await Promise.all([
        loadQuotationData(selectedQuotationId),
        loadWarehouses(),
        loadQuotations(),
      ]);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to accept split');
    } finally {
      setAcceptingSplit(false);
    }
  };

  const handleManualApply = (allocation) => {
    // Generate new mock recommended split from manual allocations
    const newSplits = [];
    Object.entries(allocation).forEach(([productId, whMap]) => {
      const line = physicalLines.find(
        (l) => (l.product_id || l.productId) === productId
      );
      const needed = line?.quantity || 0;
      let totalAllocated = 0;

      Object.entries(whMap).forEach(([warehouseId, qty]) => {
        if (qty > 0) {
          totalAllocated += qty;
          const wh = warehouses.find((w) => w.id === warehouseId);
          newSplits.push({
            productId,
            productName: line?.product?.name || 'Product',
            warehouseId,
            warehouseName: wh?.name || 'Warehouse',
            quantity: qty,
            shippingCost: Number(wh?.shipping_cost || 0),
            isBackorder: false,
            status: 'PENDING',
          });
        }
      });

      if (totalAllocated < needed) {
        newSplits.push({
          productId,
          productName: line?.product?.name || 'Product',
          warehouseId: null,
          warehouseName: 'Backorder (Manual Allocation)',
          quantity: needed - totalAllocated,
          shippingCost: 0,
          isBackorder: true,
          status: 'BACKORDERED',
        });
      }
    });

    setRecommendedSplit(newSplits);
    toast.success('Manual split allocation applied to preview');
  };

  const handleMarkAsBackorder = (productName) => {
    toast.success(`Marked backorder for ${productName}. Stock alert logged.`);
  };

  // Flatten warehouse stock overview
  const flattenedStock = useMemo(() => {
    const list = [];
    warehouses.forEach((wh) => {
      (wh.stocks || []).forEach((st) => {
        const qty = st.quantity || 0;
        const res = st.reserved || 0;
        const avail = qty - res;
        list.push({
          warehouseId: wh.id,
          warehouseName: wh.name,
          productId: st.product_id,
          productName: st.product?.name || 'Product',
          quantity: qty,
          reserved: res,
          available: avail,
        });
      });
    });
    return list;
  }, [warehouses]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* ═════════════════════════════════════════════════════════════════════
          LEFT PANEL: Quotation Selector
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-80 md:w-96 flex-shrink-0 border-r border-slate-800/80 bg-slate-900/40 flex flex-col">
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Truck size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Fulfillment Queue</h2>
                <p className="text-[11px] text-slate-400">Quotations pending fulfillment</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-slate-300">
              {filteredQuotations.length}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search QT or customer..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Quotations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loadingQuotations ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl border border-slate-800/60 bg-slate-900/40 animate-pulse"
              />
            ))
          ) : filteredQuotations.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Package size={36} className="mx-auto text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No quotations found</p>
              <p className="text-xs text-slate-600 mt-1">
                Approved or confirmed quotations needing warehouse fulfillment will appear here.
              </p>
            </div>
          ) : (
            filteredQuotations.map((q) => (
              <QuotationCard
                key={q.id}
                q={q}
                isSelected={selectedQuotationId === q.id}
                onClick={() => setSelectedQuotationId(q.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ═════════════════════════════════════════════════════════════════════
          RIGHT PANEL: Fulfillment Detail & Warehouses
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto flex flex-col bg-slate-950">
        {!selectedQuotationId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-indigo-400 mb-4 shadow-xl">
              <SplitSquareHorizontal size={36} />
            </div>
            <h3 className="text-lg font-bold text-white">Select a Quotation</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Choose an approved quotation from the left queue to compute intelligent warehouse split
              and reserve stock.
            </p>
          </div>
        ) : loadingDetail ? (
          <div className="p-8 space-y-6 animate-pulse">
            <div className="h-28 rounded-2xl bg-slate-900 border border-slate-800" />
            <div className="h-44 rounded-2xl bg-slate-900 border border-slate-800" />
            <div className="h-64 rounded-2xl bg-slate-900 border border-slate-800" />
          </div>
        ) : selectedQuotation ? (
          <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  onClick={() => setActiveTab('split')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'split'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SplitSquareHorizontal size={14} />
                  Fulfillment & Split
                </button>
                <button
                  onClick={() => setActiveTab('stock')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'stock'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Warehouse size={14} />
                  Warehouse Stock Overview
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadQuotationData(selectedQuotationId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
                >
                  <RefreshCw size={13} className={loadingSplit ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {/* TAB 1: SPLIT DETAILS */}
            {activeTab === 'split' && (
              <div className="space-y-6">
                {/* 1. QUOTATION SUMMARY */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="font-mono text-xl font-extrabold text-white">
                          {selectedQuotation.quotationNumber ||
                            selectedQuotation.quotation_number ||
                            `QT-${selectedQuotation.id.slice(0, 8)}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                          {selectedQuotation.customer_tier ||
                            selectedQuotation.customerTier ||
                            'BRONZE'}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-slate-200">
                        {selectedQuotation.customer?.name || 'Direct Customer'}
                      </p>
                      {selectedQuotation.customer?.company_name && (
                        <p className="text-xs text-slate-400">
                          {selectedQuotation.customer.company_name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                          Sales Representative
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {selectedQuotation.rep?.name || 'Unassigned'}
                        </p>
                      </div>
                      <div className="text-right pl-6 border-l border-slate-800">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                          Total Value
                        </p>
                        <p className="text-2xl font-black text-emerald-400 font-mono">
                          {formatINR(
                            selectedQuotation.total || selectedQuotation.totalAmount || 0
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. ORDER LINES TABLE (Non-subscription only) */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
                  <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-indigo-400" />
                      <h3 className="text-sm font-bold text-white">Physical Order Lines</h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      Showing physical items only ({physicalLines.length} lines) · Subscriptions
                      excluded
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                          <th className="py-3 px-5 font-semibold">Product</th>
                          <th className="py-3 px-4 font-semibold text-center">Total Qty</th>
                          <th className="py-3 px-4 font-semibold text-center">Line Type</th>
                          <th className="py-3 px-4 font-semibold text-right">Unit Price</th>
                          <th className="py-3 px-5 font-semibold text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {physicalLines.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">
                              No physical lines in this quotation.
                            </td>
                          </tr>
                        ) : (
                          physicalLines.map((line) => {
                            const unitPrice = Number(line.unitPrice || line.unit_price || 0);
                            const lineTotal =
                              Number(line.lineTotal || line.line_total || 0) ||
                              unitPrice * (line.quantity || 0);

                            return (
                              <tr
                                key={line.id}
                                className="hover:bg-slate-800/30 transition-colors"
                              >
                                <td className="py-3.5 px-5 font-medium text-white">
                                  {line.product?.name || line.productName || 'Product'}
                                  {line.product?.sku && (
                                    <span className="block font-mono text-[11px] text-slate-500">
                                      SKU: {line.product.sku}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                                  {line.quantity}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300">
                                    {line.lineType || line.line_type || 'ONE_TIME'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                                  {formatINR(unitPrice)}
                                </td>
                                <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-200">
                                  {formatINR(lineTotal)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. BACKORDER BANNER (if hasBackorder) */}
                {hasBackorder && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-lg shadow-amber-500/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5">
                          <AlertTriangle size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-amber-300">
                            Backorder Notice: Stock Shortage Detected
                          </h4>
                          <p className="text-xs text-amber-200/80 mt-0.5">
                            {totalBackorderUnits} units across {backorderItems.length} items cannot be
                            fulfilled from available inventory.
                          </p>
                          <div className="mt-2 space-y-1">
                            {backorderItems.map((bo, idx) => (
                              <p key={idx} className="text-xs text-amber-300/90 font-medium">
                                • {bo.quantity} units of{' '}
                                <span className="font-bold">{bo.productName}</span> on backorder.
                                From Main Warehouse. Consolidate when stock arrives.
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          handleMarkAsBackorder(
                            backorderItems.map((b) => b.productName).join(', ')
                          )
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-colors flex-shrink-0"
                      >
                        Mark as Backorder
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. RECOMMENDED SPLIT SECTION */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>🏭</span> Smart Warehouse Split
                      </h3>
                      <p className="text-xs text-slate-400">
                        Multi-warehouse stock allocation automatically optimized by lowest shipping
                        cost
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Main WH
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Secondary WH
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Backorder
                      </span>
                    </div>
                  </div>

                  {/* Split Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                          <th className="py-3 px-5 font-semibold">Warehouse</th>
                          <th className="py-3 px-4 font-semibold">Product</th>
                          <th className="py-3 px-4 font-semibold text-center">Qty to Fulfill</th>
                          <th className="py-3 px-4 font-semibold text-right">Shipping Cost</th>
                          <th className="py-3 px-5 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {enrichedSplit.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500">
                              {loadingSplit
                                ? 'Calculating optimal warehouse split...'
                                : 'No split details available.'}
                            </td>
                          </tr>
                        ) : (
                          enrichedSplit.map((row, idx) => {
                            const isBackorder =
                              row.isBackorder ||
                              row.status === 'BACKORDERED' ||
                              !row.warehouseId;
                            const isMainWh =
                              !isBackorder &&
                              uniqueWarehouses.length > 0 &&
                              row.warehouseId === uniqueWarehouses[0];

                            // Color coding row styles
                            let rowClass = 'border-l-4 border-l-blue-500 bg-blue-500/5';
                            if (isBackorder) {
                              rowClass = 'border-l-4 border-l-amber-500 bg-amber-500/5';
                            } else if (isMainWh) {
                              rowClass = 'border-l-4 border-l-emerald-500 bg-emerald-500/5';
                            }

                            return (
                              <tr
                                key={idx}
                                className={`${rowClass} hover:bg-slate-800/40 transition-colors`}
                              >
                                <td className="py-3.5 px-5 font-semibold text-white">
                                  <div className="flex items-center gap-2">
                                    <Warehouse
                                      size={14}
                                      className={
                                        isBackorder
                                          ? 'text-amber-400'
                                          : isMainWh
                                          ? 'text-emerald-400'
                                          : 'text-blue-400'
                                      }
                                    />
                                    <span>
                                      {row.warehouseName || (isBackorder ? 'BACKORDER' : 'Warehouse')}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-medium text-slate-200">
                                  {row.productName}
                                </td>
                                <td className="py-3.5 px-4 text-center font-mono font-bold text-white text-sm">
                                  {row.quantity}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-300">
                                  {isBackorder ? '—' : formatINR(row.shippingCost || 0)}
                                </td>
                                <td className="py-3.5 px-5 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                      isBackorder
                                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    }`}
                                  >
                                    {isBackorder ? 'BACKORDER' : 'READY TO ALLOCATE'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SHIPPING SUMMARY AT BOTTOM OF SPLIT */}
                  <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-6 text-xs">
                      <div>
                        <span className="text-slate-400">Total Shipments:</span>{' '}
                        <span className="font-mono font-bold text-white text-sm">
                          {totalShipments}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-slate-800" />
                      <div>
                        <span className="text-slate-400">Est. Shipping Cost:</span>{' '}
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {formatINR(estShippingCost)}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-slate-800" />
                      <div>
                        <span className="text-slate-400">Has Backorder:</span>{' '}
                        <span
                          className={`font-semibold ${
                            hasBackorder ? 'text-amber-400' : 'text-slate-300'
                          }`}
                        >
                          {hasBackorder ? `Yes — ${totalBackorderUnits} units on backorder` : 'No'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsManualModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-600 text-slate-200 text-xs font-semibold transition-all"
                      >
                        <Edit3 size={14} className="text-indigo-400" />
                        ✎ Manual Override
                      </button>

                      <button
                        onClick={handleAcceptSplit}
                        disabled={acceptingSplit || enrichedSplit.length === 0}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Check size={15} />
                        {acceptingSplit ? 'Reserving Stock...' : '✓ Accept Suggested Split'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WAREHOUSE STOCK OVERVIEW */}
            {activeTab === 'stock' && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Warehouse size={16} className="text-indigo-400" />
                      Warehouse Stock Overview
                    </h3>
                    <p className="text-xs text-slate-400">
                      Live stock, reservations, and available quantity across all facilities
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Available &gt; 10
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Low Stock (&lt; 10)
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Out of Stock (0)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                        <th className="py-3 px-5 font-semibold">Warehouse</th>
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold text-center">In Stock</th>
                        <th className="py-3 px-4 font-semibold text-center">Reserved</th>
                        <th className="py-3 px-4 font-semibold text-center">Available</th>
                        <th className="py-3 px-5 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {loadingWarehouses ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Loading warehouse stock data...
                          </td>
                        </tr>
                      ) : flattenedStock.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No warehouse stock records found.
                          </td>
                        </tr>
                      ) : (
                        flattenedStock.map((entry, idx) => {
                          const stockStyle = getStockBadgeStyle(entry.available);

                          return (
                            <tr
                              key={`${entry.warehouseId}-${entry.productId}-${idx}`}
                              className="hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="py-3.5 px-5 font-semibold text-white">
                                {entry.warehouseName}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-200">
                                {entry.productName}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                                {entry.quantity}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                                {entry.reserved}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-block px-3 py-0.5 rounded-full font-mono font-bold text-xs ${stockStyle}`}
                                >
                                  {entry.available}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                {canManageStock ? (
                                  <button
                                    onClick={() => setStockModalEntry(entry)}
                                    className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-slate-600 text-xs text-white font-medium transition-colors"
                                  >
                                    Update Stock
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-500 italic">
                                    Admin/Finance only
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* ═════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}
      {isManualModalOpen && (
        <ManualOverrideModal
          lines={physicalLines}
          warehouses={warehouses}
          onClose={() => setIsManualModalOpen(false)}
          onApply={handleManualApply}
        />
      )}

      {stockModalEntry && (
        <StockUpdateModal
          entry={stockModalEntry}
          onClose={() => setStockModalEntry(null)}
          onUpdated={loadWarehouses}
        />
      )}
    </div>
  );
}
