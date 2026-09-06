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
  X,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { productsAPI } from '../../api';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [subscriptionFilter, setSubscriptionFilter] = useState('ALL'); // ALL, SUBSCRIPTION, ONE_TIME
  const [viewMode, setViewMode] = useState('table'); // table, grid

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Sorting State
  const [sortField, setSortField] = useState('name'); // 'name' | 'sku' | 'category' | 'basePrice' | 'costPrice' | 'margin' | 'stock' | 'created_at'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'basePrice' || field === 'margin' || field === 'stock' || field === 'created_at' ? 'desc' : 'asc');
    }
  };

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

  // Load Data directly from PostgreSQL database via search & filter query params
  const fetchData = async (q = search, cat = selectedCategory, sub = subscriptionFilter) => {
    try {
      setLoading(true);
      const params = {};
      if (q && q.trim()) params.search = q.trim();
      if (cat && cat !== 'ALL') params.category = cat;
      if (sub && sub !== 'ALL') {
        params.isSubscription = sub === 'SUBSCRIPTION' ? 'true' : 'false';
      }

      const [prodsRes, catsRes] = await Promise.all([
        productsAPI.getAll(params),
        productsAPI.getCategories()
      ]);
      const normalizedProds = (prodsRes || []).map((p) => ({
        ...p,
        isSubscription: Boolean(p.isSubscription ?? p.is_subscription),
        basePrice: p.basePrice ?? p.base_price ?? 0,
        costPrice: p.costPrice ?? p.cost_price ?? 0,
        billingCycle: p.billingCycle ?? p.billing_cycle ?? 'MONTHLY',
        categoryId: p.categoryId ?? p.category_id ?? (p.category?.id || ''),
        warehouseStocks: p.warehouseStocks ?? p.warehouse_stocks ?? [],
      }));
      setProducts(normalizedProds);
      setCategories(catsRes || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      toast.error('Failed to fetch product catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(search, selectedCategory, subscriptionFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, subscriptionFilter]);

  // Products sorted deterministically based on active sort options
  const filteredProducts = useMemo(() => {
    const list = [...products];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else if (sortField === 'sku') {
        cmp = (a.sku || '').localeCompare(b.sku || '');
      } else if (sortField === 'category') {
        const aCat = a.category?.name || '';
        const bCat = b.category?.name || '';
        cmp = aCat.localeCompare(bCat);
      } else if (sortField === 'basePrice') {
        const aBase = Number(a.basePrice) || 0;
        const bBase = Number(b.basePrice) || 0;
        cmp = aBase - bBase;
      } else if (sortField === 'costPrice') {
        const aCost = Number(a.costPrice) || 0;
        const bCost = Number(b.costPrice) || 0;
        cmp = aCost - bCost;
      } else if (sortField === 'margin') {
        const aBase = Number(a.basePrice) || 0;
        const aCost = Number(a.costPrice) || 0;
        const aMar = aBase > 0 ? ((aBase - aCost) / aBase) * 100 : 0;
        const bBase = Number(b.basePrice) || 0;
        const bCost = Number(b.costPrice) || 0;
        const bMar = bBase > 0 ? ((bBase - bCost) / bBase) * 100 : 0;
        cmp = aMar - bMar;
      } else if (sortField === 'stock') {
        const aStock = (a.warehouseStocks || []).reduce((acc, s) => acc + (s.quantity || 0), 0);
        const bStock = (b.warehouseStocks || []).reduce((acc, s) => acc + (s.quantity || 0), 0);
        cmp = aStock - bStock;
      } else {
        // Default: created_at / updated_at
        const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
        const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
        cmp = aDate - bDate;
      }

      if (cmp === 0) {
        cmp = String(a.id).localeCompare(String(b.id));
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [products, sortField, sortOrder]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, selectedCategory, subscriptionFilter]);

  // Paginated slice
  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

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
      categoryId: product.categoryId || product.category_id || (product.category?.id || ''),
      basePrice: product.basePrice ?? product.base_price ?? '',
      costPrice: product.costPrice ?? product.cost_price ?? '0',
      tax: product.tax || '18',
      unit: product.unit || 'piece',
      isSubscription: Boolean(product.isSubscription ?? product.is_subscription),
      billingCycle: product.billingCycle || product.billing_cycle || 'MONTHLY'
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pop-sky border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
              <Package className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 tracking-tight">
                  Products & Inventory Master
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pop-sky/30 text-sky-950 border-2 border-slate-900 shadow-pop-sm">
                  CPQ Catalog
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Global catalog with pricing structures, tax rates, warehouse inventory tracking, and subscription flags.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="btn-candy bg-pop-violet hover:bg-pop-violet/90 text-white font-bold text-xs flex items-center justify-center gap-2 px-5 py-2.5 shadow-pop"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Product</span>
        </button>
      </div>

      {/* ── KPI METRICS CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Total SKUs
            </p>
            <h3 className="text-2xl font-heading font-black text-slate-900 mt-0.5">{stats.total}</h3>
            <p className="text-[10px] font-bold text-pop-violet mt-0.5">Active Catalog Items</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pop-sky/40 border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
            <Package className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Categories
            </p>
            <h3 className="text-2xl font-heading font-black text-slate-900 mt-0.5">{categories.length}</h3>
            <p className="text-[10px] font-bold text-emerald-700 mt-0.5">Discount Tier Linked</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pop-mint/40 border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
            <Layers className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Subscription SKUs
            </p>
            <h3 className="text-2xl font-heading font-black text-slate-900 mt-0.5">{stats.subs}</h3>
            <p className="text-[10px] font-bold text-purple-700 mt-0.5">Recurring SaaS Plans</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 flex items-center justify-center shadow-pop-sm">
            <RefreshCw className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Stock In Hand
            </p>
            <h3 className="text-2xl font-heading font-black text-slate-900 mt-0.5 font-mono">{stats.totalStock}</h3>
            <p className="text-[10px] font-bold text-amber-700 mt-0.5">Across All Depots</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pop-yellow border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
            <Boxes className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* ── CONTROLS & FILTER BAR ─────────────────────────────────────────── */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-pop">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]" />
            <input
              type="text"
              placeholder="Search products by name, SKU, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-paper border-2 border-slate-900 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pop-violet transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-paper border-2 border-slate-900 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet transition-colors"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Max {c.maxDiscount}%)
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <div className="flex items-center bg-slate-100 border-2 border-slate-900 rounded-2xl p-1 text-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ONE_TIME', label: 'Hardware/One-Time' },
              { id: 'SUBSCRIPTION', label: 'Subscription' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubscriptionFilter(t.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  subscriptionFilter === t.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Quick Sort Controls */}
          <div className="flex items-center gap-1.5 bg-paper border-2 border-slate-900 rounded-2xl px-2.5 py-1.5">
            <span className="text-[10px] text-slate-500 font-heading font-black uppercase tracking-wider hidden sm:inline">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="name">Product Name (A-Z)</option>
              <option value="sku">SKU Code</option>
              <option value="category">Category</option>
              <option value="basePrice">Base Price</option>
              <option value="margin">Margin %</option>
              <option value="stock">Warehouse Stock</option>
              <option value="created_at">Latest Update</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1 rounded-lg bg-white hover:bg-pop-yellow text-slate-900 border border-slate-900 shadow-pop-xs transition-transform active:translate-y-0.5 cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending (Click for Descending)' : 'Descending (Click for Ascending)'}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-pop-violet" strokeWidth={3} />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-pop-violet" strokeWidth={3} />
              )}
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            className="btn-candy bg-white hover:bg-slate-50 text-slate-900 px-3.5 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-bold shadow-pop-sm"
          >
            Switch to {viewMode === 'table' ? 'Grid Cards' : 'Table View'}
          </button>
        </div>
      </div>

      {/* ── PRODUCT LISTING TABLE / GRID ───────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-12 text-center shadow-pop">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-pop-violet rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-600">Loading catalog items...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-12 text-center shadow-pop">
          <div className="w-14 h-14 rounded-2xl bg-pop-sky/30 border-2 border-slate-900 flex items-center justify-center mx-auto mb-3 shadow-pop-sm">
            <Package className="w-7 h-7 text-slate-900 stroke-[2.5]" />
          </div>
          <h3 className="text-base font-heading font-black text-slate-900">No products found</h3>
          <p className="text-xs font-medium text-slate-600 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or category filters.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-[10px] uppercase font-mono font-black text-slate-800 tracking-wider">
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200 transition-colors select-none"
                    title="Sort by Product Name"
                  >
                    <div className="flex items-center gap-1">
                      <span>Product & SKU</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-violet-700" /> : <ArrowDown className="w-3 h-3 text-violet-700" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('category')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200 transition-colors select-none"
                    title="Sort by Category"
                  >
                    <div className="flex items-center gap-1">
                      <span>Category</span>
                      {sortField === 'category' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-violet-700" /> : <ArrowDown className="w-3 h-3 text-violet-700" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center hidden sm:table-cell">Type</th>
                  <th
                    onClick={() => handleSort('basePrice')}
                    className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200 transition-colors select-none"
                    title="Sort by Base Price"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Base Price</span>
                      {sortField === 'basePrice' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-violet-700" /> : <ArrowDown className="w-3 h-3 text-violet-700" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('costPrice')}
                    className="py-3 px-4 text-right hidden sm:table-cell cursor-pointer hover:bg-slate-200 transition-colors select-none"
                    title="Sort by Cost Price"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Cost Price</span>
                      {sortField === 'costPrice' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-violet-700" /> : <ArrowDown className="w-3 h-3 text-violet-700" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('margin')}
                    className="py-3 px-4 text-center cursor-pointer hover:bg-slate-200 transition-colors select-none"
                    title="Sort by Margin %"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Margin</span>
                      {sortField === 'margin' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-violet-700" /> : <ArrowDown className="w-3 h-3 text-violet-700" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center hidden md:table-cell">Tax</th>
                  <th
                    onClick={() => handleSort('stock')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200 transition-colors select-none"
                    title="Sort by Warehouse Stock"
                  >
                    <div className="flex items-center gap-1">
                      <span>Warehouse Stock</span>
                      {sortField === 'stock' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-violet-700" /> : <ArrowDown className="w-3 h-3 text-violet-700" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {pagedProducts.map((p) => {
                  const base = Number(p.basePrice) || 0;
                  const cost = Number(p.costPrice) || 0;
                  const margin = base > 0 ? (((base - cost) / base) * 100).toFixed(1) : '0.0';
                  const totalStock = (p.warehouseStocks || []).reduce(
                    (acc, s) => acc + (s.quantity || 0),
                    0
                  );

                  return (
                    <tr key={p.id} className="hover:bg-amber-50/40 transition-colors">
                      {/* Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-heading font-extrabold text-slate-900 text-sm">{p.name}</div>
                        <div className="text-[11px] font-mono text-pop-violet font-bold flex items-center gap-1.5 mt-0.5">
                          <span>{p.sku}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 font-sans font-medium">{p.unit || 'piece'}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-sm">
                          {p.category?.name || 'General'}
                        </span>
                      </td>

                      {/* Subscription or One-Time */}
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        {p.isSubscription ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-mono font-black bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm">
                            <RefreshCw className="w-2.5 h-2.5 stroke-[2.5]" />
                            {p.billingCycle || 'MONTHLY'}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-xl text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border-2 border-slate-900">
                            One-Time
                          </span>
                        )}
                      </td>

                      {/* Base Price */}
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        ₹{base.toLocaleString()}
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-600 hidden sm:table-cell">
                        ₹{cost.toLocaleString()}
                      </td>

                      {/* Margin */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono font-black text-xs px-2 py-0.5 rounded-xl border-2 border-slate-900 shadow-pop-sm ${
                            Number(margin) >= 30
                              ? 'bg-pop-mint/40 text-emerald-950'
                              : Number(margin) >= 15
                              ? 'bg-pop-yellow/40 text-amber-950'
                              : 'bg-pop-pink/40 text-rose-950'
                          }`}
                        >
                          {margin}%
                        </span>
                      </td>

                      {/* Tax */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 hidden md:table-cell">
                        {p.tax}%
                      </td>

                      {/* Warehouse Stock breakdown */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-xl text-[10px] font-mono font-black border-2 border-slate-900 shadow-pop-sm ${
                              totalStock > 20
                                ? 'bg-pop-mint text-slate-900'
                                : totalStock > 0
                                ? 'bg-pop-yellow text-slate-900'
                                : 'bg-pop-pink text-slate-900'
                            }`}
                          >
                            {totalStock} Total
                          </span>
                          {p.warehouseStocks?.map((ws) => (
                            <span
                              key={ws.id}
                              className="text-[10px] text-slate-800 bg-white px-2 py-0.5 rounded-lg border-2 border-slate-900 font-mono font-bold shadow-pop-xs"
                              title={`${ws.warehouse?.name}: ${ws.quantity} available`}
                            >
                              {ws.warehouse?.name?.split(' ')[0]}: {ws.quantity}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-xl bg-pop-pink/30 hover:bg-pop-pink/60 text-rose-950 border-2 border-slate-900 shadow-pop-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
                            title="Deactivate Product"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t-2 border-slate-900">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            />
          </div>
        </div>
      ) : (
        /* ── GRID CARD VIEW ───────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pagedProducts.map((p) => {
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
                className="bg-white border-2 border-slate-900 rounded-3xl p-5 flex flex-col justify-between gap-4 shadow-pop hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-pop-violet bg-pop-violet/10 border-2 border-slate-900 px-2 py-0.5 rounded-lg shadow-pop-sm">
                        {p.sku}
                      </span>
                      <h4 className="text-base font-heading font-extrabold text-slate-900 mt-2">{p.name}</h4>
                      <p className="text-xs text-slate-600 font-medium mt-0.5 line-clamp-2">
                        {p.description || 'No description provided'}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-800 border-2 border-slate-900 shrink-0 shadow-pop-sm">
                      {p.category?.name || 'General'}
                    </span>
                  </div>

                  {/* Price & Margin Matrix */}
                  <div className="grid grid-cols-3 gap-2 mt-4 bg-paper p-3 rounded-2xl border-2 border-slate-900 text-center font-mono shadow-inner">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Base Price</div>
                      <div className="text-sm font-black text-slate-900 mt-0.5">
                        ₹{base.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Cost</div>
                      <div className="text-sm font-bold text-slate-600 mt-0.5">
                        ₹{cost.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Margin</div>
                      <div
                        className={`text-sm font-black mt-0.5 ${
                          Number(margin) >= 30
                            ? 'text-emerald-700'
                            : Number(margin) >= 15
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {margin}%
                      </div>
                    </div>
                  </div>

                  {/* Warehouse stocks */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t-2 border-slate-100 pt-3">
                    <span className="flex items-center gap-1.5 font-mono font-medium">
                      <Warehouse className="w-3.5 h-3.5 text-slate-700 stroke-[2.5]" />
                      Stock: <span className="font-bold text-slate-900">{totalStock}</span> units
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      Tax: {p.tax}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="btn-candy bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl border-2 border-slate-900 shadow-pop-sm flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3 h-3 stroke-[2.5]" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="btn-candy bg-pop-pink/30 hover:bg-pop-pink/50 text-rose-950 text-xs font-bold px-3 py-1.5 rounded-xl border-2 border-slate-900 shadow-pop-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3 stroke-[2.5]" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid view pagination */}
      {viewMode === 'grid' && filteredProducts.length > 0 && (
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-4 shadow-pop">
          <Pagination
            currentPage={currentPage}
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          />
        </div>
      )}

      {/* ── CREATE / EDIT PRODUCT MODAL ────────────────────────────────────── */}
      {isModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-pop-xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 bg-amber-50/70 border-b-2 border-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pop-sky border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
                  <Package className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-heading font-extrabold text-slate-900">
                  {editingProduct ? 'Edit Product SKU' : 'Create New Product'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl border-2 border-slate-900 hover:bg-slate-100 text-slate-900 shadow-pop-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pop-violet"
                    placeholder="e.g. Enterprise Cloud ERP"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pop-violet"
                    placeholder="e.g. ERP-ENT-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  Product Category *
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-pop-violet"
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
                  <label className="block text-slate-800 font-bold mb-1">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-pop-violet"
                    placeholder="25000"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-pop-violet"
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.tax}
                    onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                    className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-pop-violet"
                    placeholder="18"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pop-violet"
                    placeholder="piece, user, month..."
                  />
                </div>
                <div>
                  <label className="block text-slate-800 font-bold mb-1">
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
                      className="w-4 h-4 rounded border-2 border-slate-900 text-pop-violet focus:ring-pop-violet"
                    />
                    <label htmlFor="isSubscription" className="text-slate-800 font-bold cursor-pointer">
                      Subscription Recurring
                    </label>
                  </div>
                </div>
              </div>

              {formData.isSubscription && (
                <div>
                  <label className="block text-slate-800 font-bold mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-pop-violet"
                  >
                    <option value="MONTHLY">Monthly Billing</option>
                    <option value="QUARTERLY">Quarterly Billing</option>
                    <option value="YEARLY">Yearly Billing</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-800 font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-paper border-2 border-slate-900 rounded-xl px-3 py-2 text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pop-violet"
                  placeholder="Optional details, terms, or tech specs..."
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-candy bg-white hover:bg-slate-100 text-slate-900 font-bold px-4 py-2 rounded-xl border-2 border-slate-900 shadow-pop-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-candy bg-pop-violet hover:bg-pop-violet/90 text-white font-bold px-5 py-2 rounded-xl border-2 border-slate-900 shadow-pop disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
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
