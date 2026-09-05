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
  const [pageSize, setPageSize] = useState(20);

  const isManagerOrAdmin = ['ADMIN', 'SALES_MANAGER', 'FINANCE'].includes(user?.role);

  // Sync URL search query
  useEffect(() => {
    const urlQuery = searchParams.get('search');
    if (urlQuery !== null && urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
  }, [searchParams]);

  // Fetch quotations and reps directly from database via PostgreSQL SQL queries
  const loadData = async (query = searchQuery, status = statusFilter, rep = selectedRep) => {
    setLoading(true);
    try {
      const params = {};
      if (query && query.trim()) params.search = query.trim();
      if (status && status !== 'ALL') params.status = status;
      if (rep && rep !== 'ALL') params.repId = rep;

      const [data, countData] = await Promise.all([
        quotationsAPI.getAll(params),
        status !== 'ALL'
          ? quotationsAPI.getAll({ search: query.trim() || undefined, repId: rep !== 'ALL' ? rep : undefined })
          : Promise.resolve(null),
      ]);

      setQuotations(Array.isArray(data) ? data : []);
      if (countData && Array.isArray(countData)) {
        setAllCountQuotes(countData);
      } else if (Array.isArray(data)) {
        setAllCountQuotes(data);
      }

      // Extract reps list or fetch users
      try {
        const users = await usersAPI.getAll();
        if (Array.isArray(users)) {
          const reps = users.filter((u) => ['SALES_REP', 'SALES_MANAGER', 'ADMIN'].includes(u.role));
          setRepsList(reps);
        }
      } catch {
        // Fallback: extract distinct reps from quotations
        const distinctReps = [];
        const seen = new Set();
        (data || []).forEach((q) => {
          const repName = q.rep?.name || q.rep_name;
          const repId = q.rep?.id || q.rep_id;
          if (repId && !seen.has(repId)) {
            seen.add(repId);
            distinctReps.push({ id: repId, name: repName || 'Rep' });
          }
        });
        setRepsList(distinctReps);
      }
    } catch (err) {
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(searchQuery, statusFilter, selectedRep);
    }, 250);
    return () => clearTimeout(timer);
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
      toast.success(`Quotation ${q.quotation_number || q.id} approved!`, { icon: '🎉' });
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

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, selectedRep, searchQuery]);

  // Paginated slice
  const pagedQuotations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotations.slice(start, start + pageSize);
  }, [filteredQuotations, currentPage, pageSize]);

  // Status Badge Colors
  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          label: 'Draft',
        };
      case 'PENDING_MANAGER':
        return {
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          label: 'Pending Manager',
        };
      case 'PENDING_FINANCE':
        return {
          bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          label: 'Pending Finance',
        };
      case 'APPROVED':
        return {
          bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          label: 'Approved',
        };
      case 'SENT_TO_CUSTOMER':
        return {
          bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
          label: 'Sent',
        };
      case 'UNDER_NEGOTIATION':
        return {
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse',
          label: 'Negotiating',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          label: 'Confirmed',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          label: 'Rejected',
        };
      case 'CANCELLED':
        return {
          bg: 'bg-slate-700/30 text-slate-500 border-slate-700/50',
          label: 'Cancelled',
        };
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          label: status || 'Unknown',
        };
    }
  };

  // Tier Badge Color
  const getTierBadge = (tier) => {
    const t = (tier || 'BRONZE').toUpperCase();
    if (t === 'GOLD') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (t === 'SILVER') return 'bg-slate-300/20 text-slate-200 border-slate-300/40';
    return 'bg-orange-600/20 text-orange-300 border-orange-500/40';
  };

  // Margin % Color: Green >= 25%, Amber 15-25%, Red < 15%
  const getMarginColor = (margin) => {
    if (margin === null || margin === undefined) return 'text-slate-400';
    const m = Number(margin);
    if (m >= 25) return 'text-emerald-400 font-semibold';
    if (m >= 15) return 'text-amber-400 font-semibold';
    return 'text-rose-400 font-semibold';
  };

  // Risk score chip: 0-5 green, 5-10 amber, 10+ red
  const getRiskChip = (score) => {
    const s = Number(score || 0);
    if (s <= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {s.toFixed(1)} / 15
        </span>
      );
    }
    if (s <= 10) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {s.toFixed(1)} / 15
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
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
    <div className="space-y-5 pb-10">
      {/* ── TOP BAR ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            Quotations
            <span className="text-xs font-mono font-normal px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
              {filteredQuotations.length} records
            </span>
            {(searchQuery || statusFilter !== 'ALL' || selectedRep !== 'ALL') && (
              <span className="flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <Database className="w-3 h-3" />
                <span>DB Filtered</span>
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Create, track, govern, and manage real-time sales proposals
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Table List View"
            >
              <LayoutList className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* New Quotation Button */}
          {['SALES_REP', 'SALES_MANAGER', 'ADMIN'].includes(user?.role) && (
            <button
              onClick={() => navigate('/quotations/new')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Quotation</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SEARCH & FILTERS BAR ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
        {/* Search input */}
        <div className="relative md:col-span-6 lg:col-span-7">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchParams(e.target.value ? { search: e.target.value } : {});
            }}
            placeholder="Search by QT#, customer name, company, or rep..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchParams({});
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
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
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
      <div className="flex items-center gap-1 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count = tabCounts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
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
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">
            Loading DealFlow360 Quotations...
          </p>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3 text-2xl">
            📋
          </div>
          <h3 className="text-base font-bold text-white">No quotations found</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
            {searchQuery || statusFilter !== 'ALL' || selectedRep !== 'ALL'
              ? 'No quotations match your active filters. Try resetting search criteria.'
              : 'You have not created any quotations yet. Start building high-margin deals now!'}
          </p>
          {['SALES_REP', 'SALES_MANAGER', 'ADMIN'].includes(user?.role) && (
            <button
              onClick={() => navigate('/quotations/new')}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25"
            >
              <Plus className="w-4 h-4" />
              Build First Quotation
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* ── TABLE VIEW ───────────────────────────────────────────── */
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">QT#</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4">Rep</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                  <th className="py-3 px-4 text-center">Risk Score</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Expiry</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
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
                      className="group hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      {/* QT# in blue monospace */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-400 group-hover:text-blue-300">
                          {q.quotationNumber || q.quotation_number || `QT-${q.id.substring(0, 6).toUpperCase()}`}
                        </span>
                      </td>

                      {/* Customer: company name + name */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {compName}
                          </span>
                          <span className="text-[11px] text-slate-400 pl-5">{custName}</span>
                        </div>
                      </td>

                      {/* Tier Badge Colored */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${getTierBadge(
                            tier
                          )}`}
                        >
                          {tier}
                        </span>
                      </td>

                      {/* Rep Name */}
                      <td className="py-3 px-4">
                        <span className="text-slate-300 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {repName}
                        </span>
                      </td>

                      {/* Total ₹ formatted Indian style */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-slate-100">
                          {formatINR(total)}
                        </span>
                      </td>

                      {/* Margin % Colored */}
                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono ${getMarginColor(margin)}`}>
                          {Number(margin).toFixed(1)}%
                        </span>
                      </td>

                      {/* Risk Score Chip */}
                      <td className="py-3 px-4 text-center">
                        {getRiskChip(riskScore)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Expiry: date or "—", red if expired */}
                      <td className="py-3 px-4 text-center font-mono text-[11px]">
                        {q.valid_until ? (
                          <span
                            className={
                              expired
                                ? 'text-rose-400 font-bold flex items-center justify-center gap-1'
                                : 'text-slate-400'
                            }
                          >
                            {expired && <AlertTriangle className="w-3 h-3" />}
                            {new Date(q.valid_until).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View button */}
                          <button
                            onClick={() => navigate(`/quotations/${q.id}`)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="View Quotation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit button (if draft) */}
                          {isDraft && (
                            <button
                              onClick={() => navigate(`/quotations/${q.id}`)}
                              className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
                              title="Edit Quotation"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Quick Approve (if manager/finance and pending) */}
                          {isManagerOrAdmin && isPending && (
                            <button
                              onClick={(e) => handleQuickApprove(e, q)}
                              disabled={approvingId === q.id}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                              title="Quick Approve"
                            >
                              {approvingId === q.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
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
          <div className="p-4 border-t border-slate-800">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all hover:shadow-xl hover:shadow-blue-500/5 group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-sm text-blue-400 group-hover:text-blue-300">
                      {q.quotationNumber || q.quotation_number || `QT-${q.id.substring(0, 6).toUpperCase()}`}
                    </span>
                    <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {compName}
                    </h4>
                    <p className="text-[11px] text-slate-400 pl-4">{custName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold border uppercase ${getTierBadge(
                        tier
                      )}`}
                    >
                      {tier}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold border ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Pricing & Margin metrics */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">
                      Total Value
                    </span>
                    <span className="text-base font-black text-slate-100 font-mono">
                      {formatINR(total)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">
                      Gross Margin
                    </span>
                    <span className={`text-base font-bold font-mono ${getMarginColor(margin)}`}>
                      {Number(margin).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {getRiskChip(riskScore)}
                    <span className="text-[10px] text-slate-500 font-mono">
                      Rep: {repName}
                    </span>
                  </div>

                  {q.valid_until && (
                    <span
                      className={`text-[10px] font-mono ${
                        expired ? 'text-rose-400 font-bold' : 'text-slate-500'
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
                      className="w-full py-1.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Build Quote
                    </button>
                  )}

                  {isManagerOrAdmin && isPending && (
                    <button
                      onClick={(e) => handleQuickApprove(e, q)}
                      disabled={approvingId === q.id}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
                    >
                      {approvingId === q.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Quick Approve
                    </button>
                  )}

                  {!isDraft && !isPending && (
                    <button
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
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
