import React, { useEffect, useState } from 'react';
import {
  Globe2,
  FileText,
  ShieldCheck,
  Lock,
  Download,
  Building,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FileDropzone } from '../../components/forms/FileDropzone';
import { useDealStore } from '../../store/dealStore';
import { dealApi } from '../../api/dealApi';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const PortalPage = () => {
  const { deals, setDeals } = useDealStore();
  const [selectedDeal, setSelectedDeal] = useState(null);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        const res = await dealApi.getDeals();
        if (res.data) {
          setDeals(res.data);
          if (res.data.length > 0 && !selectedDeal) {
            setSelectedDeal(res.data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load portal deals', err);
      }
    };
    loadDeals();
  }, [setDeals, selectedDeal]);

  return (
    <div className="space-y-6">
      {/* Portal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-brand-500/10 border border-brand-500/30 text-brand-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-xs font-mono uppercase text-brand-400 tracking-wider font-semibold">
              Secure Data Room & Investor Access
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            Client & Limited Partner Portal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Encrypted memorandum access, virtual data room documents, and diligence materials.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          NDA Active • Tier-1 Verified
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deal Selection List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Available Mandates ({deals.length})
          </h3>
          <div className="space-y-2">
            {deals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => setSelectedDeal(deal)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedDeal?.id === deal.id
                    ? 'bg-brand-600/10 border-brand-500/50 text-white shadow-lg shadow-brand-950/40'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate max-w-[170px]">{deal.title}</span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {formatCurrency(deal.dealValue)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>{deal.targetCompany}</span>
                  <Badge variant="brand">{deal.stage}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Deal Diligence Vault */}
        <div className="lg:col-span-2 space-y-6">
          {selectedDeal ? (
            <>
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-brand-400 font-mono">
                      {selectedDeal.industry}
                    </span>
                    <h2 className="text-lg font-black text-white mt-0.5">
                      {selectedDeal.title}
                    </h2>
                    <p className="text-xs text-slate-400">{selectedDeal.targetCompany}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => dealApi.downloadPdf(selectedDeal.id)}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Executive PDF
                  </Button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 py-4 border-b border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">
                      Indicative Valuation
                    </span>
                    <span className="font-mono text-base font-bold text-emerald-400">
                      {formatCurrency(selectedDeal.dealValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">
                      Current Milestone
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {selectedDeal.stage.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">
                      Diligence Probability
                    </span>
                    <span className="text-sm font-semibold text-brand-400">
                      {selectedDeal.probability}%
                    </span>
                  </div>
                </div>

                {/* Narrative */}
                <div className="pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Executive Brief & Transaction Thesis
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selectedDeal.description ||
                      'Standard non-disclosure protocol applies. Direct diligence enquiries to lead advisory broker.'}
                  </p>
                </div>
              </Card>

              {/* Upload Confidential Files / Teasers */}
              <Card>
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-white">
                    Virtual Data Room Uploads (Multer + Sharp)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload teaser sheets, product decks, or logo assets for this transaction.
                  </p>
                </div>
                <FileDropzone
                  dealId={selectedDeal.id}
                  type="products"
                  onUploadSuccess={() => {
                    // Refetch
                    dealApi.getDealById(selectedDeal.id).then((res) => {
                      if (res.data) setSelectedDeal(res.data);
                    });
                  }}
                />
              </Card>
            </>
          ) : (
            <Card className="text-center py-12 text-slate-500 text-xs">
              Select a deal on the left to review its executive memorandum.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
