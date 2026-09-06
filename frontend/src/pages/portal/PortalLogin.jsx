import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  Rocket,
  User,
  Building2,
} from 'lucide-react';
import { authAPI } from '../../api';
import { setToken } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getRedirectPathForUser } from '../../utils/authRedirect';
import toast from 'react-hot-toast';

export default function PortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser, setAuth } = useAuthStore();

  const tokenFromUrl = searchParams.get('token') || searchParams.get('magicToken');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'CUSTOMER') {
        navigate(`/portal/${currentUser.portalToken || 'demo-portal-token-acme'}`, { replace: true });
      } else {
        navigate(getRedirectPathForUser(currentUser), { replace: true });
      }
    }
  }, [currentUser, navigate]);

  // Mode: 'password' | 'signup' | 'magic'
  const [authMode, setAuthMode] = useState('password');

  // Magic Link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [demoToken, setDemoToken] = useState('');
  const [rawMagicToken, setRawMagicToken] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Signup state
  const [signupForm, setSignupForm] = useState({
    name: '',
    companyName: '',
    email: '',
    password: '',
  });
  const [signupLoading, setSignupLoading] = useState(false);

  // ── Auto-verify if token is in URL ───────────────────────────────────────
  useEffect(() => {
    if (tokenFromUrl) {
      setMagicLoading(true);
      authAPI.verifyMagic(tokenFromUrl)
        .then((res) => {
          if (res?.user && res?.accessToken) {
            setAuth(res.user, res.accessToken);
            setToken(res.accessToken);
            toast.success(`Welcome, ${res.user.name || 'Customer'}!`);
            navigate(`/portal/${res.user.portalToken || 'demo-portal-token-acme'}`, { replace: true });
          }
        })
        .catch((err) => {
          console.error(err);
          toast.error(err?.detail || 'Magic link is invalid or has expired');
        })
        .finally(() => setMagicLoading(false));
    }
  }, [tokenFromUrl, navigate, setAuth]);

  // ── Handle Magic Link Request ────────────────────────────────────────────

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!magicEmail.trim()) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setMagicLoading(true);
      const res = await authAPI.magicLink(magicEmail.trim());
      setMagicSent(true);
      const portalToken = res?.portalToken || 'demo-portal-token-acme';
      setDemoToken(portalToken);
      setRawMagicToken(res?.token || '');
      if (res?.companyName) setCustomerCompany(res.companyName);
      if (res?.customerName) setCustomerName(res.customerName);
      toast.success('Magic link generated!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to send magic link');
    } finally {
      setMagicLoading(false);
    }
  };

  // ── Authenticate and Launch Portal Directly ──────────────────────────────
  const handleLaunchWithMagic = async () => {
    try {
      setMagicLoading(true);
      if (rawMagicToken) {
        const verifyRes = await authAPI.verifyMagic(rawMagicToken);
        if (verifyRes?.user && verifyRes?.accessToken) {
          setAuth(verifyRes.user, verifyRes.accessToken);
          setToken(verifyRes.accessToken);
          toast.success(`Welcome, ${verifyRes.user.name || 'Customer'}!`);
          navigate(`/portal/${verifyRes.user.portalToken || demoToken}`);
          return;
        }
      }
      navigate(`/portal/${demoToken}`);
    } catch (err) {
      console.error(err);
      navigate(`/portal/${demoToken}`);
    } finally {
      setMagicLoading(false);
    }
  };

  // ── Handle Password Login ────────────────────────────────────────────────

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Email and password are required');
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await authAPI.login({ email: email.trim(), password });
      if (res?.user && res?.accessToken) {
        setAuth(res.user, res.accessToken);
        setToken(res.accessToken);
        toast.success(`Welcome back, ${res.user.name || 'Customer'}!`);

        // If customer has an active portal token redirect there, otherwise dashboard
        if (res.user.portalToken) {
          navigate(`/portal/${res.user.portalToken}`);
        } else if (res.user.role === 'CUSTOMER') {
          navigate('/portal/demo-portal-token-acme');
        } else {
          navigate(getRedirectPathForUser(res.user));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Invalid email or password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Handle Customer Sign Up ──────────────────────────────────────────────
  const handleCustomerSignup = async (e) => {
    e.preventDefault();
    if (!signupForm.name.trim() || !signupForm.email.trim() || !signupForm.password) {
      toast.error('Please enter name, email, and password');
      return;
    }
    if (signupForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setSignupLoading(true);
      const res = await authAPI.signup({
        name: signupForm.name.trim(),
        email: signupForm.email.trim(),
        password: signupForm.password,
        role: 'CUSTOMER',
        company_name: signupForm.companyName.trim() || undefined,
      });

      if (res?.user && res?.accessToken) {
        setAuth(res.user, res.accessToken);
        setToken(res.accessToken);
        toast.success(`Account created! Welcome, ${res.user.name}`);
        const portalToken = res.user.portalToken || res.portalToken || 'demo-portal-token-acme';
        navigate(`/portal/${portalToken}`, { replace: true });
      } else {
        toast.success('Account created! Please sign in with your email & password.');
        setAuthMode('password');
        setEmail(signupForm.email);
        setPassword(signupForm.password);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Customer registration failed');
    } finally {
      setSignupLoading(false);
    }
  };

  const demoClients = [
    { name: 'Acme Corporation', email: 'buyer@acme.com', tier: 'Gold' },
    { name: 'Beta Industries', email: 'contact@beta.com', tier: 'Silver' },
    { name: 'Gamma Retail', email: 'purchase@gamma.com', tier: 'Bronze' },
  ];

  const handleSelectClient = (clientEmail) => {
    setMagicEmail(clientEmail);
    setEmail(clientEmail);
    setPassword('Customer@123');
    toast.success(`Selected ${clientEmail}`);
  };

  const handlePrefillDemo = () => {
    setEmail('buyer@acme.com');
    setPassword('Customer@123');
    toast.success('Filled demo credentials (buyer@acme.com / Customer@123)');
  };

  const handleCopyToken = () => {
    const textToCopy = rawMagicToken
      ? `${window.location.origin}/login?token=${rawMagicToken}`
      : `${window.location.origin}/portal/${demoToken}`;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedToken(true);
    toast.success('Magic sign-in link copied to clipboard!');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="min-h-screen bg-paper bg-dot-grid flex flex-col justify-center items-center p-4 sm:p-6 antialiased">
      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pop-violet text-white font-heading font-extrabold text-2xl border-2 border-slate-900 shadow-pop-sm mb-1">
            D
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight">
            Customer Portal Access
          </h1>
          <p className="text-xs font-medium text-slate-600 max-w-xs mx-auto">
            Review, negotiate, and approve your enterprise quotations & orders
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-3xl border-2 border-slate-900 bg-white p-6 sm:p-8 shadow-pop-lg space-y-6">
          {/* Method Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 border-2 border-slate-900">
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`py-2 px-1 rounded-xl text-[11px] font-heading font-extrabold transition-all cursor-pointer truncate ${
                authMode === 'password'
                  ? 'bg-pop-violet text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In (Pass)
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`py-2 px-1 rounded-xl text-[11px] font-heading font-extrabold transition-all cursor-pointer truncate ${
                authMode === 'signup'
                  ? 'bg-pop-emerald text-slate-900 shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic');
                setMagicSent(false);
              }}
              className={`py-2 px-1 rounded-xl text-[11px] font-heading font-extrabold transition-all cursor-pointer truncate ${
                authMode === 'magic'
                  ? 'bg-pop-violet text-white shadow-pop-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* ════ OPTION 1: MAGIC LINK ═════════════════════════════════════ */}
          {authMode === 'magic' && (
            <div>
              {magicSent ? (
                <div className="space-y-4 text-center py-2 animate-in fade-in duration-200">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-slate-900 text-emerald-800 flex items-center justify-center mx-auto shadow-pop-sm">
                    <CheckCircle2 size={28} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-base font-heading font-extrabold text-slate-900">Check Your Email</h3>
                    <p className="text-xs font-medium text-slate-600 mt-1">
                      We sent a secure, passwordless authentication link to:
                    </p>
                    <p className="font-mono text-xs font-bold text-pop-violet mt-0.5">
                      {magicEmail}
                    </p>
                    {customerCompany && (
                      <p className="text-xs font-semibold text-slate-800 mt-2 inline-block px-3 py-1 rounded-xl bg-amber-100 border-2 border-slate-900 shadow-pop-sm">
                        Proposal Account: <strong className="text-slate-900">{customerCompany}</strong>
                      </p>
                    )}
                  </div>

                  {/* Demo Helper Token Display */}
                  {demoToken && (
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 border-2 border-slate-900 text-left space-y-2 shadow-pop-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-600 font-mono tracking-wider">
                          Portal Token
                        </span>
                        <button
                          onClick={handleCopyToken}
                          className="text-[11px] font-bold text-pop-violet hover:text-violet-700 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedToken ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2.5} />}
                          {copiedToken ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="font-mono text-xs text-slate-800 font-bold break-all bg-white p-2.5 rounded-xl border-2 border-slate-900">
                        {demoToken}
                      </p>

                      <button
                        onClick={handleLaunchWithMagic}
                        disabled={magicLoading}
                        className="btn-candy w-full py-2.5 px-3 rounded-xl bg-pop-violet hover:bg-violet-600 text-white font-heading font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer shadow-pop border-2 border-slate-900 active:translate-x-0.5 active:translate-y-0.5"
                      >
                        <Zap size={14} strokeWidth={2.5} className="text-yellow-300" />
                        <span>{magicLoading ? 'Signing in...' : 'Sign In & Launch Portal'}</span>
                        <ExternalLink size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setMagicSent(false)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 underline pt-2 block mx-auto cursor-pointer"
                  >
                    Enter a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Work Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        strokeWidth={2.5}
                      />
                      <input
                        type="email"
                        required
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        placeholder="buyer@acme.com"
                        className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={magicLoading}
                    className="btn-candy w-full py-3 px-4 rounded-xl bg-pop-violet hover:bg-violet-600 disabled:opacity-50 text-white font-heading font-extrabold text-xs shadow-pop border-2 border-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                  >
                    {magicLoading ? 'Sending link...' : 'Send me a login link'}
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </button>

                  {/* Multi-Client Demo Picker */}
                  <div className="pt-2">
                    <p className="text-[11px] font-heading font-extrabold text-slate-700 uppercase tracking-wider mb-2">Quick Demo Client Accounts:</p>
                    <div className="grid grid-cols-1 gap-2">
                      {demoClients.map((client) => (
                        <button
                          key={client.email}
                          type="button"
                          onClick={() => handleSelectClient(client.email)}
                          className={`flex items-center justify-between p-3 rounded-2xl border-2 border-slate-900 transition-all text-left text-xs cursor-pointer shadow-pop-sm hover:-translate-y-0.5 active:translate-y-0.5 ${
                            magicEmail === client.email
                              ? 'bg-amber-100 text-slate-900'
                              : 'bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-heading font-bold block truncate text-slate-900">{client.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono font-medium">{client.email}</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-slate-900 bg-slate-100 uppercase text-slate-800">
                            {client.tier}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ════ OPTION 2: PASSWORD LOGIN ═════════════════════════════════ */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    strokeWidth={2.5}
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@acme.com"
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    strokeWidth={2.5}
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-candy w-full py-3 px-4 rounded-xl bg-pop-violet hover:bg-violet-600 disabled:opacity-50 text-white font-heading font-extrabold text-xs shadow-pop border-2 border-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                {passwordLoading ? 'Signing in...' : 'Sign In to Portal'}
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>

              {/* Demo Hint */}
              <div
                onClick={handlePrefillDemo}
                className="p-3.5 rounded-2xl bg-amber-50 border-2 border-slate-900 shadow-pop-sm hover:bg-amber-100 transition-all cursor-pointer text-[11px] text-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-slate-900">Demo Customer Credentials:</span>
                  <span className="text-[10px] text-pop-violet font-bold underline">Click to fill</span>
                </div>
                <p className="mt-1 font-mono font-bold text-slate-900">buyer@acme.com / Customer@123</p>
                <p className="text-[10px] text-slate-500 mt-0.5">(also supports contact@beta.com or purchase@gamma.com)</p>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-xs font-bold text-pop-violet hover:underline cursor-pointer"
                >
                  New customer? Register a free portal account &rarr;
                </button>
              </div>
            </form>
          )}

          {/* ════ OPTION 3: NEW CUSTOMER SIGN UP ═══════════════════════════ */}
          {authMode === 'signup' && (
            <form onSubmit={handleCustomerSignup} className="space-y-3.5 animate-in fade-in duration-200">
              <div className="p-3 bg-emerald-50 rounded-2xl border-2 border-slate-900 text-slate-800 text-xs">
                <p className="font-heading font-extrabold text-emerald-900">🏢 Instant Customer Portal Setup</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Register with your email and password to instantly view your proposals and collaborate with sales.
                </p>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    strokeWidth={2.5}
                  />
                  <input
                    type="text"
                    required
                    value={signupForm.name}
                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company / Organization Name
                </label>
                <div className="relative">
                  <Building2
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    strokeWidth={2.5}
                  />
                  <input
                    type="text"
                    value={signupForm.companyName}
                    onChange={(e) => setSignupForm({ ...signupForm, companyName: e.target.value })}
                    placeholder="e.g. Vertex Industries Ltd"
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Email ID *
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    strokeWidth={2.5}
                  />
                  <input
                    type="email"
                    required
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    placeholder="buyer@vertex.com"
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Create Password *
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    strokeWidth={2.5}
                  />
                  <input
                    type="password"
                    required
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="btn-candy w-full py-3 px-4 rounded-xl bg-pop-emerald hover:bg-emerald-500 disabled:opacity-50 text-slate-900 font-heading font-extrabold text-xs shadow-pop border-2 border-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                <Rocket size={14} strokeWidth={2.5} />
                {signupLoading ? 'Registering...' : 'Create Account & Enter Portal'}
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('password')}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Already have an account? Sign In with Password
                </button>
              </div>
            </form>
          )}

          {/* Internal Staff Sign In Link */}
          <div className="pt-4 border-t-2 border-slate-100 text-center">
            <Link
              to="/login"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Are you an internal sales rep or manager?{' '}
              <span className="text-pop-violet font-bold underline">Staff Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
