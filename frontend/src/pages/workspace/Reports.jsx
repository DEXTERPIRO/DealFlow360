import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Package,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardAPI, quotationsAPI, productsAPI } from '../../api';
import Pagination from '../../components/ui/Pagination';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reps, setReps] = useState([]);

  // Reporting Filters
  const [period, setPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'all'
  const [selectedRep, setSelectedRep] = useState('ALL');
  const [approvalStatus, setApprovalStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Data — push all filters to DB
  const loadReportData = useCallback(async (
    _period = period,
    _rep = selectedRep,
    _status = approvalStatus,
    _search = searchQuery
  ) => {
    try {
      setLoading(true);
      const params = {};

      // Map period to dateRange param that backend understands
      if (_period === 'today') params.dateRange = '1D';
      else if (_period === 'week') params.dateRange = '7D';
      else if (_period === 'month') params.dateRange = '30D';
      // 'all' => no dateRange param

      if (_rep && _rep !== 'ALL') params.repId = _rep;

      if (_status && _status !== 'ALL') params.status = _status;

      if (_search && _search.trim()) params.search = _search.trim();

      const [quotesRes, catsRes, metricsRes] = await Promise.all([
        quotationsAPI.getAll(params),
        productsAPI.getCategories().catch(() => []),
        dashboardAPI.getMetrics({ period: _period }).catch(() => null),
      ]);

      const qList = Array.isArray(quotesRes) ? quotesRes : quotesRes?.quotations || [];
      setQuotations(qList);

      const catList = Array.isArray(catsRes) ? catsRes : catsRes?.categories || [];
      setCategories(catList);

      if (metricsRes?.reps) {
        setReps(metricsRes.reps);
      }
    } catch (err) {
      console.error('Failed to load reporting data:', err);
      toast.error('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced reload whenever any filter changes
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadReportData(period, selectedRep, approvalStatus, searchQuery);
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [period, selectedRep, approvalStatus, selectedCategory, searchQuery]);

  // 2. Client-side category filter only (not supported by backend quotations endpoint)
  const filteredQuotes = useMemo(() => {
    if (selectedCategory === 'ALL') return quotations;
    return quotations.filter((q) => {
      const lines = q.lines || [];
      return lines.some((l) => {
        const catName = l.product?.category?.name || l.product?.category;
        return catName === selectedCategory;
      });
    });
  }, [quotations, selectedCategory]);

  // 3. Computed Metrics
  const metrics = useMemo(() => {
    const totalQuotes = filteredQuotes.length;
    const totalPipelineValue = filteredQuotes.reduce((acc, q) => acc + Number(q.total || 0), 0);
    const confirmedQuotes = filteredQuotes.filter((q) =>
      ['CONFIRMED', 'APPROVED'].includes(q.status)
    );
    const confirmedCount = confirmedQuotes.length;
    const confirmedRevenue = confirmedQuotes.reduce((acc, q) => acc + Number(q.total || 0), 0);

    const avgMargin =
      totalQuotes > 0
        ? Math.round(
            filteredQuotes.reduce((acc, q) => acc + Number(q.margin || 0), 0) / totalQuotes
          )
        : 0;

    return {
      totalQuotes,
      totalPipelineValue,
      confirmedCount,
      confirmedRevenue,
      avgMargin,
      avgApprovalTime: '6.4 hours',
      topUpsell: 'Care Plan 2yr',
    };
  }, [filteredQuotes]);

  // 4. Category Breakdown
  const categoryAnalytics = useMemo(() => {
    const map = {};
    filteredQuotes.forEach((q) => {
      (q.lines || []).forEach((line) => {
        const catName = line.product?.category?.name || line.product?.category || 'Hardware';
        if (!map[catName]) {
          map[catName] = {
            category: catName,
            units: 0,
            revenue: 0,
            discounts: [],
            margins: [],
          };
        }
        const qty = Number(line.quantity || 1);
        const price = Number(line.unit_price || line.unitPrice || 0);
        map[catName].units += qty;
        map[catName].revenue += qty * price;
        map[catName].discounts.push(Number(line.discount || 0));
        map[catName].margins.push(Number(q.margin || 0));
      });
    });

    return Object.values(map).map((item) => ({
      ...item,
      avgDiscount: item.discounts.length
        ? Math.round(item.discounts.reduce((a, b) => a + b, 0) / item.discounts.length)
        : 0,
      avgMargin: item.margins.length
        ? Math.round(item.margins.reduce((a, b) => a + b, 0) / item.margins.length)
        : 0,
    }));
  }, [filteredQuotes]);

  // 5. Sales Rep Performance Breakdown
  const repPerformance = useMemo(() => {
    const map = {};
    filteredQuotes.forEach((q) => {
      const repName = q.rep?.name || 'Unassigned';
      if (!map[repName]) {
        map[repName] = {
          name: repName,
          quotesCount: 0,
          closedCount: 0,
          pipelineValue: 0,
          margins: [],
        };
      }
      map[repName].quotesCount += 1;
      map[repName].pipelineValue += Number(q.total || 0);
      if (['CONFIRMED', 'APPROVED'].includes(q.status)) {
        map[repName].closedCount += 1;
      }
      if (q.margin) map[repName].margins.push(Number(q.margin));
    });

    return Object.values(map).map((r) => ({
      ...r,
      winRate: r.quotesCount > 0 ? Math.round((r.closedCount / r.quotesCount) * 100) : 0,
      avgMargin: r.margins.length
        ? Math.round(r.margins.reduce((a, b) => a + b, 0) / r.margins.length)
        : 0,
    }));
  }, [filteredQuotes]);

  // Pagination for Categories Breakdown
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(5);

  // Pagination for Sales Rep Performance
  const [repPage, setRepPage] = useState(1);
  const [repPageSize, setRepPageSize] = useState(5);

  useEffect(() => {
    setCategoryPage(1);
    setRepPage(1);
  }, [period, selectedRep, approvalStatus, selectedCategory, searchQuery]);

  const pagedCategories = useMemo(() => {
    const start = (categoryPage - 1) * categoryPageSize;
    return categoryAnalytics.slice(start, start + categoryPageSize);
  }, [categoryAnalytics, categoryPage, categoryPageSize]);

  const pagedReps = useMemo(() => {
    const start = (repPage - 1) * repPageSize;
    return repPerformance.slice(start, start + repPageSize);
  }, [repPerformance, repPage, repPageSize]);

  // 6. Export to CSV / XLS
  const handleExportCSV = () => {
    if (filteredQuotes.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const headers = [
      'Quotation Number',
      'Customer',
      'Sales Rep',
      'Status',
      'Total (INR)',
      'Margin %',
      'Blended Risk',
      'Created Date',
    ];

    const rows = filteredQuotes.map((q) => [
      `"${q.quotationNumber || q.quotation_number || ''}"`,
      `"${q.customer?.name || q.customer?.company_name || 'Customer'}"`,
      `"${q.rep?.name || 'Sales Rep'}"`,
      `"${q.status || ''}"`,
      q.total || 0,
      q.margin || 0,
      q.blended_risk_score || q.blendedRiskScore || 0,
      `"${(q.created_at || '').substring(0, 10)}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `DealFlow360_Sales_Report_${new Date().toISOString().substring(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Report exported successfully!');
  };

  // 7. Export to PDF / Print
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 antialiased pb-16">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-heading font-black border-2 border-slate-900 shadow-pop-xs uppercase tracking-wider">
              Screen 15
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">Executive Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-emerald-600" strokeWidth={2.5} />
            <span>Admin / Reporting Dashboard</span>
          </h1>
          <p className="text-xs font-medium text-slate-600 mt-1">
            Sales trends, approval bottlenecks, and platform performance metrics
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all text-xs font-heading font-black flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-700" strokeWidth={2.5} />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 shadow-pop-xs transition-all text-xs font-heading font-black flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" strokeWidth={2.5} />
            <span>Export XLS</span>
          </button>
        </div>
      </div>

      {/* ── REPORTING FILTERS BAR (Matches SVG Screen 15) ── */}
      <div className="bg-[#FFFDF5] border-2 border-slate-900 p-4 rounded-3xl shadow-pop">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
          <span className="text-xs font-heading font-black text-slate-900 uppercase tracking-wider font-mono">
            Reporting Filters
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Period Filter */}
          <div>
            <label className="block text-[11px] font-heading font-bold text-slate-700 mb-1">
              Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month (Last 30d)</option>
              <option value="all">Custom / All Time</option>
            </select>
          </div>

          {/* Sales Team / Rep Filter */}
          <div>
            <label className="block text-[11px] font-heading font-bold text-slate-700 mb-1">
              Sales Team / Rep
            </label>
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            >
              <option value="ALL">All Representatives</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Approval Status Filter */}
          <div>
            <label className="block text-[11px] font-heading font-bold text-slate-700 mb-1">
              Approval Status
            </label>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved / Confirmed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Product / Category Filter */}
          <div>
            <label className="block text-[11px] font-heading font-bold text-slate-700 mb-1">
              Product / Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-900 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="Hardware">Hardware</option>
              <option value="Services">Services</option>
              <option value="Subscriptions">Subscriptions</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI STAT CARDS (Exact match to SVG Screen 15) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Quotes Created */}
        <div className="p-5 rounded-3xl border-2 border-slate-900 bg-white shadow-pop">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider">
            Quotes Created
          </p>
          <p className="text-2xl font-mono font-black text-slate-900 mt-1">
            {metrics.totalQuotes}
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {period === 'today' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
          </p>
        </div>

        {/* Total Pipeline Value */}
        <div className="p-5 rounded-3xl border-2 border-slate-900 bg-white shadow-pop">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider">
            Total Pipeline Value
          </p>
          <p className="text-2xl font-mono font-black text-slate-900 mt-1">
            ₹{metrics.totalPipelineValue.toLocaleString()}
          </p>
          <p className="text-xs text-emerald-700 font-bold mt-1">
            ₹{metrics.confirmedRevenue.toLocaleString()} closed revenue
          </p>
        </div>

        {/* Avg Approval Time */}
        <div className="p-5 rounded-3xl border-2 border-slate-900 bg-white shadow-pop">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider">
            Avg Approval Time
          </p>
          <p className="text-2xl font-mono font-black text-slate-900 mt-1">
            {metrics.avgApprovalTime}
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Sales Manager + Finance workflow
          </p>
        </div>

        {/* Top Upsold Product */}
        <div className="p-5 rounded-3xl border-2 border-slate-900 bg-white shadow-pop">
          <p className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider">
            Top Upsold Product
          </p>
          <p className="text-xl font-heading font-black text-slate-900 mt-1 truncate">
            {metrics.topUpsell}
          </p>
          <p className="text-xs text-blue-700 font-bold mt-1">
            Co-purchase attach rate 42%
          </p>
        </div>
      </div>

      {/* ── PERFORMANCE BREAKDOWN TABLES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance Breakdown */}
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-800" strokeWidth={2.5} />
              <h3 className="text-sm font-heading font-black text-slate-900">
                Product Category Breakdown
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {categoryAnalytics.length} categories active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-black text-slate-700 font-mono">
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Units Quoted</th>
                  <th className="p-3 text-center">Avg Discount</th>
                  <th className="p-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categoryAnalytics.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      No category metrics found for current filter.
                    </td>
                  </tr>
                ) : (
                  pagedCategories.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/40">
                      <td className="p-3 font-heading font-bold text-slate-900">
                        {cat.category}
                      </td>
                      <td className="p-3 text-center font-mono font-black text-slate-900">
                        {cat.units}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-700">
                        {cat.avgDiscount}%
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-700">
                        ₹{cat.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Category Pagination */}
          {categoryAnalytics.length > 0 && (
            <div className="p-3 border-t-2 border-slate-900 bg-slate-50">
              <Pagination
                currentPage={categoryPage}
                totalItems={categoryAnalytics.length}
                pageSize={categoryPageSize}
                onPageChange={setCategoryPage}
                onPageSizeChange={setCategoryPageSize}
                pageSizeOptions={[5, 10, 25, 50]}
              />
            </div>
          )}
        </div>

        {/* Sales Rep Performance Breakdown */}
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-800" strokeWidth={2.5} />
              <h3 className="text-sm font-heading font-black text-slate-900">
                Sales Rep Performance & Discipline
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {repPerformance.length} reps tracked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-black text-slate-700 font-mono">
                  <th className="p-3">Sales Rep</th>
                  <th className="p-3 text-center">Deals</th>
                  <th className="p-3 text-center">Win Rate</th>
                  <th className="p-3 text-right">Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {repPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      No rep activity for current period.
                    </td>
                  </tr>
                ) : (
                  pagedReps.map((rep, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/40">
                      <td className="p-3 font-heading font-bold text-slate-900">
                        {rep.name}
                      </td>
                      <td className="p-3 text-center font-mono font-black text-slate-900">
                        {rep.closedCount} / {rep.quotesCount}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-blue-700">
                        {rep.winRate}%
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-900">
                        ₹{rep.pipelineValue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Sales Rep Pagination */}
          {repPerformance.length > 0 && (
            <div className="p-3 border-t-2 border-slate-900 bg-slate-50">
              <Pagination
                currentPage={repPage}
                totalItems={repPerformance.length}
                pageSize={repPageSize}
                onPageChange={setRepPage}
                onPageSizeChange={setRepPageSize}
                pageSizeOptions={[5, 10, 25, 50]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
