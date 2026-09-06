import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import {
  Search,
  AlertTriangle,
  FileText,
  DollarSign,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Send,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  X,
  Check,
  Sparkles,
  Database,
  Activity,
  ArrowRight,
  ShoppingBag,
  RotateCcw,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { io } from 'socket.io-client';
import { quotationsAPI, usersAPI, invoicesAPI } from '../../api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 4;

const KANBAN_COLUMNS = [
  { id: 'DRAFT',       title: 'DRAFT',            accent: '#64748b', glow: '#F1F5F9'  },
  { id: 'PENDING',     title: 'PENDING APPROVAL',  accent: '#d97706', glow: '#FEF3C7'   },
  { id: 'APPROVED',    title: 'APPROVED',           accent: '#059669', glow: '#D1FAE5'  },
  { id: 'SENT',        title: 'SENT',              accent: '#0284c7', glow: '#E0F2FE'   },
  { id: 'NEGOTIATING', title: 'NEGOTIATING',        accent: '#7c3aed', glow: '#EDE9FE'  },
  { id: 'CONFIRMED',   title: 'CONFIRMED',          accent: '#0d9488', glow: '#CCFBF1'  },
  { id: 'CANCELLED',   title: 'CANCELLED',          accent: '#e11d48', glow: '#FFE4E6'   },
];

// ── Column Pagination Bar ───────────────────────────────────────────────
// ── Column Pagination Bar ───────────────────────────────────────────────
function ColPager({ colId, total, page, totalPages, pageSize, onPage }) {
  if (total === 0) return null;

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);

  return (
    <div
      className="shrink-0 flex items-center justify-between px-3 py-2 bg-slate-50 border-t-2 border-slate-900"
    >
      {/* Left: record range */}
      <span className="text-[10px] font-heading font-bold text-slate-600 select-none">
        {from}–{to} of <span className="text-slate-900 font-black">{total}</span>
      </span>

      {/* Centre: page pills or compact indicator */}
      <div className="flex items-center gap-1">
        {totalPages <= 4 ? (
          Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPage(colId, p)}
              className={`transition-all text-[10px] font-heading font-black border-2 border-slate-900 rounded-full cursor-pointer px-1.5 py-0.2 ${
                p === page ? 'bg-pop-violet text-white shadow-pop-xs' : 'bg-white text-slate-700 hover:bg-pop-yellow'
              }`}
              title={`Page ${p}`}
            >
              {p}
            </button>
          ))
        ) : (
          <span className="text-[10px] font-mono font-black text-slate-900 px-2 py-0.5 rounded-full bg-white border-2 border-slate-900 shadow-pop-xs">
            {page}/{totalPages}
          </span>
        )}
      </div>

      {/* Right: prev / next */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(colId, page - 1)}
          className="w-6 h-6 rounded-full border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-pop-xs active:translate-y-0.5 cursor-pointer"
          title="Previous Page"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(colId, page + 1)}
          className="w-6 h-6 rounded-full border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-pop-xs active:translate-y-0.5 cursor-pointer"
          title="Next Page"
        >
          <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PipelineKanban() {
  const navigate = useNavigate();

  const [quotations, setQuotations]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedRep, setSelectedRep]   = useState('');
  const [dateRange, setDateRange]       = useState('ALL');
  const [groupByValue, setGroupByValue] = useState(false);
  const [pageSize, setPageSize]         = useState(3);
  const [colPages, setColPages]         = useState({});
  const [reps, setReps]                 = useState([]);

  // Sorting State for Pipeline Deals
  const [sortField, setSortField]       = useState('last_activity'); // 'last_activity' | 'name' | 'amount' | 'customer' | 'risk' | 'expiry'
  const [sortOrder, setSortOrder]       = useState('desc'); // 'asc' | 'desc'

  // Quick Card Hover & In-Place Action States
  const [quickCardQuote, setQuickCardQuote]         = useState(null);
  const [quickCardPos, setQuickCardPos]             = useState({ x: 0, y: 0 });
  const [quickCardType, setQuickCardType]           = useState('');
  const [activeDealModal, setActiveDealModal]       = useState(null);
  const [dealDetails, setDealDetails]               = useState(null);
  const [loadingDetails, setLoadingDetails]         = useState(false);
  const [approvalNotes, setApprovalNotes]           = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [sendingId, setSendingId]                   = useState(null);

  // Load detailed quotation data when active deal modal opens
  useEffect(() => {
    if (!activeDealModal) {
      setDealDetails(null);
      setApprovalNotes('');
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    quotationsAPI.getOne(activeDealModal.id)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || res;
        setDealDetails(data);
      })
      .catch((err) => {
        console.error('Failed to fetch full quotation details:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => { cancelled = true; };
  }, [activeDealModal?.id]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDealModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Quick Card Hover Helper
  const handleButtonHover = (q, e, type) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setQuickCardQuote(q);
    setQuickCardType(type);

    const popoverWidth = 280;
    const popoverHeight = 240;

    let x = rect.right + 12;
    if (x + popoverWidth > window.innerWidth) {
      x = rect.left - popoverWidth - 12;
    }

    let y = rect.top - 20;
    if (y + popoverHeight > window.innerHeight) {
      y = window.innerHeight - popoverHeight - 20;
    }
    if (y < 20) y = 20;

    setQuickCardPos({ x, y });
  };

  // Quick In-Place Approval
  const handleQuickApprove = async (quotationId, action) => {
    setSubmittingDecision(true);
    try {
      const isApprove = action === 'APPROVED' || action === 'APPROVE';
      const canonicalAction = isApprove ? 'APPROVED' : 'REJECTED';

      await quotationsAPI.decision(quotationId, {
        action: canonicalAction,
        reason: approvalNotes?.trim() || `Decision submitted via Pipeline quick-action`
      });

      const nextStatus = isApprove ? 'APPROVED' : 'REJECTED';
      setQuotations((prev) =>
        prev.map((q) => (q.id === quotationId ? { ...q, status: nextStatus } : q))
      );

      toast.success(
        isApprove
          ? `Quotation approved and moved to Approved stage!`
          : `Quotation rejected.`
      );

      setActiveDealModal(null);
      setApprovalNotes('');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.detail || 'Failed to submit decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Quick In-Place Submit for Approval (Draft stage)
  const handleQuickSubmit = async (q) => {
    setSubmittingDecision(true);
    try {
      await quotationsAPI.submit(q.id);
      toast.success(`${q.quotation_number} submitted for approval!`);
      setQuotations((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, status: 'PENDING_MANAGER' } : item))
      );
      setActiveDealModal(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.detail || 'Failed to submit quotation');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Quick In-Place Restore to Draft (Cancelled stage)
  const handleQuickRestoreDraft = async (q) => {
    setSubmittingDecision(true);
    try {
      await quotationsAPI.updateStatus(q.id, { status: 'DRAFT' });
      toast.success(`${q.quotation_number} restored to DRAFT!`);
      setQuotations((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, status: 'DRAFT' } : item))
      );
      setActiveDealModal(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.detail || 'Failed to restore quotation');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Quick In-Place Send to Customer
  const handleSendCustomer = async (q, e) => {
    e.stopPropagation();
    e.preventDefault();
    setSendingId(q.id);
    try {
      await quotationsAPI.send(q.id);
      toast.success(`${q.quotation_number} dispatched to client via email!`);
      setQuotations((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, status: 'SENT' } : item))
      );
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.detail || 'Failed to send quotation');
    } finally {
      setSendingId(null);
    }
  };

  // Quick In-Place View Portal
  const handleViewPortal = (q, e) => {
    e.stopPropagation();
    e.preventDefault();
    const token = q.portal_token;
    if (!token) {
      toast.error('No portal token found for this quotation');
      return;
    }
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    window.open(url, '_blank');
    toast.success('Client Portal opened in new tab & link copied!');
  };

  // Quick In-Place Create Invoice
  const handleCreateInvoice = async (q, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await invoicesAPI.create({ quotationId: q.id });
      toast.success(`Invoice created for ${q.quotation_number}!`);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.detail || 'Failed to create invoice');
    }
  };

  const loadData = async (query = searchTerm, rep = selectedRep, range = dateRange) => {
    try {
      setLoading(true);
      const params = {};
      if (query && query.trim()) params.search = query.trim();
      if (rep && rep !== 'ALL') params.repId = rep;
      if (range && range !== 'ALL') params.dateRange = range;

      const [quotesRes, usersRes] = await Promise.allSettled([
        quotationsAPI.getAll(params),
        usersAPI.getAll(),
      ]);

      if (quotesRes.status === 'fulfilled') {
        const raw = quotesRes.value;
        const list = Array.isArray(raw) ? raw : (raw?.quotations || raw?.data || []);
        setQuotations(list);
      } else {
        console.error('Failed to fetch quotations:', quotesRes.reason);
        toast.error('Failed to load deals pipeline');
      }

      if (usersRes.status === 'fulfilled') {
        const rawU = usersRes.value;
        const list = Array.isArray(rawU) ? rawU : (rawU?.users || rawU?.data || []);
        const repUsers = list.filter((u) => ['SALES_REP', 'SALES_MANAGER', 'ADMIN'].includes(u.role));
        setReps(repUsers);
      }
    } catch (err) {
      console.error('Deals pipeline error:', err);
      toast.error('Failed to load deals pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, selectedRep, dateRange]);

  useEffect(() => {
    const s = io('http://localhost:5000', { withCredentials: true, transports: ['websocket', 'polling'] });
    s.on('connect', () => s.emit('join_dashboard'));
    ['quotation-created', 'approval-decision', 'quotation-updated'].forEach((ev) => s.on(ev, () => loadData(searchTerm, selectedRep, dateRange)));
    return () => s.disconnect();
  }, [searchTerm, selectedRep, dateRange]);

  const mapStatus = (status) => {
    if (!status) return 'DRAFT';
    const s = status.toUpperCase();
    if (['PENDING_MANAGER','PENDING_FINANCE','PENDING'].includes(s)) return 'PENDING';
    if (s === 'APPROVED') return 'APPROVED';
    if (['SENT_TO_CUSTOMER','SENT'].includes(s)) return 'SENT';
    if (['UNDER_NEGOTIATION','NEGOTIATING'].includes(s)) return 'NEGOTIATING';
    if (s === 'CONFIRMED') return 'CONFIRMED';
    if (['CANCELLED','REJECTED'].includes(s)) return 'CANCELLED';
    return 'DRAFT';
  };

  const toDbStatus = { PENDING:'PENDING_MANAGER', APPROVED:'APPROVED', SENT:'SENT_TO_CUSTOMER', NEGOTIATING:'UNDER_NEGOTIATION', CONFIRMED:'CONFIRMED', CANCELLED:'CANCELLED' };

  // Sort deals deterministically based on active sort options
  const sortedQuotes = useMemo(() => {
    const list = [...quotations];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        const aVal = (a.quotation_number || a.quotationNumber || '').toLowerCase();
        const bVal = (b.quotation_number || b.quotationNumber || '').toLowerCase();
        cmp = aVal.localeCompare(bVal);
      } else if (sortField === 'customer') {
        const aVal = (a.customer?.company_name || a.customer?.name || a.customer_name || '').toLowerCase();
        const bVal = (b.customer?.company_name || b.customer?.name || b.customer_name || '').toLowerCase();
        cmp = aVal.localeCompare(bVal);
      } else if (sortField === 'amount') {
        const aVal = Number(a.total ?? a.final_amount ?? a.total_amount ?? 0);
        const bVal = Number(b.total ?? b.final_amount ?? b.total_amount ?? 0);
        cmp = aVal - bVal;
      } else if (sortField === 'risk') {
        const aVal = Number(a.blended_risk_score ?? a.blendedRiskScore ?? a.risk_score ?? 0);
        const bVal = Number(b.blended_risk_score ?? b.blendedRiskScore ?? b.risk_score ?? 0);
        cmp = aVal - bVal;
      } else if (sortField === 'expiry') {
        const aVal = a.valid_until ? new Date(a.valid_until).getTime() : 0;
        const bVal = b.valid_until ? new Date(b.valid_until).getTime() : 0;
        cmp = aVal - bVal;
      } else {
        // Default: 'last_activity' / latest update
        const aVal = new Date(a.last_activity_at || a.updated_at || a.created_at || 0).getTime();
        const bVal = new Date(b.last_activity_at || b.updated_at || b.created_at || 0).getTime();
        cmp = aVal - bVal;
      }

      if (cmp === 0) {
        // Deterministic secondary tie-breaker by ID
        cmp = String(a.id).localeCompare(String(b.id));
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [quotations, sortField, sortOrder]);

  // Distribute sorted deals into kanban stages
  const colData = {};
  KANBAN_COLUMNS.forEach((c) => { colData[c.id] = []; });
  sortedQuotes.forEach((q) => { const id = mapStatus(q.status); if (colData[id]) colData[id].push(q); });

  useEffect(() => { setColPages({}); }, [searchTerm, selectedRep, dateRange]);

  const getPage  = (id) => colPages[id] || 1;
  const setPage  = (id, p) => setColPages((prev) => ({ ...prev, [id]: p }));

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const destCol = destination.droppableId;
    const q = quotations.find((x) => x.id === draggableId);
    if (!q) return;
    if (q.status === 'REJECTED' && destCol === 'CONFIRMED') { toast.error('Cannot move REJECTED → CONFIRMED'); return; }
    if (destCol === 'CANCELLED' && !window.confirm(`Mark ${q.quotation_number} as CANCELLED?`)) return;
    const nextStatus = toDbStatus[destCol] || 'DRAFT';
    setQuotations(quotations.map((x) => x.id === draggableId ? { ...x, status: nextStatus, last_activity_at: new Date().toISOString() } : x));
    try {
      await quotationsAPI.updateStatus(draggableId, { status: nextStatus });
      toast.success(`Moved ${q.quotation_number} → ${destCol}`);
    } catch (err) {
      toast.error(err.detail || 'Failed to update');
      loadData();
    }
  };

  const tierColor = (t) => {
    const v = String(t||'BRONZE').toUpperCase();
    if (v==='GOLD')   return { bg:'#FEF08A', text:'#713F12', border:'#1E293B' };
    if (v==='SILVER') return { bg:'#F1F5F9', text:'#1E293B', border:'#1E293B' };
    return { bg:'#FFEDD5', text:'#7C2D12', border:'#1E293B' };
  };

  const riskColor = (s) => {
    const n = Number(s||0);
    if (n<=5)  return { bg:'#A7F3D0', text:'#064E3B', border:'#1E293B' };
    if (n<=10) return { bg:'#FDE68A', text:'#713F12', border:'#1E293B' };
    return { bg:'#FECDD3', text:'#881337', border:'#1E293B' };
  };

  const daysAgo = (q) => {
    const dt = q.last_activity_at || q.updated_at || q.created_at;
    return dt ? Math.floor(Math.abs(Date.now()-new Date(dt).getTime())/86400000) : 0;
  };

  const expWarn = (d) => {
    if (!d) return null;
    const n = Math.ceil((new Date(d)-Date.now())/86400000);
    return n>=0 && n<=7 ? `${n}d left` : null;
  };

  return (
    <div className="flex flex-col gap-5 antialiased pb-10 h-full">
      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white border-2 border-slate-900 shadow-pop">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm flex items-center justify-center">
              <LayoutGrid className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-heading font-black text-slate-900 tracking-tight">Deals Pipeline</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-heading font-extrabold bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-sm">
              {quotations.length} deals
            </span>
            {(searchTerm || selectedRep || dateRange !== 'ALL') && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold bg-pop-mint text-slate-900 border-2 border-slate-900 shadow-pop-sm">
                <Database className="w-2.5 h-2.5" strokeWidth={2.5} />
                <span>DB Filtered</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-heading font-bold mt-1 ml-12">
            Drag cards between stages · {pageSize} per column page
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Per Page Density Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-sm">
            <span className="text-[10px] text-slate-700 font-heading font-bold uppercase tracking-wider">Per Page:</span>
            {[2, 3, 4, 8].map((sz) => {
              const active = pageSize === sz;
              return (
                <button
                  key={sz}
                  onClick={() => {
                    setPageSize(sz);
                    setColPages({});
                  }}
                  className={`px-2 py-0.5 rounded-full text-xs font-heading font-bold transition-all border ${
                    active ? 'bg-pop-violet text-white border-slate-900 shadow-pop-sm' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-pop-yellow'
                  }`}
                  title={`Show ${sz} deals per column page`}
                >
                  {sz}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
            <input
              type="text" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search QT# or client…"
              className="pl-9 pr-3.5 py-1.5 text-xs rounded-full bg-[#FFFDF5] border-2 border-slate-900 font-heading font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:shadow-pop-sm w-44"
            />
          </div>

          <select
            value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)}
            className="px-3.5 py-1.5 text-xs rounded-full bg-[#FFFDF5] border-2 border-slate-900 font-heading font-bold text-slate-900 focus:outline-none focus:shadow-pop-sm cursor-pointer"
          >
            <option value="">All Reps</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          {/* Neo-brutalist Sorting Controls */}
          <div className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-sm">
            <span className="text-[10px] text-slate-500 font-heading font-black uppercase tracking-wider hidden sm:inline">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-transparent text-xs font-heading font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
            >
              <option value="last_activity">Latest Update</option>
              <option value="name">Deal Name (QT#)</option>
              <option value="amount">Deal Value</option>
              <option value="customer">Customer Name</option>
              <option value="risk">Risk Score</option>
              <option value="expiry">Expiry Date</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1 rounded-full bg-white hover:bg-pop-yellow text-slate-900 border border-slate-900 shadow-pop-xs transition-transform active:translate-y-0.5 cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending (Click for Descending)' : 'Descending (Click for Ascending)'}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-pop-violet" strokeWidth={3} />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-pop-violet" strokeWidth={3} />
              )}
            </button>
          </div>

          <div className="flex items-center rounded-full overflow-hidden border-2 border-slate-900 shadow-pop-sm">
            {[{ id:'ALL',label:'All' },{ id:'7D',label:'7d' },{ id:'30D',label:'30d' }].map((d) => (
              <button
                key={d.id} onClick={() => setDateRange(d.id)}
                className={`px-3 py-1.5 text-xs font-heading font-bold transition-all cursor-pointer ${
                  dateRange === d.id ? 'bg-pop-violet text-white' : 'bg-white text-slate-700 hover:bg-pop-yellow'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setGroupByValue(!groupByValue)}
            className={`btn-candy text-xs px-3.5 py-1.5 gap-1.5 shadow-pop-sm cursor-pointer ${
              groupByValue ? 'bg-pop-yellow text-slate-900' : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Maximize2 className="w-3 h-3" strokeWidth={2.5} /> Size by Value
          </button>

          <div className="flex items-center gap-1.5 bg-[#FFFDF5] border-2 border-slate-900 rounded-full px-3 py-1 shadow-pop-sm">
            <span className="text-[11px] font-heading font-bold text-slate-600">Per Col:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-transparent text-xs font-heading font-black text-slate-900 focus:outline-none cursor-pointer"
              title="Deals per column page"
            >
              {[3, 5, 10, 25, 50].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── BOARD ────────────────────────────────────────────────────── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3.5 overflow-x-auto pb-4" style={{ minHeight:'calc(100vh - 230px)' }}>
          {KANBAN_COLUMNS.map((col) => {
            const cards      = colData[col.id] || [];
            const page       = getPage(col.id);
            const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
            const safePg     = Math.min(page, totalPages);
            const visible    = cards.slice((safePg-1)*pageSize, safePg*pageSize);
            const colVal     = cards.reduce((s,c)=>s+Number(c.total||0),0);
            const hasPager   = cards.length > pageSize;

            return (
              <div
                key={col.id}
                className="shrink-0 flex flex-col rounded-3xl overflow-hidden bg-white border-2 border-slate-900 shadow-pop"
                style={{
                  width: 300,
                  height: 'calc(100vh - 240px)',
                }}
              >
                {/* ── Column Header ──────────────────────────── */}
                <div
                  className="shrink-0 px-4 pt-3.5 pb-3 border-b-2 border-slate-900 bg-slate-50"
                  style={{ borderTop: `4px solid ${col.accent}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-heading font-black tracking-wider uppercase text-slate-900">
                      {col.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-heading font-black bg-white text-slate-900 border-2 border-slate-900 shadow-pop-sm">
                        {cards.length}
                      </span>
                      {hasPager && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-heading font-bold bg-pop-yellow text-slate-900 border border-slate-900 shadow-pop-sm">
                          {safePg}/{totalPages}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] font-mono font-bold text-slate-600">
                    ₹{colVal.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* ── Scrollable Cards ────────────────────────── */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 p-3 space-y-3 overflow-y-auto bg-dot-grid"
                      style={{
                        minHeight: 120,
                        maxHeight: 'calc(100vh - 320px)',
                        background: snapshot.isDraggingOver ? `${col.glow}` : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      {cards.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                          <div className="w-10 h-10 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-sm flex items-center justify-center">
                            <FileText className="w-5 h-5 text-slate-600" strokeWidth={2.5} />
                          </div>
                          <span className="text-xs font-heading font-bold text-slate-500">Empty stage</span>
                        </div>
                      )}

                      {visible.map((q, idx) => {
                        const tier  = tierColor(q.customer_tier);
                        const risk  = riskColor(q.blended_risk_score);
                        const days  = daysAgo(q);
                        const warn  = expWarn(q.expiry_date);
                        const hiVal = groupByValue && Number(q.total||0) > 100000;

                        return (
                          <Draggable key={q.id} draggableId={q.id} index={idx}>
                            {(dp, ds) => (
                              <div
                                ref={dp.innerRef}
                                {...dp.draggableProps}
                                {...dp.dragHandleProps}
                                onClick={(e) => {
                                  if (ds.isDragging) return;
                                  setActiveDealModal(q);
                                }}
                                className="rounded-2xl p-3 space-y-2 transition-all cursor-pointer select-none active:cursor-grabbing bg-white border-2 border-slate-900 shadow-pop-sm hover:shadow-pop hover:-translate-y-0.5 group relative text-slate-900"
                                style={{
                                  background: ds.isDragging ? '#FFFDF5' : '#FFFFFF',
                                  boxShadow: ds.isDragging ? '0 14px 28px -4px rgba(15, 23, 42, 0.15)' : undefined,
                                  transform: ds.isDragging ? 'rotate(2deg) scale(1.02)' : undefined,
                                }}
                                title="Click tile card to open deal window"
                              >
                                {/* Row 1: QT# + Tier Badge */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[11px] font-mono font-bold tracking-tight text-pop-violet">
                                    {q.quotation_number}
                                  </span>
                                  <span
                                    className="px-2 py-0.2 rounded-full text-[9px] font-heading font-black uppercase tracking-wider border-2 border-slate-900 shadow-pop-sm"
                                    style={{ background:tier.bg, color:tier.text }}
                                  >
                                    {q.customer_tier || 'BRONZE'}
                                  </span>
                                </div>

                                {/* Row 2: Customer Name */}
                                <div className="text-xs font-heading font-extrabold text-slate-900 truncate leading-tight group-hover:text-pop-violet transition-colors">
                                  {q.customer?.name || q.customer?.company_name || 'Customer'}
                                </div>

                                {/* Row 3: Deal Value + Rep & Chips */}
                                <div className="flex items-center justify-between gap-1 pt-0.5">
                                  <span className="text-sm font-heading font-black text-slate-900 font-mono tracking-tight">
                                    ₹{Number(q.total||0).toLocaleString('en-IN')}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-heading font-bold border border-slate-900 shadow-pop-sm"
                                      style={{ background:risk.bg, color:risk.text }}
                                      title="Blended Risk Score"
                                    >
                                      <Activity size={10} strokeWidth={2.5} />
                                      {Number(q.blended_risk_score||0).toFixed(1)}
                                    </span>
                                    <span
                                      className="px-1.5 py-0.2 rounded-full text-[9px] font-mono text-slate-600 bg-slate-100 border border-slate-900 shadow-pop-sm"
                                      title="Days Idle"
                                    >
                                      {days}d
                                    </span>
                                    {warn && (
                                      <span
                                        className="px-1.5 py-0.2 rounded-full text-[9px] font-heading font-bold bg-pop-yellow text-slate-900 border border-slate-900 shadow-pop-sm"
                                        title={`Expires in ${warn}`}
                                      >
                                        {warn}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[65px]" title={`Sales Rep: ${q.rep?.name || '—'}`}>
                                      {q.rep?.name ? q.rep.name.split(' ')[0] : '—'}
                                    </span>
                                  </div>
                                </div>

                                {/* Row 4: Compact CTA Options */}
                                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                                  {col.id === 'DRAFT' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDealModal(q);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'DRAFT')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-violet text-white shadow-pop-sm gap-1"
                                      title="Open deal window & configure quote lines"
                                    >
                                      <FileText className="w-3 h-3" strokeWidth={2.5} /> Build Quote
                                    </button>
                                  )}
                                  {col.id === 'PENDING' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDealModal(q);
                                        setApprovalNotes('');
                                        setQuickCardQuote(null);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'APPROVAL')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-yellow text-slate-900 shadow-pop-sm gap-1"
                                      title="Review & Approve in deal window"
                                    >
                                      <ShieldCheck className="w-3 h-3" strokeWidth={2.5} /> Review Approval
                                    </button>
                                  )}
                                  {col.id === 'APPROVED' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDealModal(q);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'SEND')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-mint text-slate-900 shadow-pop-sm gap-1"
                                      title="Open deal window to dispatch email or view portal"
                                    >
                                      <Send className="w-3 h-3" strokeWidth={2.5} /> Send to Customer
                                    </button>
                                  )}
                                  {(col.id==='SENT'||col.id==='NEGOTIATING') && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDealModal(q);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'PORTAL')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-sky text-slate-900 shadow-pop-sm gap-1"
                                      title="Open deal window & view portal details"
                                    >
                                      <ExternalLink className="w-3 h-3" strokeWidth={2.5} /> View Portal
                                    </button>
                                  )}
                                  {col.id === 'CONFIRMED' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDealModal(q);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'INVOICE')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-mint text-slate-900 shadow-pop-sm gap-1"
                                      title="Open deal window to create invoice"
                                    >
                                      <DollarSign className="w-3 h-3" strokeWidth={2.5} /> Create Invoice
                                    </button>
                                  )}
                                  {col.id === 'CANCELLED' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDealModal(q);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'CANCELLED')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-slate-100 text-slate-700 shadow-pop-sm flex items-center justify-center gap-1"
                                      title="Inspect details in deal window"
                                    >
                                      <span>Inspect Details</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* ── Sticky Pagination Bar ────────────────────── */}
                <ColPager
                  colId={col.id}
                  total={cards.length}
                  page={safePg}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPage={setPage}
                />
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* ── Floating Quick Card Preview on Option Hover ─────────────── */}
      {quickCardQuote && (
        <div
          className="fixed z-50 w-72 rounded-3xl p-4 pointer-events-none bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-xl transition-all duration-150 animate-in fade-in zoom-in-95 text-slate-900"
          style={{
            top: quickCardPos.y,
            left: quickCardPos.x,
          }}
        >
          {/* Quick Card Header */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-900">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pop-violet border border-slate-900" />
              <span className="text-xs font-mono font-bold text-pop-violet">
                {quickCardQuote.quotation_number}
              </span>
            </div>
            <span className="text-[10px] font-heading font-black px-2 py-0.5 rounded-full bg-pop-yellow text-slate-900 border border-slate-900 shadow-pop-sm">
              {quickCardQuote.customer_tier || 'BRONZE'}
            </span>
          </div>

          {/* Quick Card Body */}
          <div className="py-2.5 space-y-2">
            <div>
              <div className="text-[10px] font-heading font-bold uppercase text-slate-500">Client</div>
              <div className="text-xs font-heading font-extrabold text-slate-900 truncate">
                {quickCardQuote.customer?.name || quickCardQuote.customer?.company_name || 'Customer'}
              </div>
              {quickCardQuote.customer?.email && (
                <div className="text-[11px] text-slate-600 font-mono truncate">{quickCardQuote.customer.email}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t-2 border-slate-900/10">
              <div>
                <div className="text-[10px] font-heading font-bold uppercase text-slate-500">Deal Value</div>
                <div className="text-sm font-black text-slate-900 font-mono">
                  ₹{Number(quickCardQuote.total || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-heading font-bold uppercase text-slate-500">Risk Score</div>
                <div className="text-sm font-black text-pop-yellow font-mono flex items-center gap-1">
                  <Activity size={12} strokeWidth={2.5} />
                  <span>{Number(quickCardQuote.blended_risk_score || 0).toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Quick Context Guidance */}
            <div className="p-2.5 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-sm text-[11px] text-slate-800 flex items-start gap-2 font-heading font-bold">
              <Sparkles className="w-4 h-4 shrink-0 text-pop-violet mt-0.5" strokeWidth={2.5} />
              <div>
                {quickCardType === 'APPROVAL' && 'Click button or tile to review & approve in deal window.'}
                {quickCardType === 'SEND' && 'Click button to dispatch quotation email, or tile for deal window.'}
                {quickCardType === 'PORTAL' && 'Click button to open portal in new tab, or tile for deal window.'}
                {quickCardType === 'DRAFT' && 'Click button or tile to open deal window & edit line items.'}
                {quickCardType === 'INVOICE' && 'Click button to generate invoice, or tile for deal window.'}
                {quickCardType === 'CANCELLED' && 'Click button or tile to inspect or restore deal in deal window.'}
              </div>
            </div>
          </div>

          {/* Direct to page hint */}
          <div className="pt-2 border-t-2 border-slate-900/10 text-center">
            <span className="text-[10px] text-slate-600 font-heading font-bold flex items-center justify-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} /> Click tile card to open deal window
            </span>
          </div>
        </div>
      )}

      {/* ── In-Place Unified Deal Window Modal for All Pipeline Cards ── */}
      {activeDealModal && (() => {
        const modalQ = dealDetails || activeDealModal;
        const currentStatus = mapStatus(modalQ.status);
        const colDef = KANBAN_COLUMNS.find((c) => c.id === currentStatus) || KANBAN_COLUMNS[0];
        const tier = tierColor(modalQ.customer_tier);
        const risk = riskColor(modalQ.blended_risk_score);
        const marginVal = Number(modalQ.margin ?? modalQ.gross_margin_percent ?? modalQ.margin_percent ?? 0);
        const items = modalQ.items || modalQ.lines || [];

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setActiveDealModal(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-xl text-slate-900 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-900 bg-white"
                style={{ borderTop: `4px solid ${colDef.accent}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-slate-900 font-bold"
                    style={{ background: colDef.glow }}
                  >
                    {currentStatus === 'DRAFT' && <FileText className="w-5 h-5" strokeWidth={2.5} />}
                    {currentStatus === 'PENDING' && <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />}
                    {currentStatus === 'APPROVED' && <Check className="w-5 h-5" strokeWidth={2.5} />}
                    {(currentStatus === 'SENT' || currentStatus === 'NEGOTIATING') && <Send className="w-5 h-5" strokeWidth={2.5} />}
                    {currentStatus === 'CONFIRMED' && <DollarSign className="w-5 h-5" strokeWidth={2.5} />}
                    {currentStatus === 'CANCELLED' && <X className="w-5 h-5" strokeWidth={2.5} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-bold text-pop-violet">
                        {modalQ.quotation_number}
                      </span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-black uppercase tracking-wider border border-slate-900 shadow-pop-xs"
                        style={{ background: colDef.glow, color: colDef.accent }}
                      >
                        {colDef.title}
                      </span>
                      <span
                        className="px-2 py-0.2 rounded-full text-[9px] font-heading font-black uppercase tracking-wider border border-slate-900 shadow-pop-xs"
                        style={{ background: tier.bg, color: tier.text }}
                      >
                        {modalQ.customer_tier || 'BRONZE'}
                      </span>
                    </div>
                    <h3 className="text-base font-heading font-extrabold text-slate-900 truncate mt-0.5 max-w-md">
                      {modalQ.customer?.name || modalQ.customer?.company_name || 'Customer Deal'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`/quotations/${modalQ.id}`, '_blank')}
                    className="btn-candy hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-xs text-xs font-heading font-bold"
                    title="Open full quote editor in separate window"
                  >
                    <span>Full Editor</span>
                    <ExternalLink className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setActiveDealModal(null)}
                    className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white hover:bg-rose-100 text-slate-900 flex items-center justify-center shadow-pop-sm cursor-pointer transition-all"
                    title="Close window (Esc)"
                  >
                    <X className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* 4 KPI Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-xs">
                    <div className="text-[10px] font-heading font-bold uppercase text-slate-500">Deal Value</div>
                    <div className="text-base font-black text-slate-900 font-mono mt-0.5">
                      ₹{Number(modalQ.total || 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-xs">
                    <div className="text-[10px] font-heading font-bold uppercase text-slate-500">Gross Margin</div>
                    <div className={`text-base font-black font-mono mt-0.5 ${
                      marginVal >= 25 ? 'text-emerald-600' : marginVal >= 15 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {marginVal > 0 ? `${marginVal.toFixed(1)}%` : '—'}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-xs">
                    <div className="text-[10px] font-heading font-bold uppercase text-slate-500">Blended Risk</div>
                    <div className="text-base font-black text-pop-yellow font-mono flex items-center gap-1 mt-0.5">
                      <Activity size={14} strokeWidth={2.5} />
                      <span>{Number(modalQ.blended_risk_score || 0).toFixed(1)}</span>
                      <span className="text-[10px] text-slate-400 font-normal">/100</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-xs">
                    <div className="text-[10px] font-heading font-bold uppercase text-slate-500">Sales Rep</div>
                    <div className="text-xs font-heading font-extrabold text-slate-900 truncate mt-1">
                      {modalQ.rep?.name || 'Assigned Rep'}
                    </div>
                  </div>
                </div>

                {/* Client & Metadata Details Card */}
                <div className="p-4 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-sm space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 font-heading font-bold">Client Email: </span>
                      <span className="font-mono text-slate-800">{modalQ.customer?.email || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-heading font-bold">Payment Terms: </span>
                      <span className="font-heading font-bold text-slate-900">{modalQ.payment_terms || 'Standard Net 30'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-heading font-bold">Created: </span>
                      <span className="font-mono text-slate-700">
                        {modalQ.created_at ? new Date(modalQ.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-heading font-bold">Validity Expiry: </span>
                      <span className="font-mono text-slate-700">
                        {modalQ.expiry_date ? new Date(modalQ.expiry_date).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client Portal Link Card (Sent, Negotiating, Approved, Confirmed) */}
                {(currentStatus === 'SENT' || currentStatus === 'NEGOTIATING' || currentStatus === 'APPROVED' || currentStatus === 'CONFIRMED' || modalQ.portal_token) && (
                  <div className="p-3.5 rounded-2xl bg-sky-50 border-2 border-slate-900 shadow-pop-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-heading font-extrabold text-slate-900">
                        <ExternalLink className="w-3.5 h-3.5 text-sky-700" strokeWidth={2.5} />
                        <span>Client Portal Access</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-white border border-slate-900 text-sky-800 font-bold">
                        {currentStatus === 'SENT' ? 'Dispatched' : currentStatus === 'NEGOTIATING' ? 'Under Negotiation' : 'Client Access'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={modalQ.portal_token ? `${window.location.origin}/portal/${modalQ.portal_token}` : 'Portal link generated upon dispatch'}
                        className="flex-1 bg-white border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-700 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!modalQ.portal_token) {
                            toast.error('Portal link not generated yet');
                            return;
                          }
                          const url = `${window.location.origin}/portal/${modalQ.portal_token}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Client Portal link copied!');
                        }}
                        className="btn-candy px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-heading font-bold border-2 border-slate-900 shadow-pop-xs"
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleViewPortal(modalQ, e)}
                        className="btn-candy px-3.5 py-1.5 rounded-xl bg-pop-sky hover:bg-sky-400 text-slate-900 text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Line Items Preview / Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-heading font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-pop-violet" strokeWidth={2.5} />
                      <span>Line Items ({items.length})</span>
                    </h4>
                    {loadingDetails && (
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Loading items...
                      </span>
                    )}
                  </div>

                  {items.length > 0 ? (
                    <div className="rounded-2xl border-2 border-slate-900 overflow-hidden bg-white shadow-pop-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b-2 border-slate-900 font-heading font-bold text-[10px] text-slate-600 uppercase">
                            <th className="p-2.5">Product</th>
                            <th className="p-2.5 text-center">Qty</th>
                            <th className="p-2.5 text-right">Price</th>
                            <th className="p-2.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {items.slice(0, 5).map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-50">
                              <td className="p-2.5">
                                <div className="font-heading font-extrabold text-slate-900 truncate max-w-[200px]">
                                  {item.product?.name || item.product_name || `Item #${idx + 1}`}
                                </div>
                                {(item.product?.sku || item.sku) && (
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {item.product?.sku || item.sku}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                                {item.quantity}
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-700">
                                ₹{Number(item.unit_price || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                ₹{Number(item.total || (item.unit_price * item.quantity) || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {items.length > 5 && (
                        <div className="py-1.5 px-3 bg-slate-50 text-[10px] font-heading font-bold text-slate-500 text-center border-t border-slate-200">
                          +{items.length - 5} more items in full quotation
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white border-2 border-dashed border-slate-300 text-center text-xs text-slate-500 font-heading">
                      {loadingDetails ? 'Fetching line items...' : 'No line items configured yet.'}
                    </div>
                  )}
                </div>

                {/* Stage-Specific Inputs (Decision notes for Pending) */}
                {currentStatus === 'PENDING' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-heading font-bold text-slate-900">
                      Approval Decision Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="e.g. Approved with standard payment terms..."
                      className="w-full bg-white border-2 border-slate-900 rounded-xl px-3.5 py-2 text-xs font-heading text-slate-900 focus:outline-none focus:shadow-pop transition-all placeholder:text-slate-400"
                    />
                  </div>
                )}
              </div>

              {/* Modal Bottom Action Controls Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border-t-2 border-slate-900">
                <button
                  onClick={() => window.open(`/quotations/${modalQ.id}`, '_blank')}
                  className="btn-candy px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-heading font-bold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop-xs"
                >
                  <span>Open Full Builder</span>
                  <ExternalLink className="w-3 h-3" strokeWidth={2.5} />
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  {currentStatus === 'DRAFT' && (
                    <button
                      disabled={submittingDecision}
                      onClick={() => handleQuickSubmit(modalQ)}
                      className="btn-candy px-5 py-2 rounded-full bg-pop-yellow hover:bg-amber-400 text-slate-900 text-xs font-heading font-extrabold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>Submit for Approval</span>
                    </button>
                  )}

                  {currentStatus === 'PENDING' && (
                    <>
                      <button
                        disabled={submittingDecision}
                        onClick={() => handleQuickApprove(modalQ.id, 'REJECTED')}
                        className="btn-candy px-4 py-2 rounded-full bg-rose-400 hover:bg-rose-500 text-white text-xs font-heading font-bold border-2 border-slate-900 shadow-pop-xs"
                      >
                        Reject
                      </button>
                      <button
                        disabled={submittingDecision}
                        onClick={() => handleQuickApprove(modalQ.id, 'APPROVED')}
                        className="btn-candy px-5 py-2 rounded-full bg-pop-mint hover:bg-emerald-400 text-slate-900 text-xs font-heading font-extrabold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <span>{submittingDecision ? 'Submitting...' : 'Approve Deal'}</span>
                      </button>
                    </>
                  )}

                  {currentStatus === 'APPROVED' && (
                    <>
                      <button
                        onClick={(e) => handleViewPortal(modalQ, e)}
                        className="btn-candy px-3.5 py-2 rounded-full bg-pop-sky text-slate-900 text-xs font-heading font-bold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <span>View Portal</span>
                      </button>
                      <button
                        disabled={sendingId === modalQ.id}
                        onClick={(e) => handleSendCustomer(modalQ, e)}
                        className="btn-candy px-5 py-2 rounded-full bg-pop-mint text-slate-900 text-xs font-heading font-extrabold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop"
                      >
                        <Send className={`w-3.5 h-3.5 ${sendingId === modalQ.id ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                        <span>{sendingId === modalQ.id ? 'Sending...' : 'Send to Customer'}</span>
                      </button>
                    </>
                  )}

                  {(currentStatus === 'SENT' || currentStatus === 'NEGOTIATING') && (
                    <button
                      onClick={(e) => handleViewPortal(modalQ, e)}
                      className="btn-candy px-5 py-2 rounded-full bg-pop-sky text-slate-900 text-xs font-heading font-extrabold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop"
                    >
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>Launch Client Portal & Copy Link</span>
                    </button>
                  )}

                  {currentStatus === 'CONFIRMED' && (
                    <>
                      <button
                        onClick={(e) => handleViewPortal(modalQ, e)}
                        className="btn-candy px-3.5 py-2 rounded-full bg-pop-sky text-slate-900 text-xs font-heading font-bold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <span>Client Portal</span>
                      </button>
                      <button
                        onClick={(e) => handleCreateInvoice(modalQ, e)}
                        className="btn-candy px-5 py-2 rounded-full bg-pop-mint text-slate-900 text-xs font-heading font-extrabold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop"
                      >
                        <DollarSign className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <span>Create Invoice</span>
                      </button>
                    </>
                  )}

                  {currentStatus === 'CANCELLED' && (
                    <button
                      disabled={submittingDecision}
                      onClick={() => handleQuickRestoreDraft(modalQ)}
                      className="btn-candy px-5 py-2 rounded-full bg-pop-violet text-white text-xs font-heading font-extrabold flex items-center gap-1.5 border-2 border-slate-900 shadow-pop"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>Restore to Draft</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
