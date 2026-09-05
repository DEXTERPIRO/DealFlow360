import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Kanban,
  CheckCircle,
  Package,
  RefreshCw,
  Receipt,
  ShoppingBag,
  Tag,
  Percent,
  Warehouse,
  Calendar,
  TrendingUp,
  Users,
  Menu,
  X,
  Search,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { notificationsAPI, quotationsAPI } from '../../api';
import api from '../../api/client';
import NotificationDropdown from '../ui/NotificationDropdown';

export default function AppLayout() {

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Sidebar states
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyName, setCompanyName] = useState('DealFlow360');

  // Fetch system config on mount
  useEffect(() => {
    api.get('/config').then((res) => {
      const name = res?.data?.company_name || res?.company_name;
      if (name) setCompanyName(name);
    }).catch(() => {});
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // User profile dropdown
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Real-time states
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [socket, setSocket] = useState(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial notifications and quotations
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const notifs = await notificationsAPI.getAll();
        if (Array.isArray(notifs)) {
          setNotifications(notifs);
        }
      } catch (err) {
        // fail silently or fallback
      }

      if (['SALES_MANAGER', 'FINANCE', 'ADMIN'].includes(user?.role)) {
        try {
          const quotes = await quotationsAPI.getAll();
          if (Array.isArray(quotes)) {
            const pending = quotes.filter((q) =>
              ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status)
            ).length;
            setPendingApprovalsCount(pending);
          }
        } catch (err) {
          // fallback
        }
      }
    };
    loadInitialData();
  }, [user]);

  // Socket.io connection & real-time events
  useEffect(() => {
    const s = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    setSocket(s);

    s.on('connect', () => {
      s.emit('join_dashboard');
      if (user?.id) {
        s.emit('join_workspace', user.id);
      }
    });

    s.on('approval-needed', (data) => {
      setPendingApprovalsCount((prev) => prev + 1);
      toast.success(
        `Approval Needed: Quotation ${data.quotationNumber || data.quotationId}`,
        { icon: '⚠️' }
      );
      setNotifications((prev) => [
        {
          id: Date.now().toString(),
          title: 'Approval Required',
          message: `Quotation ${data.quotationNumber || ''} is awaiting decision (${data.status}).`,
          is_read: false,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
    });

    s.on('quotation-created', (data) => {
      toast(`New quotation created: ${data.quotationNumber}`, { icon: '📄' });
    });

    s.on('negotiation-received', (data) => {
      toast(
        `Customer Negotiation: ${data.message || 'Counter discount requested'}`,
        { icon: '💬' }
      );
    });

    return () => {
      s.disconnect();
    };
  }, [user]);

  // Role Badge Helper
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'SALES_REP':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'SALES_MANAGER':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'FINANCE':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  // Nav Sections Definition
  const navSections = [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ALL'] },
      ],
    },
    {
      title: 'SALES WORKSPACE',
      items: [
        { name: 'Quotations', href: '/quotations', icon: FileText, roles: ['SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'] },
        { name: 'Pipeline', href: '/pipeline', icon: Kanban, roles: ['SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'] },
        {
          name: 'Approvals',
          href: '/approvals',
          icon: CheckCircle,
          roles: ['SALES_MANAGER', 'FINANCE', 'ADMIN'],
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null
        },
      ],
    },
    {
      title: 'FULFILLMENT & BILLING',
      items: [
        { name: 'Fulfillment', href: '/fulfillment', icon: Package, roles: ['FINANCE', 'ADMIN', 'SALES_MANAGER'] },
        { name: 'Subscriptions', href: '/subscriptions', icon: RefreshCw, roles: ['FINANCE', 'ADMIN', 'SALES_MANAGER'] },
        { name: 'Invoices', href: '/invoices', icon: Receipt, roles: ['FINANCE', 'ADMIN', 'SALES_MANAGER'] },
      ],
    },
    {
      title: 'CONFIGURATION',
      items: [
        { name: 'Products', href: '/products', icon: ShoppingBag, roles: ['ADMIN', 'SALES_MANAGER'] },
        { name: 'Price Lists', href: '/price-lists', icon: Tag, roles: ['ADMIN', 'SALES_MANAGER'] },
        { name: 'Discount Tiers', href: '/discount-tiers', icon: Percent, roles: ['ADMIN', 'SALES_MANAGER'] },
        { name: 'Warehouses', href: '/warehouses', icon: Warehouse, roles: ['ADMIN', 'SALES_MANAGER', 'FINANCE'] },
        { name: 'Subscription Plans', href: '/subscription-plans', icon: Calendar, roles: ['ADMIN', 'SALES_MANAGER'] },
        { name: 'Upsell Rules', href: '/upsell-rules', icon: TrendingUp, roles: ['ADMIN', 'SALES_MANAGER'] },
        { name: 'Users', href: '/users', icon: Users, roles: ['ADMIN'] },
      ],
    },
  ];

  // Handle Search Execution
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/quotations?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased">
      {/* ── Mobile Backdrop ────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ── Sidebar (Desktop Collapsible & Mobile Drawer) ────────────── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col justify-between bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Brand Header */}
        <div className="flex flex-col shrink-0">
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                <Layers className="w-5 h-5 text-white" />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-extrabold text-base tracking-tight text-white truncate">
                    {companyName === 'DealFlow360' ? (
                      <>DealFlow<span className="text-blue-500">360</span></>
                    ) : (
                      companyName
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                    CPQ Enterprise
                  </span>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Menus with Scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {navSections.map((section, sIdx) => {
            const filteredItems = section.items.filter((item) =>
              item.roles.includes('ALL') || (user && item.roles.includes(user.role))
            );
            if (filteredItems.length === 0) return null;

            return (
              <div key={sIdx} className="space-y-1">
                {!collapsed ? (
                  <h3 className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono mb-2">
                    {section.title}
                  </h3>
                ) : (
                  <div className="h-2" />
                )}

                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                        } ${collapsed ? 'justify-center px-2' : ''}`
                      }
                      title={collapsed ? item.name : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                      {!collapsed && <span className="truncate">{item.name}</span>}

                      {/* Approval or notification badge */}
                      {!collapsed && item.badge ? (
                        <span className="ml-auto inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                          {item.badge}
                        </span>
                      ) : null}

                      {collapsed && item.badge ? (
                        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500" />
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 shrink-0 space-y-2">
          {!collapsed ? (
            <div className="space-y-2 px-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">DealFlow360 Corp</span>
                <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  v1.0
                </span>
              </div>
              <a
                href="/portal/demo-portal-token-acme"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                <span>Go to Customer Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="flex justify-center">
              <a
                href="/portal/demo-portal-token-acme"
                target="_blank"
                rel="noreferrer"
                title="Customer Portal"
                className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Sidebar Sign Out button */}
          <button
            onClick={() => {
              logout();
              toast.success('Logged out successfully');
              navigate('/login');
            }}
            className={`w-full py-2 px-2.5 flex items-center gap-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 transition-all cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>

          {/* Desktop collapse toggle button */}
          <div className="hidden lg:flex justify-end pt-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full py-1.5 px-2 flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 text-xs font-medium transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {!collapsed && <span className="text-[11px]">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area with Top Navbar ───────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quotation Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative w-64 sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quotations by number or customer..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </form>
          </div>

          {/* Right Controls: Notifications & User Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] font-bold shadow-md shadow-rose-500/50">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
                setNotifications={setNotifications}
              />
            </div>


            {/* User Avatar with Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-800/80 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-slate-200 leading-tight">
                    {user?.name || 'Administrator'}
                  </div>
                  <span
                    className={`inline-block px-1.5 py-0.2 text-[9px] font-mono uppercase font-semibold rounded border ${getRoleBadgeStyle(
                      user?.role || 'SALES_REP'
                    )}`}
                  >
                    {user?.role || 'SALES_REP'}
                  </span>
                </div>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-700 mb-1">
                    <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                    <div className="mt-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-mono uppercase font-semibold rounded border ${getRoleBadgeStyle(
                          user?.role || 'SALES_REP'
                        )}`}
                      >
                        {user?.role}
                      </span>
                    </div>
                  </div>

                  {['ADMIN', 'SALES_MANAGER'].includes(user?.role) && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/products');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-700/60 transition-colors flex items-center gap-2"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                      Backend Configuration
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Quick Logout Button */}
            <button
              onClick={() => {
                logout();
                toast.success('Logged out successfully');
                navigate('/login');
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline text-slate-300 hover:text-rose-300">Logout</span>
            </button>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
