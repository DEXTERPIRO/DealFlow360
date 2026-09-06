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
  ExternalLink,
  Plus,
  Sparkles,
  Activity,
  BarChart3,
  Clock,
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

  // Live real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Socket.io connection & real-time events (No unicode emojis)
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
        `Approval Needed: Quotation ${data.quotationNumber || data.quotationId}`
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
      toast.success(`New quotation created: ${data.quotationNumber}`);
    });

    s.on('negotiation-received', (data) => {
      toast(`Customer Negotiation: ${data.message || 'Counter discount requested'}`);
    });

    return () => {
      s.disconnect();
    };
  }, [user]);

  // Role Badge Helper
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-rose-400 text-white';
      case 'SALES_REP':
        return 'bg-pop-sky text-slate-900';
      case 'SALES_MANAGER':
        return 'bg-pop-violet text-white';
      case 'FINANCE':
        return 'bg-pop-mint text-slate-900';
      default:
        return 'bg-slate-200 text-slate-900';
    }
  };

  // Nav Sections Definition
  const navSections = [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ALL'] },
        { name: 'Deal Health', href: '/deal-health', icon: Activity, roles: ['ALL'] },
        { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP'] },
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#FFFDF5] text-slate-900 antialiased font-sans">
      {/* ── Mobile Backdrop ────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* ── Sidebar (Desktop Collapsible & Mobile Drawer) ────────────── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col justify-between bg-[#FFFDF5] border-r-2 border-slate-900 transition-all duration-250 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          mobileOpen ? 'translate-x-0 w-68 shadow-pop-xl' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-22' : 'lg:w-68'}`}
      >
        {/* Brand Header */}
        <div className="flex flex-col shrink-0">
          <div className="h-16 px-4 flex items-center justify-between border-b-2 border-slate-900 bg-white">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-pop-violet border-2 border-slate-900 shadow-pop-sm flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-heading font-black text-lg tracking-tight text-slate-900 truncate">
                    {companyName === 'DealFlow360' ? (
                      <>DealFlow<span className="text-pop-violet">360</span></>
                    ) : (
                      companyName
                    )}
                  </span>
                  <span className="text-[10px] font-heading font-bold text-slate-600 tracking-wider uppercase">
                    Enterprise Dealflow
                  </span>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white hover:bg-rose-100 text-slate-900 flex items-center justify-center shadow-pop-sm lg:hidden"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Navigation Menus with Scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section, sIdx) => {
            const filteredItems = section.items.filter((item) =>
              item.roles.includes('ALL') || (user && item.roles.includes(user.role))
            );
            if (filteredItems.length === 0) return null;

            return (
              <div key={sIdx} className="space-y-1">
                {!collapsed ? (
                  <h3 className="px-3 text-[10px] font-heading font-black tracking-widest text-slate-600 uppercase mb-2">
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
                        `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-heading font-bold transition-all border-2 ${
                          isActive
                            ? 'bg-pop-violet text-white border-slate-900 shadow-pop-sm'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-pop-yellow hover:border-slate-900 border-transparent hover:shadow-pop-sm hover:-translate-y-0.5'
                        } ${collapsed ? 'justify-center px-2' : ''}`
                      }
                      title={collapsed ? item.name : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" strokeWidth={2.5} />
                      {!collapsed && <span className="truncate">{item.name}</span>}

                      {/* Approval or notification badge */}
                      {!collapsed && item.badge ? (
                        <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-heading font-black rounded-full bg-rose-500 text-white border-2 border-slate-900 shadow-pop-sm animate-bounce">
                          {item.badge}
                        </span>
                      ) : null}

                      {collapsed && item.badge ? (
                        <span className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-900" />
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t-2 border-slate-900 bg-white shrink-0 space-y-2.5">
          {!collapsed ? (
            <div className="space-y-2 px-1">
              <div className="flex items-center text-xs font-heading font-black text-slate-800">
                <span>DealFlow360</span>
              </div>
              <a
                href="/portal/demo-portal-token-acme"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded-xl bg-[#FFFDF5] hover:bg-pop-yellow/60 border-2 border-slate-900 text-xs font-heading font-bold text-slate-900 shadow-pop-sm hover:-translate-y-0.5 transition-all"
              >
                <span>Client Portal</span>
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </a>
            </div>
          ) : (
            <div className="flex justify-center">
              <a
                href="/portal/demo-portal-token-acme"
                target="_blank"
                rel="noreferrer"
                title="Client Portal"
                className="w-10 h-10 rounded-xl border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 shadow-pop-sm flex items-center justify-center transition-all"
              >
                <ExternalLink className="w-4 h-4" strokeWidth={2.5} />
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
            className={`w-full py-2 px-3 flex items-center gap-2 rounded-xl text-xs font-heading font-bold text-rose-700 hover:text-white bg-rose-100 hover:bg-rose-500 border-2 border-slate-900 shadow-pop-sm hover:-translate-y-0.5 transition-all cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            {!collapsed && <span>Sign Out</span>}
          </button>

          {/* Desktop collapse toggle button */}
          <div className="hidden lg:flex justify-end pt-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full py-1.5 px-2 flex items-center justify-center gap-2 rounded-xl bg-[#FFFDF5] hover:bg-slate-100 border-2 border-slate-900 text-slate-700 text-xs font-heading font-bold shadow-pop-sm hover:-translate-y-0.5 transition-all cursor-pointer"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" strokeWidth={2.5} /> : <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />}
              {!collapsed && <span className="text-[11px]">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area with Top Navbar ───────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b-2 border-slate-900 bg-white px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 shrink-0 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="w-10 h-10 rounded-xl border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 flex items-center justify-center shadow-pop-sm lg:hidden cursor-pointer shrink-0"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" strokeWidth={2.5} />
            </button>

            {/* Quotation Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative w-44 sm:w-64 md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" strokeWidth={2.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quotes..."
                className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-full pl-9 pr-3 py-1.5 sm:pl-10 sm:pr-4 sm:py-2 text-xs font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:shadow-pop transition-all truncate"
              />
            </form>
          </div>

          {/* Center & Right Controls: Engine Status, New Quote Button, Notifications & User Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Animated CPQ Engine Status Widget */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full border-2 border-slate-900 bg-[#FFFDF5] shadow-pop-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600 border border-slate-900"></span>
              </span>
              <span className="text-[10px] font-mono font-black text-slate-800 tracking-wide uppercase">
                CPQ Live
              </span>
            </div>

            {/* Real-time Date and Live Clock Widget */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-slate-900 bg-white shadow-pop-xs">
              <Clock className="w-3.5 h-3.5 text-violet-700 animate-spin" style={{ animationDuration: '10s' }} />
              <span className="text-xs font-heading font-extrabold text-slate-800 tracking-tight">
                {currentTime.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span className="text-xs font-mono font-black text-violet-800 px-2 py-0.5 bg-violet-100 border border-slate-900 rounded-full shadow-pop-xs">
                {currentTime.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>



            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-full border-2 border-slate-900 bg-white hover:bg-pop-yellow text-slate-900 shadow-pop-sm flex items-center justify-center transition-all active:translate-y-0.5 cursor-pointer relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" strokeWidth={2.5} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-rose-500 text-white rounded-full text-[10px] font-heading font-black border-2 border-slate-900 shadow-pop-sm">
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
                className="flex items-center gap-2.5 p-1 rounded-full border-2 border-slate-900 bg-[#FFFDF5] shadow-pop-sm hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-pop-pink text-white font-heading font-black text-xs flex items-center justify-center border border-slate-900">
                  {user?.name ? user.name[0].toUpperCase() : 'A'}
                </div>
                <div className="text-left hidden md:block pr-2">
                  <div className="text-xs font-heading font-extrabold text-slate-900 leading-tight">
                    {user?.name || 'Admin User'}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.2 text-[9px] font-heading uppercase font-bold rounded-full border border-slate-900 ${getRoleBadgeStyle(
                      user?.role || 'ADMIN'
                    )}`}
                  >
                    {user?.role || 'ADMIN'}
                  </span>
                </div>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-lg p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b-2 border-slate-900 mb-1 bg-white rounded-xl">
                    <p className="text-xs font-heading font-extrabold text-slate-900 truncate">{user?.name || 'Administrator'}</p>
                    <p className="text-[11px] text-slate-600 font-mono truncate">{user?.email || 'admin@dealflow.com'}</p>
                    <div className="mt-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-[9px] font-heading uppercase font-bold rounded-full border border-slate-900 ${getRoleBadgeStyle(
                          user?.role || 'ADMIN'
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
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-heading font-bold text-slate-900 hover:bg-pop-yellow transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-pop-violet" strokeWidth={2.5} />
                      Master Configuration
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-heading font-bold text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Main Outlet Area with Dot Grid Canvas ──────────────────── */}
        <main className="flex-1 overflow-y-auto bg-dot-grid bg-[#FFFDF5] p-4 sm:p-6 lg:p-8 text-slate-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
