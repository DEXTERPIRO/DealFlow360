import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users as UsersIcon,
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle2,
  Copy,
  ExternalLink,
  Search,
  RefreshCw,
  Mail,
  Building,
  Edit3,
  ShieldCheck,
  X,
  ToggleLeft,
  ToggleRight,
  FileText,
} from 'lucide-react';
import { usersAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';
import Portal from '../../components/ui/Portal';

export default function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Pagination
  const [internalPage, setInternalPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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

  // Edit Role Modal State
  const [editRoleUser, setEditRoleUser] = useState(null);
  const [editRoleForm, setEditRoleForm] = useState({
    role: 'SALES_REP',
    customer_tier: 'BRONZE',
    company_name: '',
  });
  const [submittingRoleEdit, setSubmittingRoleEdit] = useState(false);

  const openEditRoleModal = (user) => {
    setEditRoleUser(user);
    setEditRoleForm({
      role: user.role || 'SALES_REP',
      customer_tier: user.customer_tier || 'BRONZE',
      company_name: user.company_name || '',
    });
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editRoleUser) return;
    try {
      setSubmittingRoleEdit(true);
      await usersAPI.updateRole(editRoleUser.id, {
        role: editRoleForm.role,
        customer_tier: editRoleForm.role === 'CUSTOMER' ? editRoleForm.customer_tier : null,
        company_name: editRoleForm.company_name,
      });
      toast.success(`Role for "${editRoleUser.name}" updated to ${editRoleForm.role.replace('_', ' ')}!`);
      setEditRoleUser(null);
      loadUsers(searchQuery, roleFilter);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update role';
      toast.error(msg);
    } finally {
      setSubmittingRoleEdit(false);
    }
  };

  // Fetch users directly from PostgreSQL database with search and role filtering
  const loadUsers = async (q = searchQuery, role = roleFilter) => {
    setLoading(true);
    try {
      const searchStr = typeof q === 'string' ? q : (typeof searchQuery === 'string' ? searchQuery : '');
      const roleStr = typeof role === 'string' ? role : (typeof roleFilter === 'string' ? roleFilter : 'ALL');
      const params = {};
      if (searchStr.trim()) params.search = searchStr.trim();
      if (roleStr !== 'ALL') params.role = roleStr;
      const res = await usersAPI.getAll(params);
      setUsers(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(searchQuery, roleFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, roleFilter]);

  // Role Badge Styling
  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return {
          bg: 'bg-rose-100 text-rose-800 border-2 border-slate-900 shadow-pop-xs',
          label: 'Admin',
        };
      case 'SALES_REP':
        return {
          bg: 'bg-blue-100 text-blue-800 border-2 border-slate-900 shadow-pop-xs',
          label: 'Sales Rep',
        };
      case 'SALES_MANAGER':
        return {
          bg: 'bg-purple-100 text-purple-800 border-2 border-slate-900 shadow-pop-xs',
          label: 'Sales Manager',
        };
      case 'FINANCE':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-2 border-slate-900 shadow-pop-xs',
          label: 'Finance',
        };
      case 'CUSTOMER':
        return {
          bg: 'bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-xs',
          label: 'Customer',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-2 border-slate-900 shadow-pop-xs',
          label: role || 'Unknown',
        };
    }
  };

  // Tier Badge Styling
  const getTierBadge = (tier) => {
    const t = (tier || 'BRONZE').toUpperCase();
    if (t === 'GOLD') return 'bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-xs';
    if (t === 'SILVER') return 'bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-pop-xs';
    return 'bg-orange-100 text-orange-900 border-2 border-slate-900 shadow-pop-xs';
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
      toast.success(`User ${addForm.name} created successfully!`);
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
    const token = user.magic_link_token || user.id;
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Customer Portal URL copied to clipboard!');
  };

  // Internal Users vs Customer Users
  const internalUsers = useMemo(() => {
    return users.filter((u) => u.role !== 'CUSTOMER');
  }, [users]);

  const customerUsers = useMemo(() => {
    return users.filter((u) => u.role === 'CUSTOMER');
  }, [users]);

  // Reset page on filter change
  useEffect(() => { setInternalPage(1); }, [roleFilter, searchQuery]);

  // Paged slices
  const pagedInternalUsers = useMemo(() => {
    const start = (internalPage - 1) * pageSize;
    return internalUsers.slice(start, start + pageSize);
  }, [internalUsers, internalPage, pageSize]);

  const pagedCustomerUsers = useMemo(() => {
    const start = (customerPage - 1) * pageSize;
    return customerUsers.slice(start, start + pageSize);
  }, [customerUsers, customerPage, pageSize]);

  return (
    <div className="space-y-8 pb-12 antialiased">
      {/* ── HEADER & ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border-2 border-slate-900 shadow-pop">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <UsersIcon className="w-6 h-6 text-blue-700" strokeWidth={2.5} />
            User Management
          </h1>
          <p className="text-xs font-medium text-slate-600 mt-1">
            Manage enterprise team members, roles, governance access, and customer portal accounts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadUsers()}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 shadow-pop-xs transition-all disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-pop-violet hover:bg-violet-700 text-white font-heading font-black text-xs sm:text-sm flex items-center gap-2 border-2 border-slate-900 shadow-pop-xs hover:shadow-pop hover:-translate-y-0.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" strokeWidth={2.5} />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: INTERNAL USERS TABLE ─────────────────────────── */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border-2 border-slate-900 shadow-pop">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team members by name or email..."
              className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl pl-10 pr-4 py-2 text-xs font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-heading font-bold text-slate-700">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
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
        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b-2 border-slate-900 text-[11px] font-mono font-black text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-black">Name</th>
                  <th className="py-3.5 px-4 font-black hidden sm:table-cell">Email</th>
                  <th className="py-3.5 px-4 text-center font-black">Role</th>
                  <th className="py-3.5 px-4 text-center font-black hidden sm:table-cell">Status</th>
                  <th className="py-3.5 px-4 text-center font-black hidden md:table-cell">Created</th>
                  <th className="py-3.5 px-4 text-right font-black">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500 font-heading font-bold">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading users...
                    </td>
                  </tr>
                ) : pagedInternalUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-500 font-heading font-bold text-xs">
                      No internal team members found matching your search.
                    </td>
                  </tr>
                ) : (
                  pagedInternalUsers.map((u) => {
                    const roleBadge = getRoleBadge(u.role);
                    const isSelf = u.id === currentUser?.id;

                    return (
                      <tr
                        key={u.id}
                        className="group hover:bg-amber-50/40 transition-colors"
                      >
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white font-heading font-black text-xs flex items-center justify-center shrink-0 border-2 border-slate-900 shadow-pop-xs">
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-heading font-bold text-slate-900">
                                  {u.name}
                                </span>
                                {isSelf && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-900 border border-slate-900 font-mono font-bold">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono sm:hidden mt-0.5">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs font-bold hidden sm:table-cell">
                          {u.email}
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => openEditRoleModal(u)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase hover:scale-105 transition-all cursor-pointer ${roleBadge.bg}`}
                            title="Click to edit user role & permissions"
                          >
                            <span>{roleBadge.label}</span>
                            <Edit3 className="w-3 h-3 opacity-70" />
                          </button>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border-2 border-slate-900 shadow-pop-xs ${
                              u.is_active
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                u.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="py-3.5 px-4 text-center text-slate-600 font-mono text-xs hidden md:table-cell">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString()
                            : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Role */}
                            <button
                              onClick={() => openEditRoleModal(u)}
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-900 text-purple-700 shadow-pop-xs transition-all"
                              title="Edit User Role & Permissions"
                            >
                              <Shield className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>

                            {/* View their quotations */}
                            <button
                              onClick={() =>
                                navigate(
                                  `/quotations?search=${encodeURIComponent(u.name)}`
                                )
                              }
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-700 shadow-pop-xs transition-all"
                              title="View user's quotations"
                            >
                              <FileText className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setResetModalUser(u);
                                setNewPassword('');
                              }}
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-900 text-amber-700 shadow-pop-xs transition-all"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>

                            {/* Toggle Active/Inactive */}
                            {!isSelf ? (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`p-2 rounded-xl border-2 border-slate-900 shadow-pop-xs transition-all ${
                                  u.is_active
                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                }`}
                                title={
                                  u.is_active
                                    ? 'Deactivate User'
                                    : 'Activate User'
                                }
                              >
                                {u.is_active ? (
                                  <ToggleRight className="w-4 h-4" strokeWidth={2.5} />
                                ) : (
                                  <ToggleLeft className="w-4 h-4" strokeWidth={2.5} />
                                )}
                              </button>
                            ) : (
                              <div className="w-8" />
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
          <div className="p-4 border-t-2 border-slate-900 bg-slate-50">
            <Pagination
              currentPage={internalPage}
              totalItems={internalUsers.length}
              pageSize={pageSize}
              onPageChange={setInternalPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20, 50, 100, 200]}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: CUSTOMER SECTION ────────────── */}
      <div className="space-y-4 pt-6 border-t-2 border-slate-900">
        <div>
          <h2 className="text-lg font-heading font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-5 h-5 text-violet-700" strokeWidth={2.5} />
            Customer Portal Accounts
          </h2>
          <p className="text-xs font-medium text-slate-600 mt-0.5">
            External customers with dedicated portal access for quote review, interactive negotiation, and deal confirmation
          </p>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b-2 border-slate-900 text-[11px] font-mono font-black text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-black">Company Name</th>
                  <th className="py-3.5 px-4 text-center font-black">Tier</th>
                  <th className="py-3.5 px-4 font-black hidden sm:table-cell">Contact Email</th>
                  <th className="py-3.5 px-4 text-center font-black hidden md:table-cell">Linked Quotations</th>
                  <th className="py-3.5 px-4 text-right font-black">Portal Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customerUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 font-heading font-bold text-xs">
                      No customer users found. Create customer accounts using the "+ Add New User" button above.
                    </td>
                  </tr>
                ) : (
                  pagedCustomerUsers.map((c) => {
                    const tier = c.customer_tier || 'BRONZE';
                    const compName = c.company_name || c.name || 'Enterprise Client';
                    const token = c.magic_link_token || c.id;

                    return (
                      <tr
                        key={c.id}
                        className="group hover:bg-amber-50/40 transition-colors"
                      >
                        {/* Company Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-heading font-bold text-slate-900 flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-violet-700 shrink-0" strokeWidth={2.5} />
                              {compName}
                            </span>
                            <span className="text-xs text-slate-500 pl-5 font-medium">
                              Contact: {c.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono sm:hidden pl-5">
                              {c.email}
                            </span>
                          </div>
                        </td>

                        {/* Tier Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase ${getTierBadge(
                              tier
                            )}`}
                          >
                            {tier}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs font-bold hidden sm:table-cell">
                          {c.email}
                        </td>

                        {/* Linked Quotations Count */}
                        <td className="py-3.5 px-4 text-center hidden md:table-cell">
                          <span className="px-3 py-1 rounded-xl bg-blue-50 font-mono text-xs font-black text-blue-900 border-2 border-slate-900 shadow-pop-xs">
                            {c.quotations_count || 0} Quotes
                          </span>
                        </td>

                        {/* Portal Access Link & Copy Button */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditRoleModal(c)}
                              className="p-2 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-900 text-purple-700 shadow-pop-xs transition-all"
                              title="Edit User Role & Permissions"
                            >
                              <Shield className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>

                            <button
                              onClick={() => copyPortalLink(c)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-900 text-xs font-heading font-bold flex items-center gap-1.5 shadow-pop-xs transition-all"
                              title="Copy Customer Portal Link"
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-600" strokeWidth={2.5} />
                              <span>Copy Link</span>
                            </button>

                            <a
                              href={`/portal/${token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-violet-100 hover:bg-violet-200 border-2 border-slate-900 text-violet-900 shadow-pop-xs transition-all"
                              title="Open Portal in New Tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.5} />
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
          <div className="p-4 border-t-2 border-slate-900 bg-slate-50">
            <Pagination
              currentPage={customerPage}
              totalItems={customerUsers.length}
              pageSize={pageSize}
              onPageChange={setCustomerPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20, 50, 100, 200]}
            />
          </div>
        </div>
      </div>

      {/* ── ADD USER MODAL ──────────────────────────────────────────── */}
      {showAddModal && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border-2 border-slate-900 rounded-3xl shadow-pop-xl p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <h3 className="font-heading font-black text-base text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-700" strokeWidth={2.5} />
                Add New User
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-heading font-bold text-slate-800 block mb-1">
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
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                />
              </div>

              <div>
                <label className="text-xs font-heading font-bold text-slate-800 block mb-1">
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
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                />
              </div>

              <div>
                <label className="text-xs font-heading font-bold text-slate-800 block mb-1">
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
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                />
              </div>

              <div>
                <label className="text-xs font-heading font-bold text-slate-800 block mb-1">
                  Role Selector *
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) =>
                    setAddForm({ ...addForm, role: e.target.value })
                  }
                  className="w-full bg-white border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                >
                  <option value="SALES_REP">Sales Rep</option>
                  <option value="SALES_MANAGER">Sales Manager</option>
                  <option value="FINANCE">Finance</option>
                  <option value="ADMIN">Admin</option>
                  <option value="CUSTOMER">Customer</option>
                </select>
              </div>

              {addForm.role === 'CUSTOMER' && (
                <div className="grid grid-cols-2 gap-3 bg-[#FFFDF5] p-3.5 rounded-2xl border-2 border-slate-900 shadow-pop-xs">
                  <div>
                    <label className="text-[11px] font-heading font-bold text-slate-700 block mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={addForm.company_name}
                      onChange={(e) =>
                        setAddForm({ ...addForm, company_name: e.target.value })
                      }
                      placeholder="e.g. Acme Corp"
                      className="w-full bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-heading font-bold text-slate-700 block mb-1">
                      Tier
                    </label>
                    <select
                      value={addForm.customer_tier}
                      onChange={(e) =>
                        setAddForm({ ...addForm, customer_tier: e.target.value })
                      }
                      className="w-full bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                    >
                      <option value="BRONZE">Bronze (Standard)</option>
                      <option value="SILVER">Silver (Preferred)</option>
                      <option value="GOLD">Gold (VIP)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Welcome Email Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-xs">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-700" strokeWidth={2.5} />
                  <div>
                    <span className="text-xs font-heading font-bold text-slate-900 block">
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
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 focus:outline-none border-2 border-slate-900 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 rounded-xl bg-pop-violet hover:bg-violet-700 text-white text-xs font-heading font-black border-2 border-slate-900 shadow-pop-xs hover:shadow-pop hover:-translate-y-0.5 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingAdd ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                  )}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
    )}

      {/* ── RESET PASSWORD MODAL ────────────────────────────────────── */}
      {resetModalUser && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white border-2 border-slate-900 rounded-3xl shadow-pop-xl p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <h3 className="font-heading font-black text-base text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-700" strokeWidth={2.5} />
                Reset Password
              </h3>
              <button
                onClick={() => setResetModalUser(null)}
                className="p-1 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Reset login credentials for{' '}
              <span className="font-bold text-slate-900">{resetModalUser.name}</span> (
              {resetModalUser.email}).
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-heading font-bold text-slate-800 block mb-1">
                  New Password (Optional, leave blank for default)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="DealFlow360@Pass123"
                  className="w-full bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-heading font-black border-2 border-slate-900 flex items-center gap-1.5 shadow-pop-xs disabled:opacity-50"
                >
                  {submittingReset ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" strokeWidth={2.5} />
                  )}
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
    )}

      {/* ── EDIT ROLE & PERMISSIONS MODAL ───────────────────────────── */}
      {editRoleUser && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border-2 border-slate-900 rounded-3xl shadow-pop-xl p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <h3 className="font-heading font-black text-base text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-700" strokeWidth={2.5} />
                Change User Role & Access
              </h3>
              <button
                onClick={() => setEditRoleUser(null)}
                className="p-1 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-3.5 bg-[#FFFDF5] border-2 border-slate-900 rounded-2xl space-y-1 shadow-pop-xs">
              <div className="text-xs font-heading font-black text-slate-900 flex items-center justify-between">
                <span>{editRoleUser.name}</span>
                <span className="text-[10px] font-mono font-bold text-slate-500">{editRoleUser.email}</span>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                <span>Current Role:</span>
                <span className="font-bold text-purple-800">
                  {editRoleUser.role?.replace('_', ' ')}
                </span>
              </div>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div>
                <label className="text-xs font-heading font-bold text-slate-800 block mb-1.5">
                  Select New Role *
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'SALES_REP',
                      name: 'Sales Representative',
                      desc: 'Create quotations, negotiate with clients, advance pipeline',
                    },
                    {
                      id: 'SALES_MANAGER',
                      name: 'Sales Manager',
                      desc: 'Approve discounts, manage team pipeline & margin thresholds',
                    },
                    {
                      id: 'FINANCE',
                      name: 'Finance Officer',
                      desc: 'Manage invoices, subscriptions, revenue audits & fulfillment splits',
                    },
                    {
                      id: 'ADMIN',
                      name: 'System Administrator',
                      desc: 'Full administrative control, user roles, system configurations',
                    },
                    {
                      id: 'CUSTOMER',
                      name: 'Customer / Client',
                      desc: 'Access client quotation negotiation portal & approvals',
                    },
                  ].map((r) => {
                    const isSelected = editRoleForm.role === r.id;
                    return (
                      <label
                        key={r.id}
                        className={`flex items-start gap-3 p-3 rounded-2xl border-2 border-slate-900 cursor-pointer transition-all shadow-pop-xs ${
                          isSelected
                            ? 'bg-blue-50 ring-2 ring-slate-900'
                            : 'bg-white hover:bg-amber-50/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="edit_role"
                          value={r.id}
                          checked={isSelected}
                          onChange={() =>
                            setEditRoleForm((prev) => ({ ...prev, role: r.id }))
                          }
                          className="mt-1 accent-slate-900"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-heading font-black text-slate-900 flex items-center justify-between">
                            <span>{r.name}</span>
                            {isSelected && (
                              <span className="text-[10px] text-blue-800 font-mono font-bold">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 font-medium">{r.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* If Customer, allow selecting Customer Tier */}
              {editRoleForm.role === 'CUSTOMER' && (
                <div className="space-y-2 pt-2 border-t-2 border-slate-900">
                  <label className="text-xs font-heading font-bold text-slate-800 block mb-1">
                    Customer Contract Tier
                  </label>
                  <select
                    value={editRoleForm.customer_tier}
                    onChange={(e) =>
                      setEditRoleForm((prev) => ({ ...prev, customer_tier: e.target.value }))
                    }
                    className="w-full bg-white border-2 border-slate-900 rounded-2xl px-3.5 py-2 text-xs font-heading font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-pop-xs"
                  >
                    <option value="BRONZE">Bronze Tier (Standard)</option>
                    <option value="SILVER">Silver Tier (Preferred)</option>
                    <option value="GOLD">Gold Tier (Enterprise VIP)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setEditRoleUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRoleEdit}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-heading font-black border-2 border-slate-900 flex items-center gap-1.5 shadow-pop-xs disabled:opacity-50"
                >
                  {submittingRoleEdit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                  )}
                  Apply Role Update
                </button>
              </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
