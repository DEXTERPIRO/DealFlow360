import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  AlertCircle,
  Sparkles,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api';
import { setToken } from '../../api/client';
import { getRedirectPathForUser } from '../../utils/authRedirect';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser, setAuth } = useAuthStore();

  const tokenFromUrl = searchParams.get('token') || searchParams.get('magicToken');

  useEffect(() => {
    if (currentUser) {
      navigate(getRedirectPathForUser(currentUser), { replace: true });
    }
  }, [currentUser, navigate]);

  // Mode: 'password' | 'magic'
  const [authMode, setAuthMode] = useState('password');

  const [email, setEmail] = useState('admin@dealflow.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');

  // Magic Link specific state
  const [magicEmail, setMagicEmail] = useState('buyer@acme.com');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicResult, setMagicResult] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // ── Auto-verify if magic link token in URL ─────────────────────────────────
  useEffect(() => {
    if (tokenFromUrl) {
      setLoading(true);
      authAPI.verifyMagic(tokenFromUrl)
        .then((res) => {
          if (res?.user && res?.accessToken) {
            setAuth(res.user, res.accessToken);
            setToken(res.accessToken);
            toast.success(`Welcome, ${res.user.name || 'Customer'}!`);
            navigate(getRedirectPathForUser(res.user), { replace: true });
          }
        })
        .catch((err) => {
          console.error(err);
          setAuthError('Magic link is invalid or has expired');
          toast.error('Magic link is invalid or has expired');
        })
        .finally(() => setLoading(false));
    }
  }, [tokenFromUrl, navigate, setAuth]);

  const demoAccounts = [
    { role: 'ADMIN', name: 'Admin', email: 'admin@dealflow.com', password: 'Admin@123', color: 'bg-rose-100 text-slate-900 border-2 border-slate-900 hover:bg-rose-200' },
    { role: 'SALES_REP', name: 'Sales Rep (Priya)', email: 'priya@dealflow.com', password: 'Rep@123', color: 'bg-sky-100 text-slate-900 border-2 border-slate-900 hover:bg-sky-200' },
    { role: 'SALES_MANAGER', name: 'Manager (Raj)', email: 'manager@dealflow.com', password: 'Manager@123', color: 'bg-violet-100 text-slate-900 border-2 border-slate-900 hover:bg-violet-200' },
    { role: 'FINANCE', name: 'Finance (Sneha)', email: 'finance@dealflow.com', password: 'Finance@123', color: 'bg-emerald-100 text-slate-900 border-2 border-slate-900 hover:bg-emerald-200' },
    { role: 'CUSTOMER', name: 'Customer (Acme)', email: 'buyer@acme.com', password: 'Customer@123', color: 'bg-amber-100 text-slate-900 border-2 border-slate-900 hover:bg-amber-200' },
  ];

  const handleSelectDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password || 'Admin@123');
    setMagicEmail(acc.email);
    setErrors({});
    setAuthError('');
    if (acc.role === 'CUSTOMER') {
      toast.success('Customer demo selected (Password or Magic Link available)');
    }
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
      setToken(accessToken);
      toast.success(`Welcome back, ${user.name || 'User'}!`);

      // Role based redirection
      navigate(getRedirectPathForUser(user));
    } catch (err) {
      const msg = err.detail || err.error || err.message || 'Invalid email or password';
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Customer Magic Link Request & Instant Auth ─────────────────────
  const handleMagicSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!magicEmail.trim()) {
      toast.error('Please enter a customer email address');
      return;
    }

    setMagicLoading(true);
    try {
      const res = await authAPI.magicLink(magicEmail.trim());
      setMagicResult(res);
      setMagicSent(true);
      toast.success('Magic link generated!');
    } catch (err) {
      console.error(err);
      const msg = err.detail || err.error || err.message || 'Failed to send magic link';
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setMagicLoading(false);
    }
  };

  const handleLaunchMagicPortal = async () => {
    if (!magicResult) return;
    setMagicLoading(true);
    try {
      // Auto-verify token to log in customer session
      if (magicResult.token) {
        const verifyRes = await authAPI.verifyMagic(magicResult.token);
        if (verifyRes?.user && verifyRes?.accessToken) {
          setAuth(verifyRes.user, verifyRes.accessToken);
          setToken(verifyRes.accessToken);
          toast.success(`Welcome, ${verifyRes.user.name || 'Customer'}!`);
          const targetToken = verifyRes.user.portalToken || magicResult.portalToken || `portal-token-${verifyRes.user.id}`;
          navigate(`/portal/${targetToken}`);
          return;
        }
      }
      const fallbackToken = magicResult.portalToken || (magicResult.userId ? `portal-token-${magicResult.userId}` : '');
      navigate(`/portal/${fallbackToken}`);
    } catch (err) {
      console.error(err);
      const fallbackToken = magicResult.portalToken || (magicResult.userId ? `portal-token-${magicResult.userId}` : '');
      navigate(`/portal/${fallbackToken}`);
    } finally {
      setMagicLoading(false);
    }
  };

  const handleCopyMagicToken = () => {
    const textToCopy = magicResult?.token
      ? `${window.location.origin}/login?token=${magicResult.token}`
      : `${window.location.origin}/portal/${magicResult?.portalToken || (magicResult?.userId ? `portal-token-${magicResult.userId}` : '')}`;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedToken(true);
    toast.success('Magic sign-in link copied to clipboard!');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-paper antialiased">
      {/* ── LEFT PANEL: BRANDING & DEMO LOGINS (45%) ──────────────────── */}
      <div className="w-full md:w-[45%] bg-amber-50/70 border-r-2 border-slate-900 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="space-y-8 relative z-10">
          {/* Logo & Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-pop-violet border-2 border-slate-900 shadow-pop-sm flex items-center justify-center text-white">
              <Layers className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <span className="font-heading font-extrabold text-2xl tracking-tight text-slate-900 flex items-center gap-1">
                DealFlow<span className="text-pop-violet">360</span>
              </span>
              <span className="text-[11px] text-slate-600 font-mono font-bold tracking-wider uppercase block">
                Enterprise CPQ & Deal Governance
              </span>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-4xl font-heading font-extrabold text-slate-900 tracking-tight leading-tight">
              Intelligent, Self-Governing Sales Operations
            </h1>
            <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-lg">
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
              <div key={idx} className="flex items-center gap-3 text-sm font-bold text-slate-800">
                <div className="w-6 h-6 rounded-full bg-emerald-300 text-slate-900 flex items-center justify-center shrink-0 border-2 border-slate-900 shadow-pop-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                </div>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Demo Credentials Clickable Cards */}
        <div className="pt-8 relative z-10">
          <div className="text-xs font-heading font-extrabold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-pop-violet" strokeWidth={2.5} />
            Quick Demo Sign In (Click to prefill):
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {demoAccounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleSelectDemo(acc)}
                className={`p-2.5 rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5 active:translate-y-0.5 shadow-pop-sm cursor-pointer ${acc.color}`}
              >
                <div className="font-heading font-extrabold text-xs">{acc.name}</div>
                <div className="text-[10px] font-mono font-bold opacity-80 truncate">{acc.role}</div>
              </button>
            ))}
          </div>
          <div className="text-[11px] font-medium text-slate-600 mt-2.5">
            Default demo password: <span className="font-mono text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">Admin@123</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: LOGIN FORM (55%) ────────────────────────────── */}
      <div className="w-full md:w-[55%] bg-paper bg-dot-grid flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md bg-white border-2 border-slate-900 rounded-3xl p-8 shadow-pop-lg space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight">
              {authMode === 'password' ? 'Staff Workspace Sign In' : 'Client Portal Sign In'}
            </h2>
            <p className="text-xs font-medium text-slate-600">
              {authMode === 'password'
                ? 'Enter credentials to access pipeline, margin analytics, and deal operations'
                : 'Enter your work email for instant passwordless access to your enterprise quote'}
            </p>
          </div>

          {/* Method Tabs: Staff (Password) vs Customer (Magic Link) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 border-2 border-slate-900 shadow-pop-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setAuthError('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-heading font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'password'
                  ? 'bg-pop-violet text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock size={13} strokeWidth={2.5} />
              <span>Staff (Password)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic');
                setAuthError('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-heading font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'magic'
                  ? 'bg-pop-violet text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={13} strokeWidth={2.5} className="text-yellow-300" />
              <span>Customer (Magic Link)</span>
            </button>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-slate-900 shadow-pop-sm flex items-start gap-3 text-rose-950 text-xs font-medium animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" strokeWidth={2.5} />
              <span>{authError}</span>
            </div>
          )}

          {/* ════ OPTION A: PASSWORD LOGIN FORM ════════════════════════════ */}
          {authMode === 'password' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                    }}
                    placeholder="name@company.com"
                    autoComplete="email"
                    className={`w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all ${
                      errors.email ? 'border-rose-500' : ''
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-rose-600 mt-1 pl-1 font-bold">{errors.email}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all ${
                      errors.password ? 'border-rose-500' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={2.5} /> : <Eye className="w-4 h-4" strokeWidth={2.5} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-rose-600 mt-1 pl-1 font-bold">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-candy bg-pop-violet hover:bg-violet-600 text-white w-full py-3.5 px-4 rounded-xl border-2 border-slate-900 shadow-pop text-sm font-heading font-extrabold active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign in to Platform</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ════ OPTION B: MAGIC LINK CUSTOMER PORTAL FORM ════════════════ */
            <div className="space-y-4">
              {magicSent && magicResult ? (
                <div className="space-y-4 text-center py-2 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-slate-900 text-emerald-800 flex items-center justify-center mx-auto shadow-pop-sm">
                    <CheckCircle2 size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-base font-heading font-extrabold text-slate-900">
                      Magic Link Generated!
                    </h3>
                    <p className="text-xs font-medium text-slate-600 mt-1">
                      Ready for passwordless sign-in for:
                    </p>
                    <p className="font-mono text-xs font-bold text-pop-violet mt-0.5">
                      {magicEmail}
                    </p>
                    {magicResult.companyName && (
                      <span className="inline-block mt-2 px-3 py-1 rounded-full text-[11px] font-heading font-extrabold bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-xs">
                        {magicResult.companyName}
                      </span>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-900 text-left space-y-3 shadow-pop-sm">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-extrabold text-slate-700 font-mono tracking-wider flex items-center gap-1">
                          <Sparkles size={11} className="text-amber-500" />
                          One-Click Magic Sign-In Link
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyMagicToken}
                          className="text-[11px] font-bold text-pop-violet hover:text-violet-700 flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-lg border border-slate-300"
                        >
                          {copiedToken ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2.5} />}
                          {copiedToken ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-slate-800 font-bold break-all bg-white p-2 rounded-xl border-2 border-slate-900">
                        {window.location.origin}/login?token={magicResult.token}
                      </p>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600 font-medium border-t border-slate-200">
                      <span>Target Portal:</span>
                      <span className="font-mono font-bold text-slate-900 bg-amber-100 px-1.5 py-0.5 rounded border border-slate-300">
                        /portal/{magicResult.portalToken || (magicResult.userId ? `portal-token-${magicResult.userId}` : 'pending')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleLaunchMagicPortal}
                      disabled={magicLoading}
                      className="btn-candy w-full py-3 px-3 rounded-xl bg-pop-violet hover:bg-violet-600 text-white font-heading font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-pop border-2 border-slate-900 active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <Zap size={15} strokeWidth={2.5} className="text-yellow-300" />
                      <span>{magicLoading ? 'Signing in...' : 'Sign In & Launch Portal'}</span>
                      <ExternalLink size={14} strokeWidth={2.5} />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setMagicSent(false);
                      setMagicResult(null);
                    }}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 underline pt-1 block mx-auto cursor-pointer"
                  >
                    Enter a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Customer Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
                      <input
                        type="email"
                        required
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        placeholder="buyer@acme.com"
                        className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      No password required. Instant passwordless sign-in for enterprise deals.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={magicLoading}
                    className="btn-candy bg-pop-violet hover:bg-violet-600 text-white w-full py-3.5 px-4 rounded-xl border-2 border-slate-900 shadow-pop text-sm font-heading font-extrabold active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={15} strokeWidth={2.5} className="text-yellow-300" />
                    <span>{magicLoading ? 'Generating link...' : 'Send Magic Link & Sign In'}</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                  </button>

                  {/* Fast Client Demo Picker */}
                  <div className="pt-2 border-t-2 border-slate-100">
                    <p className="text-[11px] font-heading font-bold text-slate-600 mb-2 uppercase tracking-wider">
                      Quick Customer Select:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Acme Corp (Gold)', email: 'buyer@acme.com' },
                        { label: 'Beta Industries (Silver)', email: 'contact@beta.com' },
                        { label: 'Gamma Retail (Bronze)', email: 'purchase@gamma.com' },
                      ].map((c) => (
                        <button
                          key={c.email}
                          type="button"
                          onClick={() => {
                            setMagicEmail(c.email);
                            toast.success(`Selected ${c.label}`);
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-heading font-bold border-2 border-slate-900 transition-all cursor-pointer shadow-pop-xs ${
                            magicEmail === c.email
                              ? 'bg-amber-200 text-slate-900'
                              : 'bg-[#FFFDF5] text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Contextual Footer Switcher */}
          <div className="pt-2 border-t-2 border-slate-100">
            {authMode === 'password' ? (
              <div className="space-y-3 text-center">
                <div className="text-xs text-slate-600 font-medium">
                  Don't have an internal staff account?{' '}
                  <Link to="/signup" className="text-pop-violet hover:underline font-bold">
                    Sign up
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('magic');
                    setAuthError('');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-heading font-extrabold text-slate-700 hover:text-pop-violet transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-100"
                >
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Enterprise customer reviewing a proposal? Switch to Customer Portal →</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('password');
                    setAuthError('');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-heading font-extrabold text-slate-700 hover:text-pop-violet transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-100"
                >
                  <Lock size={13} className="text-slate-500" />
                  <span>Internal sales rep, manager, or finance? Switch to Staff Login →</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
