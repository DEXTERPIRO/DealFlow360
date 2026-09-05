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
  Package
} from 'lucide-react';
import { fulfillmentAPI, productsAPI } from '../../api';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';

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

  // ── 1. Load Warehouses & Stock ───────────────────────────────────────────

  const loadWarehouses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fulfillmentAPI.getWarehouseStock();
      const list = Array.isArray(res) ? res : res?.warehouses || [];
      setWarehouses(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warehouse inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

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

  const filteredStock = useMemo(() => {
    return flattenedStock.filter((item) => {
      const matchesWh =
        warehouseFilter === 'ALL' || item.warehouseId === warehouseFilter;
      const q = searchProduct.toLowerCase();
      const matchesProd =
        !q ||
        item.productName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q);
      return matchesWh && matchesProd;
    });
  }, [flattenedStock, warehouseFilter, searchProduct]);

  // Stock Pagination
  const [stockPage, setStockPage] = useState(1);
  const stockPageSize = 8;

  useEffect(() => {
    setStockPage(1);
  }, [warehouseFilter, searchProduct]);

  const pagedStock = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return filteredStock.slice(start, start + stockPageSize);
  }, [filteredStock, stockPage, stockPageSize]);

  const getStockColorClass = (avail) => {
    if (avail > 20) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (avail >= 5) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-10">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <WarehouseIcon size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Warehouses & Stock Control
              </h1>
              <p className="text-xs text-slate-400">
                Multi-location distribution hubs, shipping rates, and live SKU inventory management
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setWarehouseModalData({ name: '', location: '', shippingCost: 0, isActive: true })}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          Add Warehouse
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 1: WAREHOUSE MANAGEMENT CARDS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Truck size={17} className="text-indigo-400" />
          Fulfillment Facilities
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 rounded-3xl bg-slate-900 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-slate-800/80 bg-slate-900/40">
            <WarehouseIcon size={36} className="mx-auto text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-400">No warehouses configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {warehouses.map((wh) => {
              const skuCount = (wh.stocks || []).length;
              const totalUnits = (wh.stocks || []).reduce(
                (sum, s) => sum + (s.quantity || 0),
                0
              );
              const isWhActive = wh.is_active !== false;

              return (
                <div
                  key={wh.id}
                  className={`rounded-3xl border p-6 flex flex-col justify-between transition-all ${
                    isWhActive
                      ? 'border-slate-800/90 bg-slate-900/70 hover:border-slate-700 shadow-xl'
                      : 'border-slate-800/40 bg-slate-950/40 opacity-70'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white">{wh.name}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} className="text-slate-500 flex-shrink-0" />
                          {wh.location || 'Location Not Specified'}
                        </p>
                      </div>

                      {/* Active Toggle Switch */}
                      <button
                        onClick={() => handleToggleActive(wh)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                          isWhActive
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700/40 text-slate-500 border-slate-700'
                        }`}
                      >
                        {isWhActive ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800/60">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                          Total SKUs
                        </p>
                        <p className="font-mono text-lg font-black text-white mt-0.5">
                          {skuCount}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800/60">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                          Total Units
                        </p>
                        <p className="font-mono text-lg font-black text-emerald-400 mt-0.5">
                          {totalUnits}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Shipping Cost / Delivery:</span>
                      <span className="font-mono font-bold text-slate-200">
                        ₹{Number(wh.shipping_cost || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex justify-end">
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
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      <Edit3 size={13} />
                      Edit Facility
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 2: STOCK MANAGEMENT TABLE
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Boxes size={17} className="text-indigo-400" />
              Live Stock Management
            </h2>
            <p className="text-xs text-slate-400">
              Per-facility inventory count, allocated orders, and net available quantities
            </p>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> &gt; 20 (Healthy)
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> 5 - 20 (Low)
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> &lt; 5 (Critical)
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              placeholder="Search product or SKU..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 whitespace-nowrap">Warehouse:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="ALL">All Facilities</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stock Table */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400">
                  <th className="py-3.5 px-6 font-semibold">Warehouse</th>
                  <th className="py-3.5 px-4 font-semibold">Product</th>
                  <th className="py-3.5 px-4 font-semibold font-mono">SKU</th>
                  <th className="py-3.5 px-4 font-semibold text-center">In Stock</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Reserved</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Available</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No matching stock items found.
                    </td>
                  </tr>
                ) : (
                  pagedStock.map((row, idx) => {
                    const badgeClass = getStockColorClass(row.available);

                    return (
                      <tr
                        key={`${row.warehouseId}-${row.productId}-${idx}`}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-white">
                          {row.warehouseName}
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-200">
                          {row.productName}
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-400">
                          {row.sku}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-slate-300">
                          {row.quantity}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-slate-400">
                          {row.reserved}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-3 py-0.5 rounded-full font-mono font-black text-xs border ${badgeClass}`}
                          >
                            {row.available}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleOpenStockEdit(row)}
                            className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
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
          <div className="p-4 border-t border-slate-800">
            <Pagination
              currentPage={stockPage}
              totalItems={filteredStock.length}
              pageSize={stockPageSize}
              onPageChange={setStockPage}
            />
          </div>
        </div>
      </div>

      {/* ── Modal: Add / Edit Warehouse ──────────────────────────────────── */}
      {warehouseModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {warehouseModalData.id ? 'Edit Warehouse' : 'Add Warehouse'}
              </h3>
              <button
                onClick={() => setWarehouseModalData(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Warehouse Name <span className="text-rose-400">*</span>
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setWarehouseModalData(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWarehouse}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-indigo-600/20"
                >
                  {savingWarehouse ? 'Saving...' : 'Save Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Stock Quantity ───────────────────────────────────── */}
      {stockEditEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Update Stock Quantity</h3>
              <button
                onClick={() => setStockEditEntry(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs space-y-1">
                <p className="text-slate-400">
                  Facility: <strong className="text-white">{stockEditEntry.warehouseName}</strong>
                </p>
                <p className="text-slate-400">
                  Product: <strong className="text-white">{stockEditEntry.productName}</strong>
                </p>
                <p className="text-slate-400">
                  Currently Reserved: <strong className="text-amber-400">{stockEditEntry.reserved} units</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Total Quantity in Stock <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStockEditEntry(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStock}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
                >
                  {savingStock ? 'Updating...' : 'Update Quantity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
