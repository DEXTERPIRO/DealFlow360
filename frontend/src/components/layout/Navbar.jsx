import React from 'react';
import { Bell, Search, Activity, User, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useDealStore } from '../../store/dealStore';

export const Navbar = ({ isConnected }) => {
  const { user, logout } = useAuthStore();
  const { searchTerm, setSearchTerm } = useDealStore();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Global Search */}
      <div className="relative w-80">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search deals, companies, industries..."
          className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Real-time socket indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}
          title={isConnected ? 'Live Socket Connected' : 'Socket Disconnected'}
        >
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
          />
          <span className="hidden sm:inline">{isConnected ? 'Live Sync' : 'Offline'}</span>
        </div>

        {/* User Info & Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white">
              {user ? `${user.firstName} ${user.lastName}` : 'Elena Vance'}
            </div>
            <div className="text-[10px] text-brand-400 font-mono uppercase">
              {user?.role || 'Admin'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 text-brand-300 flex items-center justify-center font-bold text-xs">
            {user?.firstName?.[0] || 'E'}
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
