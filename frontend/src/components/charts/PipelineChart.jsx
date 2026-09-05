import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { STAGES } from '../../utils/formatters';

const STAGE_COLORS = {
  LEAD: '#64748b',
  QUALIFICATION: '#3b82f6',
  DUE_DILIGENCE: '#f59e0b',
  NEGOTIATION: '#a855f7',
  CLOSED_WON: '#10b981',
  CLOSED_LOST: '#ef4444',
};

export const PipelineChart = ({ deals = [] }) => {
  const data = STAGES.map((stg) => {
    const stageDeals = deals.filter((d) => d.stage === stg.id);
    return {
      stage: stg.label,
      stageId: stg.id,
      count: stageDeals.length,
      value: stageDeals.reduce((acc, curr) => acc + (curr.dealValue || 0), 0) / 1e6, // In Millions
    };
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f8fafc',
            }}
            formatter={(val, name) => [
              name === 'count' ? `${val} Deals` : `$${val.toFixed(1)}M`,
              name === 'count' ? 'Count' : 'Volume',
            ]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={`cell-${entry.stageId}`} fill={STAGE_COLORS[entry.stageId] || '#3b82f6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
