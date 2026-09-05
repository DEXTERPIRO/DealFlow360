import React, { useMemo, useEffect, useRef } from 'react';

/**
 * LiveMarginBar — Fixed bottom sticky bar for QuotationBuilder.
 *
 * Props:
 *   lines       – array of order line objects: { unit_price, cost_price, quantity, discount, tax }
 *   sidebarCollapsed – boolean: whether the left sidebar is collapsed (affects left offset)
 *
 * Computes in real-time:
 *   • Total value (₹)
 *   • Gross Margin %
 *   • Blended Risk Score (0–15)
 *   • Approval path hint
 *   • "X% more discount to trigger next approval tier"
 */
export default function LiveMarginBar({ lines = [], sidebarCollapsed = false }) {
  const prevTotalRef = useRef(0);

  // ── Compute Metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!lines.length) {
      return { total: 0, margin: 0, riskScore: 0, discountToNextTier: null };
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let weightedRisk = 0;
    let totalWeight = 0;

    for (const line of lines) {
      const qty = Number(line.quantity || 1);
      const unitPrice = Number(line.unit_price ?? line.unitPrice ?? 0);
      const costPrice = Number(line.cost_price ?? line.costPrice ?? 0);
      const discount = Number(line.discount || 0);
      const tax = Number(line.tax ?? 18);

      const effectivePrice = unitPrice * (1 - discount / 100);
      const lineRevenue = effectivePrice * qty;
      const lineCost = costPrice * qty;
      const lineTotal = lineRevenue * (1 + tax / 100);

      // Risk score per line: weighted by discount
      const lineRisk = Math.min((discount / 20) * 10 + (discount > 15 ? 5 : 0), 15);

      totalRevenue += lineRevenue;
      totalCost += lineCost;
      weightedRisk += lineRisk * lineRevenue;
      totalWeight += lineRevenue;
    }

    const total = lines.reduce((sum, line) => {
      const qty = Number(line.quantity || 1);
      const unitPrice = Number(line.unit_price ?? line.unitPrice ?? 0);
      const discount = Number(line.discount || 0);
      const tax = Number(line.tax ?? 18);
      const effectivePrice = unitPrice * (1 - discount / 100);
      return sum + effectivePrice * qty * (1 + tax / 100);
    }, 0);

    const gross = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (gross / totalRevenue) * 100 : 0;
    const riskScore = totalWeight > 0 ? weightedRisk / totalWeight : 0;

    // Discount tiers:  0-5% → auto, 5-10% → Manager, 10%+ → Manager+Finance
    const avgDiscount =
      lines.reduce((a, l) => a + Number(l.discount || 0), 0) / lines.length;

    let discountToNextTier = null;
    if (avgDiscount < 5) {
      discountToNextTier = { threshold: 5, label: 'Manager Approval', remaining: +(5 - avgDiscount).toFixed(1) };
    } else if (avgDiscount < 10) {
      discountToNextTier = { threshold: 10, label: 'Finance Approval', remaining: +(10 - avgDiscount).toFixed(1) };
    }

    return { total, margin, riskScore, discountToNextTier };
  }, [lines]);

  const { total, margin, riskScore, discountToNextTier } = metrics;

  // ── Color helpers ─────────────────────────────────────────────────────────
  const marginColor =
    margin >= 30 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444';
  const riskColor =
    riskScore < 5 ? '#10b981' : riskScore < 10 ? '#f59e0b' : '#ef4444';

  const approvalLabel =
    riskScore < 5
      ? '✅ Auto-Approved'
      : riskScore < 10
      ? '⚠️ Needs Manager Review'
      : '🔴 Needs Manager + Finance';

  const approvalColor =
    riskScore < 5 ? '#10b981' : riskScore < 10 ? '#f59e0b' : '#ef4444';

  const sidebarWidth = sidebarCollapsed ? 80 : 256;

  if (!lines.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: sidebarWidth,
        right: 0,
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderTop: '1px solid #334155',
        padding: '10px 24px',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '28px',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        transition: 'left 300ms ease',
        minHeight: 68,
      }}
    >
      {/* ── TOTAL ─────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 2 }}
        >
          LIVE TOTAL
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
            fontFamily: 'monospace',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          ₹{Math.round(total).toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>
          incl. tax
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 44, background: '#334155', flexShrink: 0 }} />

      {/* ── MARGIN BAR ────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 120, maxWidth: 260 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}
        >
          <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            GROSS MARGIN
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: marginColor,
              fontFamily: 'monospace',
              transition: 'color 300ms',
            }}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
        {/* Bar */}
        <div
          style={{
            height: 6,
            background: '#1e3a5f',
            borderRadius: 9999,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* 30% threshold line */}
          <div
            style={{
              position: 'absolute',
              left: '30%',
              top: 0,
              bottom: 0,
              width: 1,
              background: '#334155',
              zIndex: 2,
            }}
          />
          <div
            style={{
              height: '100%',
              borderRadius: 9999,
              width: `${Math.max(Math.min(margin, 100), 0)}%`,
              background: `linear-gradient(90deg, ${marginColor}80, ${marginColor})`,
              transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), background 300ms',
              boxShadow: `0 0 8px ${marginColor}40`,
            }}
          />
        </div>
        {/* Scale labels */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 8, color: '#475569' }}
        >
          <span>0%</span>
          <span style={{ color: '#ef4444' }}>15%</span>
          <span style={{ color: '#f59e0b' }}>30%</span>
          <span style={{ color: '#10b981' }}>50%+</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 44, background: '#334155', flexShrink: 0 }} />

      {/* ── RISK LED ─────────────────────────────── */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div
          style={{
            fontSize: 9,
            color: '#64748b',
            fontFamily: 'monospace',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}
        >
          RISK SCORE
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            margin: '0 auto',
            background: riskColor,
            boxShadow: `0 0 16px ${riskColor}, 0 0 4px ${riskColor}`,
            transition: 'background 300ms, box-shadow 300ms',
            animation: riskScore > 10 ? 'ledpulse 1s infinite' : 'none',
            position: 'relative',
          }}
        />
        <div
          style={{
            fontSize: 10,
            color: '#94a3b8',
            fontFamily: 'monospace',
            marginTop: 3,
            fontWeight: 700,
          }}
        >
          {riskScore.toFixed(1)} / 15
        </div>
        <style>{`
          @keyframes ledpulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 16px #ef4444, 0 0 4px #ef4444; }
            50% { opacity: 0.6; box-shadow: 0 0 8px #ef4444; }
          }
        `}</style>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 44, background: '#334155', flexShrink: 0 }} />

      {/* ── APPROVAL PATH ────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 4 }}
        >
          APPROVAL PATH
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: approvalColor }}>
          {approvalLabel}
        </div>
        {discountToNextTier && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
            ↑ Add{' '}
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>
              {discountToNextTier.remaining}%
            </span>{' '}
            avg discount → triggers{' '}
            <span style={{ color: '#e2e8f0' }}>{discountToNextTier.label}</span>
          </div>
        )}
      </div>

      {/* ── LINES COUNT (right-most) ─────────────── */}
      <div
        style={{
          marginLeft: 'auto',
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        <div
          style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 2 }}
        >
          LINE ITEMS
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#475569', fontFamily: 'monospace' }}>
          {lines.length}
        </div>
      </div>
    </div>
  );
}
