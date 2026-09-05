import React, { useEffect, useState } from 'react';
import {
  MoreVertical,
  Plus,
  FileText,
  DollarSign,
  Building2,
  Calendar,
  AlertCircle,
  MoveRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useDealStore } from '../../store/dealStore';
import { dealApi } from '../../api/dealApi';
import { STAGES, formatCurrency, formatDate, PRIORITY_COLORS } from '../../utils/formatters';
import toast from 'react-hot-toast';

export const WorkspacePage = () => {
  const { deals, setDeals, setIsNewDealModalOpen, addOrUpdateDeal, searchTerm } = useDealStore();
  const [movingDealId, setMovingDealId] = useState(null);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        const res = await dealApi.getDeals();
        if (res.data) setDeals(res.data);
      } catch (err) {
        console.error('Failed to load deals in workspace', err);
      }
    };
    loadDeals();
  }, [setDeals]);

  const handleStageChange = async (deal, targetStage) => {
    if (deal.stage === targetStage) return;
    setMovingDealId(deal.id);
    try {
      const res = await dealApi.updateDeal(deal.id, { stage: targetStage });
      addOrUpdateDeal(res.data);
      toast.success(`Moved "${deal.title}" to ${targetStage.replace('_', ' ')}`);
    } catch (err) {
      toast.error('Failed to advance deal stage');
    } finally {
      setMovingDealId(null);
    }
  };

  const filteredDeals = deals.filter(
    (d) =>
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.targetCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            Enterprise Deal Pipeline Kanban
            <Badge variant="brand">{deals.length} Total Mandates</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Stage-gate workflow for M&A deal execution. Advance deals between phases in real-time.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsNewDealModalOpen(true)}>
          <Plus className="w-4 h-4" /> New Deal
        </Button>
      </div>

      {/* Kanban Board Columns Container */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[1280px] h-full items-start">
          {STAGES.map((stage) => {
            const stageDeals = filteredDeals.filter((d) => d.stage === stage.id);
            const totalStageValue = stageDeals.reduce((acc, d) => acc + (d.dealValue || 0), 0);

            return (
              <div
                key={stage.id}
                className="w-80 bg-slate-900/60 rounded-xl border border-slate-800/80 flex flex-col max-h-[calc(100vh-180px)] shrink-0"
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 rounded-t-xl">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.color.split(' ')[1]}`} />
                    <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                      {stage.label}
                    </h4>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-emerald-400">
                    {formatCurrency(totalStageValue)}
                  </span>
                </div>

                {/* Column Deal Cards */}
                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className={`p-4 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all shadow-md group ${
                        movingDealId === deal.id ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Card Top: Industry & Priority */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] text-brand-400 font-medium truncate max-w-[130px]">
                          {deal.industry || 'M&A Advisory'}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            PRIORITY_COLORS[deal.priority] || PRIORITY_COLORS.MEDIUM
                          }`}
                        >
                          {deal.priority}
                        </span>
                      </div>

                      {/* Card Title & Target */}
                      <h5 className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors line-clamp-2">
                        {deal.title}
                      </h5>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        {deal.targetCompany}
                      </p>

                      {/* Financial Value & Probability */}
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80 text-xs">
                        <span className="font-mono font-semibold text-emerald-400">
                          {formatCurrency(deal.dealValue)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Prob: {deal.probability}%
                        </span>
                      </div>

                      {/* Stage Mover Selector */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <select
                          value={deal.stage}
                          onChange={(e) => handleStageChange(deal, e.target.value)}
                          className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] rounded px-2 py-1 focus:outline-none focus:border-brand-500 w-full"
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              Move to: {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => dealApi.downloadPdf(deal.id)}
                          title="Export PDF Memo"
                          className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-brand-400 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="py-8 text-center text-[11px] text-slate-600">
                      No deals currently in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
