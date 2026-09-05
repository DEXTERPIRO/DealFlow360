import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { io } from 'socket.io-client';
import { dashboardAPI, quotationsAPI } from '../../api';
import toast from 'react-hot-toast';

export default function ApprovalQueue() {
  const [queue, setQueue] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter: 'ALL' | 'PENDING_MANAGER' | 'PENDING_FINANCE'
  const [filter, setFilter] = useState('ALL');

  // Decision state per card: { [quotationId]: { action: '', reason: '' } }
  const [decisions, setDecisions] = useState({});

  // Bulk selection: array of quotation ids
  const [selectedIds, setSelectedIds] = useState([]);

  // Collapsible audit trail
  const [showAuditTrail, setShowAuditTrail] = useState(true);

  // Live timer tick
  const [, setTimeTick] = useState(Date.now());

  const loadApprovalData = async () => {
    try {
      setLoading(true);
      const res = await dashboardAPI.getApprovalQueue();
      if (res) {
        setQueue(res.queue || []);
        setAuditTrail(res.auditTrail || []);
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

  // Filtered queue items
  const filteredQueue = queue.filter((item) => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

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
    if (t === 'GOLD') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (t === 'SILVER') return 'bg-slate-300/15 text-slate-200 border-slate-400/30';
    return 'bg-amber-700/15 text-amber-500 border-amber-700/30';
  };

  // Blended Risk Score Gauge Color
  const getRiskColor = (score) => {
    const s = Number(score || 0);
    if (s <= 5) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (s <= 10) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  // Handle single decision
  const handleDecisionSubmit = async (quotationId, quotationNumber) => {
    const state = decisions[quotationId] || {};
    if (!state.action) {
      toast.error('Please select Approve, Reject, or Return');
      return;
    }

    if ((state.action === 'REJECTED' || state.action === 'RETURNED') && !state.reason?.trim()) {
      toast.error('Reason is required when rejecting or returning for revision');
      return;
    }

    try {
      await quotationsAPI.decision(quotationId, {
        action: state.action,
        reason: state.reason?.trim()
      });

      // Animate out from state
      setQueue((prev) => prev.filter((q) => q.id !== quotationId));
      setSelectedIds((prev) => prev.filter((id) => id !== quotationId));

      toast.success(`${quotationNumber} ${state.action.toLowerCase()} successfully!`);

      // Refresh data
      loadApprovalData();
    } catch (err) {
      console.error('Decision failed:', err);
      toast.error(err.detail || err.error || 'Failed to submit decision');
    }
  };

  // Handle Bulk Approval
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const confirmMsg = `Approve ${selectedIds.length} quotation${selectedIds.length > 1 ? 's' : ''}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await quotationsAPI.batchDecision({
        quotationIds: selectedIds,
        action: 'APPROVED',
        reason: 'Bulk approved by executive manager'
      });

      toast.success(`Successfully approved ${selectedIds.length} quotations!`);
      setSelectedIds([]);
      loadApprovalData();
    } catch (err) {
      toast.error(err.detail || err.error || 'Bulk approval failed');
    }
  };

  // Toggle selection for bulk actions
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredQueue.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQueue.map((q) => q.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 antialiased pb-12">
      {/* ── HEADER & BULK ACTION TOOLBAR ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Approval Queue
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {queue.length} Pending
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-tiered discount governance and executive review chain
            </p>
          </div>
        </div>

        {/* Filters & Bulk Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter tabs */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING_MANAGER', label: 'Pending Manager' },
              { id: 'PENDING_FINANCE', label: 'Pending Finance' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bulk Approve Button */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/25 animate-pulse"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Selected ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SELECT ALL TOGGLE ────────────────────────────────────────── */}
      {filteredQueue.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-400">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            {selectedIds.length === filteredQueue.length ? (
              <CheckSquare className="w-4 h-4 text-blue-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-600" />
            )}
            <span>
              {selectedIds.length === filteredQueue.length ? 'Deselect All' : 'Select All for Bulk Approval'}
            </span>
          </button>
          <span className="font-mono text-slate-500">
            Showing {filteredQueue.length} deal{filteredQueue.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── APPROVAL CARDS LIST ──────────────────────────────────────── */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Loading approval queue...
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Approval Queue is Clear!</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No quotations currently require sales manager or finance review. All deals are moving through the pipeline.
            </p>
          </div>
        ) : (
          filteredQueue.map((item) => {
            const currentDecision = decisions[item.id] || { action: '', reason: '' };
            const tierMax = item.customer_tier === 'GOLD' ? 15 : item.customer_tier === 'SILVER' ? 10 : 5;

            // Approval chain step calculations
            const isPendingFinance = item.status === 'PENDING_FINANCE';
            const managerApproved = item.approvals?.some(
              (a) => a.level === 1 && a.action === 'APPROVED'
            );

            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-2xl p-5 shadow-lg transition-all space-y-5 ${
                  selectedIds.includes(item.id)
                    ? 'border-blue-500/60 ring-1 ring-blue-500/30'
                    : 'border-slate-800'
                }`}
              >
                {/* ── TOP ROW: QT Number, Customer, Time, Risk Meter, Tier ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleSelectOne(item.id)}
                      className="mt-1 text-slate-500 hover:text-white transition-colors"
                    >
                      {selectedIds.includes(item.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-blue-400">
                          {item.quotation_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getTierBadge(
                            item.customer_tier
                          )}`}
                        >
                          {item.customer_tier || 'BRONZE'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">
                        {item.customer?.name || item.customer?.company_name || 'Prospect Customer'}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Sales Rep: <span className="text-slate-300 font-medium">{item.rep?.name || 'Rep'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right side: Waiting time & Blended Risk visual meter */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    {/* Time waiting badge */}
                    <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{getWaitingTime(item.created_at)}</span>
                    </div>

                    {/* Blended Risk visual meter */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold font-mono">
                          Blended Risk
                        </div>
                        <div className="text-xs font-mono font-bold text-white">
                          {Number(item.blended_risk_score || 0).toFixed(1)} / 10.0
                        </div>
                      </div>

                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-sm border ${getRiskColor(
                          item.blended_risk_score
                        )}`}
                      >
                        {Number(item.blended_risk_score || 0).toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── MIDDLE SECTION: LINES TABLE & APPROVAL PANEL ─────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LINES TABLE (8 cols) */}
                  <div className="lg:col-span-8 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Quotation Product Lines & Discount Verification</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase font-bold text-slate-400 font-mono">
                            <th className="p-3">Product</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Unit Price</th>
                            <th className="p-3 text-center">Discount</th>
                            <th className="p-3 text-center">Max Allowed</th>
                            <th className="p-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {item.lines?.map((line, lIdx) => {
                            const discount = Number(line.discount || 0);
                            const catMax = line.product?.category?.max_discount || tierMax;
                            const effectiveMax = Math.min(tierMax, catMax);
                            const overage = Math.max(0, discount - effectiveMax);
                            const isOver = overage > 0;

                            return (
                              <tr
                                key={line.id || lIdx}
                                className={isOver ? 'bg-rose-500/5' : 'hover:bg-slate-900/30'}
                              >
                                <td className="p-3">
                                  <div className="font-semibold text-white">
                                    {line.product?.name || 'Product Item'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Cat: {line.product?.category?.name || 'General'}
                                  </div>
                                </td>
                                <td className="p-3 text-center font-mono text-slate-300">
                                  {line.quantity}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-300">
                                  ₹{Number(line.unit_price || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-center font-mono font-bold">
                                  <span className={isOver ? 'text-rose-400' : 'text-slate-300'}>
                                    {discount}%
                                  </span>
                                </td>
                                <td className="p-3 text-center font-mono text-slate-400">
                                  {effectiveMax}%
                                </td>
                                <td className="p-3 text-right">
                                  {isOver ? (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                      {discount}% given — {effectiveMax}% allowed (+{overage.toFixed(1)}%)
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      Within Limits
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* APPROVAL CHAIN STEPS */}
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                        Approval Chain Progress
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        {/* Step 1: Sales Manager */}
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              managerApproved
                                ? 'bg-emerald-500 text-white'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            1
                          </div>
                          <span className={managerApproved ? 'text-emerald-400' : 'text-amber-300'}>
                            Sales Manager [{managerApproved ? 'APPROVED' : 'PENDING'}]
                          </span>
                        </div>

                        {/* Connector line */}
                        <div className="h-0.5 w-8 bg-slate-800" />

                        {/* Step 2: Finance */}
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isPendingFinance
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            2
                          </div>
                          <span
                            className={
                              isPendingFinance
                                ? 'text-amber-300'
                                : 'text-slate-500'
                            }
                          >
                            Finance Review [{isPendingFinance ? 'PENDING' : 'REQUIRED IF >10%'}]
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── APPROVAL DECISION PANEL (4 cols) ────────────────── */}
                  <div className="lg:col-span-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Executive Decision
                      </div>

                      {/* Decision action buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Approve */}
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [item.id]: { ...currentDecision, action: 'APPROVED' }
                            }))
                          }
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                            currentDecision.action === 'APPROVED'
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                              : 'bg-slate-900 border-slate-800 text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approve</span>
                        </button>

                        {/* Reject */}
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [item.id]: { ...currentDecision, action: 'REJECTED' }
                            }))
                          }
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                            currentDecision.action === 'REJECTED'
                              ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                              : 'bg-slate-900 border-slate-800 text-rose-400 hover:bg-rose-500/10'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>

                        {/* Return for Revision */}
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [item.id]: { ...currentDecision, action: 'RETURNED' }
                            }))
                          }
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                            currentDecision.action === 'RETURNED'
                              ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                              : 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-amber-500/10'
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Return</span>
                        </button>
                      </div>

                      {/* Reason text area */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Decision Notes & Rationale{' '}
                          {(currentDecision.action === 'REJECTED' ||
                            currentDecision.action === 'RETURNED') && (
                            <span className="text-rose-400 font-bold">*</span>
                          )}
                        </label>
                        <textarea
                          rows={3}
                          value={currentDecision.reason || ''}
                          onChange={(e) =>
                            setDecisions((prev) => ({
                              ...prev,
                              [item.id]: { ...currentDecision, reason: e.target.value }
                            }))
                          }
                          placeholder={
                            currentDecision.action === 'REJECTED'
                              ? 'State rationale for deal rejection...'
                              : currentDecision.action === 'RETURNED'
                              ? 'Specify required discount corrections for rep...'
                              : 'Optional comments or terms approval note...'
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Submit Decision Button */}
                    <button
                      type="button"
                      onClick={() => handleDecisionSubmit(item.id, item.quotation_number)}
                      disabled={!currentDecision.action}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Decision</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── AUDIT TRAIL PANEL (COLLAPSIBLE) ──────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowAuditTrail(!showAuditTrail)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-850/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">
              Recent Approval Activity & Audit Trail
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              ({auditTrail.length} recorded events)
            </span>
          </div>
          {showAuditTrail ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAuditTrail && (
          <div className="border-t border-slate-800 p-4 max-h-72 overflow-y-auto divide-y divide-slate-800/60">
            {auditTrail.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No recent approval actions recorded in audit log.
              </div>
            ) : (
              auditTrail.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">
                        {log.quotation?.quotation_number || 'Quotation'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          log.action === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : log.action === 'REJECTED'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {log.details} · By <span className="text-slate-300 font-medium">{log.user?.name || 'Executive'}</span>
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono shrink-0">
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
