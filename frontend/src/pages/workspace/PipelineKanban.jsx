import React, { useState, useEffect } from 'react';
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
  ArrowRight
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

  // Quick Card Hover & In-Place Action States
  const [quickCardQuote, setQuickCardQuote]         = useState(null);
  const [quickCardPos, setQuickCardPos]             = useState({ x: 0, y: 0 });
  const [quickCardType, setQuickCardType]           = useState('');
  const [quickApprovalQuote, setQuickApprovalQuote] = useState(null);
  const [approvalNotes, setApprovalNotes]           = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [sendingId, setSendingId]                   = useState(null);

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
      await quotationsAPI.decision(quotationId, {
        action,
        reason: approvalNotes?.trim() || `Decision submitted via Pipeline quick-action`
      });

      const nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      setQuotations((prev) =>
        prev.map((q) => (q.id === quotationId ? { ...q, status: nextStatus } : q))
      );

      toast.success(
        action === 'APPROVE'
          ? `Quotation approved and moved to Approved stage!`
          : `Quotation rejected.`
      );

      setQuickApprovalQuote(null);
      setApprovalNotes('');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.detail || 'Failed to submit decision');
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

  // Data is filtered directly in PostgreSQL database
  const colData = {};
  KANBAN_COLUMNS.forEach((c) => { colData[c.id] = []; });
  quotations.forEach((q) => { const id = mapStatus(q.status); if (colData[id]) colData[id].push(q); });

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
                                  navigate(`/quotations/${q.id}`);
                                }}
                                className="rounded-2xl p-3 space-y-2 transition-all cursor-pointer select-none active:cursor-grabbing bg-white border-2 border-slate-900 shadow-pop-sm hover:shadow-pop hover:-translate-y-0.5 group relative text-slate-900"
                                style={{
                                  background: ds.isDragging ? '#FFFDF5' : '#FFFFFF',
                                  boxShadow: ds.isDragging ? '0 14px 28px -4px rgba(15, 23, 42, 0.15)' : undefined,
                                  transform: ds.isDragging ? 'rotate(2deg) scale(1.02)' : undefined,
                                }}
                                title="Click tile card to open full quotation"
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
                                        navigate(`/quotations/${q.id}`);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'DRAFT')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-violet text-white shadow-pop-sm gap-1"
                                      title="Configure quote lines"
                                    >
                                      <FileText className="w-3 h-3" strokeWidth={2.5} /> Build Quote
                                    </button>
                                  )}
                                  {col.id === 'PENDING' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickApprovalQuote(q);
                                        setApprovalNotes('');
                                        setQuickCardQuote(null);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'APPROVAL')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-yellow text-slate-900 shadow-pop-sm gap-1"
                                      title="Review & Approve in-place without leaving pipeline"
                                    >
                                      <ShieldCheck className="w-3 h-3" strokeWidth={2.5} /> Review Approval
                                    </button>
                                  )}
                                  {col.id === 'APPROVED' && (
                                    <button
                                      disabled={sendingId === q.id}
                                      onClick={(e) => handleSendCustomer(q, e)}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'SEND')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-mint text-slate-900 shadow-pop-sm gap-1"
                                      title="Dispatch quotation to client via email in-place"
                                    >
                                      <Send className={`w-3 h-3 ${sendingId === q.id ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                                      {sendingId === q.id ? 'Sending...' : 'Send to Customer'}
                                    </button>
                                  )}
                                  {(col.id==='SENT'||col.id==='NEGOTIATING') && (
                                    <button
                                      onClick={(e) => handleViewPortal(q, e)}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'PORTAL')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-sky text-slate-900 shadow-pop-sm gap-1"
                                      title="Launch client portal in new tab & copy link"
                                    >
                                      <ExternalLink className="w-3 h-3" strokeWidth={2.5} /> View Portal
                                    </button>
                                  )}
                                  {col.id === 'CONFIRMED' && (
                                    <button
                                      onClick={(e) => handleCreateInvoice(q, e)}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'INVOICE')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-pop-mint text-slate-900 shadow-pop-sm gap-1"
                                      title="Generate invoice in-place"
                                    >
                                      <DollarSign className="w-3 h-3" strokeWidth={2.5} /> Create Invoice
                                    </button>
                                  )}
                                  {col.id === 'CANCELLED' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/quotations/${q.id}`);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'CANCELLED')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="btn-candy w-full py-1.5 rounded-full text-[10px] bg-slate-100 text-slate-700 shadow-pop-sm"
                                    >
                                      Inspect Details
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
                {quickCardType === 'APPROVAL' && 'Click button to review & approve in-place without leaving pipeline.'}
                {quickCardType === 'SEND' && 'Click button to dispatch quotation email in-place.'}
                {quickCardType === 'PORTAL' && 'Click button to open portal in new tab & copy link.'}
                {quickCardType === 'DRAFT' && 'Click button or tile to edit line items.'}
                {quickCardType === 'INVOICE' && 'Click button to generate invoice in-place.'}
                {quickCardType === 'CANCELLED' && 'Archived quotation.'}
              </div>
            </div>
          </div>

          {/* Direct to page hint */}
          <div className="pt-2 border-t-2 border-slate-900/10 text-center">
            <span className="text-[10px] text-slate-600 font-heading font-bold flex items-center justify-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} /> Click tile card to open quotation
            </span>
          </div>
        </div>
      )}

      {/* ── In-Place Quick Approval Review Modal ────────────────────── */}
      {quickApprovalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-xl p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 bg-white -mx-6 -mt-6 p-6 rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-sm flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base font-heading font-extrabold text-slate-900 flex items-center gap-2">
                    Quick Approval
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-900 shadow-pop-sm">
                      {quickApprovalQuote.quotation_number}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Decision directly inside pipeline
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickApprovalQuote(null)}
                className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white hover:bg-rose-100 text-slate-900 flex items-center justify-center shadow-pop-sm cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white border-2 border-slate-900 shadow-pop-sm space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 font-heading font-bold">Client:</span>
                <span className="font-heading font-extrabold text-slate-900">
                  {quickApprovalQuote.customer?.name || quickApprovalQuote.customer?.company_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-heading font-bold">Tier:</span>
                <span className="font-mono font-bold text-pop-violet">{quickApprovalQuote.customer_tier || 'BRONZE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-heading font-bold">Deal Value:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  ₹{Number(quickApprovalQuote.total || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-heading font-bold">Blended Risk:</span>
                <span className="font-mono font-bold text-pop-yellow flex items-center gap-1">
                  <Activity size={12} strokeWidth={2.5} />
                  <span>{Number(quickApprovalQuote.blended_risk_score || 0).toFixed(1)} / 100</span>
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold text-slate-900 mb-1.5">
                Decision Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Approved with standard quarterly payment terms..."
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-3.5 py-2 text-xs font-heading text-slate-900 focus:outline-none focus:shadow-pop transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-slate-900/10">
              <button
                disabled={submittingDecision}
                onClick={() => handleQuickApprove(quickApprovalQuote.id, 'REJECT')}
                className="btn-candy bg-rose-400 hover:bg-rose-500 text-white text-xs px-4 py-2 shadow-pop-sm"
              >
                Reject
              </button>
              <button
                disabled={submittingDecision}
                onClick={() => handleQuickApprove(quickApprovalQuote.id, 'APPROVE')}
                className="btn-candy bg-pop-mint hover:bg-[#10B981] text-slate-900 text-xs px-5 py-2 shadow-pop"
              >
                {submittingDecision ? 'Submitting...' : 'Approve Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
