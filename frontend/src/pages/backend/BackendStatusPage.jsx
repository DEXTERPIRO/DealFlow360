import React, { useEffect, useState } from 'react';
import { Server, CheckCircle2, AlertCircle, RefreshCw, Cpu, Database, Radio } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useSocket } from '../../hooks/useSocket';
import api from '../../api/axiosClient';

export const BackendStatusPage = () => {
  const { isConnected } = useSocket();
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/health');
      setHealthData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to ping backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-brand-400" />
            Backend Infrastructure Health
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry for Express.js, Prisma ORM, and Socket.io cluster.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={checkHealth} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Ping Service
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              healthData ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Express REST</span>
            <div className="text-sm font-bold text-white">
              {healthData ? 'Online (200 OK)' : error ? 'Offline' : 'Connecting...'}
            </div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Socket.io Engine</span>
            <div className="text-sm font-bold text-white">
              {isConnected ? 'Real-Time Sync Active' : 'Disconnected'}
            </div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Prisma / Postgres</span>
            <div className="text-sm font-bold text-white">PostgreSQL Client</div>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-bold text-white mb-3">Service Diagnostic Dump</h3>
        {healthData ? (
          <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-brand-300 font-mono text-xs overflow-x-auto">
            {JSON.stringify(healthData, null, 2)}
          </pre>
        ) : (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 text-xs">
            {error || 'No active connection response yet.'}
          </div>
        )}
      </Card>
    </div>
  );
};
