import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users as UsersIcon,
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Eye,
  Search,
  RefreshCw,
  Mail,
  Building,
  Lock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Send,
  AlertCircle,
  FileText
} from 'lucide-react';
import { usersAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Add User State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SALES_REP',
    company_name: '',
    customer_tier: 'BRONZE',
    send_welcome_email: true,
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);

  // Fetch all users
  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await usersAPI.getAll();
      setUsers(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Role Badge Styling
  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return {
          bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          label: 'Admin',
        };
      case 'SALES_REP':
        return {
          bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          label: 'Sales Rep',
        };
      case 'SALES_MANAGER':
        return {
          bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          label: 'Sales Manager',
        };
      case 'FINANCE':
        return {
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          label: 'Finance',
        };
      case 'CUSTOMER':
        return {
          bg: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
          label: 'Customer',
        };
      default:
        return {
          bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
          label: role || 'Unknown',
        };
    }
  };

  // Tier Badge Styling
  const getTierBadge = (tier) => {
    const t = (tier || 'BRONZE').toUpperCase();
    if (t === 'GOLD') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (t === 'SILVER') return 'bg-slate-300/20 text-slate-200 border-slate-300/40';
    return 'bg-orange-600/20 text-orange-300 border-orange-500/40';
  };

  // Toggle Active/Inactive
  const handleToggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot change your own account's active status");
      return;
    }

    try {
      await usersAPI.toggleStatus(user.id);
      toast.success(
        `User ${user.name} is now ${user.is_active ? 'deactivated' : 'activated'}`
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to toggle user status');
    }
  };

  // Submit Add User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (addForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSubmittingAdd(true);
    try {
      await usersAPI.create(addForm);
      toast.success(`User ${addForm.name} created successfully!`, { icon: '🎉' });
      setShowAddModal(false);
      setAddForm({
        name: '',
        email: '',
        password: '',
        role: 'SALES_REP',
        company_name: '',
        customer_tier: 'BRONZE',
        send_welcome_email: true,
      });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Submit Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (newPassword && newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSubmittingReset(true);
    try {
      const res = await usersAPI.resetPassword(resetModalUser.id, {
        new_password: newPassword || 'DealFlow360@Pass123',
      });
      toast.success(
        `Password reset for ${resetModalUser.name}. Temp password: ${
          res?.temporary_password || newPassword || 'DealFlow360@Pass123'
        }`,
        { duration: 6000 }
      );
      setResetModalUser(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setSubmittingReset(false);
    }
  };

  // Copy Portal Link
  const copyPortalLink = (user) => {
    // Generate portal url or magic link
    const token = user.magic_link_token || user.id;
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Customer Portal URL copied to clipboard!', { icon: '🔗' });
  };

  // Internal Users vs Customer Users
  const internalUsers = useMemo(() => {
    return users.filter((u) => u.role !== 'CUSTOMER');
  }, [users]);

  const customerUsers = useMemo(() => {
    return users.filter((u) => u.role === 'CUSTOMER');
  }, [users]);

  // Filtered internal users
  const filteredInternalUsers = useMemo(() => {
    return internalUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = u.name?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        return nameMatch || emailMatch;
      }
      return true;
    });
  }, [internalUsers, roleFilter, searchQuery]);

  return (
    <div className="space-y-8 pb-12">
      {/* ── HEADER & ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <UsersIcon className="w-6 h-6 text-blue-400" />
            User Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage enterprise team members, roles, governance access, and customer portal accounts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New User</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: INTERNAL USERS TABLE ─────────────────────────── */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members by name or email..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Internal Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="SALES_MANAGER">Sales Manager</option>
              <option value="SALES_REP">Sales Rep</option>
              <option value="FINANCE">Finance</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Role</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading users...
                    </td>
                  </tr>
                ) : filteredInternalUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-400">
                      No internal team members found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredInternalUsers.map((u) => {
                    const roleBadge = getRoleBadge(u.role);
                    const isSelf = u.id === currentUser?.id;

                    return (
                      <tr
                        key={u.id}
                        className="group hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-200">
                                {u.name}
                              </span>
                              {isSelf && (
                                <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {u.email}
                        </td>

                        {/* Role Badge */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${roleBadge.bg}`}
                          >
                            {roleBadge.label}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              u.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-500/10 text-slate-500 border-slate-500/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString()
                            : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View their quotations */}
                            <button
                              onClick={() =>
                                navigate(
                                  `/quotations?search=${encodeURIComponent(u.name)}`
                                )
                              }
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="View user's quotations"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setResetModalUser(u);
                                setNewPassword('');
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition-colors"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Toggle Active/Inactive */}
                            {!isSelf ? (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  u.is_active
                                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                }`}
                                title={
                                  u.is_active
                                    ? 'Deactivate User'
                                    : 'Activate User'
                                }
                              >
                                {u.is_active ? (
                                  <ToggleRight className="w-4 h-4" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <div className="w-7" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: CUSTOMER SECTION (SEPARATE BELOW) ────────────── */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" />
            Customer Portal Accounts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            External customers with dedicated portal access for quote review, interactive negotiation, and deal confirmation
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4 text-center">Tier</th>
                  <th className="py-3 px-4">Contact Email</th>
                  <th className="py-3 px-4 text-center">Linked Quotations</th>
                  <th className="py-3 px-4 text-right">Portal Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customerUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No customer users found. Create customer accounts using the "+ Add New User" button above.
                    </td>
                  </tr>
                ) : (
                  customerUsers.map((c) => {
                    const tier = c.customer_tier || 'BRONZE';
                    const compName = c.company_name || c.name || 'Enterprise Client';
                    const token = c.magic_link_token || c.id;

                    return (
                      <tr
                        key={c.id}
                        className="group hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Company Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200 flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              {compName}
                            </span>
                            <span className="text-[11px] text-slate-400 pl-5">
                              Contact: {c.name}
                            </span>
                          </div>
                        </td>

                        {/* Tier Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${getTierBadge(
                              tier
                            )}`}
                          >
                            {tier}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                          {c.email}
                        </td>

                        {/* Linked Quotations Count */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950 font-mono text-xs font-bold text-blue-400 border border-slate-800">
                            {c.quotations_count || 0} Quotes
                          </span>
                        </td>

                        {/* Portal Access Link & Copy Button */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => copyPortalLink(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              title="Copy Customer Portal Link"
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                              <span>Copy Link</span>
                            </button>

                            <a
                              href={`/portal/${token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 transition-colors"
                              title="Open Portal in New Tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ADD USER MODAL ──────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Add New User
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, name: e.target.value })
                  }
                  placeholder="e.g. Alex Mercer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, email: e.target.value })
                  }
                  placeholder="e.g. alex@dealflow.io"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  value={addForm.password}
                  onChange={(e) =>
                    setAddForm({ ...addForm, password: e.target.value })
                  }
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Role Selector *
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) =>
                    setAddForm({ ...addForm, role: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="SALES_REP">Sales Rep (Blue)</option>
                  <option value="SALES_MANAGER">Sales Manager (Purple)</option>
                  <option value="FINANCE">Finance (Green)</option>
                  <option value="ADMIN">Admin (Rose/Red)</option>
                  <option value="CUSTOMER">Customer (Gray)</option>
                </select>
              </div>

              {addForm.role === 'CUSTOMER' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={addForm.company_name}
                      onChange={(e) =>
                        setAddForm({ ...addForm, company_name: e.target.value })
                      }
                      placeholder="e.g. Acme Corp"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Tier
                    </label>
                    <select
                      value={addForm.customer_tier}
                      onChange={(e) =>
                        setAddForm({ ...addForm, customer_tier: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="BRONZE">Bronze (Standard)</option>
                      <option value="SILVER">Silver (Preferred)</option>
                      <option value="GOLD">Gold (VIP)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Welcome Email Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Send Welcome Email
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Deliver account credentials and getting started guide
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={addForm.send_welcome_email}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      send_welcome_email: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 focus:outline-none bg-slate-950 border-slate-800 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {submittingAdd ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ────────────────────────────────────── */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Reset Password
              </h3>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Reset login credentials for{' '}
              <span className="font-bold text-white">{resetModalUser.name}</span> (
              {resetModalUser.email}).
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  New Password (Optional, leave blank for default)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="DealFlow360@Pass123"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/20 disabled:opacity-50"
                >
                  {submittingReset ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
