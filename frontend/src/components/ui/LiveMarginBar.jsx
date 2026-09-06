import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, Layers } from 'lucide-react';

export default function LiveMarginBar({ lines = [], sidebarCollapsed = false }) {
  // ── Compute live metrics ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    let total = 0;
    let cost = 0;
    let totalDiscounts = 0;

    lines.forEach((line) => {
      const price = Number(line.price_override ?? line.unit_price ?? 0);
      const qty = Number(line.quantity || 1);
      const disc = Number(line.discount_pct || 0);
      const lineCost = Number(line.product?.cost_price ?? line.cost_price ?? 0);

      const discountedPrice = price * (1 - disc / 100);
      const lineTotal = discountedPrice * qty;

      total += lineTotal;
      cost += lineCost * qty;
      totalDiscounts += disc;
    });

    const margin = total > 0 ? ((total - cost) / total) * 100 : 0;
    const avgDiscount = lines.length ? totalDiscounts / lines.length : 0;

    // Simple CPQ Risk Score:
    const discountRisk = Math.min((avgDiscount / 30) * 10, 10);
    const marginRisk = margin < 15 ? 5 : margin < 25 ? 3 : 0;
    const riskScore = Math.min(+(discountRisk + marginRisk).toFixed(1), 15);

    // "What if" delta to next approval tier
    let discountToNextTier = null;
    if (avgDiscount < 5) {
      discountToNextTier = { threshold: 5, label: 'Manager Approval', remaining: +(5 - avgDiscount).toFixed(1) };
    } else if (avgDiscount < 10) {
      discountToNextTier = { threshold: 10, label: 'Finance Approval', remaining: +(10 - avgDiscount).toFixed(1) };
    }

    return { total, margin, riskScore, discountToNextTier };
  }, [lines]);

  const { total, margin, riskScore, discountToNextTier } = metrics;

  // ── Color & Badge helpers ─────────────────────────────────────────────────
  const isHighMargin = margin >= 30;
  const isMedMargin = margin >= 15;
  const marginColor = isHighMargin ? '#10b981' : isMedMargin ? '#f59e0b' : '#f43f5e';

  const riskStatus = riskScore < 5 ? 'low' : riskScore < 10 ? 'medium' : 'high';

  const approvalConfig = {
    low: {
      label: 'Auto-Approved',
      icon: CheckCircle2,
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-900',
      iconColor: 'text-emerald-700',
    },
    medium: {
      label: 'Needs Manager Review',
      icon: AlertTriangle,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-900',
      iconColor: 'text-amber-700',
    },
    high: {
      label: 'Needs Manager + Finance',
      icon: ShieldAlert,
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-900',
      iconColor: 'text-rose-700',
    },
  }[riskStatus];

  const ApprovalIcon = approvalConfig.icon;

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveLeft = isMobile ? 0 : (sidebarCollapsed ? 80 : 256);

  if (!lines.length) return null;

  return (
    <aside
      aria-label="Live quotation margin and risk metrics"
      style={{ left: effectiveLeft }}
      className="fixed bottom-0 right-0 z-40 bg-white border-t-2 border-slate-900 px-3 sm:px-6 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-6 shadow-[0_-4px_16px_rgba(30,41,59,0.08)] transition-[left] duration-300 min-h-[56px] sm:min-h-[64px] overflow-x-auto scrollbar-thin"
    >
      {/* ── TOTAL ─────────────────────────────────── */}
      <div className="shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading">
          Live Total
        </div>
        <div className="text-xl font-extrabold text-slate-900 font-mono tracking-tight leading-none mt-0.5">
          ₹{Math.round(total).toLocaleString('en-IN')}
        </div>
        <div className="text-[10px] font-semibold text-slate-400 font-mono mt-0.5">
          incl. estimated tax
        </div>
      </div>

      {/* Divider */}
      <div className="w-[2px] h-9 bg-slate-200 shrink-0" />

      {/* ── MARGIN BAR ────────────────────────────── */}
      <div className="flex-1 min-w-[140px] max-w-xs">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading">
            Gross Margin
          </span>
          <span
            className="text-xs font-extrabold font-mono px-2 py-0.5 rounded-md border-2 border-slate-900 shadow-pop-sm"
            style={{ backgroundColor: marginColor, color: '#ffffff' }}
          >
            {Number(margin || 0).toFixed(1)}%
          </span>
        </div>
        {/* Chunky Bar */}
        <div className="h-3 w-full bg-slate-100 rounded-full border-2 border-slate-900 overflow-hidden relative">
          {/* 30% Target indicator */}
          <div
            className="absolute left-[30%] top-0 bottom-0 w-[2px] bg-slate-900 z-10 opacity-40"
            title="30% Healthy Margin Target"
          />
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(Math.min(margin, 100), 0)}%`,
              backgroundColor: marginColor,
            }}
          />
        </div>
        {/* Scale labels */}
        <div className="flex justify-between mt-1 text-[9px] font-bold font-mono text-slate-400">
          <span>0%</span>
          <span className="text-rose-600">15%</span>
          <span className="text-amber-600">30%</span>
          <span className="text-emerald-600">50%+</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-[2px] h-9 bg-slate-200 shrink-0" />

      {/* ── RISK SCORE ────────────────────────────── */}
      <div className="shrink-0 text-center">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading mb-1">
          Risk Index
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border-2 border-slate-900 font-mono font-bold text-xs shadow-pop-sm bg-slate-50 text-slate-900">
          <span
            className="w-2 h-2 rounded-full border border-slate-900 shrink-0"
            style={{ backgroundColor: marginColor }}
          />
          <span>{Number(riskScore || 0).toFixed(1)} / 15</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-[2px] h-9 bg-slate-200 shrink-0" />

      {/* ── APPROVAL PATH ────────────────────────── */}
      <div className="shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading mb-1">
          Approval Path
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border-2 font-heading font-extrabold text-xs shadow-pop-sm ${approvalConfig.badgeClass}`}>
          <ApprovalIcon size={14} className={approvalConfig.iconColor} strokeWidth={2.5} />
          <span>{approvalConfig.label}</span>
        </div>
        {discountToNextTier && (
          <div className="text-[10px] font-medium text-slate-500 mt-1 flex items-center gap-1">
            <span>+</span>
            <span className="text-amber-700 font-bold font-mono">{discountToNextTier.remaining}%</span>
            <span>avg disc → triggers</span>
            <span className="text-slate-900 font-bold">{discountToNextTier.label}</span>
          </div>
        )}
      </div>

      {/* ── LINE ITEMS COUNT (Right) ─────────────── */}
      <div className="ml-auto shrink-0 text-right">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading">
          Line Items
        </div>
        <div className="inline-flex items-center gap-1.5 mt-0.5">
          <Layers size={14} className="text-slate-500" strokeWidth={2.5} />
          <span className="text-lg font-extrabold text-slate-900 font-mono">
            {lines.length}
          </span>
        </div>
      </div>
    </aside>
  );
}
