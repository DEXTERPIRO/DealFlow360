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
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  User,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { io } from 'socket.io-client';
import { dashboardAPI } from '../../api';

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
        ...(selectedRep ? { rep_id: selectedRep } : {}),
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight">
              Deal Health & Operations Dashboard
            </h1>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-900 border-2 border-slate-900 shadow-pop-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600 border border-slate-900"></span>
              </span>
              <span>Live CPQ Engine</span>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-600 mt-1">
            Real-time pipeline velocity, automated discount governance, and revenue analytics.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl p-1 shadow-pop-xs">
            {['today', 'week', 'month', 'custom'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-xl capitalize text-xs font-heading font-black transition-all cursor-pointer ${
                  period === p
                    ? 'bg-pop-violet text-white shadow-pop-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
              className="bg-white border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 shadow-pop-xs focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
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
      <div className="space-y-3.5">
        {/* ROW 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Quotations */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
            <div>
              <p className="text-xs font-heading font-black text-blue-600 uppercase tracking-wider">
                Total Quotations
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 mt-1">
                {kpis.totalQuotations || 0}
              </h3>
              <p className="text-xs font-heading font-bold text-blue-700 mt-1">Active Pipeline Volume</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-100 border-2 border-slate-900 text-blue-700 flex items-center justify-center shadow-pop-xs group-hover:scale-105 transition-transform">
              <FileText className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>

          {/* Confirmed Deals */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
            <div>
              <p className="text-xs font-heading font-black text-emerald-600 uppercase tracking-wider">
                Confirmed Deals
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-emerald-700 mt-1">
                {kpis.confirmedDeals || 0}
              </h3>
              <p className="text-xs font-heading font-bold text-slate-600 mt-1">
                Total: ₹{(kpis.confirmedValue || 0).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 border-2 border-slate-900 text-emerald-700 flex items-center justify-center shadow-pop-xs group-hover:scale-105 transition-transform">
              <CheckCircle className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>

          {/* Pending Approvals (Clickable) */}
          <div
            onClick={() => navigate('/approvals')}
            className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-slate-900 hover:border-amber-600 rounded-3xl p-5 flex items-center justify-between shadow-pop hover:shadow-pop-lg hover:-translate-y-1 cursor-pointer transition-all group"
          >
            <div>
              <p className="text-xs font-heading font-black text-amber-600 uppercase tracking-wider group-hover:text-amber-800 transition-colors">
                Pending Approvals
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-amber-700 mt-1">
                {kpis.pendingApprovals || 0}
              </h3>
              <p className="text-xs font-heading font-bold text-amber-700 mt-1 flex items-center gap-1 group-hover:underline">
                <span>Action Queue</span>
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-slate-900 text-amber-700 flex items-center justify-center shadow-pop-xs group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
            <div>
              <p className="text-xs font-heading font-black text-green-600 uppercase tracking-wider">
                Total Revenue
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 mt-1">
                ₹{(kpis.totalRevenue || 0).toLocaleString()}
              </h3>
              <p className="text-xs font-heading font-bold text-emerald-700 mt-1">Settled Invoices</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-green-100 border-2 border-slate-900 text-green-700 flex items-center justify-center shadow-pop-xs group-hover:scale-105 transition-transform">
              <DollarSign className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* ROW 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Draft Quotations */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
            <div>
              <p className="text-xs font-heading font-black text-slate-500 uppercase tracking-wider">
                Draft Quotations
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-slate-700 mt-1">
                {kpis.draftQuotations || 0}
              </h3>
              <p className="text-xs font-heading font-bold text-slate-500 mt-1">Under Rep Formulation</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border-2 border-slate-900 text-slate-700 flex items-center justify-center shadow-pop-xs group-hover:scale-105 transition-transform">
              <Edit className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>

          {/* Rejected Quotations */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
            <div>
              <p className="text-xs font-heading font-black text-rose-500 uppercase tracking-wider">
                Rejected Deals
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-rose-600 mt-1">
                {kpis.rejectedQuotations || 0}
              </h3>
              <p className="text-xs font-heading font-bold text-rose-600/90 mt-1">Declined Margin / Terms</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border-2 border-slate-900 text-rose-600 flex items-center justify-center shadow-pop-xs group-hover:scale-105 transition-transform">
              <XCircle className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>

          {/* Active Subscriptions */}
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
            <div>
              <p className="text-xs font-heading font-black text-purple-600 uppercase tracking-wider">
                Active Subscriptions
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-purple-700 mt-1">
                {kpis.activeSubscriptions || 0}
              </h3>
              <p className="text-xs font-heading font-bold text-purple-700 mt-1">Recurring SaaS ARR</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-100 border-2 border-slate-900 text-purple-700 flex items-center justify-center shadow-pop-xs group-hover:scale-105 transition-transform">
              <RefreshCw className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>

          {/* Avg Deal Size */}
          <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border-2 border-slate-900 rounded-3xl p-5 shadow-pop hover:shadow-pop-lg hover:-translate-y-1 transition-all flex items-center justify-between group">
            <div>
              <p className="text-xs font-heading font-black text-indigo-600 uppercase tracking-wider">
                Avg Deal Size
              </p>
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-indigo-700 mt-1">
                ₹{(kpis.avgDealSize || 0).toLocaleString()}
              </h3>
              <p className="text-xs font-heading font-bold text-indigo-600 mt-1">Order Value Baseline</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 border-2 border-slate-900 text-indigo-700 flex items-center justify-center shadow-pop-xs group-hover:scale-105 transition-transform">
              <TrendingUp className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>

      {/* ── ALERTS SECTION (STALLED DEALS & DISCOUNT ANOMALIES) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STALLED DEALS ALERT PANEL */}
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border-2 border-slate-900 text-amber-700 flex items-center justify-center shadow-pop-xs">
                <AlertTriangle className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-black text-slate-900">Stalled Deals Alert</h3>
                <p className="text-xs font-medium text-slate-500">Quotations inactive for more than 5 days</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-amber-200 text-slate-900 border-2 border-slate-900 shadow-pop-xs">
              {data.stalledDeals?.length || 0}
            </span>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {data.stalledDeals?.length === 0 ? (
              <div className="p-8 text-center text-xs font-heading font-bold text-slate-500 flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" strokeWidth={2.5} />
                <span>All deals are active and progressing</span>
              </div>
            ) : (
              data.stalledDeals?.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-pop-xs"
                >
                  <div>
                    <div className="font-heading font-black text-slate-900 flex items-center gap-1.5">
                      <span>{d.quotationNumber || d.quotation_number || 'Quotation'}</span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">({d.status})</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                      {d.customerName || d.customer?.name || 'Direct Customer'} · Rep: <span className="font-bold text-slate-900">{d.repName || d.rep?.name || 'Rep'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-black bg-rose-100 text-rose-700 border-2 border-slate-900 shadow-pop-xs">
                      {d.daysStalled ?? 5}d stalled
                    </span>
                    <button
                      onClick={() => navigate(`/quotations/${d.id}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-pop-violet hover:bg-violet-700 text-white text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
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
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 border-2 border-slate-900 text-rose-600 flex items-center justify-center shadow-pop-xs">
                <AlertOctagon className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-heading font-black text-slate-900">Discount Anomaly Alerts</h3>
                <p className="text-xs font-medium text-slate-500">High blended risk score requiring governance</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-rose-200 text-slate-900 border-2 border-slate-900 shadow-pop-xs">
              {data.discountAnomalies?.length || 0}
            </span>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {data.discountAnomalies?.length === 0 ? (
              <div className="p-8 text-center text-xs font-heading font-bold text-slate-500 flex items-center justify-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" strokeWidth={2.5} />
                <span>No high-risk discount anomalies detected</span>
              </div>
            ) : (
              data.discountAnomalies?.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-pop-xs"
                >
                  <div>
                    <div className="font-heading font-black text-slate-900 flex items-center gap-2">
                      <span>{a.quotationNumber || a.quotation_number || 'Quotation'}</span>
                      <span className="text-[11px] font-mono text-slate-600 font-bold">₹{Number(a.total || 0).toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                      Rep: <span className="font-bold text-slate-900">{a.repName || a.rep?.name || 'Rep'}</span> · {a.customerName || a.customer?.name || 'Customer'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] font-heading font-black uppercase text-slate-500">Risk Score</div>
                      <span className="inline-block px-2.5 py-0.5 rounded-lg font-mono font-black text-xs bg-rose-500 text-white border-2 border-slate-900 shadow-pop-xs animate-pulse">
                        {Number(a.riskScore ?? a.blendedRiskScore ?? 0).toFixed(1)}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/quotations/${a.id}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-pop-pink hover:bg-pink-600 text-white text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
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
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <h3 className="text-sm font-heading font-black text-slate-900">Pipeline Status Distribution</h3>
              <p className="text-xs font-medium text-slate-500">Deal count and volume by CPQ lifecycle stage</p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.pipelineChart || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 8px 20px -3px rgba(15, 23, 42, 0.12)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                  }}
                />
                <Bar dataKey="count" fill="#8B5CF6" radius={[8, 8, 0, 0]} stroke="#0f172a" strokeWidth={1.5} name="Deal Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* REVENUE TREND CHART (Area Gradient) */}
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <h3 className="text-sm font-heading font-black text-slate-900">Revenue Velocity (6 Months)</h3>
              <p className="text-xs font-medium text-slate-500">Recognized invoice earnings trajectory</p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.revenueTrend || []}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 8px 20px -3px rgba(15, 23, 42, 0.12)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                  }}
                  formatter={(val) => [`₹${Number(val).toLocaleString()}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7C3AED"
                  strokeWidth={3}
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
        {/* EXPIRING QUOTATIONS */}
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-amber-600" strokeWidth={2.5} />
              <h3 className="text-sm font-heading font-black text-slate-900">Expiring Quotations (Next 7 Days)</h3>
            </div>
            <span className="text-xs text-amber-700 font-mono font-black px-2.5 py-0.5 rounded-full bg-amber-100 border-2 border-slate-900 shadow-pop-xs">
              {data.expiringQuotations?.length || 0} Expiring
            </span>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {data.expiringQuotations?.length === 0 ? (
              <div className="p-8 text-center text-xs font-heading font-bold text-slate-500">
                No quotations expiring within the next 7 days.
              </div>
            ) : (
              data.expiringQuotations?.map((q) => (
                <div
                  key={q.id}
                  className="p-3.5 bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl flex items-center justify-between text-xs shadow-pop-xs"
                >
                  <div>
                    <div className="font-heading font-black text-slate-900">{q.quotationNumber || q.quotation_number || 'Quotation'}</div>
                    <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                      {q.customerName || q.customer?.name || 'Customer'} · Rep: {q.repName || q.rep?.name || 'Rep'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-black bg-amber-100 text-amber-800 border-2 border-slate-900 shadow-pop-xs">
                      {q.daysRemaining ?? 0} days left
                    </span>
                    <button
                      onClick={() => navigate(`/quotations/${q.id}`)}
                      className="text-violet-700 hover:text-violet-900 font-heading font-black text-xs underline"
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
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-purple-600" strokeWidth={2.5} />
              <h3 className="text-sm font-heading font-black text-slate-900">Top Performing Representatives</h3>
            </div>
            <span className="text-xs text-slate-600 font-heading font-bold">By Confirmed Volume</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[11px] uppercase font-heading font-black text-slate-600 font-mono">
                  <th className="pb-3">Representative</th>
                  <th className="pb-3 text-center">Deals</th>
                  <th className="pb-3 text-right">Volume</th>
                  <th className="pb-3 text-right">Avg Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.topReps?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 font-heading font-bold text-xs">
                      No sales metrics recorded yet
                    </td>
                  </tr>
                ) : (
                  data.topReps?.map((rep) => (
                    <tr key={rep.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="py-3 font-heading font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-100 border border-slate-900 flex items-center justify-center text-purple-700 text-[10px] font-black">
                          <User size={12} strokeWidth={2.5} />
                        </div>
                        <span>{rep.name || 'Sales Rep'}</span>
                      </td>
                      <td className="py-3 text-center text-slate-700 font-mono font-bold">{rep.confirmedDeals ?? rep.deals ?? 0}</td>
                      <td className="py-3 text-right font-mono font-black text-slate-900">
                        ₹{Number(rep.totalValue ?? rep.revenue ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-700">
                        {rep.avgMargin ?? '0.0'}%
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
