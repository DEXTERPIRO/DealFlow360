import React, { useEffect, useState } from 'react';
import { Server, CheckCircle2, AlertCircle, RefreshCw, Cpu, Database, Radio } from 'lucide-react';
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
    <div className="space-y-6 max-w-4xl pb-12">
      <div className="flex items-center justify-between bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pop-sky/30 border-2 border-slate-900 flex items-center justify-center text-slate-900 shadow-pop-sm">
              <Server className="w-5 h-5 stroke-[2.5]" />
            </div>
            Backend Infrastructure Health
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Real-time telemetry for Express.js, Prisma ORM, and Socket.io cluster.
          </p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="btn-candy bg-white hover:bg-slate-50 text-slate-900 flex items-center gap-2 px-4 py-2 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
          <span>Ping Service</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl border-2 border-slate-900 flex items-center justify-center shadow-pop-sm ${
              healthData ? 'bg-pop-mint text-slate-900' : 'bg-pop-pink text-slate-900'
            }`}
          >
            <Cpu className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Express REST</span>
            <div className="text-sm font-heading font-black text-slate-900">
              {healthData ? 'Online (200 OK)' : error ? 'Offline' : 'Connecting...'}
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl border-2 border-slate-900 flex items-center justify-center shadow-pop-sm ${
              isConnected ? 'bg-pop-mint text-slate-900' : 'bg-pop-pink text-slate-900'
            }`}
          >
            <Radio className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Socket.io Engine</span>
            <div className="text-sm font-heading font-black text-slate-900">
              {isConnected ? 'Real-Time Sync Active' : 'Disconnected'}
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-3xl p-5 shadow-pop flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-pop-sky border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
            <Database className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Prisma / Postgres</span>
            <div className="text-sm font-heading font-black text-slate-900">PostgreSQL Client</div>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-pop">
        <h3 className="text-sm font-heading font-black text-slate-900 mb-3 flex items-center gap-2">
          <span>Service Diagnostic Dump</span>
        </h3>
        {healthData ? (
          <pre className="p-4 rounded-2xl bg-paper border-2 border-slate-900 text-slate-900 font-mono text-xs overflow-x-auto shadow-inner">
            {JSON.stringify(healthData, null, 2)}
          </pre>
        ) : (
          <div className="p-4 rounded-2xl bg-paper border-2 border-slate-900 text-slate-500 text-xs font-medium">
            {error || 'No active connection response yet.'}
          </div>
        )}
      </div>
    </div>
  );
};

