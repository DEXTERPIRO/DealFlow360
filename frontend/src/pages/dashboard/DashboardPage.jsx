import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  CheckCircle2,
  FileText,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PipelineChart } from '../../components/charts/PipelineChart';
import { ValuationChart } from '../../components/charts/ValuationChart';
import { useDealStore } from '../../store/dealStore';
import { dealApi } from '../../api/dealApi';
import { formatCurrency, formatDate, PRIORITY_COLORS } from '../../utils/formatters';

export const DashboardPage = () => {
  const { deals, setDeals, setIsNewDealModalOpen, searchTerm } = useDealStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const res = await dealApi.getDeals();
        if (res.data) {
          setDeals(res.data);
        }
      } catch (err) {
        console.error('Failed to load deals', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, [setDeals]);

  // KPI Calculations
  const totalValuation = deals.reduce((acc, d) => acc + (d.dealValue || 0), 0);
  const activeDealsCount = deals.filter((d) => d.stage !== 'CLOSED_LOST').length;
  const wonDeals = deals.filter((d) => d.stage === 'CLOSED_WON');
  const wonValuation = wonDeals.reduce((acc, d) => acc + (d.dealValue || 0), 0);
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  const filteredDeals = deals.filter(
    (d) =>
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.targetCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            M&A Dealflow Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global pipeline orchestration, probability-weighted analytics, and transaction memos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Refresh Sync
          </Button>
          <Button size="sm" onClick={() => setIsNewDealModalOpen(true)}>
            + New Mandate
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Total Pipeline Value
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">
              {formatCurrency(totalValuation)}
            </h3>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3" /> Weighted live exposure
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Active Deal Count
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">{activeDealsCount}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Across all advisory sectors</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Closed Won Volume
            </p>
            <h3 className="text-2xl font-black text-emerald-400 mt-0.5">
              {formatCurrency(wonValuation)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{wonDeals.length} completed transactions</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Win Rate Conversion
            </p>
            <h3 className="text-2xl font-black text-white mt-0.5">{winRate}%</h3>
            <p className="text-[10px] text-purple-400 mt-0.5">Lead to Closed Won</p>
          </div>
        </Card>
      </div>

      {/* Visual Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Stage Concentration</h3>
              <p className="text-xs text-slate-400">Distribution of deals across pipeline phases</p>
            </div>
          </div>
          <PipelineChart deals={deals} />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Valuation Funnel</h3>
              <p className="text-xs text-slate-400">Aggregated capital volume per milestone (USD Millions)</p>
            </div>
          </div>
          <ValuationChart deals={deals} />
        </Card>
      </div>

      {/* Active Deals Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Dealflow Pipeline Overview</h3>
            <p className="text-xs text-slate-400">Comprehensive log of live mandates and target valuations</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="pb-3 pl-2">Deal Title & Target</th>
                <th className="pb-3">Industry</th>
                <th className="pb-3">Valuation</th>
                <th className="pb-3">Stage</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3">Probability</th>
                <th className="pb-3 text-right pr-2">Memo Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 pl-2">
                    <div className="font-semibold text-white">{deal.title}</div>
                    <div className="text-[11px] text-slate-400">{deal.targetCompany}</div>
                  </td>
                  <td className="py-3.5 text-slate-300">{deal.industry}</td>
                  <td className="py-3.5 font-mono font-medium text-emerald-400">
                    {formatCurrency(deal.dealValue)}
                  </td>
                  <td className="py-3.5">
                    <Badge variant="brand">{deal.stage.replace('_', ' ')}</Badge>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        PRIORITY_COLORS[deal.priority] || PRIORITY_COLORS.MEDIUM
                      }`}
                    >
                      {deal.priority}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-brand-500 h-full rounded-full"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {deal.probability}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 text-right pr-2">
                    <button
                      onClick={() => dealApi.downloadPdf(deal.id)}
                      title="Download PDFKit Executive Memorandum"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      PDF Memo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
