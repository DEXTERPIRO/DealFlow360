import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  XCircle,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  Calendar,
  ArrowUpRight,
  Filter,
  User,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { io } from 'socket.io-client';
import { dashboardAPI } from '../../api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();

  // Filters
  const [period, setPeriod] = useState('month'); // today, week, month, custom
  const [selectedRep, setSelectedRep] = useState('');
  const [loading, setLoading] = useState(true);

  // Metrics state
  const [data, setData] = useState({
    kpis: {
      totalQuotations: 0,
      confirmedDeals: 0,
      confirmedValue: 0,
      pendingApprovals: 0,
      totalRevenue: 0,
      draftQuotations: 0,
      rejectedQuotations: 0,
      activeSubscriptions: 0,
      avgDealSize: 0,
    },
    stalledDeals: [],
    discountAnomalies: [],
    expiringQuotations: [],
    pipelineChart: [],
    revenueTrend: [],
    topReps: [],
    reps: [],
  });

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await dashboardAPI.getMetrics({
        period,
        ...(selectedRep ? { rep_id: selectedRep } : {})
      });
      if (res) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [period, selectedRep]);

  // Socket.io for real-time live updates
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_dashboard');
    });

    socket.on('quotation-created', () => {
      fetchMetrics();
    });

    socket.on('approval-needed', () => {
      fetchMetrics();
    });

    socket.on('approval-decision', () => {
      fetchMetrics();
    });

    socket.on('invoice-paid', () => {
      fetchMetrics();
    });

    return () => {
      socket.disconnect();
    };
  }, [period, selectedRep]);

  const kpis = data.kpis || {};

  return (
    <div className="space-y-6 pb-12 antialiased">
      {/* ── HEADER ROW & FILTERS ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Deal Health & Operations Dashboard
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Live CPQ Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time pipeline velocity, automated discount governance, and revenue analytics.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            {['today', 'week', 'month', 'custom'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                  period === p
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Rep filter dropdown */}
          <div className="relative">
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              <option value="">All Sales Reps</option>
              {data.reps?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS (2 ROWS OF 4) ────────────────────────────────────── */}
      <div className="space-y-3">
        {/* ROW 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Quotations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Quotations
              </p>
              <h3 className="text-2xl font-black text-white mt-1">
                {kpis.totalQuotations || 0}
              </h3>
              <p className="text-[11px] text-blue-400 font-medium mt-1">Active Pipeline Volume</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Confirmed Deals */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Confirmed Deals
              </p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">
                {kpis.confirmedDeals || 0}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Total: ₹{(kpis.confirmedValue || 0).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          {/* Pending Approvals (Clickable) */}
          <div
            onClick={() => navigate('/approvals')}
            className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4.5 flex items-center justify-between shadow-sm cursor-pointer transition-all group"
          >
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
                Pending Approvals
              </p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">
                {kpis.pendingApprovals || 0}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1 group-hover:underline">
                <span>Action Queue</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Revenue
              </p>
              <h3 className="text-2xl font-black text-emerald-300 mt-1">
                ₹{(kpis.totalRevenue || 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-emerald-400 font-medium mt-1">Settled Invoices</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ROW 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Draft Quotations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Draft Quotations
              </p>
              <h3 className="text-2xl font-black text-slate-300 mt-1">
                {kpis.draftQuotations || 0}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Under Rep Formulation</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
              <Edit className="w-6 h-6" />
            </div>
          </div>

          {/* Rejected Quotations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Rejected Deals
              </p>
              <h3 className="text-2xl font-black text-rose-400 mt-1">
                {kpis.rejectedQuotations || 0}
              </h3>
              <p className="text-[11px] text-rose-400/80 font-medium mt-1">Declined Margin / Terms</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
          </div>

          {/* Active Subscriptions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Subscriptions
              </p>
              <h3 className="text-2xl font-black text-purple-400 mt-1">
                {kpis.activeSubscriptions || 0}
              </h3>
              <p className="text-[11px] text-purple-400 font-medium mt-1">Recurring SaaS ARR</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <RefreshCw className="w-6 h-6" />
            </div>
          </div>

          {/* Avg Deal Size */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Avg Deal Size
              </p>
              <h3 className="text-2xl font-black text-blue-300 mt-1">
                ₹{(kpis.avgDealSize || 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-blue-400 font-medium mt-1">Order Value Baseline</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* ── ALERTS SECTION (STALLED DEALS & DISCOUNT ANOMALIES) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STALLED DEALS ALERT PANEL */}
        <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Stalled Deals Alert</h3>
                <p className="text-[11px] text-slate-400">Quotations inactive for more than 5 days</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300">
              {data.stalledDeals?.length || 0}
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {data.stalledDeals?.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                All deals are active 🎉
              </div>
            ) : (
              data.stalledDeals?.map((d) => (
                <div
                  key={d.id}
                  className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{d.quotationNumber}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({d.status})</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {d.customerName} · Rep: <span className="text-slate-300">{d.repName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      {d.daysStalled}d stalled
                    </span>
                    <button
                      onClick={() => navigate(`/quotations/${d.id}`)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DISCOUNT ANOMALY ALERTS */}
        <div className="bg-slate-900 border-2 border-rose-500/40 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Discount Anomaly Alerts</h3>
                <p className="text-[11px] text-slate-400">High blended risk score requiring governance</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300">
              {data.discountAnomalies?.length || 0}
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {data.discountAnomalies?.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                No high-risk discount anomalies detected ✨
              </div>
            ) : (
              data.discountAnomalies?.map((a) => (
                <div
                  key={a.id}
                  className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{a.quotationNumber}</span>
                      <span className="text-[10px] text-slate-500">₹{a.total.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Rep: <span className="text-slate-300">{a.repName}</span> · {a.customerName}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 font-mono">Risk Score</div>
                      <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-rose-500 text-white">
                        {a.riskScore.toFixed(1)}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/quotations/${a.id}`)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold transition-colors"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── CHARTS SECTION (PIPELINE STATUS & REVENUE TREND) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PIPELINE STATUS CHART */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Pipeline Status Distribution</h3>
              <p className="text-[11px] text-slate-400">Deal count and volume by CPQ lifecycle stage</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.pipelineChart || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="status" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Deal Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* REVENUE TREND CHART (Area Gradient) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Revenue Velocity (6 Months)</h3>
              <p className="text-[11px] text-slate-400">Recognized invoice earnings trajectory</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.revenueTrend || []}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc'
                  }}
                  formatter={(val) => [`₹${Number(val).toLocaleString()}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: EXPIRING QUOTATIONS & TOP REPS TABLE ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EXPIRING QUOTATIONS (Amber card, countdown badge) */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Expiring Quotations (Next 7 Days)</h3>
            </div>
            <span className="text-xs text-amber-400 font-mono font-bold">
              {data.expiringQuotations?.length || 0} Expiring
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.expiringQuotations?.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No quotations expiring within the next 7 days.
              </div>
            ) : (
              data.expiringQuotations?.map((q) => (
                <div
                  key={q.id}
                  className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{q.quotationNumber}</div>
                    <div className="text-[11px] text-slate-400">
                      {q.customerName} · Rep: {q.repName}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {q.daysRemaining} days left
                    </span>
                    <button
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="text-blue-400 hover:text-blue-300 font-semibold text-[11px]"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOP REPS TABLE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Top Performing Representatives</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">By Confirmed Volume</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 font-mono">
                  <th className="pb-2.5">Representative</th>
                  <th className="pb-2.5 text-center">Deals</th>
                  <th className="pb-2.5 text-right">Volume</th>
                  <th className="pb-2.5 text-right">Avg Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.topReps?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                      No sales metrics recorded yet
                    </td>
                  </tr>
                ) : (
                  data.topReps?.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="py-2.5 font-semibold text-slate-200">{rep.name}</td>
                      <td className="py-2.5 text-center text-slate-300 font-mono">{rep.confirmedDeals}</td>
                      <td className="py-2.5 text-right font-bold text-white font-mono">
                        ₹{rep.totalValue.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-emerald-400 font-mono">
                        {rep.avgMargin}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
