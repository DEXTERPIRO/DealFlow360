import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Clock,
  TrendingDown,
  ShieldAlert,
  Send,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Users,
  ChevronRight,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { dashboardAPI } from '../../api';

export default function DealHealth() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      stalledCount: 0,
      discountAnomalyCount: 0,
      deliverySlippageCount: 0,
      totalAtRisk: 0,
    },
    alerts: [],
  });

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // 1. Fetch Deal Health Data
  const loadDealHealth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dashboardAPI.getDealHealth();
      if (res?.data || res) {
        setData(res.data || res);
      }
    } catch (err) {
      console.error('Failed to load deal health metrics:', err);
      toast.error('Failed to load deal health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDealHealth();
  }, [loadDealHealth]);

  // 2. Real-time WebSockets synchronization
  useEffect(() => {
    const socket = io('http://localhost:5000');
    socket.emit('join_dashboard');

    socket.on('deal-nudged', (payload) => {
      toast(`⚡ Rep nudged for quotation ${payload.quotationNumber || payload.quotationId}`);
      loadDealHealth();
    });

    socket.on('deal-escalated', (payload) => {
      toast.success(`🛡️ Quotation ${payload.quotationNumber || payload.quotationId} escalated to Manager!`);
      loadDealHealth();
    });

    socket.on('quotation-updated', () => {
      loadDealHealth();
    });

    return () => {
      socket.disconnect();
    };
  }, [loadDealHealth]);

  // 3. Handlers for Nudge and Escalate
  const handleNudge = async (quotationId, quotationNumber) => {
    try {
      setActionLoading((prev) => ({ ...prev, [`nudge_${quotationId}`]: true }));
      const res = await dashboardAPI.nudgeRep(quotationId);
      toast.success(res?.data?.message || res?.message || `Nudge sent to rep for ${quotationNumber}!`);
      // Update locally
      setData((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) =>
          a.id === quotationId ? { ...a, lastAction: 'Nudge sent' } : a
        ),
      }));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to send nudge');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`nudge_${quotationId}`]: false }));
    }
  };

  const handleEscalate = async (quotationId, quotationNumber) => {
    try {
      setActionLoading((prev) => ({ ...prev, [`escalate_${quotationId}`]: true }));
      const res = await dashboardAPI.escalateDeal(quotationId);
      toast.success(res?.data?.message || res?.message || `Quotation ${quotationNumber} escalated to Manager!`);
      // Update locally
      setData((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) =>
          a.id === quotationId ? { ...a, lastAction: 'Escalated to Manager' } : a
        ),
      }));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to escalate deal');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`escalate_${quotationId}`]: false }));
    }
  };

  // 4. Filtering and Searching
  const filteredAlerts = useMemo(() => {
    let list = data.alerts || [];

    if (activeFilter !== 'ALL') {
      list = list.filter((a) => a.type === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.quotationNumber || '').toLowerCase().includes(q) ||
          (a.customer || '').toLowerCase().includes(q) ||
          (a.repName || '').toLowerCase().includes(q) ||
          (a.issue || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [data.alerts, activeFilter, searchQuery]);

  return (
    <div className="space-y-6 antialiased pb-16">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-heading font-black border-2 border-slate-900 shadow-pop-xs uppercase tracking-wider">
              Screen 14
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">Live Governance Sentinel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-rose-600 animate-pulse" strokeWidth={2.5} />
            <span>Deal Health and Anomaly Dashboard</span>
          </h1>
          <p className="text-xs font-medium text-slate-600 mt-1">
            Real-time flags for stalled deals, discount anomalies, and delivery promise slippage
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDealHealth}
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all text-xs font-heading font-bold flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} />
            <span>Refresh Flags</span>
          </button>
        </div>
      </div>

      {/* ── KPI CARDS (Matches SVG Box 14) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Stalled Deals */}
        <div
          onClick={() => setActiveFilter(activeFilter === 'STALLED' ? 'ALL' : 'STALLED')}
          className={`p-5 rounded-3xl border-2 border-slate-900 transition-all cursor-pointer shadow-pop hover:-translate-y-0.5 ${
            activeFilter === 'STALLED' ? 'bg-amber-100 ring-4 ring-amber-400/50' : 'bg-[#FFFDF5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-200 border-2 border-slate-900 flex items-center justify-center text-amber-900 shadow-pop-xs">
                <Clock className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-black text-slate-900">Stalled Deals</h3>
                <p className="text-[11px] font-mono font-bold text-amber-800">
                  {data.summary.stalledCount} quotes idle 5+ days
                </p>
              </div>
            </div>
            <span className="text-2xl font-mono font-black text-slate-900">
              {data.summary.stalledCount}
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 mt-3 pt-3 border-t-2 border-slate-900/10">
            Deals stuck in pipeline without rep or client activity. Requires immediate nudge.
          </p>
        </div>

        {/* Card 2: Discount Anomalies */}
        <div
          onClick={() => setActiveFilter(activeFilter === 'DISCOUNT_ANOMALY' ? 'ALL' : 'DISCOUNT_ANOMALY')}
          className={`p-5 rounded-3xl border-2 border-slate-900 transition-all cursor-pointer shadow-pop hover:-translate-y-0.5 ${
            activeFilter === 'DISCOUNT_ANOMALY' ? 'bg-rose-100 ring-4 ring-rose-400/50' : 'bg-[#FFFDF5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-200 border-2 border-slate-900 flex items-center justify-center text-rose-900 shadow-pop-xs">
                <TrendingDown className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-black text-slate-900">Discount Anomalies</h3>
                <p className="text-[11px] font-mono font-bold text-rose-800">
                  {data.summary.discountAnomalyCount} above rep average / risk ceiling
                </p>
              </div>
            </div>
            <span className="text-2xl font-mono font-black text-slate-900">
              {data.summary.discountAnomalyCount}
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 mt-3 pt-3 border-t-2 border-slate-900/10">
            Excessive discounts given well above tier limit or blended risk threshold &gt; 5.
          </p>
        </div>

        {/* Card 3: Delivery Slippage */}
        <div
          onClick={() => setActiveFilter(activeFilter === 'DELIVERY_SLIPPAGE' ? 'ALL' : 'DELIVERY_SLIPPAGE')}
          className={`p-5 rounded-3xl border-2 border-slate-900 transition-all cursor-pointer shadow-pop hover:-translate-y-0.5 ${
            activeFilter === 'DELIVERY_SLIPPAGE' ? 'bg-blue-100 ring-4 ring-blue-400/50' : 'bg-[#FFFDF5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-200 border-2 border-slate-900 flex items-center justify-center text-blue-900 shadow-pop-xs">
                <AlertTriangle className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-black text-slate-900">Delivery Slippage</h3>
                <p className="text-[11px] font-mono font-bold text-blue-800">
                  {data.summary.deliverySlippageCount} promise dates at risk
                </p>
              </div>
            </div>
            <span className="text-2xl font-mono font-black text-slate-900">
              {data.summary.deliverySlippageCount}
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 mt-3 pt-3 border-t-2 border-slate-900/10">
            Offer expiry approaching or target fulfillment promise dates under pressure.
          </p>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-2 border-slate-900 p-4 rounded-3xl shadow-pop-xs">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-black border-2 border-slate-900 transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-pop-xs'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            All Flagged ({data.alerts.length})
          </button>
          <button
            onClick={() => setActiveFilter('STALLED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-black border-2 border-slate-900 transition-all cursor-pointer ${
              activeFilter === 'STALLED'
                ? 'bg-amber-400 text-slate-900 shadow-pop-xs'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            Stalled ({data.summary.stalledCount})
          </button>
          <button
            onClick={() => setActiveFilter('DISCOUNT_ANOMALY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-black border-2 border-slate-900 transition-all cursor-pointer ${
              activeFilter === 'DISCOUNT_ANOMALY'
                ? 'bg-rose-400 text-white shadow-pop-xs'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            Discount Anomalies ({data.summary.discountAnomalyCount})
          </button>
          <button
            onClick={() => setActiveFilter('DELIVERY_SLIPPAGE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-black border-2 border-slate-900 transition-all cursor-pointer ${
              activeFilter === 'DELIVERY_SLIPPAGE'
                ? 'bg-blue-400 text-slate-900 shadow-pop-xs'
                : 'bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            Delivery Slippage ({data.summary.deliverySlippageCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals, reps, anomalies..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-2xl border-2 border-slate-900 bg-[#FFFDF5] text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
          />
        </div>
      </div>

      {/* ── DEAL HEALTH ANOMALY TABLE (Matches SVG Box 14 Table) ── */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
        <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-800" strokeWidth={2.5} />
            <h2 className="text-sm font-heading font-black text-slate-900">
              Deal Anomaly & Velocity Oversight Table
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-slate-600">
            {filteredAlerts.length} issues requiring attention
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] uppercase font-heading font-black text-slate-700 font-mono">
                <th className="p-3.5">Deal / Quotation</th>
                <th className="p-3.5">Customer & Rep</th>
                <th className="p-3.5">Issue / Anomaly Reason</th>
                <th className="p-3.5 text-center">Flagged</th>
                <th className="p-3.5 text-center">Risk / Margin</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-heading font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-800" />
                    Scanning pipeline health & anomaly signals...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500 font-heading font-bold">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-900 font-heading font-black">All Deals in Prime Health!</p>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      No stalled quotes, extreme discount anomalies, or delivery slippage detected.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr key={`${alert.type}_${alert.id}`} className="hover:bg-amber-50/40 transition-colors">
                    {/* Quotation Number */}
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono font-black text-slate-900 text-xs flex items-center gap-1.5">
                          {alert.quotationNumber}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-600">
                          ₹{Number(alert.total || 0).toLocaleString()}
                        </span>
                      </div>
                    </td>

                    {/* Customer & Rep */}
                    <td className="p-3.5">
                      <div className="flex flex-col">
                        <span className="font-heading font-black text-slate-900 text-xs">
                          {alert.customer}
                        </span>
                        <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          {alert.repName}
                        </span>
                      </div>
                    </td>

                    {/* Issue Description */}
                    <td className="p-3.5">
                      <div className="flex items-start gap-2 max-w-sm">
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 border border-slate-900 ${
                            alert.type === 'STALLED'
                              ? 'bg-amber-400'
                              : alert.type === 'DISCOUNT_ANOMALY'
                              ? 'bg-rose-500'
                              : 'bg-blue-500'
                          }`}
                        />
                        <div>
                          <p className="font-heading font-bold text-slate-900 text-xs leading-snug">
                            {alert.issue}
                          </p>
                          <span className="text-[10px] uppercase font-mono font-black text-slate-500 tracking-wider">
                            Type: {alert.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Flagged Date */}
                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      {alert.flaggedDate}
                    </td>

                    {/* Risk Score / Margin */}
                    <td className="p-3.5 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border border-slate-900 ${
                            alert.riskScore > 10
                              ? 'bg-rose-200 text-rose-900'
                              : alert.riskScore > 5
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          Risk: {alert.riskScore}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 mt-0.5">
                          Margin: {alert.margin}%
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 border border-slate-900 text-slate-800">
                        {alert.status}
                      </span>
                    </td>

                    {/* Actions (Matches SVG: Nudge Rep, Escalate, View Deal) */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Status Label if already nudged / escalated */}
                        {alert.lastAction && (
                          <span className="text-[10px] font-mono font-black px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                            {alert.lastAction}
                          </span>
                        )}

                        {/* Nudge Rep Button */}
                        <button
                          type="button"
                          onClick={() => handleNudge(alert.id, alert.quotationNumber)}
                          disabled={actionLoading[`nudge_${alert.id}`]}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-300 hover:bg-amber-400 text-slate-900 text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs transition-all flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                          title="Send Velocity Nudge to Sales Rep"
                        >
                          <Flame size={13} strokeWidth={2.5} />
                          <span>{actionLoading[`nudge_${alert.id}`] ? '...' : 'Nudge Rep'}</span>
                        </button>

                        {/* Escalate to Manager Button */}
                        <button
                          type="button"
                          onClick={() => handleEscalate(alert.id, alert.quotationNumber)}
                          disabled={actionLoading[`escalate_${alert.id}`]}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-400 hover:bg-rose-500 text-white text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs transition-all flex items-center gap-1 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                          title="Escalate Deal to Sales Management"
                        >
                          <ShieldAlert size={13} strokeWidth={2.5} />
                          <span>{actionLoading[`escalate_${alert.id}`] ? '...' : 'Escalate'}</span>
                        </button>

                        {/* View Deal Button */}
                        <button
                          type="button"
                          onClick={() => navigate(`/quotations/${alert.id}`)}
                          className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                          title="Open Quotation Builder"
                        >
                          <ArrowUpRight size={15} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
