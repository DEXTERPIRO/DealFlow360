import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Edit3,
  Boxes,
  Truck,
  MapPin,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  RefreshCw,
  TrendingUp,
  Package,
  Sparkles,
  LayoutGrid,
  List
} from 'lucide-react';
import { fulfillmentAPI, productsAPI } from '../../api';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';

const FACILITY_THEMES = [
  {
    cardBg: 'bg-gradient-to-b from-sky-50/90 via-blue-50/30 to-white',
    topBar: 'bg-sky-500',
    iconBg: 'bg-pop-sky text-slate-900',
    skuBadge: 'bg-sky-100 text-sky-900',
    unitsBox: 'bg-emerald-50 border-2 border-slate-900',
    unitsBadge: 'bg-emerald-200 text-emerald-950',
    shippingBox: 'bg-sky-100/70 text-slate-900 border-2 border-slate-900',
  },
  {
    cardBg: 'bg-gradient-to-b from-amber-50/90 via-orange-50/30 to-white',
    topBar: 'bg-pop-yellow',
    iconBg: 'bg-pop-yellow text-slate-900',
    skuBadge: 'bg-amber-100 text-amber-900',
    unitsBox: 'bg-emerald-50 border-2 border-slate-900',
    unitsBadge: 'bg-emerald-200 text-emerald-950',
    shippingBox: 'bg-amber-100/80 text-slate-900 border-2 border-slate-900',
  },
  {
    cardBg: 'bg-gradient-to-b from-purple-50/90 via-pink-50/30 to-white',
    topBar: 'bg-pop-violet',
    iconBg: 'bg-pop-violet text-white',
    skuBadge: 'bg-purple-100 text-purple-900',
    unitsBox: 'bg-emerald-50 border-2 border-slate-900',
    unitsBadge: 'bg-emerald-200 text-emerald-950',
    shippingBox: 'bg-purple-100/70 text-slate-900 border-2 border-slate-900',
  },
];

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Warehouse Modal
  const [warehouseModalData, setWarehouseModalData] = useState(null); // null = closed, {} = add, wh = edit
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  // Stock Edit Modal
  const [stockEditEntry, setStockEditEntry] = useState(null);
  const [stockQty, setStockQty] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // Stock Filters
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [searchProduct, setSearchProduct] = useState('');

  const [allWarehouses, setAllWarehouses] = useState([]);

  // Connect Product to Warehouse Modal
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [productsCatalog, setProductsCatalog] = useState([]);
  const [connectWhId, setConnectWhId] = useState('');
  const [connectProductId, setConnectProductId] = useState('');
  const [connectQty, setConnectQty] = useState('');
  const [savingConnect, setSavingConnect] = useState(false);

  const handleOpenConnectModal = async () => {
    setConnectModalOpen(true);
    setConnectWhId(warehouseFilter !== 'ALL' ? warehouseFilter : (warehouses[0]?.id || ''));
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
      const whName = (allWarehouses.length > 0 ? allWarehouses : warehouses).find(w => w.id === connectWhId)?.name || 'Warehouse';
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

  // ── 1. Load Warehouses & Stock ───────────────────────────────────────────

  const loadWarehouses = useCallback(async (q = searchProduct, whId = warehouseFilter) => {
    try {
      setLoading(true);
      const params = {};
      if (q && q.trim()) params.search = q.trim();
      if (whId && whId !== 'ALL') params.warehouse_id = whId;

      const res = await fulfillmentAPI.getWarehouseStock(params);
      const list = Array.isArray(res) ? res : res?.warehouses || [];
      setWarehouses(list);
      if (!q && whId === 'ALL' && allWarehouses.length === 0) {
        setAllWarehouses(list);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warehouse inventory');
    } finally {
      setLoading(false);
    }
  }, [searchProduct, warehouseFilter, allWarehouses.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWarehouses(searchProduct, warehouseFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchProduct, warehouseFilter, loadWarehouses]);

  // ── 2. Create / Update Warehouse Handler ─────────────────────────────────

  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    const { id, name, location, shippingCost, isActive } = warehouseModalData;
    if (!name || !name.trim()) {
      toast.error('Warehouse name is required');
      return;
    }

    try {
      setSavingWarehouse(true);
      if (id) {
        await fulfillmentAPI.updateWarehouse(id, {
          name: name.trim(),
          location: location?.trim() || null,
          shippingCost: parseFloat(shippingCost) || 0,
          isActive: isActive !== undefined ? isActive : true,
        });
        toast.success(`Warehouse "${name}" updated`);
      } else {
        await fulfillmentAPI.createWarehouse({
          name: name.trim(),
          location: location?.trim() || null,
          shippingCost: parseFloat(shippingCost) || 0,
        });
        toast.success(`Warehouse "${name}" created`);
      }
      setWarehouseModalData(null);
      loadWarehouses();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save warehouse');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleToggleActive = async (wh) => {
    try {
      const newStatus = !wh.is_active;
      await fulfillmentAPI.updateWarehouse(wh.id, { isActive: newStatus });
      toast.success(`Warehouse "${wh.name}" ${newStatus ? 'activated' : 'deactivated'}`);
      loadWarehouses();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update warehouse status');
    }
  };

  // ── 3. Update Stock Handler ──────────────────────────────────────────────

  const handleOpenStockEdit = (entry) => {
    setStockEditEntry(entry);
    setStockQty(entry.quantity ?? 0);
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (stockQty === '' || isNaN(stockQty) || Number(stockQty) < 0) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    try {
      setSavingStock(true);
      await fulfillmentAPI.updateStock(
        stockEditEntry.warehouseId,
        stockEditEntry.productId,
        {
          quantity: parseInt(stockQty, 10),
          reserved: stockEditEntry.reserved || 0,
        }
      );
      toast.success(`Stock updated for ${stockEditEntry.productName}`);
      setStockEditEntry(null);
      loadWarehouses();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update stock');
    } finally {
      setSavingStock(false);
    }
  };

  // ── 4. Flattened Stock Records ───────────────────────────────────────────

  const flattenedStock = useMemo(() => {
    const rows = [];
    warehouses.forEach((wh) => {
      (wh.stocks || []).forEach((st) => {
        const inStock = st.quantity || 0;
        const reserved = st.reserved || 0;
        const available = inStock - reserved;

        rows.push({
          warehouseId: wh.id,
          warehouseName: wh.name,
          productId: st.product_id,
          productName: st.product?.name || 'Product',
          sku: st.product?.sku || '—',
          quantity: inStock,
          reserved,
          available,
        });
      });
    });
    return rows;
  }, [warehouses]);

  // Database-queried stock records
  const filteredStock = flattenedStock;

  // ── 3b. Facility Filtering & Pagination ──────────────────────────────────
  const [facilityViewMode, setFacilityViewMode] = useState('grid');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [facilityPage, setFacilityPage] = useState(1);
  const [facilityPageSize, setFacilityPageSize] = useState(5);

  useEffect(() => {
    setFacilityPage(1);
  }, [facilitySearch]);

  const filteredWarehouses = useMemo(() => {
    if (!facilitySearch.trim()) return warehouses;
    const q = facilitySearch.toLowerCase().trim();
    return warehouses.filter(
      (wh) =>
        wh.name?.toLowerCase().includes(q) ||
        wh.location?.toLowerCase().includes(q)
    );
  }, [warehouses, facilitySearch]);

  const pagedWarehouses = useMemo(() => {
    const start = (facilityPage - 1) * facilityPageSize;
    return filteredWarehouses.slice(start, start + facilityPageSize);
  }, [filteredWarehouses, facilityPage, facilityPageSize]);

  // Stock Pagination
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(5);

  useEffect(() => {
    setStockPage(1);
  }, [warehouseFilter, searchProduct]);

  const pagedStock = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return filteredStock.slice(start, start + stockPageSize);
  }, [filteredStock, stockPage, stockPageSize]);

  const getStockColorClass = (avail) => {
    if (avail > 20) return 'bg-pop-mint text-slate-900 border-2 border-slate-900 shadow-pop-sm';
    if (avail >= 5) return 'bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-sm';
    return 'bg-pop-pink text-slate-900 border-2 border-slate-900 shadow-pop-sm';
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-10 antialiased pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-50 via-teal-50 to-amber-50 border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-pop-sky border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
              <WarehouseIcon className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight">
                  Warehouses & Stock Control
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pop-mint text-slate-900 border-2 border-slate-900 font-mono text-[10px] font-black uppercase shadow-pop-xs">
                  <Sparkles size={10} strokeWidth={2.5} /> Active Facilities
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Multi-location distribution hubs, shipping rates, and live SKU inventory management
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setWarehouseModalData({ name: '', location: '', shippingCost: 0, isActive: true })}
          className="btn-candy bg-pop-violet hover:bg-violet-700 text-white text-xs font-heading font-black px-5 py-2.5 rounded-2xl border-2 border-slate-900 shadow-pop flex items-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Warehouse</span>
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 1: WAREHOUSE MANAGEMENT (COMPACT CARDS OR HIGH-DENSITY TABLE)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-3xl border-2 border-slate-900 shadow-pop">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pop-violet/10 border-2 border-slate-900 text-pop-violet flex items-center justify-center shadow-pop-xs">
              <Truck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-heading font-black text-slate-900">
                Fulfillment Facilities
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {filteredWarehouses.length} {filteredWarehouses.length === 1 ? 'facility' : 'facilities'} active across logistics network
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" strokeWidth={2.5} />
              <input
                type="text"
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
                placeholder="Search by facility name or city..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-heading font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50"
              />
              {facilitySearch && (
                <button
                  onClick={() => setFacilitySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 border-2 border-slate-900 rounded-xl p-0.5 shadow-pop-xs">
              <button
                onClick={() => setFacilityViewMode('grid')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-heading font-black transition-all cursor-pointer ${
                  facilityViewMode === 'grid'
                    ? 'bg-white text-slate-900 border border-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Compact Cards View"
              >
                <LayoutGrid size={13} strokeWidth={2.5} />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setFacilityViewMode('table')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-heading font-black transition-all cursor-pointer ${
                  facilityViewMode === 'table'
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-3xl bg-white border-2 border-slate-900 shadow-pop animate-pulse" />
            ))}
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border-2 border-slate-900 bg-white shadow-pop">
            <WarehouseIcon className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[2]" />
            <p className="text-sm font-bold text-slate-700">No matching warehouses found</p>
            {facilitySearch && (
              <button
                onClick={() => setFacilitySearch('')}
                className="mt-2 text-xs font-bold text-pop-violet underline cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : facilityViewMode === 'grid' ? (
          /* ── COMPACT CARDS VIEW (Space Efficient) ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedWarehouses.map((wh, idx) => {
              const skuCount = (wh.stocks || []).length;
              const totalUnits = (wh.stocks || []).reduce(
                (sum, s) => sum + (s.quantity || 0),
                0
              );
              const isWhActive = wh.is_active !== false;
              const theme = FACILITY_THEMES[idx % FACILITY_THEMES.length];

              return (
                <div
                  key={wh.id}
                  className={`rounded-2xl border-2 border-slate-900 ${theme.cardBg} p-4 flex flex-col justify-between gap-3 shadow-pop transition-all hover:shadow-pop-md hover:-translate-y-0.5 relative overflow-hidden group ${
                    !isWhActive ? 'opacity-70 bg-slate-100' : ''
                  }`}
                >
                  {/* Decorative Color Stripe at Top */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${theme.topBar}`} />

                  {/* Header Row: Icon, Title, Location, Status & Edit */}
                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl border-2 border-slate-900 ${theme.iconBg} flex items-center justify-center shadow-pop-xs shrink-0 mt-0.5`}>
                        <WarehouseIcon size={15} strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-heading font-black text-slate-900 truncate group-hover:text-violet-700 transition-colors">
                          {wh.name}
                        </h3>
                        <p className="text-[11px] text-slate-600 font-bold flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-500 stroke-[2.5] shrink-0" />
                          <span className="truncate">{wh.location || 'Not Specified'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleActive(wh)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-black border-2 border-slate-900 shadow-pop-xs transition-transform active:translate-y-0.5 cursor-pointer ${
                          isWhActive
                            ? 'bg-pop-mint text-slate-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                        title="Click to toggle status"
                      >
                        {isWhActive ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                      <button
                        onClick={() =>
                          setWarehouseModalData({
                            id: wh.id,
                            name: wh.name,
                            location: wh.location || '',
                            shippingCost: wh.shipping_cost || 0,
                            isActive: isWhActive,
                          })
                        }
                        className="p-1 rounded-lg bg-white hover:bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0.5"
                        title="Edit Facility"
                      >
                        <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Compact Unified Metrics Strip (High-Density) */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-white/90 border-2 border-slate-900 shadow-pop-xs text-center font-mono">
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-500">SKUs</div>
                      <div className="text-sm font-black text-slate-900">{skuCount}</div>
                    </div>
                    <div className="border-x border-slate-300">
                      <div className="text-[9px] font-black uppercase text-slate-500">Stock Units</div>
                      <div className="text-sm font-black text-emerald-700">{totalUnits}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-500">Shipping</div>
                      <div className="text-sm font-black text-slate-900">
                        ₹{Number(wh.shipping_cost || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── HIGH-DENSITY DATA TABLE VIEW (Handles 100+ Facilities) ── */
          <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-mono font-black text-slate-800 tracking-wider">
                    <th className="py-3 px-4">Facility Name</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Location</th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">SKUs</th>
                    <th className="py-3 px-4 text-right">Total Units</th>
                    <th className="py-3 px-4 text-right hidden sm:table-cell">Standard Shipping</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100">
                  {pagedWarehouses.map((wh, idx) => {
                    const skuCount = (wh.stocks || []).length;
                    const totalUnits = (wh.stocks || []).reduce(
                      (sum, s) => sum + (s.quantity || 0),
                      0
                    );
                    const isWhActive = wh.is_active !== false;

                    return (
                      <tr key={wh.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-pop-sky/30 border border-slate-900 text-slate-900 flex items-center justify-center shrink-0">
                              <WarehouseIcon size={14} strokeWidth={2.5} />
                            </div>
                            <div>
                              <span className="font-heading font-black text-slate-900">{wh.name}</span>
                              <div className="sm:hidden text-[10px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                                <MapPin size={10} className="text-slate-400 shrink-0" />
                                {wh.location || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell">
                          <span className="font-medium text-slate-600 flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            {wh.location || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center hidden md:table-cell">
                          <span className="inline-block px-2 py-0.5 rounded-md font-mono text-[11px] font-black bg-sky-100 text-sky-900 border border-sky-300">
                            {skuCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                          {totalUnits.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 hidden sm:table-cell">
                          ₹{Number(wh.shipping_cost || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(wh)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-black border border-slate-900 shadow-pop-xs transition-transform active:translate-y-0.5 cursor-pointer ${
                              isWhActive
                                ? 'bg-pop-mint text-slate-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isWhActive ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() =>
                              setWarehouseModalData({
                                id: wh.id,
                                name: wh.name,
                                location: wh.location || '',
                                shippingCost: wh.shipping_cost || 0,
                                isActive: isWhActive,
                              })
                            }
                            className="p-1.5 rounded-lg bg-white hover:bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all cursor-pointer inline-flex items-center gap-1 font-heading font-bold text-[11px]"
                            title="Edit Facility"
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

        {/* Facility Section Pagination */}
        {filteredWarehouses.length > 0 && (
          <div className="bg-white border-2 border-slate-900 rounded-3xl p-3 shadow-pop">
            <Pagination
              currentPage={facilityPage}
              totalItems={filteredWarehouses.length}
              pageSize={facilityPageSize}
              pageSizeOptions={[5, 6, 12, 24, 48, 100, 200]}
              onPageChange={setFacilityPage}
              onPageSizeChange={(s) => {
                setFacilityPageSize(s);
                setFacilityPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 2: STOCK MANAGEMENT TABLE
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-heading font-black text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-pop-violet stroke-[2.5]" />
              <span>Live Stock Management</span>
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              Per-facility inventory count, allocated orders, and net available quantities
            </p>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-3 h-3 rounded-md bg-pop-mint border border-slate-900" /> &gt; 20 (Healthy)
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-3 h-3 rounded-md bg-pop-yellow border border-slate-900" /> 5 - 20 (Low)
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-3 h-3 rounded-md bg-pop-pink border border-slate-900" /> &lt; 5 (Critical)
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-3xl border-2 border-slate-900 shadow-pop">
          <div className="relative w-full sm:w-80">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]"
            />
            <input
              type="text"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              placeholder="Search product or SKU..."
              className="w-full bg-paper border-2 border-slate-900 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pop-violet transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Warehouse:</span>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet transition-colors"
              >
                <option value="ALL">All Facilities</option>
                {(allWarehouses.length > 0 ? allWarehouses : warehouses).map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleOpenConnectModal}
              className="btn-candy px-3.5 py-2 rounded-2xl bg-pop-violet hover:bg-violet-600 text-white font-heading font-black text-xs border-2 border-slate-900 shadow-pop-xs hover:shadow-pop flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Connect Product to Warehouse</span>
            </button>
          </div>
        </div>

        {/* Stock Table */}
        <div className="rounded-3xl border-2 border-slate-900 bg-white overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-slate-800 text-[10px] uppercase font-mono font-black tracking-wider">
                  <th className="py-3.5 px-6">Warehouse</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4 font-mono hidden sm:table-cell">SKU</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">In Stock</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">Reserved</th>
                  <th className="py-3.5 px-4 text-center">Available</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                      No matching stock items found.
                    </td>
                  </tr>
                ) : (
                  pagedStock.map((row, idx) => {
                    const badgeClass = getStockColorClass(row.available);

                    return (
                      <tr
                        key={`${row.warehouseId}-${row.productId}-${idx}`}
                        className="hover:bg-amber-50/40 transition-colors"
                      >
                        <td className="py-4 px-6 font-heading font-extrabold text-slate-900">
                          {row.warehouseName}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-800">
                          <div>{row.productName}</div>
                          <div className="sm:hidden text-[10px] font-mono text-pop-violet font-bold mt-0.5">{row.sku}</div>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-pop-violet hidden sm:table-cell">
                          {row.sku}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-slate-800 hidden md:table-cell">
                          {row.quantity}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-slate-500 hidden md:table-cell">
                          {row.reserved}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-3 py-0.5 rounded-xl font-mono font-black text-xs ${badgeClass}`}
                          >
                            {row.available}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleOpenStockEdit(row)}
                            className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-3 py-1 rounded-xl border-2 border-slate-900 shadow-pop-sm"
                          >
                            Edit Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Stock Table Pagination */}
          <div className="p-4 border-t-2 border-slate-900">
            <Pagination
              currentPage={stockPage}
              totalItems={filteredStock.length}
              pageSize={stockPageSize}
              onPageChange={setStockPage}
              onPageSizeChange={setStockPageSize}
              pageSizeOptions={[5, 10, 25, 50, 100, 200]}
            />
          </div>
        </div>
      </div>

      {/* ── Modal: Add / Edit Warehouse ──────────────────────────────────── */}
      {warehouseModalData && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
                <h3 className="text-base font-heading font-extrabold text-slate-900">
                  {warehouseModalData.id ? 'Edit Warehouse' : 'Add Warehouse'}
                </h3>
                <button
                  type="button"
                  onClick={() => setWarehouseModalData(null)}
                  className="p-1 rounded-xl border-2 border-slate-900 hover:bg-slate-100 text-slate-900 shadow-pop-xs cursor-pointer"
                >
                  <X size={16} className="stroke-[2.5]" />
                </button>
              </div>

              <form onSubmit={handleSaveWarehouse} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Warehouse Name <span className="text-pop-pink font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={warehouseModalData.name || ''}
                    onChange={(e) =>
                      setWarehouseModalData({
                        ...warehouseModalData,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g. Mumbai Logistics Hub"
                    className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet shadow-pop-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Location (City / State)
                  </label>
                  <input
                    type="text"
                    value={warehouseModalData.location || ''}
                    onChange={(e) =>
                      setWarehouseModalData({
                        ...warehouseModalData,
                        location: e.target.value,
                      })
                    }
                    placeholder="e.g. Bhiwandi, Maharashtra"
                    className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet shadow-pop-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Standard Shipping Cost per Delivery (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={warehouseModalData.shippingCost || 0}
                    onChange={(e) =>
                      setWarehouseModalData({
                        ...warehouseModalData,
                        shippingCost: e.target.value,
                      })
                    }
                    className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet font-mono font-bold shadow-pop-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-100">
                  <button
                    type="button"
                    onClick={() => setWarehouseModalData(null)}
                    className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-3.5 py-2 rounded-xl border-2 border-slate-900 shadow-pop-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingWarehouse}
                    className="btn-candy bg-pop-violet hover:bg-violet-600 text-white text-xs font-heading font-black px-4 py-2 rounded-xl border-2 border-slate-900 shadow-pop cursor-pointer disabled:opacity-50"
                  >
                    {savingWarehouse ? 'Saving...' : 'Save Warehouse'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Modal: Edit Stock Quantity ───────────────────────────────────── */}
      {stockEditEntry && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl border-2 border-slate-900 bg-white shadow-pop-xl p-6 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
                <h3 className="text-sm font-heading font-extrabold text-slate-900">Update Stock Quantity</h3>
                <button
                  type="button"
                  onClick={() => setStockEditEntry(null)}
                  className="p-1 rounded-xl border-2 border-slate-900 hover:bg-slate-100 text-slate-900 shadow-pop-xs cursor-pointer"
                >
                  <X size={16} className="stroke-[2.5]" />
                </button>
              </div>

              <form onSubmit={handleSaveStock} className="mt-4 space-y-4">
                <div className="p-3 rounded-2xl bg-slate-100 border-2 border-slate-900 text-xs space-y-1">
                  <p className="text-slate-600">
                    Facility: <strong className="text-slate-900 font-bold">{stockEditEntry.warehouseName}</strong>
                  </p>
                  <p className="text-slate-600">
                    Product: <strong className="text-slate-900 font-bold">{stockEditEntry.productName}</strong>
                  </p>
                  <p className="text-slate-600">
                    Currently Reserved: <strong className="text-amber-700 font-bold">{stockEditEntry.reserved} units</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Total Quantity in Stock <span className="text-pop-pink font-black">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet font-mono font-bold shadow-pop-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-100">
                  <button
                    type="button"
                    onClick={() => setStockEditEntry(null)}
                    className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl border-2 border-slate-900 shadow-pop-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingStock}
                    className="btn-candy bg-pop-mint hover:bg-pop-mint/90 text-slate-900 text-xs font-heading font-black px-4 py-1.5 rounded-xl border-2 border-slate-900 shadow-pop cursor-pointer"
                  >
                    {savingStock ? 'Updating...' : 'Update Quantity'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* ── Modal: Connect Product to Warehouse ─────────────────────────── */}
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
                    Connecting a product creates a live record in the <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300">warehouse_stocks</code> table. When sales reps configure quotes, our engine automatically checks and allocates stock from the nearest warehouse.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Select Target Warehouse Facility <span className="text-pop-pink font-black">*</span>
                  </label>
                  <select
                    required
                    value={connectWhId}
                    onChange={(e) => setConnectWhId(e.target.value)}
                    className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet shadow-pop-xs"
                  >
                    {(allWarehouses.length > 0 ? allWarehouses : warehouses).map((wh) => (
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
                    className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet shadow-pop-xs"
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
                    className="w-full bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet font-mono font-bold shadow-pop-xs"
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
