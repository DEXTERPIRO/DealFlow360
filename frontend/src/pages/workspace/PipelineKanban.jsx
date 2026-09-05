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
} from 'lucide-react';
import { io } from 'socket.io-client';
import { quotationsAPI, dashboardAPI, invoicesAPI } from '../../api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 4;

const KANBAN_COLUMNS = [
  { id: 'DRAFT',       title: 'DRAFT',            accent: '#64748b', glow: 'rgba(100,116,139,0.15)'  },
  { id: 'PENDING',     title: 'PENDING APPROVAL',  accent: '#f59e0b', glow: 'rgba(245,158,11,0.12)'   },
  { id: 'APPROVED',    title: 'APPROVED',           accent: '#10b981', glow: 'rgba(16,185,129,0.12)'  },
  { id: 'SENT',        title: 'SENT',              accent: '#3b82f6', glow: 'rgba(59,130,246,0.12)'   },
  { id: 'NEGOTIATING', title: 'NEGOTIATING',        accent: '#a855f7', glow: 'rgba(168,85,247,0.12)'  },
  { id: 'CONFIRMED',   title: 'CONFIRMED',          accent: '#14b8a6', glow: 'rgba(20,184,166,0.12)'  },
  { id: 'CANCELLED',   title: 'CANCELLED',          accent: '#ef4444', glow: 'rgba(239,68,68,0.10)'   },
];

// ── Sleek Column Pagination Bar ───────────────────────────────────────────────
function ColPager({ colId, total, page, totalPages, pageSize, onPage }) {
  if (total === 0) return null;

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);

  return (
    <div
      className="shrink-0 flex items-center justify-between px-3 py-2.5"
      style={{ background: 'rgba(2,6,23,0.92)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Left: record range */}
      <span className="text-[10px] font-mono text-slate-400 select-none">
        {from}–{to} <span className="text-slate-600">of</span> {total}
      </span>

      {/* Centre: page pills */}
      <div className="flex items-center gap-1">
        {totalPages > 1 ? (
          Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPage(colId, p)}
              className="transition-all duration-150 text-[10px] font-mono font-bold"
              style={{
                minWidth: p === page ? 22 : 18,
                height: 20,
                borderRadius: 6,
                background: p === page ? '#2563eb' : 'rgba(51,65,85,0.4)',
                color: p === page ? '#ffffff' : '#94a3b8',
                border: p === page ? '1px solid rgba(147,197,253,0.5)' : '1px solid rgba(71,85,105,0.2)',
                cursor: 'pointer',
                padding: '0 4px',
              }}
              title={`Page ${p}`}
            >
              {p}
            </button>
          ))
        ) : (
          <span className="text-[9px] font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
            Pg 1/1
          </span>
        )}
      </div>

      {/* Right: prev / next */}
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(colId, page - 1)}
          className="w-5 h-5 rounded-md flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(59,130,246,0.15)',
            color: '#93c5fd',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
          title="Previous Page"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(colId, page + 1)}
          className="w-5 h-5 rounded-md flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(59,130,246,0.15)',
            color: '#93c5fd',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
          title="Next Page"
        >
          <ChevronRight className="w-3 h-3" />
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
          : `Quotation rejected.`,
        { icon: action === 'APPROVE' ? '🎉' : '⚠️' }
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
      toast.success(`${q.quotation_number} dispatched to client via email!`, { icon: '📧' });
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
    toast.success('Client Portal opened in new tab & link copied!', { icon: '🔗' });
  };

  // Quick In-Place Create Invoice
  const handleCreateInvoice = async (q, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await invoicesAPI.create({ quotationId: q.id });
      toast.success(`Invoice created for ${q.quotation_number}!`, { icon: '📄' });
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

      const [quotesRes, dashRes] = await Promise.all([
        quotationsAPI.getAll(params),
        dashboardAPI.getMetrics(),
      ]);
      if (Array.isArray(quotesRes)) setQuotations(quotesRes);
      if (dashRes?.reps) setReps(dashRes.reps);
    } catch {
      toast.error('Failed to load quotations pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(searchTerm, selectedRep, dateRange);
    }, 250);
    return () => clearTimeout(timer);
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
    if (v==='GOLD')   return { bg:'rgba(245,158,11,0.15)', text:'#fcd34d', border:'rgba(245,158,11,0.3)' };
    if (v==='SILVER') return { bg:'rgba(148,163,184,0.15)', text:'#cbd5e1', border:'rgba(148,163,184,0.3)' };
    return { bg:'rgba(180,83,9,0.15)', text:'#fb923c', border:'rgba(180,83,9,0.3)' };
  };

  const riskColor = (s) => {
    const n = Number(s||0);
    if (n<=5)  return { bg:'rgba(16,185,129,0.12)', text:'#6ee7b7', border:'rgba(16,185,129,0.25)' };
    if (n<=10) return { bg:'rgba(245,158,11,0.12)', text:'#fcd34d', border:'rgba(245,158,11,0.25)' };
    return { bg:'rgba(239,68,68,0.12)', text:'#fca5a5', border:'rgba(239,68,68,0.25)' };
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
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl"
        style={{ background:'rgba(15,23,42,0.9)', border:'1px solid rgba(255,255,255,0.07)' }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-black text-white tracking-tight">Deals Pipeline</h1>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold"
              style={{ background:'rgba(59,130,246,0.15)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.3)' }}
            >
              {quotations.length} deals
            </span>
            {(searchTerm || selectedRep || dateRange !== 'ALL') && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <Database className="w-2.5 h-2.5" />
                <span>DB Filtered</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 ml-7">
            Drag cards between stages · {pageSize} per column page
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Per Page Density Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl" style={{ background:'rgba(2,6,23,0.8)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">Per Page:</span>
            {[2, 3, 4, 8].map((sz) => {
              const active = pageSize === sz;
              return (
                <button
                  key={sz}
                  onClick={() => {
                    setPageSize(sz);
                    setColPages({});
                  }}
                  className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all"
                  style={{
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : '#64748b',
                  }}
                  title={`Show ${sz} deals per column page`}
                >
                  {sz}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search QT# or customer…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none w-44"
              style={{ background:'rgba(2,6,23,0.8)', border:'1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          <select
            value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl text-slate-300 focus:outline-none"
            style={{ background:'rgba(2,6,23,0.8)', border:'1px solid rgba(255,255,255,0.08)' }}
          >
            <option value="">All Reps</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div className="flex items-center rounded-xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
            {[{ id:'ALL',label:'All' },{ id:'7D',label:'7d' },{ id:'30D',label:'30d' }].map((d) => (
              <button
                key={d.id} onClick={() => setDateRange(d.id)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: dateRange===d.id ? '#2563eb' : 'rgba(2,6,23,0.8)',
                  color: dateRange===d.id ? '#fff' : '#64748b',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setGroupByValue(!groupByValue)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: groupByValue ? 'rgba(59,130,246,0.15)' : 'rgba(2,6,23,0.8)',
              color: groupByValue ? '#93c5fd' : '#64748b',
              border: `1px solid ${groupByValue ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <Maximize2 className="w-3 h-3" /> Size by Value
          </button>
        </div>
      </div>

      {/* ── BOARD ────────────────────────────────────────────────────── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight:'calc(100vh - 230px)' }}>
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
                className="shrink-0 flex flex-col rounded-2xl overflow-hidden"
                style={{
                  width: 296,
                  height: 'calc(100vh - 250px)',
                  background: 'rgba(15,23,42,0.85)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: `0 0 0 0 ${col.glow}`,
                }}
              >
                {/* ── Column Header ──────────────────────────── */}
                <div
                  className="shrink-0 px-3.5 pt-3.5 pb-3"
                  style={{ borderTop: `3px solid ${col.accent}`, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black tracking-widest uppercase font-mono" style={{ color: col.accent }}>
                      {col.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
                        style={{ background:'rgba(30,41,59,0.8)', color:'#94a3b8', border:'1px solid rgba(71,85,105,0.4)' }}
                      >
                        {cards.length}
                      </span>
                      {hasPager && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                          style={{ background:`${col.accent}22`, color: col.accent, border:`1px solid ${col.accent}44` }}
                        >
                          {safePg}/{totalPages}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] font-mono font-semibold text-slate-500">
                    ₹{colVal.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* ── Scrollable Cards ────────────────────────── */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 p-2.5 space-y-2.5 overflow-y-auto"
                      style={{
                        minHeight: 120,
                        maxHeight: 'calc(100vh - 320px)',
                        background: snapshot.isDraggingOver ? `${col.glow}` : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      {cards.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-700">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'rgba(30,41,59,0.5)' }}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-xs">Empty stage</span>
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
                                className="rounded-xl p-2.5 space-y-1.5 transition-all cursor-pointer select-none active:cursor-grabbing hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 group relative"
                                style={{
                                  background: ds.isDragging
                                    ? 'rgba(30,41,59,0.98)'
                                    : hiVal
                                    ? 'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(15,23,42,0.92))'
                                    : 'rgba(30,41,59,0.65)',
                                  border: `1px solid ${ds.isDragging ? col.accent+'66' : hiVal ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                  boxShadow: ds.isDragging ? `0 12px 24px rgba(0,0,0,0.6), 0 0 0 1.5px ${col.accent}55` : 'none',
                                  transform: ds.isDragging ? 'rotate(1deg) scale(1.01)' : 'none',
                                }}
                                title="Click tile card to open full quotation"
                              >
                                {/* Row 1: QT# + Tier Badge */}
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[10px] font-mono font-bold tracking-tight" style={{ color: col.accent }}>
                                    {q.quotation_number}
                                  </span>
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase font-mono tracking-wider"
                                    style={{ background:tier.bg, color:tier.text, border:`1px solid ${tier.border}` }}
                                  >
                                    {q.customer_tier || 'BRONZE'}
                                  </span>
                                </div>

                                {/* Row 2: Customer Name */}
                                <div className="text-[12px] font-bold text-white truncate leading-tight group-hover:text-blue-200 transition-colors">
                                  {q.customer?.name || q.customer?.company_name || 'Customer'}
                                </div>

                                {/* Row 3: Deal Value + Rep & Chips */}
                                <div className="flex items-center justify-between gap-1 pt-0.5">
                                  <span className="text-[13px] font-black text-white font-mono tracking-tight">
                                    ₹{Number(q.total||0).toLocaleString('en-IN')}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <span
                                      className="px-1 py-0.5 rounded text-[9px] font-mono font-bold"
                                      style={{ background:risk.bg, color:risk.text, border:`1px solid ${risk.border}` }}
                                      title="Blended Risk Score"
                                    >
                                      ⚡{Number(q.blended_risk_score||0).toFixed(1)}
                                    </span>
                                    <span
                                      className="px-1 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/40"
                                      title="Days Idle"
                                    >
                                      {days}d
                                    </span>
                                    {warn && (
                                      <span
                                        className="px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                        title={`Expires in ${warn}`}
                                      >
                                        {warn}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 truncate max-w-[65px]" title={`Sales Rep: ${q.rep?.name || '—'}`}>
                                      {q.rep?.name ? q.rep.name.split(' ')[0] : '—'}
                                    </span>
                                  </div>
                                </div>

                                {/* Row 4: Compact CTA Options */}
                                <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                  {col.id === 'DRAFT' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/quotations/${q.id}`);
                                      }}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'DRAFT')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="w-full py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:brightness-110 shadow-sm"
                                      style={{ background:'#2563eb', color:'#fff' }}
                                      title="Configure quote lines"
                                    >
                                      <FileText className="w-3 h-3" /> Build Quote
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
                                      className="w-full py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:brightness-110 shadow-sm"
                                      style={{ background:'#d97706', color:'#fff' }}
                                      title="Review & Approve in-place without leaving pipeline"
                                    >
                                      <ShieldCheck className="w-3 h-3" /> Review Approval
                                    </button>
                                  )}
                                  {col.id === 'APPROVED' && (
                                    <button
                                      disabled={sendingId === q.id}
                                      onClick={(e) => handleSendCustomer(q, e)}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'SEND')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="w-full py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:brightness-110 shadow-sm disabled:opacity-50"
                                      style={{ background:'#059669', color:'#fff' }}
                                      title="Dispatch quotation to client via email in-place"
                                    >
                                      <Send className={`w-3 h-3 ${sendingId === q.id ? 'animate-pulse' : ''}`} />
                                      {sendingId === q.id ? 'Sending...' : 'Send to Customer'}
                                    </button>
                                  )}
                                  {(col.id==='SENT'||col.id==='NEGOTIATING') && (
                                    <button
                                      onClick={(e) => handleViewPortal(q, e)}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'PORTAL')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="w-full py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:brightness-110 shadow-sm"
                                      style={{ background:'rgba(59,130,246,0.18)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.35)' }}
                                      title="Launch client portal in new tab & copy link"
                                    >
                                      <ExternalLink className="w-3 h-3" /> View Portal
                                    </button>
                                  )}
                                  {col.id === 'CONFIRMED' && (
                                    <button
                                      onClick={(e) => handleCreateInvoice(q, e)}
                                      onMouseEnter={(e) => handleButtonHover(q, e, 'INVOICE')}
                                      onMouseLeave={() => setQuickCardQuote(null)}
                                      className="w-full py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all hover:brightness-110 shadow-sm"
                                      style={{ background:'#0d9488', color:'#fff' }}
                                      title="Generate invoice in-place"
                                    >
                                      <DollarSign className="w-3 h-3" /> Create Invoice
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
                                      className="w-full py-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                                      style={{ background:'rgba(30,41,59,0.8)', color:'#94a3b8', border:'1px solid rgba(71,85,105,0.3)' }}
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
          className="fixed z-50 w-72 rounded-2xl p-3.5 pointer-events-none backdrop-blur-xl border border-slate-700/80 shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            top: quickCardPos.y,
            left: quickCardPos.x,
            background: 'rgba(15, 23, 42, 0.96)',
            boxShadow: '0 20px 45px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12)',
          }}
        >
          {/* Quick Card Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[11px] font-mono font-bold text-blue-400">
                {quickCardQuote.quotation_number}
              </span>
            </div>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {quickCardQuote.customer_tier || 'BRONZE'}
            </span>
          </div>

          {/* Quick Card Body */}
          <div className="py-2.5 space-y-2">
            <div>
              <div className="text-[9px] font-mono uppercase text-slate-500 font-semibold">Client</div>
              <div className="text-xs font-bold text-white truncate">
                {quickCardQuote.customer?.name || quickCardQuote.customer?.company_name || 'Customer'}
              </div>
              {quickCardQuote.customer?.email && (
                <div className="text-[10px] text-slate-400 truncate">{quickCardQuote.customer.email}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
              <div>
                <div className="text-[9px] font-mono uppercase text-slate-500">Deal Value</div>
                <div className="text-sm font-black text-white font-mono">
                  ₹{Number(quickCardQuote.total || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-mono uppercase text-slate-500">Risk Score</div>
                <div className="text-sm font-black text-amber-400 font-mono">
                  ⚡ {Number(quickCardQuote.blended_risk_score || 0).toFixed(1)}
                </div>
              </div>
            </div>

            {/* Quick Context Guidance */}
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-400 mt-0.5" />
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
          <div className="pt-2 border-t border-slate-800/80 text-center">
            <span className="text-[9.5px] text-slate-400 font-mono flex items-center justify-center gap-1">
              <span>👉 Click tile card to open quotation</span>
            </span>
          </div>
        </div>
      )}

      {/* ── In-Place Quick Approval Review Modal ────────────────────── */}
      {quickApprovalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Quick Approval
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {quickApprovalQuote.quotation_number}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Decision directly inside pipeline
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickApprovalQuote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Client:</span>
                <span className="font-bold text-white">
                  {quickApprovalQuote.customer?.name || quickApprovalQuote.customer?.company_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tier:</span>
                <span className="font-mono font-bold text-blue-400">{quickApprovalQuote.customer_tier || 'BRONZE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Deal Value:</span>
                <span className="font-mono font-black text-white text-sm">
                  ₹{Number(quickApprovalQuote.total || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Blended Risk Score:</span>
                <span className="font-mono font-bold text-amber-400">
                  ⚡ {Number(quickApprovalQuote.blended_risk_score || 0).toFixed(1)} / 100
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Decision Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Approved with standard quarterly payment terms..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                disabled={submittingDecision}
                onClick={() => handleQuickApprove(quickApprovalQuote.id, 'REJECT')}
                className="flex-1 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold text-xs transition-all disabled:opacity-50"
              >
                Reject Deal
              </button>
              <button
                disabled={submittingDecision}
                onClick={() => handleQuickApprove(quickApprovalQuote.id, 'APPROVE')}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {submittingDecision ? 'Approving...' : 'Approve Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
