import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Truck,
  RefreshCw,
  Edit3,
  X,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  Plus,
} from 'lucide-react';
import { fulfillmentAPI, quotationsAPI, productsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';

// Format currency
const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

// Status styling
const STATUS_CONFIG = {
  PENDING_FULFILLMENT: {
    label: 'Split Pending',
    badgeClass: 'bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-xs',
    dotClass: 'bg-amber-500',
  },
  PARTIALLY_FULFILLED: {
    label: 'Partially Fulfilled',
    badgeClass: 'bg-blue-100 text-blue-900 border-2 border-slate-900 shadow-pop-xs',
    dotClass: 'bg-blue-500',
  },
  FULFILLED: {
    label: 'Fulfilled',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-2 border-slate-900 shadow-pop-xs',
    dotClass: 'bg-emerald-500',
  },
  BACKORDER: {
    label: 'Backorder',
    badgeClass: 'bg-rose-100 text-rose-900 border-2 border-slate-900 shadow-pop-xs',
    dotClass: 'bg-rose-500',
  },
};

const getStockBadgeStyle = (available) => {
  if (available <= 0) {
    return 'bg-rose-100 text-rose-800 border-2 border-slate-900 shadow-pop-xs';
  }
  if (available < 10) {
    return 'bg-amber-100 text-amber-800 border-2 border-slate-900 shadow-pop-xs';
  }
  return 'bg-emerald-100 text-emerald-800 border-2 border-slate-900 shadow-pop-xs';
};

const getTierBadge = (tier) => {
  const t = String(tier || 'BRONZE').toUpperCase();
  if (t === 'GOLD') return 'bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-xs';
  if (t === 'SILVER') return 'bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-xs';
  return 'bg-orange-100 text-orange-900 border-2 border-slate-900 shadow-pop-xs';
};

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
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 text-slate-900">
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 border-2 border-slate-900 text-blue-700 flex items-center justify-center shadow-pop-xs">
                <Warehouse size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-base font-heading font-black text-slate-900">Stock Update</h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-900"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="rounded-2xl bg-[#FFFDF5] border-2 border-slate-900 p-4 space-y-2 shadow-pop-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-heading font-black">Warehouse</p>
                <p className="text-sm font-heading font-bold text-slate-900">{entry.warehouseName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-heading font-black">Product</p>
                <p className="text-sm font-heading font-bold text-slate-900">{entry.productName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t-2 border-slate-900/10 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">In Stock:</span>{' '}
                  <span className="font-mono font-black text-slate-900">{entry.inStock}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Reserved:</span>{' '}
                  <span className="font-mono font-black text-amber-700">{entry.reserved}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold text-slate-800 mb-1">
                New In-Stock Quantity <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder={`Current: ${entry.inStock}`}
                className="w-full rounded-2xl border-2 border-slate-900 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono shadow-pop-xs"
                required
              />
              {newQty !== '' && !isNaN(newQty) && (
                <p className="mt-1 text-xs text-slate-600">
                  Projected Available:{' '}
                  <span className="font-mono font-black text-emerald-700">
                    {Math.max(0, parseInt(newQty, 10) - (entry.reserved || 0))}
                  </span>{' '}
                  units
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-heading font-bold text-slate-800 mb-1">
                Reason for Adjustment <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Physical inventory count correction, batch delivery restock"
                className="w-full rounded-2xl border-2 border-slate-900 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-xs font-heading font-bold text-slate-800 transition-colors shadow-pop-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-pop-violet hover:bg-violet-700 text-xs font-heading font-black text-white border-2 border-slate-900 transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-pop-xs hover:shadow-pop hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />}
                <span>{saving ? 'Updating...' : 'Confirm Update'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

// ─── Sub-Component: Manual Override Modal ──────────────────────────────────
function ManualOverrideModal({
  isOpen,
  onClose,
  lines = [],
  warehouses = [],
  onApply,
}) {
  const [allocation, setAllocation] = useState({});

  useEffect(() => {
    if (isOpen) {
      const init = {};
      lines.forEach((l) => {
        const pid = l.product_id || l.productId;
        init[pid] = {};
      });
      setAllocation(init);
    }
  }, [isOpen, lines]);

  if (!isOpen) return null;

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
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl flex flex-col max-h-[85vh] text-slate-900">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 border-2 border-slate-900 text-blue-700 shadow-pop-xs">
              <Edit3 size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-heading font-black text-slate-900">Manual Warehouse Assignment</h3>
              <p className="text-xs text-slate-600 font-medium">Override smart split algorithm and assign warehouse quantities manually</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {lines.map((line) => {
            const pid = line.product_id || line.productId;
            const productName = line.product?.name || line.productName || 'Product';
            const neededQty = line.quantity || 0;
            const currentAlloc = allocation[pid] || {};
            const totalAssigned = Object.values(currentAlloc).reduce((sum, v) => sum + (v || 0), 0);
            const remaining = neededQty - totalAssigned;

            return (
              <div key={line.id || pid} className="rounded-2xl border-2 border-slate-900 bg-[#FFFDF5] p-4 space-y-3 shadow-pop-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-heading font-black text-slate-900">{productName}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Total Needed: <span className="font-mono font-black text-slate-900">{neededQty}</span> units
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold border-2 border-slate-900 shadow-pop-xs ${
                      remaining === 0
                        ? 'bg-emerald-100 text-emerald-900'
                        : remaining > 0
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    {remaining === 0
                      ? 'Fully Allocated'
                      : remaining > 0
                      ? `${remaining} unassigned`
                      : `${Math.abs(remaining)} over-assigned`}
                  </span>
                </div>

                <div className="space-y-2.5 pt-2 border-t-2 border-slate-900/10">
                  {warehouses.map((wh) => {
                    const stockRecord = (wh.stocks || []).find((s) => s.product_id === pid);
                    const inStock = stockRecord?.quantity || 0;
                    const reserved = stockRecord?.reserved || 0;
                    const available = Math.max(0, inStock - reserved);
                    const assignedVal = currentAlloc[wh.id] ?? '';

                    return (
                      <div key={wh.id} className="flex items-center justify-between gap-3 text-xs bg-white p-3 rounded-xl border-2 border-slate-900 shadow-pop-xs">
                        <div className="flex-1">
                          <span className="font-heading font-bold text-slate-900">{wh.name}</span>
                          <span className="text-[11px] text-slate-500 ml-2 font-medium">
                            (Available: <span className="font-mono text-emerald-700 font-bold">{available}</span>)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-heading font-bold text-slate-600">Qty:</label>
                          <input
                            type="number"
                            min="0"
                            max={available}
                            value={assignedVal}
                            onChange={(e) => handleQtyChange(pid, wh.id, e.target.value)}
                            placeholder="0"
                            className="w-16 rounded-xl border-2 border-slate-900 bg-[#FFFDF5] px-2 py-1 text-center text-xs text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-slate-900 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white border-2 border-slate-900 hover:bg-slate-100 text-xs font-heading font-bold text-slate-800 shadow-pop-xs">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-xl bg-pop-violet hover:bg-violet-700 text-xs font-heading font-black text-white border-2 border-slate-900 shadow-pop-xs hover:shadow-pop hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-all">
            Apply Custom Allocation
          </button>
        </div>
      </div>
    </div>
  </Portal>
);
}

// ─── Main Component: Fulfillment and Stock (List) ──────────────────────────
export default function Fulfillment() {
  const { user } = useAuthStore();
  const isAdminOrManager = ['ADMIN', 'SALES_MANAGER'].includes(user?.role);

  const [quotations, setQuotations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination for Orders Table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Collapsible live stock section
  const [showLiveStock, setShowLiveStock] = useState(true);

  // Active quotation for the Fulfillment Detail Modal
  const [activeDetailItem, setActiveDetailItem] = useState(null);
  const [detailSplits, setDetailSplits] = useState([]);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [acceptingSplit, setAcceptingSplit] = useState(false);

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [stockModalEntry, setStockModalEntry] = useState(null);

  // Connect Product to Warehouse Modal
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [productsCatalog, setProductsCatalog] = useState([]);
  const [connectWhId, setConnectWhId] = useState('');
  const [connectProductId, setConnectProductId] = useState('');
  const [connectQty, setConnectQty] = useState('25');
  const [savingConnect, setSavingConnect] = useState(false);

  const handleOpenConnectModal = async () => {
    setConnectModalOpen(true);
    setConnectWhId(warehouses[0]?.id || '');
    setConnectQty('25');
    if (productsCatalog.length === 0) {
      try {
        const res = await productsAPI.getAll();
        const prods = Array.isArray(res) ? res : res?.products || [];
        setProductsCatalog(prods);
        if (prods.length > 0) setConnectProductId(prods[0].id);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load product catalog');
      }
    } else if (!connectProductId && productsCatalog.length > 0) {
      setConnectProductId(productsCatalog[0].id);
    }
  };

  const handleConnectProduct = async (e) => {
    e.preventDefault();
    if (!connectWhId) {
      toast.error('Please select a warehouse facility');
      return;
    }
    if (!connectProductId) {
      toast.error('Please select a product from the catalog');
      return;
    }
    const qty = parseInt(connectQty || '0', 10);
    if (isNaN(qty) || qty < 0) {
      toast.error('Please enter a valid non-negative quantity');
      return;
    }

    try {
      setSavingConnect(true);
      await fulfillmentAPI.updateStock(connectWhId, connectProductId, {
        quantity: qty,
        reserved: 0
      });
      const whName = warehouses.find(w => w.id === connectWhId)?.name || 'Warehouse';
      const prodName = productsCatalog.find(p => p.id === connectProductId)?.name || 'Product';
      toast.success(`Connected "${prodName}" to "${whName}" (${qty} units added)`);
      setConnectModalOpen(false);
      loadWarehouses();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to connect product to warehouse');
    } finally {
      setSavingConnect(false);
    }
  };

  // Load quotations
  const loadQuotations = useCallback(async (q = searchQuery) => {
    try {
      setLoadingQuotations(true);
      const params = {};
      if (q && q.trim()) params.search = q.trim();
      const res = await quotationsAPI.getAll(params);
      const list = Array.isArray(res) ? res : res?.quotations || [];

      // Filter eligible for fulfillment: CONFIRMED, APPROVED, SENT_TO_CUSTOMER
      const eligible = list.filter(
        (item) =>
          item.status === 'CONFIRMED' ||
          item.status === 'APPROVED' ||
          item.status === 'SENT_TO_CUSTOMER'
      );
      setQuotations(eligible);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load fulfillment quotations');
    } finally {
      setLoadingQuotations(false);
    }
  }, [searchQuery]);

  // Load warehouses & stock
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

  useEffect(() => {
    loadQuotations();
    loadWarehouses();
  }, [loadQuotations, loadWarehouses]);

  // Load splits when an activeDetailItem is chosen
  const loadSplitForActive = useCallback(async (item) => {
    if (!item) return;
    try {
      setLoadingSplits(true);
      const splitRes = await fulfillmentAPI.getSplit(item.id);
      const rawSplits = Array.isArray(splitRes) ? splitRes : splitRes?.splits || [];

      // Enrich with product names
      const lines = item.lines || [];
      const enriched = rawSplits.map((s) => {
        const matchingLine = lines.find((l) => (l.product_id || l.productId) === s.productId);
        return {
          ...s,
          productName: s.productName || matchingLine?.product?.name || 'Product',
        };
      });
      setDetailSplits(enriched);
    } catch (err) {
      console.error('Failed to calculate split:', err);
      toast.error('Failed to calculate warehouse split');
    } finally {
      setLoadingSplits(false);
    }
  }, []);

  // When active detail item changes, fetch its split
  useEffect(() => {
    if (activeDetailItem) {
      loadSplitForActive(activeDetailItem);
    } else {
      setDetailSplits([]);
    }
  }, [activeDetailItem, loadSplitForActive]);

  // Flatten warehouse stock entries
  const flattenedStockRows = useMemo(() => {
    const rows = [];
    warehouses.forEach((wh) => {
      (wh.stocks || []).forEach((stock) => {
        const inStock = Number(stock.quantity || 0);
        const reserved = Number(stock.reserved || 0);
        const available = Math.max(0, inStock - reserved);
        rows.push({
          warehouseId: wh.id,
          warehouseName: wh.name,
          productId: stock.product_id || stock.product?.id,
          productName: stock.product?.name || 'Product',
          inStock,
          reserved,
          available,
        });
      });
    });
    return rows;
  }, [warehouses]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    let list = quotations;

    if (statusFilter !== 'ALL') {
      list = list.filter((q) => {
        if (statusFilter === 'FULFILLED') {
          return q.fulfillments && q.fulfillments.length > 0 && q.fulfillments.every((f) => f.status === 'FULFILLED');
        }
        if (statusFilter === 'PARTIAL') {
          return q.fulfillments && q.fulfillments.some((f) => f.status === 'PARTIALLY_FULFILLED');
        }
        if (statusFilter === 'PENDING') {
          return !q.fulfillments || q.fulfillments.length === 0;
        }
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const num = (item.quotationNumber || item.quotation_number || '').toLowerCase();
        const cust = (item.customer?.name || item.customer?.company_name || '').toLowerCase();
        return num.includes(q) || cust.includes(q);
      });
    }

    return list;
  }, [quotations, statusFilter, searchQuery]);

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Order status helper
  const getOrderStatus = (q) => {
    if (q.fulfillments && q.fulfillments.length > 0) {
      const allFulfilled = q.fulfillments.every(
        (f) => f.status === 'FULFILLED' || (f.quantity_fulfilled >= f.quantity_needed)
      );
      if (allFulfilled) return STATUS_CONFIG.FULFILLED;
      const anyPartial = q.fulfillments.some((f) => f.quantity_fulfilled > 0);
      if (anyPartial) return STATUS_CONFIG.PARTIALLY_FULFILLED;
    }
    return STATUS_CONFIG.PENDING_FULFILLMENT;
  };

  // Get physical units count
  const getPhysicalUnits = (q) => {
    const lines = (q.lines || []).filter(
      (l) => (l.lineType || l.line_type) !== 'SUBSCRIPTION'
    );
    return lines.reduce((acc, l) => acc + (l.quantity || 0), 0);
  };

  // Warehouse breakdown by warehouse for the detail modal
  const aggregatedWarehouseSplits = useMemo(() => {
    if (!detailSplits || detailSplits.length === 0) return [];
    const map = {};

    detailSplits.forEach((s) => {
      const key = s.isBackorder ? 'BACKORDER' : s.warehouseName || 'Warehouse';
      if (!map[key]) {
        map[key] = {
          warehouseName: key,
          qtyFulfilled: 0,
          shipments: s.isBackorder ? 0 : 1,
          cost: s.isBackorder ? 0 : s.shippingCost || 0,
          isBackorder: s.isBackorder,
        };
      }
      map[key].qtyFulfilled += Number(s.quantity || 0);
    });

    return Object.values(map);
  }, [detailSplits]);

  const hasBackorderInActive = useMemo(() => {
    return detailSplits.some((s) => s.isBackorder);
  }, [detailSplits]);

  // Handle Backorder Consolidation Prompt
  const handleConsolidateBackorder = async () => {
    if (!activeDetailItem) return;
    try {
      setAcceptingSplit(true);
      await fulfillmentAPI.acceptSplit(activeDetailItem.id);
      toast.success(
        `🎉 Remaining backorder consolidated! All ${activeDetailItem.quotationNumber || activeDetailItem.quotation_number} shipments unified.`
      );
      loadQuotations();
      loadWarehouses();
      loadSplitForActive(activeDetailItem);
    } catch (err) {
      console.error(err);
      toast.error('Failed to consolidate backorder');
    } finally {
      setAcceptingSplit(false);
    }
  };

  // Handle Accept Split
  const handleAcceptSplit = async () => {
    if (!activeDetailItem) return;
    try {
      setAcceptingSplit(true);
      await fulfillmentAPI.acceptSplit(activeDetailItem.id);
      toast.success(
        `Fulfillment confirmed for ${activeDetailItem.quotationNumber || activeDetailItem.quotation_number}! Stock reserved.`
      );
      // Reload orders and stock
      loadQuotations();
      loadWarehouses();
      setActiveDetailItem(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to confirm fulfillment');
    } finally {
      setAcceptingSplit(false);
    }
  };

  // Navigation inside Modal
  const currentIndex = useMemo(() => {
    if (!activeDetailItem) return -1;
    return filteredOrders.findIndex((q) => q.id === activeDetailItem.id);
  }, [activeDetailItem, filteredOrders]);

  const handlePrev = () => {
    if (currentIndex > 0) setActiveDetailItem(filteredOrders[currentIndex - 1]);
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < filteredOrders.length - 1) {
      setActiveDetailItem(filteredOrders[currentIndex + 1]);
    }
  };

  // Keyboard escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && activeDetailItem) setActiveDetailItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDetailItem]);

  return (
    <div className="space-y-6 antialiased pb-16">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Fulfillment and Stock</span>
            <span className="text-sm font-semibold text-slate-500 font-mono font-normal">
              (List)
            </span>
          </h1>
          <p className="text-xs font-medium text-slate-600 mt-1">
            Live stock per warehouse, plus every order that still needs fulfilling
          </p>
        </div>

        {/* Quick Actions & Refresh */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadQuotations();
              loadWarehouses();
            }}
            disabled={loadingQuotations || loadingWarehouses}
            className="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all text-xs font-heading font-bold flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
            title="Refresh Stock & Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQuotations || loadingWarehouses ? 'animate-spin' : ''}`} strokeWidth={2.5} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: LIVE STOCK PER WAREHOUSE TABLE ── */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
        <div
          className="p-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-900 bg-slate-50"
        >
          <div
            onClick={() => setShowLiveStock(!showLiveStock)}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Warehouse className="w-4 h-4 text-blue-700" strokeWidth={2.5} />
            <h2 className="text-sm font-heading font-black text-slate-900 tracking-wide">Live Stock per Warehouse</h2>
            <span className="text-xs text-slate-600 font-mono font-bold">
              ({flattenedStockRows.length} inventory records across {warehouses.length} warehouses)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdminOrManager && (
              <button
                type="button"
                onClick={handleOpenConnectModal}
                className="btn-candy px-3 py-1.5 rounded-xl bg-pop-violet hover:bg-violet-600 text-white font-heading font-black text-xs border-2 border-slate-900 shadow-pop-xs hover:shadow-pop flex items-center gap-1.5 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Connect Product to Warehouse</span>
              </button>
            )}
            <button
              onClick={() => setShowLiveStock(!showLiveStock)}
              className="text-slate-600 hover:text-slate-900 p-1 rounded-lg border border-transparent hover:border-slate-300 cursor-pointer"
            >
              {showLiveStock ? <ChevronUp className="w-4 h-4" strokeWidth={2.5} /> : <ChevronDown className="w-4 h-4" strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        {showLiveStock && (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden md:block overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] uppercase font-heading font-black text-slate-700 font-mono sticky top-0 z-10">
                    <th className="p-3.5">Warehouse</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5 text-center">In Stock</th>
                    <th className="p-3.5 text-center">Reserved</th>
                    <th className="p-3.5 text-center">Available</th>
                    {isAdminOrManager && <th className="p-3.5 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {flattenedStockRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 font-heading font-bold text-xs">
                        No warehouse stock records found.
                      </td>
                    </tr>
                  ) : (
                    flattenedStockRows.map((row, idx) => (
                      <tr key={`${row.warehouseId}-${row.productId}-${idx}`} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-3.5 font-heading font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-slate-900" />
                          <span>{row.warehouseName}</span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-800">{row.productName}</td>
                        <td className="p-3.5 text-center font-mono font-black text-slate-900">{row.inStock}</td>
                        <td className="p-3.5 text-center font-mono text-amber-700 font-black">{row.reserved}</td>
                        <td className="p-3.5 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-mono font-black ${getStockBadgeStyle(row.available)}`}>
                            {row.available}
                          </span>
                        </td>
                        {isAdminOrManager && (
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => setStockModalEntry(row)}
                              className="px-3.5 py-1.5 rounded-xl bg-pop-violet hover:bg-violet-700 text-white text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs hover:shadow-pop hover:-translate-y-0.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                              title="Adjust In-Stock Quantity"
                            >
                              Edit Stock
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-200 max-h-80 overflow-y-auto">
              {flattenedStockRows.length === 0 ? (
                <div className="p-6 text-center text-slate-500 font-heading font-bold text-xs">
                  No warehouse stock records found.
                </div>
              ) : (
                flattenedStockRows.map((row, idx) => (
                  <div key={`${row.warehouseId}-${row.productId}-${idx}`} className="p-3.5 space-y-2 hover:bg-amber-50/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-slate-900 shrink-0" />
                        <span className="font-heading font-bold text-slate-900 text-xs">{row.warehouseName}</span>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-mono font-black ${getStockBadgeStyle(row.available)}`}>
                        {row.available} avail
                      </span>
                    </div>
                    <div className="font-medium text-slate-800 text-xs">
                      {row.productName}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-3 text-slate-600 font-mono text-[11px]">
                        <span>In Stock: <strong className="text-slate-900">{row.inStock}</strong></span>
                        <span>Reserved: <strong className="text-amber-700">{row.reserved}</strong></span>
                      </div>
                      {isAdminOrManager && (
                        <button
                          onClick={() => setStockModalEntry(row)}
                          className="px-3 py-1 rounded-xl bg-pop-violet hover:bg-violet-700 text-white text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs active:translate-x-0.5 active:translate-y-0.5"
                        >
                          Edit Stock
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── SECTION 2: ORDERS AWAITING FULFILLMENT ── */}
      <div className="space-y-4">
        {/* Search & Status Filter Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-3xl border-2 border-slate-900 shadow-pop">
          <div className="relative md:col-span-8">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order/quotation # or customer..."
              className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl pl-10 pr-12 py-2 text-xs sm:text-sm font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            >
              <option value="ALL">All Orders ({quotations.length})</option>
              <option value="PENDING">Split Pending Only</option>
              <option value="PARTIAL">Partially Fulfilled</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
          </div>
        </div>

        {/* Callout Hint Banner */}
        <div className="bg-amber-100/70 border-2 border-slate-900 rounded-2xl px-4 py-3 text-xs font-heading font-bold text-slate-900 flex items-center gap-2.5 shadow-pop-xs">
          <Info className="w-4 h-4 text-amber-700 shrink-0" strokeWidth={2.5} />
          <span>Click an order row to open its warehouse split detail.</span>
        </div>

        {/* Orders Awaiting Fulfillment Table */}
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-heading font-black text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-700" strokeWidth={2.5} />
              <span>Orders Awaiting Fulfillment</span>
            </h2>
            <span className="text-xs font-mono font-bold text-slate-600">
              Showing {paginatedOrders.length} of {filteredOrders.length} orders
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] uppercase font-heading font-black text-slate-700 font-mono">
                  <th className="p-3.5 font-black">Order</th>
                  <th className="p-3.5 font-black">Customer</th>
                  <th className="p-3.5 font-black">Status</th>
                  <th className="p-3.5 font-black">Warehouses</th>
                  <th className="p-3.5 font-black text-right">Units / Value</th>
                  <th className="p-3.5 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loadingQuotations ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 font-heading font-bold">
                      <div className="w-7 h-7 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading fulfillment orders...
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500 font-heading font-bold text-xs">
                      No orders awaiting fulfillment matching the criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((q) => {
                    const statusMeta = getOrderStatus(q);
                    const units = getPhysicalUnits(q);
                    const isPureSubscription = units === 0;

                    return (
                      <tr
                        key={q.id}
                        onClick={() => setActiveDetailItem(q)}
                        className="cursor-pointer hover:bg-amber-50/40 transition-colors group"
                      >
                        {/* Order Number */}
                        <td className="p-3.5">
                          <div className="font-mono font-black text-violet-700 group-hover:text-violet-900">
                            {q.quotationNumber || q.quotation_number || 'QT-Deal'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">
                            {q.created_at ? new Date(q.created_at).toLocaleDateString() : 'Recent'}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="p-3.5">
                          <div className="font-heading font-bold text-slate-900">
                            {q.customer?.name || q.customer?.company_name || 'Customer'}
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase mt-1 ${getTierBadge(
                              q.customerTier || q.customer_tier
                            )}`}
                          >
                            {q.customerTier || q.customer_tier || 'BRONZE'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold ${statusMeta.badgeClass}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                            <span>{statusMeta.label}</span>
                          </span>
                        </td>

                        {/* Warehouses */}
                        <td className="p-3.5 text-slate-700">
                          {isPureSubscription ? (
                            <span className="text-slate-500 text-xs italic font-medium">Subscription Only</span>
                          ) : (
                            <span className="font-heading font-bold text-xs">
                              {warehouses.length > 1 ? 'Bengaluru + Mumbai (Optimized)' : 'Main Warehouse'}
                            </span>
                          )}
                        </td>

                        {/* Units / Value */}
                        <td className="p-3.5 text-right font-mono">
                          <div className="font-black text-slate-900 text-sm">{formatINR(q.total)}</div>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                            {units} physical unit{units === 1 ? '' : 's'}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveDetailItem(q)}
                            className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-heading font-black text-xs transition-all border-2 border-slate-900 shadow-pop-xs flex items-center gap-1.5 ml-auto active:translate-x-0.5 active:translate-y-0.5"
                          >
                            <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                            <span>View Split</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden divide-y divide-slate-200">
            {loadingQuotations ? (
              <div className="p-8 text-center text-slate-500 font-heading font-bold">
                <div className="w-7 h-7 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading fulfillment orders...
              </div>
            ) : paginatedOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-heading font-bold text-xs">
                No orders awaiting fulfillment matching the criteria.
              </div>
            ) : (
              paginatedOrders.map((q) => {
                const statusMeta = getOrderStatus(q);
                const units = getPhysicalUnits(q);
                const isPureSubscription = units === 0;

                return (
                  <div
                    key={q.id}
                    onClick={() => setActiveDetailItem(q)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-amber-50/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-black text-violet-700 text-xs">
                          {q.quotationNumber || q.quotation_number || 'QT-Deal'}
                        </div>
                        <div className="font-heading font-bold text-slate-900 text-sm mt-0.5">
                          {q.customer?.name || q.customer?.company_name || 'Customer'}
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase mt-1 ${getTierBadge(
                            q.customerTier || q.customer_tier
                          )}`}
                        >
                          {q.customerTier || q.customer_tier || 'BRONZE'}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold shrink-0 ${statusMeta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#FFFDF5] p-2.5 rounded-xl border border-slate-300 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Units / Total</span>
                        <span className="font-mono font-black text-slate-900 text-sm">{formatINR(q.total)}</span>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {units} unit{units === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Warehouse Route</span>
                        <span className="font-heading font-bold text-slate-800 text-xs block mt-0.5">
                          {isPureSubscription ? 'Subscription Only' : warehouses.length > 1 ? 'Multi-Warehouse' : 'Main Warehouse'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {q.created_at ? new Date(q.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveDetailItem(q)}
                        className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-heading font-black text-xs transition-all border-2 border-slate-900 shadow-pop-xs flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5"
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <span>View Split</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {filteredOrders.length > 0 && (
            <div className="border-t-2 border-slate-900 p-3 bg-slate-50">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 25, 50, 100, 200]}
              />
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         SECTION 3: FULFILLMENT DETAIL MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {activeDetailItem && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-3xl bg-white border-2 border-slate-900 rounded-3xl shadow-pop-xl overflow-hidden my-auto max-h-[90vh] flex flex-col text-slate-900">
            {/* Header */}
            <div className="p-5 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-heading font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Fulfillment Detail:</span>
                  <span className="text-violet-700 font-mono">
                    {activeDetailItem.quotationNumber || activeDetailItem.quotation_number}
                  </span>
                  <span className="text-slate-600 font-bold text-sm">
                    ({activeDetailItem.customer?.name || activeDetailItem.customer?.company_name || 'Customer'})
                  </span>
                </h2>
                <p className="text-xs font-medium text-slate-600 mt-0.5">
                  Opened by clicking an order row on the Fulfillment list
                </p>
              </div>

              {/* Navigation & Close */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border-2 border-slate-900 rounded-xl p-0.5 shadow-pop-xs">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex <= 0}
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                    title="Previous Order"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <span className="text-xs font-mono font-black px-1.5 text-slate-700">
                    {currentIndex + 1} / {filteredOrders.length}
                  </span>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex >= filteredOrders.length - 1}
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                    title="Next Order"
                  >
                    <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>

                <button
                  onClick={() => setActiveDetailItem(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-700 hover:text-slate-900 transition-colors shadow-pop-xs"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Badges bar */}
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold ${getOrderStatus(activeDetailItem).badgeClass}`}>
                  {getOrderStatus(activeDetailItem).label}
                </span>
                <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold ${getTierBadge(activeDetailItem.customerTier || activeDetailItem.customer_tier)}`}>
                  Customer Tier: {activeDetailItem.customerTier || activeDetailItem.customer_tier || 'BRONZE'}
                </span>
                <span className="px-3.5 py-1 rounded-xl text-xs font-mono font-black bg-white text-slate-900 border-2 border-slate-900 shadow-pop-xs ml-auto">
                  Order Total: {formatINR(activeDetailItem.total)}
                </span>
              </div>

              {/* Warehouse Allocation Table */}
              <div className="space-y-2.5">
                <div className="text-xs font-heading font-black uppercase tracking-wider text-slate-600 font-mono flex items-center justify-between">
                  <span>Smart Warehouse Stock Allocation</span>
                  {detailSplits.length > 0 && (
                    <span className="text-emerald-700 font-bold text-xs normal-case">
                      Optimized for lowest shipping cost
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto rounded-2xl border-2 border-slate-900 bg-white shadow-pop-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-black text-slate-700 font-mono">
                        <th className="p-3">Warehouse</th>
                        <th className="p-3 text-center">Qty Fulfilled</th>
                        <th className="p-3 text-center">Est. Shipments</th>
                        <th className="p-3 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingSplits ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500 font-heading font-bold">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                            Calculating optimal warehouse split...
                          </td>
                        </tr>
                      ) : aggregatedWarehouseSplits.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500 font-heading font-bold text-xs">
                            {getPhysicalUnits(activeDetailItem) === 0
                              ? 'This quotation contains subscription or digital items only. No physical warehouse dispatch required.'
                              : 'No split allocations calculated.'}
                          </td>
                        </tr>
                      ) : (
                        aggregatedWarehouseSplits.map((row, idx) => (
                          <tr
                            key={idx}
                            className={row.isBackorder ? 'bg-rose-50' : 'hover:bg-amber-50/40'}
                          >
                            <td className="p-3">
                              <span className="font-heading font-bold text-slate-900 flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full border border-slate-900 ${row.isBackorder ? 'bg-rose-500' : 'bg-blue-600'}`} />
                                <span>{row.warehouseName}</span>
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-black text-slate-900">
                              {row.qtyFulfilled} units
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-600">
                              {row.isBackorder ? 'Pending Restock' : `${row.shipments} shipment`}
                            </td>
                            <td className="p-3 text-right font-mono font-black">
                              {row.isBackorder ? (
                                <span className="text-rose-600 text-xs">—</span>
                              ) : (
                                <span className="text-emerald-700">₹{Number(row.cost).toLocaleString()}</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Callout Banner with Automatic Backorder Consolidation Prompt */}
              <div className={`border-2 border-slate-900 rounded-2xl p-4 text-xs font-heading font-bold shadow-pop-xs ${
                hasBackorderInActive ? 'bg-amber-100/90 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3' : 'bg-emerald-50 text-slate-900'
              }`}>
                {hasBackorderInActive ? (
                  <>
                    <div className="space-y-0.5">
                      <p className="font-black text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-700" />
                        <span>Backorder Consolidation Sentinel Active</span>
                      </p>
                      <p className="text-[11px] font-medium text-amber-800">
                        "Consolidate Remaining Backorder" prompt appears automatically once warehouse restocks.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConsolidateBackorder}
                      disabled={acceptingSplit}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 border-2 border-slate-900 shadow-pop-xs font-black text-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <Package size={13} strokeWidth={2.5} />
                      <span>{acceptingSplit ? 'Consolidating...' : 'Consolidate Remaining Backorder'}</span>
                    </button>
                  </>
                ) : getPhysicalUnits(activeDetailItem) === 0 ? (
                  <span>
                    This order consists of recurring subscriptions or services only. Fulfillment can be finalized directly.
                  </span>
                ) : (
                  <span>
                    Stock availability has been reserved across regional hubs to minimize cross-dock transit and ensure the fastest customer delivery.
                  </span>
                )}
              </div>

              {/* Physical Lines Preview */}
              {(activeDetailItem.lines || []).length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-heading font-black uppercase tracking-wider text-slate-600 font-mono">
                    Order Lines Breakdown
                  </div>
                  <div className="overflow-x-auto rounded-2xl border-2 border-slate-900 bg-white shadow-pop-xs">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-black text-slate-700 font-mono">
                          <th className="p-3">Product</th>
                          <th className="p-3 text-center">Type</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Unit Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activeDetailItem.lines.map((l, i) => (
                          <tr key={l.id || i} className="hover:bg-amber-50/40">
                            <td className="p-3 font-heading font-bold text-slate-900">{l.product?.name || 'Product'}</td>
                            <td className="p-3 text-center">
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-900 text-slate-800">
                                {l.line_type || l.lineType || 'ONE_TIME'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-black text-slate-900">{l.quantity}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-700">{formatINR(l.unit_price || l.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── ACTION BUTTONS ── */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t-2 border-slate-900">
                <div className="flex items-center gap-3">
                  {/* Accept Suggested Split Button */}
                  <button
                    type="button"
                    onClick={handleAcceptSplit}
                    disabled={acceptingSplit || loadingSplits}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-black text-xs transition-all border-2 border-slate-900 shadow-pop flex items-center gap-2 disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                    <span>{acceptingSplit ? 'Reserving...' : 'Accept Suggested Split'}</span>
                  </button>

                  {/* Manual Override Button */}
                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(true)}
                    className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 font-heading font-bold text-xs transition-all shadow-pop-xs active:translate-x-0.5 active:translate-y-0.5"
                  >
                    Manual Override
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveDetailItem(null)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-800 text-xs font-heading font-bold shadow-pop-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    )}

      {/* Manual Override Modal */}
      <ManualOverrideModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        lines={activeDetailItem?.lines || []}
        warehouses={warehouses}
        onApply={(customAlloc) => {
          toast.success('Custom warehouse allocation applied to this order!');
        }}
      />

      {/* Stock Update Modal */}
      {stockModalEntry && (
        <StockUpdateModal
          entry={stockModalEntry}
          onClose={() => setStockModalEntry(null)}
          onUpdated={() => {
            loadWarehouses();
          }}
        />
      )}

      {/* Connect Product to Warehouse Modal */}
      {connectModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-pop-violet border-2 border-slate-900 text-white flex items-center justify-center shadow-pop-xs">
                    <Plus size={16} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-base font-heading font-black text-slate-900">Connect Product to Warehouse</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="p-1 rounded-xl border-2 border-slate-900 hover:bg-slate-100 text-slate-900 shadow-pop-xs cursor-pointer"
                >
                  <X size={16} className="stroke-[2.5]" />
                </button>
              </div>

              <form onSubmit={handleConnectProduct} className="mt-4 space-y-4">
                <div className="p-3 rounded-2xl bg-amber-50 border-2 border-slate-900 text-xs text-slate-700 space-y-1">
                  <p className="font-heading font-bold text-slate-900">How Product-Warehouse Allocation Works:</p>
                  <p className="text-[11px] leading-relaxed">
                    Connecting a product links it in the <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300">warehouse_stocks</code> table. When quotations are confirmed, DealFlow360's smart fulfillment algorithm automatically routes stock from the lowest-cost facility.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Select Warehouse Facility <span className="text-pop-pink font-black">*</span>
                  </label>
                  <select
                    required
                    value={connectWhId}
                    onChange={(e) => setConnectWhId(e.target.value)}
                    className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet shadow-pop-xs"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} {wh.location ? `(${wh.location})` : ''} — Standard Shipping: ₹{wh.shipping_cost || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Select Product from Catalog <span className="text-pop-pink font-black">*</span>
                  </label>
                  <select
                    required
                    value={connectProductId}
                    onChange={(e) => setConnectProductId(e.target.value)}
                    className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet shadow-pop-xs"
                  >
                    {productsCatalog.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} (SKU: {prod.sku || 'N/A'}) — ₹{prod.base_price || prod.basePrice || 0}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Initial Physical Stock Quantity <span className="text-pop-pink font-black">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={connectQty}
                    onChange={(e) => setConnectQty(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet font-mono font-bold shadow-pop-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Reserved units start at 0. Available quantity will immediately equal this amount.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConnectModalOpen(false)}
                    className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-3.5 py-2 rounded-xl border-2 border-slate-900 shadow-pop-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingConnect}
                    className="btn-candy bg-pop-violet hover:bg-violet-600 text-white text-xs font-heading font-black px-4 py-2 rounded-xl border-2 border-slate-900 shadow-pop cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingConnect ? 'Connecting...' : 'Connect & Save Stock'}
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
