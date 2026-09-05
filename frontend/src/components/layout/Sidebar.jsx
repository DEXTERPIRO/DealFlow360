import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  KanbanSquare,
  Globe2,
  Server,
  PlusCircle,
  Briefcase,
  Layers,
} from 'lucide-react';
import { useDealStore } from '../../store/dealStore';

export const Sidebar = () => {
  const setIsNewDealModalOpen = useDealStore((state) => state.setIsNewDealModalOpen);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Deal Workspace', href: '/workspace', icon: KanbanSquare },
    { name: 'Client Portal', href: '/portal', icon: Globe2 },
    { name: 'Backend Health', href: '/backend', icon: Server },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center shadow-md shadow-brand-600/30">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1">
              DealFlow<span className="text-brand-500">360</span>
            </span>
            <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-mono">
              Enterprise M&A
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4">
          <button
            onClick={() => setIsNewDealModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/25 transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            New Deal Mandate
          </button>
        </div>

        {/* Navigation items */}
        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/40">
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300 mb-1">
            <Briefcase className="w-3.5 h-3.5 text-brand-400" />
            Active Workspace
          </div>
          <p className="truncate text-slate-400">Global M&A Advisory</p>
        </div>
      </div>
    </aside>
  );
};
