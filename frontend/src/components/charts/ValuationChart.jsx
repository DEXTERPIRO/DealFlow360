import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { STAGES } from '../../utils/formatters';

export const ValuationChart = ({ deals = [] }) => {
  const data = STAGES.map((stg) => {
    const stageDeals = deals.filter((d) => d.stage === stg.id);
    const volume = stageDeals.reduce((acc, curr) => acc + (curr.dealValue || 0), 0) / 1e6;
    return {
      stage: stg.label.split(' ')[0],
      valuation: Number(volume.toFixed(2)),
    };
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="stage"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            unit="M"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f8fafc',
            }}
            formatter={(val) => [`$${val}M`, 'Pipeline Value']}
          />
          <Area
            type="monotone"
            dataKey="valuation"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#valGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
