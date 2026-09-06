import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  History,
  CheckSquare,
  Square,
  Send,
  Sparkles,
  Search,
  Filter,
  Eye,
  LayoutList,
  LayoutGrid,
  X,
  ChevronRight,
  ChevronLeft,
  Info,
  ExternalLink,
  ArrowUpDown,
  Check
} from 'lucide-react';
import Portal from '../../components/ui/Portal';
import { io } from 'socket.io-client';
import { dashboardAPI, quotationsAPI } from '../../api';
import { formatDate, formatRelativeTime } from '../../utils/formatters';
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

export default function ApprovalQueue() {
  const [queue, setQueue] = useState([]);
  const [allApprovals, setAllApprovals] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, returned: 0, approved: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  // Filter: 'PENDING' | 'PENDING_MANAGER' | 'PENDING_FINANCE' | 'RETURNED' | 'APPROVED' | 'ALL'
  const [filter, setFilter] = useState('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  // View Mode: 'list' (compact table, default) | 'cards' (expanded)
  const [viewMode, setViewMode] = useState('list');

  // Selected Detail Item for the Modal (matching Reference Image 3)
  const [activeDetailItem, setActiveDetailItem] = useState(null);

  // Decision state per quotation: { [quotationId]: { action: '', reason: '' } }
  const [decisions, setDecisions] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  // Bulk selection: array of quotation ids
  const [selectedIds, setSelectedIds] = useState([]);

  // Collapsible audit trail
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Live timer tick
  const [, setTimeTick] = useState(Date.now());

  const loadApprovalData = async () => {
    try {
      setLoading(true);
      const res = await dashboardAPI.getApprovalQueue();
      if (res) {
        setQueue(res.queue || []);
        setAllApprovals(res.allApprovals || res.queue || []);
        setAuditTrail(res.auditTrail || []);
        if (res.counts) {
          setCounts(res.counts);
          window.dispatchEvent(new CustomEvent('approvals-updated', { detail: res.counts }));
        } else {
          const fallbackCounts = {
            pending: (res.queue || []).length,
            returned: 0,
            approved: 0,
            total: (res.queue || []).length
          };
          setCounts(fallbackCounts);
          window.dispatchEvent(new CustomEvent('approvals-updated', { detail: fallbackCounts }));
        }
      }
    } catch (err) {
      console.error('Failed to load approval queue:', err);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovalData();
  }, []);

  // Update live waiting timer every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Socket.io for real-time approval queue synchronization
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_dashboard');
    });

    socket.on('approval-needed', () => {
      loadApprovalData();
    });

    socket.on('approval-decision', () => {
      loadApprovalData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Sync activeDetailItem with latest data if updated
  useEffect(() => {
    if (activeDetailItem) {
      const fresh = allApprovals.find((q) => q.id === activeDetailItem.id) || queue.find((q) => q.id === activeDetailItem.id);
      if (fresh) setActiveDetailItem(fresh);
    }
  }, [queue, allApprovals]);

  // Compute displayed list based on filter and search
  const displayedItems = useMemo(() => {
    // Choose base dataset: if filter is 'PENDING' or stage-specific, use pending queue, else use allApprovals
    let items = allApprovals.length > 0 ? allApprovals : queue;

    if (filter === 'PENDING') {
      items = items.filter((q) => ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status));
    } else if (filter === 'PENDING_MANAGER') {
      items = items.filter((q) => q.status === 'PENDING_MANAGER');
    } else if (filter === 'PENDING_FINANCE') {
      items = items.filter((q) => q.status === 'PENDING_FINANCE');
    } else if (filter === 'RETURNED') {
      items = items.filter(
        (q) =>
          q.status === 'RETURNED' ||
          q.approvals?.some((a) => a.action === 'RETURNED') ||
          q.audit_logs?.some((l) => l.action === 'RETURNED')
      );
    } else if (filter === 'APPROVED') {
      items = items.filter((q) => q.status === 'APPROVED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((item) => {
        const num = (item.quotationNumber || item.quotation_number || '').toLowerCase();
        const cust = (item.customer?.name || item.customer?.company_name || '').toLowerCase();
        const rep = (item.rep?.name || '').toLowerCase();
        return num.includes(q) || cust.includes(q) || rep.includes(q);
      });
    }

    return items;
  }, [filter, searchQuery, allApprovals, queue]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedItems.slice(start, start + pageSize);
  }, [displayedItems, currentPage, pageSize]);

  // Calculate waiting time string
  const getWaitingTime = (createdDate) => {
    if (!createdDate) return 'Just now';
    const diffMs = Math.max(0, Date.now() - new Date(createdDate).getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `Waiting ${mins}m`;
    return `Waiting ${hours}h ${mins}m`;
  };

  // Tier Badge Color
  const getTierBadge = (tier) => {
    const t = String(tier || 'BRONZE').toUpperCase();
    if (t === 'GOLD') return 'bg-pop-yellow text-slate-900 border-2 border-slate-900 font-heading font-extrabold';
    if (t === 'SILVER') return 'bg-slate-200 text-slate-800 border-2 border-slate-900 font-heading font-extrabold';
    return 'bg-amber-100 text-amber-900 border-2 border-slate-900 font-heading font-extrabold';
  };

  // Blended Risk Score Badge & Color
  const getRiskDetails = (score) => {
    const s = Number(score || 0);
    if (s <= 5) {
      return {
        level: 'LOW',
        text: 'LOW',
        chipClass: 'bg-emerald-100 text-emerald-950 border-2 border-slate-900 font-heading font-extrabold',
        badgeBg: 'bg-emerald-100 text-emerald-950 border-2 border-slate-900 font-heading font-extrabold shadow-pop-sm',
        scoreClass: 'text-emerald-700',
      };
    }
    if (s <= 10) {
      return {
        level: 'MEDIUM',
        text: 'MEDIUM',
        chipClass: 'bg-amber-100 text-amber-950 border-2 border-slate-900 font-heading font-extrabold',
        badgeBg: 'bg-amber-100 text-amber-950 border-2 border-slate-900 font-heading font-extrabold shadow-pop-sm',
        scoreClass: 'text-amber-700',
      };
    }
    return {
      level: 'HIGH',
      text: 'HIGH',
      chipClass: 'bg-rose-100 text-rose-950 border-2 border-slate-900 font-heading font-extrabold',
      badgeBg: 'bg-rose-100 text-rose-950 border-2 border-slate-900 font-heading font-extrabold shadow-pop-sm',
      scoreClass: 'text-rose-700',
    };
  };

  // Format Stage display name
  const getStageLabel = (status) => {
    switch (status) {
      case 'PENDING_MANAGER':
        return 'Sales Manager';
      case 'PENDING_FINANCE':
        return 'Finance';
      case 'APPROVED':
        return 'Auto-Approved / Approved';
      case 'RETURNED':
        return 'Returned for Revision';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status ? status.replace('_', ' ') : 'Under Review';
    }
  };

  // Calculate line items analysis for "Why This Quote Was Flagged"
  const getLineAnalysis = (item) => {
    if (!item || !item.lines || item.lines.length === 0) return { lines: [], worstOver: 0 };
    const tier = (item.customerTier || item.customer_tier || 'BRONZE').toUpperCase();
    const tierMax = tier === 'GOLD' ? 15 : tier === 'SILVER' ? 10 : 5;

    let worstOver = 0;
    const lines = item.lines.map((l) => {
      const discount = Number(l.discount || 0);
      const catMax = l.product?.category?.maxDiscount || l.product?.category?.max_discount || tierMax;
      const effectiveMax = Math.min(tierMax, catMax);
      const overage = Math.max(0, discount - effectiveMax);
      if (overage > worstOver) worstOver = overage;

      return {
        id: l.id,
        name: l.product?.name || 'Product Item',
        category: l.product?.category?.name || 'General',
        discount,
        limit: effectiveMax,
        overage,
        isOver: overage > 0,
      };
    });

    return { lines, worstOver };
  };

  // Single Decision Submission
  const handleDecisionSubmit = async (quotationId, quotationNumber) => {
    const state = decisions[quotationId] || {};
    if (!state.action) {
      toast.error('Please select Approve, Return, or Reject');
      return;
    }

    if ((state.action === 'REJECTED' || state.action === 'RETURNED') && !state.reason?.trim()) {
      toast.error('Reason note is required when rejecting or returning for revision');
      return;
    }

    setSubmittingId(quotationId);
    try {
      await quotationsAPI.decision(quotationId, {
        action: state.action,
        reason: state.reason?.trim(),
      });

      toast.success(`${quotationNumber || 'Quotation'} ${state.action.toLowerCase()} successfully!`);

      // Close modal if open for this item
      if (activeDetailItem?.id === quotationId) {
        setActiveDetailItem(null);
      }

      // Refresh data
      loadApprovalData();
    } catch (err) {
      console.error('Decision failed:', err);
      toast.error(err.response?.data?.detail || err.detail || 'Failed to submit decision');
    } finally {
      setSubmittingId(null);
    }
  };

  // Quick Approve from list row
  const handleQuickApprove = async (e, item) => {
    e.stopPropagation();
    try {
      await quotationsAPI.decision(item.id, {
        action: 'APPROVED',
        reason: 'Quick approved from Approval List',
      });
      toast.success(`${item.quotation_number || item.quotationNumber} approved!`);
      loadApprovalData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve');
    }
  };

  // Bulk Approval
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const confirmMsg = `Approve ${selectedIds.length} quotation${selectedIds.length > 1 ? 's' : ''}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await quotationsAPI.batchDecision({
        quotationIds: selectedIds,
        action: 'APPROVED',
        reason: 'Bulk approved by executive manager',
      });

      toast.success(`Successfully approved ${selectedIds.length} quotations!`);
      setSelectedIds([]);
      loadApprovalData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk approval failed');
    }
  };

  // Bulk select toggles
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length && paginatedItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map((q) => q.id));
    }
  };

  const toggleSelectOne = (e, id) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Modal navigation (Previous / Next)
  const currentDetailIndex = useMemo(() => {
    if (!activeDetailItem) return -1;
    return displayedItems.findIndex((q) => q.id === activeDetailItem.id);
  }, [activeDetailItem, displayedItems]);

  const handlePrevItem = () => {
    if (currentDetailIndex > 0) {
      setActiveDetailItem(displayedItems[currentDetailIndex - 1]);
    }
  };

  const handleNextItem = () => {
    if (currentDetailIndex >= 0 && currentDetailIndex < displayedItems.length - 1) {
      setActiveDetailItem(displayedItems[currentDetailIndex + 1]);
    }
  };

  // Keydown listener for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeDetailItem) {
        setActiveDetailItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDetailItem]);

  return (
    <div className="space-y-6 antialiased pb-14">
      {/* ── TOP HEADER & SUMMARY PILLS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-5 sm:p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-slate-900">
              <ShieldAlert size={22} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Approvals</span>
              <span className="text-xs font-mono font-extrabold px-3 py-0.5 rounded-full bg-slate-100 border-2 border-slate-900 text-slate-700">
                List
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">
            Every quotation that needed, needs, or is going through discount approval
          </p>
        </div>

        {/* Status Summary Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pending Pill */}
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-extrabold transition-all border-2 border-slate-900 flex items-center gap-2 cursor-pointer ${
              filter === 'PENDING'
                ? 'bg-amber-400 text-slate-900 shadow-pop-sm'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 border border-slate-900 animate-pulse" />
            <span>{counts.pending || queue.length} Pending</span>
          </button>

          {/* Returned Pill */}
          <button
            onClick={() => setFilter('RETURNED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-extrabold transition-all border-2 border-slate-900 flex items-center gap-2 cursor-pointer ${
              filter === 'RETURNED'
                ? 'bg-rose-400 text-slate-900 shadow-pop-sm'
                : 'bg-rose-50 text-rose-900 hover:bg-rose-100'
            }`}
          >
            <span>{counts.returned} Returned</span>
          </button>

          {/* Approved Pill */}
          <button
            onClick={() => setFilter('APPROVED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-extrabold transition-all border-2 border-slate-900 flex items-center gap-2 cursor-pointer ${
              filter === 'APPROVED'
                ? 'bg-emerald-400 text-slate-900 shadow-pop-sm'
                : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            <span>{counts.approved} Approved</span>
          </button>

          {/* All Filter Pill */}
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-extrabold transition-all border-2 border-slate-900 cursor-pointer ${
              filter === 'ALL'
                ? 'bg-pop-violet text-white shadow-pop-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            All ({counts.total || allApprovals.length})
          </button>
        </div>
      </div>

      {/* ── TOOLBAR: SEARCH, STAGE FILTER & VIEW TOGGLES ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-2xl border-2 border-slate-900 shadow-pop">
        {/* Search Bar */}
        <div className="relative md:col-span-6 lg:col-span-5">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by quotation #, customer, or rep..."
            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Stage Filter Dropdown */}
        <div className="md:col-span-3 lg:col-span-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2 text-xs sm:text-sm font-heading font-bold text-slate-900 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all cursor-pointer"
          >
            <option value="PENDING">Filter: Pending Only</option>
            <option value="ALL">All Stages</option>
            <option value="PENDING_MANAGER">Pending Sales Manager</option>
            <option value="PENDING_FINANCE">Pending Finance Review</option>
            <option value="RETURNED">Returned for Revision</option>
            <option value="APPROVED">Approved Deals</option>
          </select>
        </div>

        {/* View Toggle & Bulk Action */}
        <div className="md:col-span-3 lg:col-span-4 flex items-center justify-end gap-2.5">
          {/* Bulk Approve Button */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkApprove}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-900 text-xs font-heading font-extrabold border-2 border-slate-900 shadow-pop-sm flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
              <span>Approve ({selectedIds.length})</span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border-2 border-slate-900">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 sm:px-3 sm:py-1 rounded-lg text-xs font-heading font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-pop-violet text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Compact Table List"
            >
              <LayoutList className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 sm:px-3 sm:py-1 rounded-lg text-xs font-heading font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-pop-violet text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Expanded Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── CALLOUT HINT BANNER ── */}
      <div className="bg-amber-50 border-2 border-slate-900 shadow-pop-sm rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 flex items-center gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={2.5} />
        <span>Click any row to open its full approval detail, risk breakdown, and audit trail.</span>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      {loading ? (
        <div className="p-16 text-center text-slate-600 text-sm font-bold bg-white border-2 border-slate-900 shadow-pop rounded-3xl">
          <div className="w-8 h-8 border-3 border-pop-violet border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading approval queue...
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white border-2 border-slate-900 shadow-pop rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-heading font-extrabold text-slate-900">No Quotations Found</h3>
          <p className="text-xs font-medium text-slate-600 max-w-sm mx-auto">
            {filter === 'PENDING'
              ? 'Approval queue is clear! No quotations currently require executive review.'
              : `No quotations match the filter "${filter}".`}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* ══════════════════════════════════════════════════════════════════
           COMPACT HIGH-DENSITY TABLE LIST
           ══════════════════════════════════════════════════════════════════ */
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-extrabold text-slate-700 tracking-wider font-mono">
                  <th className="p-3 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Select all on current page"
                    >
                      {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-pop-violet" strokeWidth={2.5} />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" strokeWidth={2.5} />
                      )}
                    </button>
                  </th>
                  <th className="p-3 font-heading font-extrabold">Quotation</th>
                  <th className="p-3 font-heading font-extrabold">Customer</th>
                  <th className="p-3 font-heading font-extrabold text-center hidden md:table-cell">Blended Risk</th>
                  <th className="p-3 font-heading font-extrabold hidden sm:table-cell">Stage</th>
                  <th className="p-3 font-heading font-extrabold hidden lg:table-cell">Assigned To</th>
                  <th className="p-3 font-heading font-extrabold text-right">Amount</th>
                  <th className="p-3 font-heading font-extrabold hidden sm:table-cell">Waiting</th>
                  <th className="p-3 font-heading font-extrabold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100">
                {paginatedItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const risk = getRiskDetails(item.blendedRiskScore ?? item.blended_risk_score);
                  const isPending = ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(item.status);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setActiveDetailItem(item)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-violet-50 hover:bg-violet-100'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="p-3 text-center" onClick={(e) => toggleSelectOne(e, item.id)}>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-pop-violet" strokeWidth={2.5} />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-700" strokeWidth={2.5} />
                        )}
                      </td>

                      {/* Quotation Number */}
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-pop-violet flex items-center gap-1.5">
                          <span>{item.quotationNumber || item.quotation_number || 'QT-Deal'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono font-medium">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-3">
                        <div className="font-heading font-bold text-slate-900 group-hover:text-pop-violet">
                          {item.customer?.name || item.customer?.company_name || 'Direct Customer'}
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase mt-0.5 ${getTierBadge(
                            item.customerTier || item.customer_tier
                          )}`}
                        >
                          {item.customerTier || item.customer_tier || 'BRONZE'}
                        </span>
                      </td>

                      {/* Blended Risk */}
                      <td className="p-3 text-center hidden md:table-cell">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold ${risk.chipClass}`}
                        >
                          <span>{risk.level}</span>
                          <span className="opacity-75">
                            ({Number(item.blendedRiskScore ?? item.blended_risk_score ?? 0).toFixed(1)})
                          </span>
                        </span>
                      </td>

                      {/* Stage */}
                      <td className="p-3 hidden sm:table-cell">
                        <span
                          className={`font-heading font-bold text-xs ${
                            item.status === 'PENDING_MANAGER'
                              ? 'text-amber-800'
                              : item.status === 'PENDING_FINANCE'
                              ? 'text-pop-violet'
                              : item.status === 'APPROVED'
                              ? 'text-emerald-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {getStageLabel(item.status)}
                        </span>
                      </td>

                      {/* Assigned To */}
                      <td className="p-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.5} />
                          <span>{item.rep?.name || 'Sales Rep'}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right font-mono font-extrabold text-slate-900 text-sm">
                        {formatINR(item.total)}
                      </td>

                      {/* Waiting Time */}
                      <td className="p-3 text-slate-600 text-[11px] font-mono whitespace-nowrap hidden sm:table-cell">
                        <div className="flex items-center gap-1 text-amber-900 font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-700" strokeWidth={2.5} />
                          <span>{getWaitingTime(item.created_at || item.createdAt)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={(e) => handleQuickApprove(e, item)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-400 hover:bg-emerald-300 border-2 border-slate-900 text-slate-900 font-heading font-extrabold text-[11px] flex items-center gap-1 shadow-pop-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                              title="Quick Approve"
                            >
                              <Check className="w-3 h-3" strokeWidth={2.5} />
                              <span className="hidden sm:inline">Approve</span>
                            </button>
                          )}
                          <button
                            onClick={() => setActiveDetailItem(item)}
                            className="px-2.5 py-1 rounded-xl bg-pop-violet hover:bg-violet-600 border-2 border-slate-900 text-white font-heading font-extrabold text-[11px] flex items-center gap-1 shadow-pop-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                            title="Open full approval details"
                          >
                            <Eye className="w-3 h-3" strokeWidth={2.5} />
                            <span>Review</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {displayedItems.length > 0 && (
            <div className="border-t-2 border-slate-900 p-3 bg-slate-50">
              <Pagination
                currentPage={currentPage}
                totalItems={displayedItems.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 25, 50, 100, 200]}
              />
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           EXPANDED CARDS VIEW
           ══════════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          {paginatedItems.map((item) => {
            return (
              <div
                key={item.id}
                className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop space-y-4 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-slate-900">
                        {item.quotationNumber || item.quotation_number}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${getTierBadge(item.customer_tier)}`}>
                        {item.customer_tier || 'BRONZE'}
                      </span>
                    </div>
                    <h3 className="text-base font-heading font-extrabold text-slate-900 mt-1">
                      {item.customer?.name || item.customer?.company_name || 'Client'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveDetailItem(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-pop-violet hover:bg-violet-600 text-white text-xs font-heading font-extrabold border-2 border-slate-900 shadow-pop-sm flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>Full Detail View</span>
                    </button>
                  </div>
                </div>

                {/* Quick actions inside card */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-amber-900">{getWaitingTime(item.created_at)}</span>
                  <span className="font-mono font-extrabold text-slate-900 text-sm">{formatINR(item.total)}</span>
                </div>
              </div>
            );
          })}

          <div className="bg-white border-2 border-slate-900 rounded-3xl p-3 shadow-pop">
            <Pagination
              currentPage={currentPage}
              totalItems={displayedItems.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 25, 50, 100, 200]}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
         APPROVAL DETAIL MODAL / SLIDE-OVER
         ══════════════════════════════════════════════════════════════════ */}
      {activeDetailItem && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white border-2 border-slate-900 rounded-3xl shadow-pop-xl overflow-hidden max-h-[88vh] flex flex-col">
            {/* ── MODAL HEADER ── */}
            <div className="p-4 sm:p-5 border-b-2 border-slate-900 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-heading font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Approval Detail:</span>
                  <span className="text-pop-violet font-mono font-bold">
                    {activeDetailItem.quotationNumber || activeDetailItem.quotation_number}
                  </span>
                  <span className="text-slate-600 font-medium">
                    ({activeDetailItem.customer?.name || activeDetailItem.customer?.company_name || 'Customer'})
                  </span>
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Opened by clicking a row on the Approvals list
                </p>
              </div>

              {/* Badges & Navigation Buttons */}
              <div className="flex items-center gap-2">
                {/* Previous / Next Deal buttons */}
                <div className="flex items-center bg-white border-2 border-slate-900 rounded-xl p-0.5 shadow-pop-sm">
                  <button
                    onClick={handlePrevItem}
                    disabled={currentDetailIndex <= 0}
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    title="Previous Quotation"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <span className="text-[10px] font-mono font-bold px-1.5 text-slate-700">
                    {currentDetailIndex + 1} / {displayedItems.length}
                  </span>
                  <button
                    onClick={handleNextItem}
                    disabled={currentDetailIndex >= displayedItems.length - 1}
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    title="Next Quotation"
                  >
                    <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setActiveDetailItem(null)}
                  className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* ── MODAL SCROLLABLE BODY ── */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-white">
              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Blended Risk Badge */}
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 ${
                    getRiskDetails(activeDetailItem.blendedRiskScore ?? activeDetailItem.blended_risk_score).badgeBg
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2.5} />
                  <span>
                    Blended Risk:{' '}
                    {getRiskDetails(activeDetailItem.blendedRiskScore ?? activeDetailItem.blended_risk_score).level} (
                    {Number(activeDetailItem.blendedRiskScore ?? activeDetailItem.blended_risk_score ?? 0).toFixed(1)} / 10.0)
                  </span>
                </span>

                {/* Customer Tier Badge */}
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-pop-sm ${getTierBadge(
                    activeDetailItem.customerTier || activeDetailItem.customer_tier
                  )}`}
                >
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />
                  <span>Customer Tier: {activeDetailItem.customerTier || activeDetailItem.customer_tier || 'BRONZE'}</span>
                </span>

                {/* Total Value */}
                <span className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-extrabold bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-sm ml-auto">
                  Total Deal: {formatINR(activeDetailItem.total)}
                </span>
              </div>

              {/* ── SECTION: WHY THIS QUOTE WAS FLAGGED ── */}
              <div className="space-y-3">
                <h3 className="text-sm font-heading font-extrabold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" strokeWidth={2.5} />
                  <span>Why This Quote Was Flagged</span>
                </h3>

                {/* Flagged Lines Table */}
                <div className="overflow-x-auto rounded-2xl border-2 border-slate-900 bg-white shadow-pop-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-extrabold text-slate-700 tracking-wider font-mono">
                        <th className="p-3">Line</th>
                        <th className="p-3 text-center">Discount Given</th>
                        <th className="p-3 text-center">Limit Allowed</th>
                        <th className="p-3 text-right">Over By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100">
                      {getLineAnalysis(activeDetailItem).lines.map((l) => (
                        <tr
                          key={l.id}
                          className={l.isOver ? 'bg-rose-50' : 'hover:bg-slate-50'}
                        >
                          <td className="p-3">
                            <span className="font-heading font-bold text-slate-900">{l.name}</span>
                            <span className="text-[11px] text-slate-500 ml-1.5 font-medium">({l.category})</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-900">
                            {l.discount}%
                          </td>
                          <td className="p-3 text-center font-mono text-slate-600 font-medium">
                            {l.limit}%
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            {l.isOver ? (
                              <span className="text-rose-950 bg-rose-200 px-2.5 py-0.5 rounded-lg border-2 border-slate-900 text-xs font-mono font-extrabold shadow-pop-sm">
                                {l.overage.toFixed(0)} pt OVER
                              </span>
                            ) : (
                              <span className="text-emerald-950 bg-emerald-100 px-2.5 py-0.5 rounded-lg border-2 border-slate-900 text-xs font-mono font-bold">
                                0 pt - OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Callout Box */}
                <div className="bg-amber-50 border-2 border-slate-900 shadow-pop-sm rounded-2xl p-3.5 text-xs font-medium text-slate-800">
                  Worst single line ({getLineAnalysis(activeDetailItem).worstOver.toFixed(0)} pt over) plus
                  overall pattern across the order sets the blended score. One bad line is enough to require
                  approval.
                </div>
              </div>

              {/* ── SECTION: APPROVAL PROGRESS FLOW ── */}
              <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-5 space-y-4 shadow-pop-sm">
                <div className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-700">
                  Approval Chain Progression
                </div>

                {/* Flow Diagram */}
                <div className="flex items-center justify-between px-4 py-2 relative">
                  {/* Step 1: Submitted */}
                  <div className="flex flex-col items-center gap-1.5 z-10">
                    <div className="w-9 h-9 rounded-full bg-emerald-400 border-2 border-slate-900 text-slate-900 flex items-center justify-center font-bold text-xs shadow-pop-sm">
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-heading font-bold text-emerald-800">Submitted</span>
                  </div>

                  {/* Connecting Line 1 */}
                  <div className="flex-1 h-1 bg-slate-300 mx-2 rounded-full" />

                  {/* Step 2: Sales Manager */}
                  <div className="flex flex-col items-center gap-1.5 z-10">
                    <div
                      className={`w-9 h-9 rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-xs shadow-pop-sm ${
                        activeDetailItem.approvals?.some((a) => a.level === 1 && a.action === 'APPROVED')
                          ? 'bg-emerald-400 text-slate-900'
                          : activeDetailItem.status === 'PENDING_MANAGER'
                          ? 'bg-pop-violet text-white ring-4 ring-violet-200'
                          : 'bg-white text-slate-400'
                      }`}
                    >
                      2
                    </div>
                    <span
                      className={`text-xs font-heading font-bold ${
                        activeDetailItem.status === 'PENDING_MANAGER'
                          ? 'text-pop-violet'
                          : activeDetailItem.approvals?.some((a) => a.level === 1 && a.action === 'APPROVED')
                          ? 'text-emerald-800'
                          : 'text-slate-500'
                      }`}
                    >
                      Sales Manager
                    </span>
                  </div>

                  {/* Connecting Line 2 */}
                  <div className="flex-1 h-1 bg-slate-300 mx-2 rounded-full" />

                  {/* Step 3: Finance */}
                  <div className="flex flex-col items-center gap-1.5 z-10">
                    <div
                      className={`w-9 h-9 rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-xs shadow-pop-sm ${
                        activeDetailItem.approvals?.some((a) => a.level === 2 && a.action === 'APPROVED')
                          ? 'bg-emerald-400 text-slate-900'
                          : activeDetailItem.status === 'PENDING_FINANCE'
                          ? 'bg-pop-violet text-white ring-4 ring-violet-200'
                          : 'bg-white text-slate-400'
                      }`}
                    >
                      3
                    </div>
                    <span
                      className={`text-xs font-heading font-bold ${
                        activeDetailItem.status === 'PENDING_FINANCE'
                          ? 'text-pop-violet'
                          : activeDetailItem.approvals?.some((a) => a.level === 2 && a.action === 'APPROVED')
                          ? 'text-emerald-800'
                          : 'text-slate-500'
                      }`}
                    >
                      Finance
                    </span>
                  </div>

                  {/* Connecting Line 3 */}
                  <div className="flex-1 h-1 bg-slate-300 mx-2 rounded-full" />

                  {/* Step 4: Confirmed */}
                  <div className="flex flex-col items-center gap-1.5 z-10">
                    <div
                      className={`w-9 h-9 rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-xs shadow-pop-sm ${
                        activeDetailItem.status === 'CONFIRMED'
                          ? 'bg-emerald-400 text-slate-900'
                          : 'bg-white text-slate-400'
                      }`}
                    >
                      4
                    </div>
                    <span
                      className={`text-xs font-heading font-bold ${
                        activeDetailItem.status === 'CONFIRMED' ? 'text-emerald-800' : 'text-slate-500'
                      }`}
                    >
                      Confirmed
                    </span>
                  </div>
                </div>
              </div>

              {/* ── SECTION: ACTION HISTORY / AUDIT TABLE ── */}
              <div className="space-y-3">
                <h3 className="text-sm font-heading font-extrabold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-pop-violet" strokeWidth={2.5} />
                  <span>Approval Action History</span>
                </h3>

                <div className="overflow-x-auto rounded-2xl border-2 border-slate-900 bg-white shadow-pop-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-extrabold text-slate-700 tracking-wider font-mono">
                        <th className="p-3">User</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100">
                      {/* Initial submission line */}
                      <tr>
                        <td className="p-3 font-heading font-bold text-slate-900">
                          {activeDetailItem.rep?.name || 'Sales Rep'}
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-sky-100 text-sky-900 border border-sky-300">
                            Submitted
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-[11px] font-medium">
                          {activeDetailItem.created_at
                            ? new Date(activeDetailItem.created_at).toLocaleDateString()
                            : 'Aug 20'}
                        </td>
                        <td className="p-3 text-slate-700 text-[11px] font-medium">
                          Initial discount requested for approval
                        </td>
                      </tr>

                      {/* Approvals and audit logs */}
                      {activeDetailItem.audit_logs?.map((l) => (
                        <tr key={l.id}>
                          <td className="p-3 font-heading font-bold text-slate-900">{l.user?.name || 'Manager'}</td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                                l.action === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                  : l.action === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-950 border-rose-300'
                                  : 'bg-amber-100 text-amber-950 border-amber-300'
                              }`}
                            >
                              {l.action}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-mono text-[11px] font-medium">
                            {l.created_at ? `${formatRelativeTime(l.created_at)} · ${formatDate(l.created_at)}` : 'Recent'}
                          </td>
                          <td className="p-3 text-slate-700 text-[11px] font-medium">{l.details || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── SECTION: EXECUTIVE DECISION ACTIONS ── */}
              <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-5 space-y-4 shadow-pop-sm">
                <div className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-700">
                  Executive Decision
                </div>

                {/* 3 Large Action Buttons (Approve | Return for Revision | Reject) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Approve */}
                  <button
                    type="button"
                    onClick={() =>
                      setDecisions((prev) => ({
                        ...prev,
                        [activeDetailItem.id]: {
                          ...prev[activeDetailItem.id],
                          action: 'APPROVED',
                        },
                      }))
                    }
                    className={`py-3 px-4 rounded-xl text-sm font-heading font-extrabold border-2 border-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      decisions[activeDetailItem.id]?.action === 'APPROVED'
                        ? 'bg-emerald-400 text-slate-900 shadow-pop ring-2 ring-emerald-500'
                        : 'bg-white text-slate-800 hover:bg-emerald-50 shadow-pop-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                    <span>Approve</span>
                  </button>

                  {/* Return for Revision */}
                  <button
                    type="button"
                    onClick={() =>
                      setDecisions((prev) => ({
                        ...prev,
                        [activeDetailItem.id]: {
                          ...prev[activeDetailItem.id],
                          action: 'RETURNED',
                        },
                      }))
                    }
                    className={`py-3 px-4 rounded-xl text-sm font-heading font-extrabold border-2 border-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      decisions[activeDetailItem.id]?.action === 'RETURNED'
                        ? 'bg-amber-400 text-slate-900 shadow-pop ring-2 ring-amber-500'
                        : 'bg-white text-slate-800 hover:bg-amber-50 shadow-pop-sm'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4" strokeWidth={2.5} />
                    <span>Return for Revision</span>
                  </button>

                  {/* Reject */}
                  <button
                    type="button"
                    onClick={() =>
                      setDecisions((prev) => ({
                        ...prev,
                        [activeDetailItem.id]: {
                          ...prev[activeDetailItem.id],
                          action: 'REJECTED',
                        },
                      }))
                    }
                    className={`py-3 px-4 rounded-xl text-sm font-heading font-extrabold border-2 border-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      decisions[activeDetailItem.id]?.action === 'REJECTED'
                        ? 'bg-rose-400 text-slate-900 shadow-pop ring-2 ring-rose-500'
                        : 'bg-white text-slate-800 hover:bg-rose-50 shadow-pop-sm'
                    }`}
                  >
                    <XCircle className="w-4 h-4" strokeWidth={2.5} />
                    <span>Reject</span>
                  </button>
                </div>

                {/* Decision Notes & Rationale */}
                <div>
                  <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Decision Notes & Rationale{' '}
                    {(decisions[activeDetailItem.id]?.action === 'REJECTED' ||
                      decisions[activeDetailItem.id]?.action === 'RETURNED') && (
                      <span className="text-rose-600 font-extrabold">* (Required)</span>
                    )}
                  </label>
                  <textarea
                    rows={3}
                    value={decisions[activeDetailItem.id]?.reason || ''}
                    onChange={(e) =>
                      setDecisions((prev) => ({
                        ...prev,
                        [activeDetailItem.id]: {
                          ...prev[activeDetailItem.id],
                          reason: e.target.value,
                        },
                      }))
                    }
                    placeholder={
                      decisions[activeDetailItem.id]?.action === 'REJECTED'
                        ? 'State specific business justification for deal rejection...'
                        : decisions[activeDetailItem.id]?.action === 'RETURNED'
                        ? 'Specify required discount adjustments or terms for sales rep...'
                        : 'Optional approval notes or executive comments...'
                    }
                    className="w-full bg-white border-2 border-slate-900 rounded-xl p-3 text-xs sm:text-sm text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:shadow-pop-sm transition-all"
                  />
                </div>

                {/* Submit Decision Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveDetailItem(null)}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-heading font-bold border-2 border-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDecisionSubmit(
                        activeDetailItem.id,
                        activeDetailItem.quotationNumber || activeDetailItem.quotation_number
                      )
                    }
                    disabled={!decisions[activeDetailItem.id]?.action || submittingId === activeDetailItem.id}
                    className="px-6 py-2.5 rounded-xl bg-pop-violet hover:bg-violet-600 text-white text-xs font-heading font-extrabold border-2 border-slate-900 shadow-pop-sm transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
                    <span>{submittingId === activeDetailItem.id ? 'Submitting...' : 'Submit Decision'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    )}

      {/* ── AUDIT TRAIL PANEL (COLLAPSIBLE FOOTER) ── */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
        <button
          type="button"
          onClick={() => setShowAuditTrail(!showAuditTrail)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-sky-800">
              <History className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <h3 className="text-sm font-heading font-extrabold text-slate-900">Recent Approval Activity & Audit Trail</h3>
            <span className="text-xs text-slate-500 font-mono font-medium">({auditTrail.length} recorded events)</span>
          </div>
          {showAuditTrail ? (
            <ChevronUp className="w-4 h-4 text-slate-600" strokeWidth={2.5} />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600" strokeWidth={2.5} />
          )}
        </button>

        {showAuditTrail && (
          <div className="border-t-2 border-slate-900 p-4 max-h-72 overflow-y-auto divide-y-2 divide-slate-100 bg-slate-50/50">
            {auditTrail.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-medium">
                No recent approval actions recorded in audit log.
              </div>
            ) : (
              auditTrail.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-slate-900">
                        {log.quotation?.quotation_number || 'Quotation'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                          log.action === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                            : log.action === 'REJECTED'
                            ? 'bg-rose-100 text-rose-950 border-rose-300'
                            : 'bg-amber-100 text-amber-950 border-amber-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                      {log.details} · By{' '}
                      <span className="text-slate-900 font-bold">{log.user?.name || 'Executive'}</span>
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono font-medium shrink-0">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
