import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import {
  Search,
  Filter,
  User,
  Calendar,
  Layers,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  DollarSign,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Send,
  Plus
} from 'lucide-react';
import { io } from 'socket.io-client';
import { quotationsAPI, dashboardAPI } from '../../api';
import toast from 'react-hot-toast';

// Columns definition matching specification
const KANBAN_COLUMNS = [
  { id: 'DRAFT', title: 'DRAFT', color: 'border-slate-500', headerBg: 'bg-slate-800/40' },
  { id: 'PENDING', title: 'PENDING APPROVAL', color: 'border-amber-500', headerBg: 'bg-amber-500/10' },
  { id: 'APPROVED', title: 'APPROVED', color: 'border-emerald-500', headerBg: 'bg-emerald-500/10' },
  { id: 'SENT', title: 'SENT', color: 'border-blue-500', headerBg: 'bg-blue-500/10' },
  { id: 'NEGOTIATING', title: 'NEGOTIATING', color: 'border-purple-500', headerBg: 'bg-purple-500/10' },
  { id: 'CONFIRMED', title: 'CONFIRMED', color: 'border-teal-500', headerBg: 'bg-teal-500/10' },
  { id: 'CANCELLED', title: 'CANCELLED', color: 'border-rose-500', headerBg: 'bg-rose-500/10' },
];

export default function PipelineKanban() {
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState('');
  const [dateRange, setDateRange] = useState('ALL');
  const [groupByValue, setGroupByValue] = useState(false);

  // Reps list for dropdown
  const [reps, setReps] = useState([]);

  // Fetch quotations and reps
  const loadData = async () => {
    try {
      setLoading(true);
      const [quotesRes, dashRes] = await Promise.all([
        quotationsAPI.getAll(),
        dashboardAPI.getMetrics()
      ]);
      if (Array.isArray(quotesRes)) {
        setQuotations(quotesRes);
      }
      if (dashRes?.reps) {
        setReps(dashRes.reps);
      }
    } catch (err) {
      console.error('Failed to load kanban data', err);
      toast.error('Failed to load quotations pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time socket events
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_dashboard');
    });

    socket.on('quotation-created', () => {
      loadData();
    });

    socket.on('approval-decision', () => {
      loadData();
    });

    socket.on('quotation-updated', () => {
      loadData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Map database status to Kanban column ID
  const mapStatusToColumn = (status) => {
    if (!status) return 'DRAFT';
    const s = status.toUpperCase();
    if (s === 'PENDING_MANAGER' || s === 'PENDING_FINANCE' || s === 'PENDING') return 'PENDING';
    if (s === 'APPROVED') return 'APPROVED';
    if (s === 'SENT_TO_CUSTOMER' || s === 'SENT') return 'SENT';
    if (s === 'UNDER_NEGOTIATION' || s === 'NEGOTIATING') return 'NEGOTIATING';
    if (s === 'CONFIRMED') return 'CONFIRMED';
    if (s === 'CANCELLED' || s === 'REJECTED') return 'CANCELLED';
    return 'DRAFT';
  };

  // Map Kanban column ID to database status
  const mapColumnToDbStatus = (colId) => {
    switch (colId) {
      case 'PENDING':
        return 'PENDING_MANAGER';
      case 'APPROVED':
        return 'APPROVED';
      case 'SENT':
        return 'SENT_TO_CUSTOMER';
      case 'NEGOTIATING':
        return 'UNDER_NEGOTIATION';
      case 'CONFIRMED':
        return 'CONFIRMED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'DRAFT';
    }
  };

  // Filter quotations
  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      !searchTerm ||
      q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRep = !selectedRep || q.rep_id === selectedRep;

    // Date range filter
    let matchesDate = true;
    if (dateRange !== 'ALL' && q.created_at) {
      const qDate = new Date(q.created_at);
      const now = new Date();
      if (dateRange === '7D') {
        matchesDate = (now - qDate) <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateRange === '30D') {
        matchesDate = (now - qDate) <= 30 * 24 * 60 * 60 * 1000;
      }
    }

    return matchesSearch && matchesRep && matchesDate;
  });

  // Organize by column
  const columnData = {};
  KANBAN_COLUMNS.forEach((col) => {
    columnData[col.id] = [];
  });

  filteredQuotations.forEach((q) => {
    const colId = mapStatusToColumn(q.status);
    if (columnData[colId]) {
      columnData[colId].push(q);
    }
  });

  // Drag and Drop Handler
  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    const targetQuote = quotations.find((q) => q.id === draggableId);
    if (!targetQuote) return;

    // Validation rule: cannot move REJECTED to CONFIRMED
    if (targetQuote.status === 'REJECTED' && destCol === 'CONFIRMED') {
      toast.error('Cannot directly move a REJECTED deal to CONFIRMED');
      return;
    }

    // Confirmation if moving to CANCELLED
    if (destCol === 'CANCELLED') {
      const confirmed = window.confirm(`Are you sure you want to mark ${targetQuote.quotation_number} as CANCELLED?`);
      if (!confirmed) return;
    }

    // Optimistic UI update
    const nextDbStatus = mapColumnToDbStatus(destCol);
    const updatedList = quotations.map((q) =>
      q.id === draggableId ? { ...q, status: nextDbStatus, last_activity_at: new Date().toISOString() } : q
    );
    setQuotations(updatedList);

    try {
      await quotationsAPI.updateStatus(draggableId, { status: nextDbStatus });
      toast.success(`Updated ${targetQuote.quotation_number} to ${destCol.replace('_', ' ')}`);
    } catch (err) {
      console.error('Failed to update quotation status:', err);
      toast.error(err.detail || err.error || 'Failed to update deal status');
      // Revert
      loadData();
    }
  };

  // Tier Badge Color
  const getTierBadge = (tier) => {
    const t = String(tier || 'BRONZE').toUpperCase();
    if (t === 'GOLD') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (t === 'SILVER') return 'bg-slate-300/15 text-slate-200 border-slate-400/30';
    return 'bg-amber-700/15 text-amber-500 border-amber-700/30';
  };

  // Risk Score Color Chip
  const getRiskChip = (score) => {
    const s = Number(score || 0);
    if (s <= 5) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (s <= 10) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  };

  // Calculate days since last activity
  const getDaysSinceActivity = (q) => {
    const dt = q.last_activity_at || q.updated_at || q.created_at;
    if (!dt) return 0;
    const diffTime = Math.abs(new Date() - new Date(dt));
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate expiry warning
  const getExpiryWarning = (expiryDate) => {
    if (!expiryDate) return null;
    const diffDays = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 7) {
      return `${diffDays}d to expire`;
    }
    return null;
  };

  return (
    <div className="space-y-5 antialiased pb-10">
      {/* ── HEADER & TOOLBAR ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Deals Pipeline Kanban
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {filteredQuotations.length} Active Deals
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Drag and drop quotation cards to advance deal lifecycle and govern approvals
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter customer or QT#..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors w-44 sm:w-56"
            />
          </div>

          {/* Rep filter */}
          <select
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Reps</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Date range filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: '7D', label: '7 Days' },
              { id: '30D', label: '30 Days' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateRange(d.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  dateRange === d.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Group by Value Toggle */}
          <button
            onClick={() => setGroupByValue(!groupByValue)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              groupByValue
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Size by Value</span>
          </button>
        </div>
      </div>

      {/* ── KANBAN BOARD DRAG & DROP CONTEXT ───────────────────────── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-800 min-h-[calc(100vh-260px)]">
          {KANBAN_COLUMNS.map((col) => {
            const cards = columnData[col.id] || [];
            const colTotalValue = cards.reduce((acc, c) => acc + Number(c.total || 0), 0);

            return (
              <div
                key={col.id}
                className="w-80 shrink-0 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Column Header */}
                <div className={`p-3.5 border-t-4 ${col.color} border-b border-slate-800 ${col.headerBg}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white tracking-wider font-mono uppercase">
                      {col.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {cards.length}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1 font-semibold">
                    ₹{colTotalValue.toLocaleString()}
                  </div>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2.5 space-y-2.5 overflow-y-auto min-h-[400px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      {cards.map((q, index) => {
                        const daysInactive = getDaysSinceActivity(q);
                        const expWarning = getExpiryWarning(q.expiry_date);
                        const isHighValue = groupByValue && Number(q.total || 0) > 100000;

                        return (
                          <Draggable key={q.id} draggableId={q.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`bg-slate-850 hover:bg-slate-800/90 border border-slate-750 hover:border-slate-600 rounded-2xl p-4 shadow-md transition-all space-y-3 cursor-grab active:cursor-grabbing ${
                                  dragSnapshot.isDragging ? 'rotate-1 shadow-2xl ring-2 ring-blue-500/50' : ''
                                } ${isHighValue ? 'border-blue-500/40 bg-gradient-to-b from-blue-950/20 to-slate-850' : ''}`}
                              >
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="font-mono text-xs font-bold text-blue-400 tracking-wider">
                                      {q.quotation_number}
                                    </span>
                                    <h4 className="text-xs font-bold text-white leading-tight mt-0.5">
                                      {q.customer?.name || q.customer?.company_name || 'Prospect Customer'}
                                    </h4>
                                    {q.customer?.company_name && (
                                      <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                        {q.customer.company_name}
                                      </p>
                                    )}
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono border ${getTierBadge(
                                      q.customer_tier
                                    )}`}
                                  >
                                    {q.customer_tier || 'BRONZE'}
                                  </span>
                                </div>

                                {/* Deal Value & Rep */}
                                <div className="flex items-baseline justify-between border-t border-slate-750/80 pt-2.5">
                                  <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                      Deal Value
                                    </div>
                                    <div className="text-base font-black text-white font-mono">
                                      ₹{Number(q.total || 0).toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                      Rep
                                    </div>
                                    <div className="text-[11px] font-medium text-slate-300 truncate max-w-[100px]">
                                      {q.rep?.name || 'Sales Rep'}
                                    </div>
                                  </div>
                                </div>

                                {/* Metadata Chips: Risk & Activity */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getRiskChip(
                                      q.blended_risk_score
                                    )}`}
                                  >
                                    Risk: {Number(q.blended_risk_score || 0).toFixed(1)}
                                  </span>

                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                                    {daysInactive}d active
                                  </span>

                                  {expWarning && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      {expWarning}
                                    </span>
                                  )}
                                </div>

                                {/* Action Buttons per column */}
                                <div className="pt-2 border-t border-slate-750/80">
                                  {col.id === 'DRAFT' && (
                                    <button
                                      onClick={() => navigate(`/quotations/${q.id}`)}
                                      className="w-full py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      Build Quote
                                    </button>
                                  )}

                                  {col.id === 'PENDING' && (
                                    <button
                                      onClick={() => navigate('/approvals')}
                                      className="w-full py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      Review
                                    </button>
                                  )}

                                  {col.id === 'APPROVED' && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await quotationsAPI.send(q.id);
                                          toast.success(`Quotation ${q.quotation_number} sent to customer!`);
                                          loadData();
                                        } catch (err) {
                                          toast.error(err.detail || 'Failed to send quotation');
                                        }
                                      }}
                                      className="w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      Send to Customer
                                    </button>
                                  )}

                                  {(col.id === 'SENT' || col.id === 'NEGOTIATING') && (
                                    <a
                                      href={`/portal/${q.portal_token}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-full py-1.5 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      View Portal
                                    </a>
                                  )}

                                  {col.id === 'CONFIRMED' && (
                                    <button
                                      onClick={() => navigate('/invoices')}
                                      className="w-full py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                      <DollarSign className="w-3.5 h-3.5" />
                                      Create Invoice
                                    </button>
                                  )}

                                  {col.id === 'CANCELLED' && (
                                    <button
                                      onClick={() => navigate(`/quotations/${q.id}`)}
                                      className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
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
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
