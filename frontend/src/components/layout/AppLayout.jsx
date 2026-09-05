import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { NewDealModal } from '../forms/NewDealModal';
import { useSocket } from '../../hooks/useSocket';

export const AppLayout = () => {
  const { isConnected } = useSocket();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar isConnected={isConnected} />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>

      {/* Global New Deal Creation Modal */}
      <NewDealModal />
    </div>
  );
};
