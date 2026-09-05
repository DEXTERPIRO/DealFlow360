import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Activity,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('admin@dealflow360.com');
  const [password, setPassword] = useState('Password@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');

  const demoAccounts = [
    { role: 'ADMIN', name: 'Admin', email: 'admin@dealflow360.com', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
    { role: 'SALES_REP', name: 'Sales Rep', email: 'sarah.rep@dealflow360.com', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
    { role: 'SALES_MANAGER', name: 'Sales Manager', email: 'david.manager@dealflow360.com', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300' },
    { role: 'FINANCE', name: 'Finance', email: 'emma.finance@dealflow360.com', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    { role: 'CUSTOMER', name: 'Customer', email: 'john@acmecorp.com', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  ];

  const handleSelectDemo = (acc) => {
    setEmail(acc.email);
    setPassword('Password@123');
    setErrors({});
    setAuthError('');
  };

  const validate = () => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await authAPI.login({ email: email.trim(), password });
      const user = res.user;
      const accessToken = res.accessToken;
      setAuth(user, accessToken);
      toast.success(`Welcome back, ${user.name || 'User'}!`);

      // Role based redirection
      if (user.role === 'ADMIN' || user.role === 'SALES_MANAGER') {
        navigate('/products');
      } else if (user.role === 'SALES_REP') {
        navigate('/quotations');
      } else if (user.role === 'FINANCE') {
        navigate('/approvals');
      } else if (user.role === 'CUSTOMER') {
        navigate('/portal/login');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.detail || err.error || err.message || 'Invalid email or password';
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
      {/* ── LEFT PANEL: BRANDING & DEMO LOGINS (45%) ──────────────────── */}
      <div className="w-full md:w-[45%] bg-slate-900 border-r border-slate-800 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Glow ambient decoration */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-8 relative z-10">
          {/* Logo & Header */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-1">
                DealFlow<span className="text-blue-500">360</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono tracking-wider uppercase block">
                Enterprise CPQ & Deal Governance
              </span>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              Intelligent, Self-Governing Sales Operations
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              Automate multi-tier pricing guardrails, warehouse allocation intelligence, and customer deal negotiations with full margin visibility.
            </p>
          </div>

          {/* Feature Highlights with check icons */}
          <div className="space-y-3 pt-2">
            {[
              'Auto approval routing based on discount risk score',
              'Live margin & profit tracking as you build quotes',
              'Multi-warehouse fulfillment & backorder intelligence',
              'Collaborative customer portal negotiation room'
            ].map((feat, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Demo Credentials Clickable Cards */}
        <div className="pt-8 relative z-10">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            Quick Demo Sign In (Click to prefill):
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleSelectDemo(acc)}
                className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${acc.color}`}
              >
                <div className="font-bold text-xs">{acc.name}</div>
                <div className="text-[10px] opacity-75 truncate">{acc.role}</div>
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Default demo password: <span className="font-mono text-slate-300 font-semibold">Password@123</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: LOGIN FORM (55%) ────────────────────────────── */}
      <div className="w-full md:w-[55%] bg-slate-950 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Sign in to your account</h2>
            <p className="text-xs text-slate-400">
              Enter your credentials to access your organization workspace
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  placeholder="name@company.com"
                  className={`w-full bg-slate-900 border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors ${
                    errors.email
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-800 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-rose-400 mt-1 pl-1 font-medium">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  placeholder="••••••••"
                  className={`w-full bg-slate-900 border rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors ${
                    errors.password
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-800 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-400 mt-1 pl-1 font-medium">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign in to Platform</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Links & Divider */}
          <div className="space-y-4 pt-2">
            <div className="text-center text-xs text-slate-400">
              Don't have an internal account?{' '}
              <Link to="/signup" className="text-blue-400 hover:underline font-semibold">
                Sign up
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-800" />
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">OR</span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            <div className="text-center">
              <Link
                to="/portal/login"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Customer Portal Login (Magic Link) →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
