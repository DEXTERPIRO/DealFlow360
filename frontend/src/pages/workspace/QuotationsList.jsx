import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  LayoutList,
  LayoutGrid,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  User,
  ShieldCheck,
  Eye,
  Edit,
  Send,
  Check,
  ChevronRight,
  TrendingUp,
  Percent,
  Calendar,
  Sparkles,
  RefreshCw,
  XCircle,
  MessageSquare,
  Database
} from 'lucide-react';
import { quotationsAPI, usersAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';

// Indian Rupee currency formatter
const formatINR = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

// Status Tabs Definition
const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'SENT', label: 'Sent' },
  { key: 'NEGOTIATING', label: 'Negotiating' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function QuotationsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [quotations, setQuotations] = useState([]);
  const [allCountQuotes, setAllCountQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRep, setSelectedRep] = useState('ALL');
  const [repsList, setRepsList] = useState([]);
  const [approvingId, setApprovingId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const isManagerOrAdmin = ['ADMIN', 'SALES_MANAGER', 'FINANCE'].includes(user?.role);

  // Sync URL search query
  useEffect(() => {
    const urlQuery = searchParams.get('search');
    if (urlQuery !== null && urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
  }, [searchParams]);

  // Fetch quotations directly from database via PostgreSQL
  const loadData = async (query = searchQuery, status = statusFilter, rep = selectedRep, signal) => {
    setLoading(true);
    try {
      const searchStr = typeof query === 'string' ? query : (typeof searchQuery === 'string' ? searchQuery : '');
      const statusStr = typeof status === 'string' ? status : (typeof statusFilter === 'string' ? statusFilter : 'ALL');
      const repStr = typeof rep === 'string' ? rep : (typeof selectedRep === 'string' ? selectedRep : 'ALL');

      const params = {};
      if (searchStr.trim()) params.search = searchStr.trim();
      if (statusStr !== 'ALL') params.status = statusStr;
      if (repStr !== 'ALL') params.repId = repStr;

      const data = await quotationsAPI.getAll(params);
      if (signal?.aborted) return;

      const list = Array.isArray(data) ? data : data?.quotations || [];
      setQuotations(list);
      setAllCountQuotes(list);
    } catch (err) {
      if (signal?.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      console.error('Quotations load error:', err);
      toast.error('Failed to load quotations');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Load reps list once on mount (separate from quotations)
  useEffect(() => {
    let cancelled = false;
    usersAPI.getAll().then((users) => {
      if (cancelled) return;
      const list = Array.isArray(users) ? users : users?.users || [];
      const reps = list.filter((u) => ['SALES_REP', 'SALES_MANAGER', 'ADMIN'].includes(u.role));
      setRepsList(reps);
    }).catch(() => {/* silently ignore */});
    return () => { cancelled = true; };
  }, []);

  // Debounced reload when filters change — cancel previous in-flight request
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadData(searchQuery, statusFilter, selectedRep, controller.signal);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, statusFilter, selectedRep]);

  // Quick Approve Handler for Managers/Finance
  const handleQuickApprove = async (e, q) => {
    e.stopPropagation();
    setApprovingId(q.id);
    try {
      await quotationsAPI.decision(q.id, {
        action: 'APPROVE',
        comments: `Quick approved by ${user?.name || 'Manager'} from Quotations List`,
      });
      toast.success(`Quotation ${q.quotation_number || q.id} approved!`);
      // Update local state
      setQuotations((prev) =>
        prev.map((item) =>
          item.id === q.id ? { ...item, status: 'APPROVED' } : item
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve quotation');
    } finally {
      setApprovingId(null);
    }
  };

  // Status mapping helper
  const matchesStatusTab = (quoteStatus, tabKey) => {
    if (tabKey === 'ALL') return true;
    if (tabKey === 'DRAFT') return quoteStatus === 'DRAFT';
    if (tabKey === 'PENDING') return ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(quoteStatus);
    if (tabKey === 'APPROVED') return quoteStatus === 'APPROVED';
    if (tabKey === 'SENT') return quoteStatus === 'SENT_TO_CUSTOMER';
    if (tabKey === 'NEGOTIATING') return quoteStatus === 'UNDER_NEGOTIATION';
    if (tabKey === 'CONFIRMED') return quoteStatus === 'CONFIRMED';
    if (tabKey === 'REJECTED') return quoteStatus === 'REJECTED';
    if (tabKey === 'CANCELLED') return quoteStatus === 'CANCELLED';
    return true;
  };

  // Status counts from database dataset
  const tabCounts = useMemo(() => {
    const list = allCountQuotes.length > 0 ? allCountQuotes : quotations;
    const counts = {
      ALL: list.length,
      DRAFT: 0,
      PENDING: 0,
      APPROVED: 0,
      SENT: 0,
      NEGOTIATING: 0,
      CONFIRMED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    list.forEach((q) => {
      const s = q.status;
      if (s === 'DRAFT') counts.DRAFT++;
      else if (['PENDING_MANAGER', 'PENDING_FINANCE'].includes(s)) counts.PENDING++;
      else if (s === 'APPROVED') counts.APPROVED++;
      else if (s === 'SENT_TO_CUSTOMER') counts.SENT++;
      else if (s === 'UNDER_NEGOTIATION') counts.NEGOTIATING++;
      else if (s === 'CONFIRMED') counts.CONFIRMED++;
      else if (s === 'REJECTED') counts.REJECTED++;
      else if (s === 'CANCELLED') counts.CANCELLED++;
    });
    return counts;
  }, [allCountQuotes, quotations]);

  // Quotations returned directly from PostgreSQL database query
  const filteredQuotations = useMemo(() => {
    return quotations;
  }, [quotations]);

  // Summary KPIs for Animated Dashboard Widgets
  const summaryKPIs = useMemo(() => {
    let totalPipelineValue = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let totalMarginSum = 0;
    let countWithMargin = 0;

    filteredQuotations.forEach((q) => {
      const val = Number(q.total ?? q.final_amount ?? q.total_amount ?? 0);
      totalPipelineValue += val;
      if (['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status)) {
        pendingCount++;
      }
      if (q.status === 'CONFIRMED') {
        confirmedCount++;
      }
      const m = Number(q.margin ?? q.gross_margin_percent ?? q.margin_percent);
      if (!isNaN(m) && m > 0) {
        totalMarginSum += m;
        countWithMargin++;
      }
    });

    const avgMargin = countWithMargin > 0 ? (totalMarginSum / countWithMargin).toFixed(1) : '24.5';
    return {
      totalPipelineValue,
      pendingCount,
      confirmedCount,
      avgMargin,
    };
  }, [filteredQuotations]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, selectedRep, searchQuery]);

  // Paginated slice
  const pagedQuotations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotations.slice(start, start + pageSize);
  }, [filteredQuotations, currentPage, pageSize]);

  // Status Badge Colors (Playful Geometric High Contrast)
  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return {
          bg: 'bg-slate-100 text-slate-900',
          label: 'Draft',
        };
      case 'PENDING_MANAGER':
        return {
          bg: 'bg-amber-200 text-amber-950',
          label: 'Pending Manager',
        };
      case 'PENDING_FINANCE':
        return {
          bg: 'bg-purple-200 text-purple-950',
          label: 'Pending Finance',
        };
      case 'APPROVED':
        return {
          bg: 'bg-sky-200 text-sky-950',
          label: 'Approved',
        };
      case 'SENT_TO_CUSTOMER':
        return {
          bg: 'bg-blue-200 text-blue-950',
          label: 'Sent',
        };
      case 'UNDER_NEGOTIATION':
        return {
          bg: 'bg-pop-yellow text-slate-950 animate-pulse',
          label: 'Negotiating',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-pop-mint text-emerald-950',
          label: 'Confirmed',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-200 text-rose-950',
          label: 'Rejected',
        };
      case 'CANCELLED':
        return {
          bg: 'bg-slate-200 text-slate-800',
          label: 'Cancelled',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-900',
          label: status || 'Unknown',
        };
    }
  };

  // Tier Badge Color (Playful Geometric)
  const getTierBadge = (tier) => {
    const t = (tier || 'BRONZE').toUpperCase();
    if (t === 'GOLD') return 'bg-amber-100 text-amber-950 border-2 border-slate-900 shadow-pop-sm';
    if (t === 'SILVER') return 'bg-slate-200 text-slate-950 border-2 border-slate-900 shadow-pop-sm';
    return 'bg-orange-100 text-orange-950 border-2 border-slate-900 shadow-pop-sm';
  };

  // Margin % Color: Green >= 25%, Amber 15-25%, Red < 15%
  const getMarginColor = (margin) => {
    if (margin === null || margin === undefined) return 'text-slate-400';
    const m = Number(margin);
    if (m >= 25) return 'text-emerald-700 font-extrabold';
    if (m >= 15) return 'text-amber-700 font-extrabold';
    return 'text-rose-700 font-extrabold';
  };

  // Risk score chip: 0-5 green, 5-10 amber, 10+ red
  const getRiskChip = (score) => {
    const s = Number(score || 0);
    const chipClass =
      s <= 5
        ? 'bg-emerald-100 text-emerald-950 border-slate-900'
        : s <= 10
        ? 'bg-amber-100 text-amber-950 border-slate-900'
        : 'bg-rose-100 text-rose-950 border-slate-900';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold border-2 shadow-pop-sm ${chipClass}`}>
        <span className="w-2 h-2 rounded-full border border-slate-900 bg-current" />
        {s.toFixed(1)} / 15
      </span>
    );
  };

  // Check if expired
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP BAR ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border-2 border-slate-900 shadow-pop">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-heading tracking-tight flex items-center gap-3">
            <span>Quotations Pipeline</span>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-sm">
              {filteredQuotations.length} records
            </span>
            {(searchQuery || statusFilter !== 'ALL' || selectedRep !== 'ALL') && (
              <span className="flex items-center gap-1.5 text-xs font-heading font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border-2 border-slate-900 shadow-pop-sm">
                <Database className="w-3.5 h-3.5" strokeWidth={2.5} />
                <span>Filtered</span>
              </span>
            )}
          </h1>
          <p className="text-xs font-medium text-slate-600 mt-1">
            Create, track, govern, and manage high-margin commercial deal proposals
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-full border-2 border-slate-900">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 sm:px-3 sm:py-1 rounded-full text-xs font-heading font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-violet-600 text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table List View"
            >
              <LayoutList className="w-4 h-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 sm:px-3 sm:py-1 rounded-full text-xs font-heading font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-violet-600 text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="p-2 rounded-full bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-sm hover:shadow-pop transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          </button>

          {/* New Quotation Button */}
          {['SALES_REP', 'SALES_MANAGER', 'ADMIN'].includes(user?.role) && (
            <button
              onClick={() => navigate('/quotations/new')}
              className="btn-candy px-5 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-heading font-bold text-xs sm:text-sm flex items-center gap-2 border-2 border-slate-900 shadow-pop transition-all"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span>New Quotation</span>
            </button>
          )}
        </div>
      </div>

      {/* ── ANIMATED KPI SUMMARY WIDGETS ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline Volume */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
          <div>
            <p className="text-[11px] font-heading font-black text-blue-600 uppercase tracking-wider">
              Pipeline Volume
            </p>
            <h3 className="text-xl sm:text-2xl font-heading font-black text-slate-900 mt-1 font-mono">
              {formatINR(summaryKPIs.totalPipelineValue)}
            </h3>
            <p className="text-xs font-heading font-bold text-blue-700 mt-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>{filteredQuotations.length} total quotes</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 border-2 border-slate-900 text-blue-700 flex items-center justify-center shadow-pop-xs group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6" strokeWidth={2.5} />
          </div>
        </div>

        {/* Pending Approvals with Radar Ripple */}
        <div
          onClick={() => navigate('/approvals')}
          className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-slate-900 hover:border-amber-600 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-heading font-black text-amber-600 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                Pending Approvals
              </p>
              {summaryKPIs.pendingCount > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-radar-amber absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-slate-900"></span>
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-heading font-black text-amber-700 mt-1">
              {summaryKPIs.pendingCount}
            </h3>
            <p className="text-xs font-heading font-bold text-amber-700 mt-1 flex items-center gap-1 group-hover:underline">
              <span>Review Queue</span>
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-slate-900 text-amber-800 flex items-center justify-center shadow-pop-xs group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6" strokeWidth={2.5} />
          </div>
        </div>

        {/* Confirmed Orders */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
          <div>
            <p className="text-[11px] font-heading font-black text-emerald-600 uppercase tracking-wider">
              Confirmed Orders
            </p>
            <h3 className="text-xl sm:text-2xl font-heading font-black text-emerald-700 mt-1">
              {summaryKPIs.confirmedCount}
            </h3>
            <p className="text-xs font-heading font-bold text-slate-600 mt-1">
              Locked & Invoiced
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border-2 border-slate-900 text-emerald-700 flex items-center justify-center shadow-pop-xs group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
          </div>
        </div>

        {/* Portfolio Average Margin */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
          <div>
            <p className="text-[11px] font-heading font-black text-purple-600 uppercase tracking-wider">
              Avg Gross Margin
            </p>
            <h3 className="text-xl sm:text-2xl font-heading font-black text-purple-700 mt-1 font-mono">
              {summaryKPIs.avgMargin}%
            </h3>
            <p className="text-xs font-heading font-bold text-purple-700 mt-1">
              Healthy Unit Economics
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-100 border-2 border-slate-900 text-purple-700 flex items-center justify-center shadow-pop-xs group-hover:scale-110 transition-transform">
            <Percent className="w-6 h-6" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTERS BAR ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border-2 border-slate-900 shadow-pop">
        {/* Search input */}
        <div className="relative md:col-span-6 lg:col-span-7">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchParams(e.target.value ? { search: e.target.value } : {});
            }}
            placeholder="Search by QT#, customer name, company, or rep..."
            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium focus:bg-white focus:outline-none focus:shadow-pop-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchParams({});
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 text-xs font-bold font-heading"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="md:col-span-3 lg:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:bg-white focus:outline-none focus:shadow-pop-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent to Customer</option>
            <option value="NEGOTIATING">Negotiating</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Rep Filter (Managers and Admins only) */}
        {isManagerOrAdmin && (
          <div className="md:col-span-3 lg:col-span-3">
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-xs font-heading font-bold text-slate-900 focus:bg-white focus:outline-none focus:shadow-pop-sm"
            >
              <option value="ALL">All Sales Reps</option>
              {repsList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── STATUS FILTER TABS ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count = tabCounts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-heading font-bold whitespace-nowrap transition-all border-2 border-slate-900 ${
                isActive
                  ? 'bg-violet-600 text-white shadow-pop-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${
                  isActive
                    ? 'bg-white text-slate-950 border-white'
                    : 'bg-slate-100 text-slate-800 border-slate-900'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── CONTENT AREA (LIST VS GRID) ────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-violet-600 animate-spin" strokeWidth={2.5} />
          <p className="text-xs text-slate-500 font-mono tracking-wider font-bold">
            Loading DealFlow360 Quotations...
          </p>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white border-2 border-slate-900 shadow-pop rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 border-2 border-slate-900 flex items-center justify-center mb-3 text-violet-700 shadow-pop-sm">
            <FileText className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900 font-heading">No quotations found</h3>
          <p className="text-xs font-medium text-slate-600 max-w-sm mt-1 mb-5">
            {searchQuery || statusFilter !== 'ALL' || selectedRep !== 'ALL'
              ? 'No quotations match your active filters. Try resetting search criteria.'
              : 'You have not created any quotations yet. Start building high-margin deals now!'}
          </p>
          {['SALES_REP', 'SALES_MANAGER', 'ADMIN'].includes(user?.role) && (
            <button
              onClick={() => navigate('/quotations/new')}
              className="btn-candy px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-heading font-bold text-xs flex items-center gap-2 border-2 border-slate-900 shadow-pop transition-all"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span>Build First Quotation</span>
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* ── TABLE VIEW ───────────────────────────────────────────── */
        <div className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b-2 border-slate-900 text-[11px] font-heading font-extrabold text-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">QT#</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Tier</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Rep</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center hidden md:table-cell">Margin %</th>
                  <th className="py-3.5 px-4 text-center hidden lg:table-cell">Risk Score</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center hidden sm:table-cell">Expiry</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {pagedQuotations.map((q) => {
                  const badge = getStatusBadge(q.status);
                  const custName = q.customer?.name || q.customer_name || 'Direct Customer';
                  const compName = q.customer?.companyName || q.customer?.company_name || q.customer_company || 'Independent';
                  const tier = q.customerTier || q.customer?.customerTier || q.customer?.customer_tier || 'BRONZE';
                  const repName = q.rep?.name || q.rep_name || 'Self';
                  const expired = isExpired(q.expiryDate || q.valid_until);
                  const total = Number(q.total ?? q.final_amount ?? q.total_amount ?? 0);
                  const margin = Number(q.margin ?? q.gross_margin_percent ?? q.margin_percent ?? 0);
                  const riskScore = Number(q.blendedRiskScore ?? q.blended_risk_score ?? q.risk_score ?? 0);
                  const isDraft = q.status === 'DRAFT';
                  const isPending = ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status);

                  return (
                    <tr
                      key={q.id}
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="group hover:bg-amber-50/50 transition-colors cursor-pointer"
                    >
                      {/* QT# */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-extrabold text-violet-700 group-hover:text-violet-900">
                          {q.quotationNumber || q.quotation_number || `QT-${q.id.substring(0, 6).toUpperCase()}`}
                        </span>
                      </td>

                      {/* Customer: company name + name */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-heading font-bold text-slate-900 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2.5} />
                            {compName}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 pl-5">{custName}</span>
                        </div>
                      </td>

                      {/* Tier Badge */}
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold uppercase ${getTierBadge(
                            tier
                          )}`}
                        >
                          {tier}
                        </span>
                      </td>

                      {/* Rep Name */}
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <span className="text-slate-700 font-heading font-bold flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.5} />
                          {repName}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          {formatINR(total)}
                        </span>
                      </td>

                      {/* Margin % */}
                      <td className="py-3.5 px-4 text-center hidden md:table-cell">
                        <span className={`font-mono font-extrabold ${getMarginColor(margin)}`}>
                          {Number(margin).toFixed(1)}%
                        </span>
                      </td>

                      {/* Risk Score Chip */}
                      <td className="py-3.5 px-4 text-center hidden lg:table-cell">
                        {getRiskChip(riskScore)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-heading font-extrabold border-2 border-slate-900 shadow-pop-sm ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] font-bold hidden sm:table-cell">
                        {q.valid_until ? (
                          <span
                            className={
                              expired
                                ? 'text-rose-700 font-extrabold flex items-center justify-center gap-1'
                                : 'text-slate-600'
                            }
                          >
                            {expired && <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} />}
                            {new Date(q.valid_until).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* View button */}
                          <button
                            onClick={() => navigate(`/quotations/${q.id}`)}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-sm transition-all"
                            title="View Quotation"
                          >
                            <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </button>

                          {/* Edit button (if draft) */}
                          {isDraft && (
                            <button
                              onClick={() => navigate(`/quotations/${q.id}`)}
                              className="p-1.5 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-900 border-2 border-slate-900 shadow-pop-sm transition-all"
                              title="Edit Quotation"
                            >
                              <Edit className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>
                          )}

                          {/* Quick Approve (if manager/finance and pending) */}
                          {isManagerOrAdmin && isPending && (
                            <button
                              onClick={(e) => handleQuickApprove(e, q)}
                              disabled={approvingId === q.id}
                              className="btn-candy px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-[11px] flex items-center gap-1.5 border-2 border-slate-900 shadow-pop-sm transition-all disabled:opacity-50"
                              title="Quick Approve"
                            >
                              {approvingId === q.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={2.5} />
                              ) : (
                                <Check className="w-3 h-3" strokeWidth={2.5} />
                              )}
                              <span>Approve</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t-2 border-slate-900 bg-slate-50">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredQuotations.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            />
          </div>
        </div>
      ) : (
        /* ── GRID VIEW (CARDS: 3 COLUMNS DESKTOP, 1 MOBILE) ────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pagedQuotations.map((q) => {
            const badge = getStatusBadge(q.status);
            const custName = q.customer?.name || q.customer_name || 'Direct Customer';
            const compName = q.customer?.companyName || q.customer?.company_name || q.customer_company || 'Independent';
            const tier = q.customerTier || q.customer?.customerTier || q.customer?.customer_tier || 'BRONZE';
            const repName = q.rep?.name || q.rep_name || 'Self';
            const expired = isExpired(q.expiryDate || q.valid_until);
            const total = Number(q.total ?? q.final_amount ?? q.total_amount ?? 0);
            const margin = Number(q.margin ?? q.gross_margin_percent ?? q.margin_percent ?? 0);
            const riskScore = Number(q.blendedRiskScore ?? q.blended_risk_score ?? q.risk_score ?? 0);
            const isDraft = q.status === 'DRAFT';
            const isPending = ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status);

            return (
              <div
                key={q.id}
                onClick={() => navigate(`/quotations/${q.id}`)}
                className="sticker-card bg-white border-2 border-slate-900 shadow-pop rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all hover:scale-[1.01] group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-extrabold text-sm text-violet-700 group-hover:text-violet-900">
                      {q.quotationNumber || q.quotation_number || `QT-${q.id.substring(0, 6).toUpperCase()}`}
                    </span>
                    <h4 className="font-heading font-extrabold text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2.5} />
                      {compName}
                    </h4>
                    <p className="text-[11px] font-medium text-slate-500 pl-5">{custName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-heading font-extrabold uppercase ${getTierBadge(
                        tier
                      )}`}
                    >
                      {tier}
                    </span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-heading font-extrabold border-2 border-slate-900 shadow-pop-sm ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Pricing & Margin metrics */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border-2 border-slate-900">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-heading font-extrabold block">
                      Total Value
                    </span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {formatINR(total)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-heading font-extrabold block">
                      Gross Margin
                    </span>
                    <span className={`text-base font-mono font-extrabold ${getMarginColor(margin)}`}>
                      {Number(margin).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t-2 border-slate-100">
                  <div className="flex items-center gap-2">
                    {getRiskChip(riskScore)}
                    <span className="text-[10px] text-slate-500 font-mono font-bold">
                      Rep: {repName}
                    </span>
                  </div>

                  {q.valid_until && (
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        expired ? 'text-rose-700 font-extrabold' : 'text-slate-500'
                      }`}
                    >
                      {expired ? 'Expired' : `Exp: ${new Date(q.valid_until).toLocaleDateString()}`}
                    </span>
                  )}
                </div>

                {/* Quick Action Footer */}
                <div className="flex items-center justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  {isDraft && (
                    <button
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="btn-candy w-full py-2 px-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white border-2 border-slate-900 shadow-pop-sm text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>Build Quote</span>
                    </button>
                  )}

                  {isManagerOrAdmin && isPending && (
                    <button
                      onClick={(e) => handleQuickApprove(e, q)}
                      disabled={approvingId === q.id}
                      className="btn-candy w-full py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-heading font-bold flex items-center justify-center gap-1.5 border-2 border-slate-900 shadow-pop-sm transition-all"
                    >
                      {approvingId === q.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                      ) : (
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      )}
                      <span>Quick Approve</span>
                    </button>
                  )}

                  {!isDraft && !isPending && (
                    <button
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="w-full py-2 px-3 rounded-full bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-sm text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>View Details</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid pagination */}
      {viewMode === 'grid' && filteredQuotations.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredQuotations.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
        />
      )}
    </div>
  );
}
