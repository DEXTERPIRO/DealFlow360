import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Check
} from 'lucide-react';
import { authAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function PortalLogin() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  // Mode: 'magic' | 'password'
  const [authMode, setAuthMode] = useState('magic');

  // Magic Link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [demoToken, setDemoToken] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── Handle Magic Link ────────────────────────────────────────────────────

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
      // For demo: capture token from response if provided or generate demo portal token
      const token = res?.token || res?.portalToken || 'demo-portal-token-acme';
      setDemoToken(token);
      toast.success('Magic link generated!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to send magic link');
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
        toast.success(`Welcome back, ${res.user.name || 'Customer'}!`);

        // If customer has an active portal token redirect there, otherwise dashboard
        if (res.user.portalToken) {
          navigate(`/portal/${res.user.portalToken}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Invalid email or password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePrefillDemo = () => {
    setEmail('customer@acme.com');
    setPassword('Customer@123');
    toast.success('Customer credentials filled!');
  };

  const handlePrefillMagic = () => {
    setMagicEmail('customer@acme.com');
    toast.success('Customer email filled!');
  };

  const handleCopyToken = () => {
    if (!demoToken) return;
    navigator.clipboard.writeText(demoToken);
    setCopiedToken(true);
    toast.success('Token copied!');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-xl shadow-xl shadow-blue-600/20 mb-1">
            D
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Customer Portal Sign In
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Access, negotiate, and digitally confirm your enterprise proposals
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Method Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic');
                setMagicSent(false);
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'magic'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Magic Link
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'password'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Email & Password
            </button>
          </div>

          {/* ════ OPTION 1: MAGIC LINK ═════════════════════════════════════ */}
          {authMode === 'magic' && (
            <div>
              {magicSent ? (
                <div className="space-y-4 text-center py-2 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Check Your Email</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      We sent a secure, passwordless authentication link to:
                    </p>
                    <p className="font-mono text-xs font-semibold text-blue-400 mt-0.5">
                      {magicEmail}
                    </p>
                  </div>

                  {/* Demo Helper Token Display */}
                  {demoToken && (
                    <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Demo Live Token
                        </span>
                        <button
                          onClick={handleCopyToken}
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                          {copiedToken ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="font-mono text-xs text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
                        {demoToken}
                      </p>

                      <Link
                        to={`/portal/${demoToken}`}
                        className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 mt-2"
                      >
                        Launch Portal Directly
                        <ExternalLink size={13} />
                      </Link>
                    </div>
                  )}

                  <button
                    onClick={() => setMagicSent(false)}
                    className="text-xs text-slate-400 hover:text-white underline pt-2 block mx-auto"
                  >
                    Enter a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Your Work Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                      />
                      <input
                        type="email"
                        required
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        placeholder="procurement@acme.com"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={magicLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {magicLoading ? 'Sending link...' : 'Send me a login link'}
                    <ArrowRight size={14} />
                  </button>

                  {/* Magic Link Demo Hint */}
                  <div
                    onClick={handlePrefillMagic}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900/60 transition-all cursor-pointer text-[11px] text-slate-400 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Demo Customer Email:</span>
                      <span className="text-[10px] text-blue-400 group-hover:underline font-medium">Click to fill</span>
                    </div>
                    <p className="mt-1 font-mono text-slate-300">customer@acme.com</p>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ════ OPTION 2: PASSWORD LOGIN ═════════════════════════════════ */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@acme.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {passwordLoading ? 'Signing in...' : 'Sign In to Portal'}
                <ArrowRight size={14} />
              </button>

              {/* Demo Hint */}
              <div
                onClick={handlePrefillDemo}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900/60 transition-all cursor-pointer text-[11px] text-slate-400 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Demo Customer Credentials:</span>
                  <span className="text-[10px] text-blue-400 group-hover:underline font-medium">Click to fill</span>
                </div>
                <p className="mt-1 font-mono text-slate-300">customer@acme.com / Customer@123</p>
                <p className="text-[10px] text-slate-500 mt-0.5">(also accepts customer123)</p>
              </div>
            </form>
          )}

          {/* Internal Staff Sign In Link */}
          <div className="pt-4 border-t border-slate-800/80 text-center">
            <Link
              to="/login"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Are you an internal sales rep or manager?{' '}
              <span className="text-blue-400 font-semibold underline">Staff Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
