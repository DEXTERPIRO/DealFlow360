import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Layers,
  DollarSign,
  RefreshCw,
  Boxes,
  TrendingUp,
  Tag,
  CheckCircle,
  XCircle,
  Clock,
  Warehouse,
  ChevronDown,
  X
} from 'lucide-react';
import { productsAPI } from '../../api';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [subscriptionFilter, setSubscriptionFilter] = useState('ALL'); // ALL, SUBSCRIPTION, ONE_TIME
  const [viewMode, setViewMode] = useState('table'); // table, grid

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    basePrice: '',
    costPrice: '',
    tax: '18',
    unit: 'piece',
    isSubscription: false,
    billingCycle: 'MONTHLY'
  });
  const [submitting, setSubmitting] = useState(false);

  // Load Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodsRes, catsRes] = await Promise.all([
        productsAPI.getAll(),
        productsAPI.getCategories()
      ]);
      setProducts(prodsRes || []);
      setCategories(catsRes || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      toast.error('Failed to fetch product catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        search === '' ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase());

      const matchesCat =
        selectedCategory === 'ALL' || p.categoryId === selectedCategory;

      const matchesSub =
        subscriptionFilter === 'ALL' ||
        (subscriptionFilter === 'SUBSCRIPTION' && p.isSubscription) ||
        (subscriptionFilter === 'ONE_TIME' && !p.isSubscription);

      return matchesSearch && matchesCat && matchesSub;
    });
  }, [products, search, selectedCategory, subscriptionFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = products.length;
    const subs = products.filter((p) => p.isSubscription).length;
    const totalStock = products.reduce((acc, p) => {
      const pStock = (p.warehouseStocks || []).reduce(
        (sum, s) => sum + (s.quantity || 0),
        0
      );
      return acc + pStock;
    }, 0);
    const avgMargin =
      total > 0
        ? (
            products.reduce((acc, p) => {
              const base = Number(p.basePrice) || 0;
              const cost = Number(p.costPrice) || 0;
              const margin = base > 0 ? ((base - cost) / base) * 100 : 0;
              return acc + margin;
            }, 0) / total
          ).toFixed(1)
        : '0.0';

    return { total, subs, totalStock, avgMargin };
  }, [products]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      description: '',
      categoryId: categories[0]?.id || '',
      basePrice: '',
      costPrice: '',
      tax: '18',
      unit: 'piece',
      isSubscription: false,
      billingCycle: 'MONTHLY'
    });
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description || '',
      categoryId: product.categoryId,
      basePrice: product.basePrice,
      costPrice: product.costPrice || '0',
      tax: product.tax || '18',
      unit: product.unit || 'piece',
      isSubscription: Boolean(product.isSubscription),
      billingCycle: product.billingCycle || 'MONTHLY'
    });
    setIsModalOpen(true);
  };

  // Submit create or edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.categoryId || !formData.basePrice) {
      toast.error('Please fill in required fields (Name, SKU, Category, Price)');
      return;
    }

    try {
      setSubmitting(true);
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, formData);
        toast.success(`Product "${formData.name}" updated successfully!`);
      } else {
        await productsAPI.create(formData);
        toast.success(`Product "${formData.name}" created successfully!`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err?.error || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  // Soft delete product
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate product "${name}"?`)) return;
    try {
      await productsAPI.delete(id);
      toast.success(`Product "${name}" deactivated`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to deactivate product');
    }
  };

  return (
    <div className="space-y-6 pb-12 antialiased">
      {/* ── HEADER ROW ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Products & Inventory Master
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              CPQ Catalog
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global catalog with pricing structures, tax rates, warehouse inventory tracking, and subscription flags.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* ── KPI METRICS CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Total SKUs
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">{stats.total}</h3>
            <p className="text-[10px] text-blue-400 mt-0.5">Active Catalog Items</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Categories
            </p>
            <h3 className="text-2xl font-black text-emerald-400 mt-0.5">{categories.length}</h3>
            <p className="text-[10px] text-emerald-400/80 mt-0.5">Discount Tier Linked</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Subscription SKUs
            </p>
            <h3 className="text-2xl font-black text-purple-400 mt-0.5">{stats.subs}</h3>
            <p className="text-[10px] text-purple-400/80 mt-0.5">Recurring SaaS Plans</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Stock In Hand
            </p>
            <h3 className="text-2xl font-black text-amber-400 mt-0.5">{stats.totalStock}</h3>
            <p className="text-[10px] text-amber-400/80 mt-0.5">Across All Depots</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── CONTROLS & FILTER BAR ─────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search products by name, SKU, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Max {c.maxDiscount}%)
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ONE_TIME', label: 'Hardware/One-Time' },
              { id: 'SUBSCRIPTION', label: 'Subscription' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubscriptionFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  subscriptionFilter === t.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-300 hover:text-white transition-colors"
          >
            Switch to {viewMode === 'table' ? 'Grid Cards' : 'Table View'}
          </button>
        </div>
      </div>

      {/* ── PRODUCT LISTING TABLE / GRID ───────────────────────────────────── */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading catalog items...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No products found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search query or category filters.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] uppercase font-bold text-slate-400 font-mono">
                  <th className="py-3 px-4">Product & SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Type</th>
                  <th className="py-3 px-4 text-right">Base Price</th>
                  <th className="py-3 px-4 text-right">Cost Price</th>
                  <th className="py-3 px-4 text-center">Margin</th>
                  <th className="py-3 px-4 text-center">Tax</th>
                  <th className="py-3 px-4">Warehouse Stock</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const base = Number(p.basePrice) || 0;
                  const cost = Number(p.costPrice) || 0;
                  const margin = base > 0 ? (((base - cost) / base) * 100).toFixed(1) : '0.0';
                  const totalStock = (p.warehouseStocks || []).reduce(
                    (acc, s) => acc + (s.quantity || 0),
                    0
                  );

                  return (
                    <tr key={p.id} className="hover:bg-slate-850/50 transition-colors">
                      {/* Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{p.name}</div>
                        <div className="text-[11px] font-mono text-blue-400 flex items-center gap-1.5">
                          <span>{p.sku}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{p.unit || 'piece'}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {p.category?.name || 'General'}
                        </span>
                      </td>

                      {/* Subscription or One-Time */}
                      <td className="py-3 px-4 text-center">
                        {p.isSubscription ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <RefreshCw className="w-2.5 h-2.5" />
                            {p.billingCycle || 'MONTHLY'}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            One-Time
                          </span>
                        )}
                      </td>

                      {/* Base Price */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                        ₹{base.toLocaleString()}
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        ₹{cost.toLocaleString()}
                      </td>

                      {/* Margin */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono font-bold text-xs ${
                            Number(margin) >= 30
                              ? 'text-emerald-400'
                              : Number(margin) >= 15
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {margin}%
                        </span>
                      </td>

                      {/* Tax */}
                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {p.tax}%
                      </td>

                      {/* Warehouse Stock breakdown */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              totalStock > 20
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : totalStock > 0
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {totalStock} Total
                          </span>
                          {p.warehouseStocks?.map((ws) => (
                            <span
                              key={ws.id}
                              className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono"
                              title={`${ws.warehouse?.name}: ${ws.quantity} available`}
                            >
                              {ws.warehouse?.name?.split(' ')[0]}: {ws.quantity}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Deactivate Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID CARD VIEW ───────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const base = Number(p.basePrice) || 0;
            const cost = Number(p.costPrice) || 0;
            const margin = base > 0 ? (((base - cost) / base) * 100).toFixed(1) : '0.0';
            const totalStock = (p.warehouseStocks || []).reduce(
              (acc, s) => acc + (s.quantity || 0),
              0
            );

            return (
              <div
                key={p.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-slate-700 transition-colors shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                        {p.sku}
                      </span>
                      <h4 className="text-base font-bold text-white mt-1.5">{p.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {p.description || 'No description provided'}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                      {p.category?.name || 'General'}
                    </span>
                  </div>

                  {/* Price & Margin Matrix */}
                  <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Base Price</div>
                      <div className="text-sm font-black text-white mt-0.5">
                        ₹{base.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Cost</div>
                      <div className="text-sm font-semibold text-slate-400 mt-0.5">
                        ₹{cost.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Margin</div>
                      <div
                        className={`text-sm font-black mt-0.5 ${
                          Number(margin) >= 30
                            ? 'text-emerald-400'
                            : Number(margin) >= 15
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {margin}%
                      </div>
                    </div>
                  </div>

                  {/* Warehouse stocks */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                    <span className="flex items-center gap-1 font-mono">
                      <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                      Stock: <span className="font-bold text-white">{totalStock}</span> units
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Tax: {p.tax}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT PRODUCT MODAL ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingProduct ? 'Edit Product SKU' : 'Create New Product'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Enterprise Cloud ERP"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. ERP-ENT-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Product Category *
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>
                    Select category...
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Max Discount {c.maxDiscount}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    placeholder="25000"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.tax}
                    onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                    placeholder="18"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="piece, user, month..."
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Billing Type
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="isSubscription"
                      checked={formData.isSubscription}
                      onChange={(e) =>
                        setFormData({ ...formData, isSubscription: e.target.checked })
                      }
                      className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isSubscription" className="text-slate-300 font-medium">
                      Subscription Recurring
                    </label>
                  </div>
                </div>
              </div>

              {formData.isSubscription && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="MONTHLY">Monthly Billing</option>
                    <option value="QUARTERLY">Quarterly Billing</option>
                    <option value="YEARLY">Yearly Billing</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Optional details, terms, or tech specs..."
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-all shadow-lg shadow-blue-600/20"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
