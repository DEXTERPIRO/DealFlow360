import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Check,
  Info,
  Building2,
  Briefcase,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api';
import { setToken } from '../../api/client';
import { getRedirectPathForUser } from '../../utils/authRedirect';
import toast from 'react-hot-toast';

export default function Signup() {
  const navigate = useNavigate();
  const { user: currentUser, setAuth } = useAuthStore();

  React.useEffect(() => {
    if (currentUser) {
      navigate(getRedirectPathForUser(currentUser), { replace: true });
    }
  }, [currentUser, navigate]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    companyName: '',
    password: '',
    confirmPassword: '',
    role: 'CUSTOMER',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-700' };
    let s = 0;
    if (pass.length >= 8) s += 1;
    if (/[A-Z]/.test(pass)) s += 1;
    if (/[0-9]/.test(pass)) s += 1;
    if (/[^A-Za-z0-9]/.test(pass)) s += 1;

    if (s <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (s <= 3) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(formData.password);

  const passRules = {
    hasMinLen: (formData.password || '').length >= 8,
    hasUpper: /[A-Z]/.test(formData.password || ''),
    hasNumber: /[0-9]/.test(formData.password || ''),
    hasSpecial: /[^A-Za-z0-9]/.test(formData.password || ''),
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Full name is required';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errs.email = 'Work email is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errs.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await authAPI.signup({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        company_name: formData.companyName.trim() || undefined,
      });

      const user = res.user;
      const accessToken = res.accessToken;
      setAuth(user, accessToken);
      setToken(accessToken);
      toast.success(
        user.role === 'CUSTOMER'
          ? 'Customer account created! Welcome to your Portal.'
          : 'Account created successfully!'
      );

      // Redirect based on role
      navigate(getRedirectPathForUser(user));
    } catch (err) {
      const msg = err.detail || err.error || err.message || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-paper bg-dot-grid antialiased">
      <div className="w-full max-w-lg p-8 rounded-3xl bg-white border-2 border-slate-900 shadow-pop-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-pop-violet items-center justify-center border-2 border-slate-900 shadow-pop-sm text-white">
            <Layers className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight">Create Account</h2>
          <p className="text-xs font-medium text-slate-600">
            Sign up as a client to review & sign proposals, or as a sales representative
          </p>
        </div>

        {/* Account Type Selector */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 border-2 border-slate-900">
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, role: 'CUSTOMER' }))}
            className={`py-2 px-3 rounded-xl text-xs font-heading font-black transition-all cursor-pointer ${
              formData.role === 'CUSTOMER'
                ? 'bg-pop-violet text-white shadow-pop-sm border-2 border-slate-900'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 justify-center">
              <Building2 className="w-4 h-4" strokeWidth={2.5} />
              Customer / Client
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, role: 'SALES_REP' }))}
            className={`py-2 px-3 rounded-xl text-xs font-heading font-black transition-all cursor-pointer ${
              formData.role === 'SALES_REP'
                ? 'bg-pop-violet text-white shadow-pop-sm border-2 border-slate-900'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 justify-center">
              <Briefcase className="w-4 h-4" strokeWidth={2.5} />
              Sales Representative
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Elena Vance"
                autoComplete="off"
                spellCheck="false"
                className={`w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all ${
                  errors.name ? 'border-rose-500' : ''
                }`}
              />
            </div>
            {errors.name && <p className="text-[11px] text-rose-600 mt-1 pl-1 font-bold">{errors.name}</p>}
          </div>

          {/* Company Name (for Customer) */}
          {formData.role === 'CUSTOMER' && (
            <div className="animate-in fade-in duration-150">
              <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Company / Organization Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Acme Corporation"
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {formData.role === 'CUSTOMER' ? 'Customer Email (Sign In ID)' : 'Work Email'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={formData.role === 'CUSTOMER' ? 'buyer@company.com' : 'elena@company.com'}
                autoComplete="off"
                spellCheck="false"
                className={`w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all ${
                  errors.email ? 'border-rose-500' : ''
                }`}
              />
            </div>
            {errors.email && <p className="text-[11px] text-rose-600 mt-1 pl-1 font-bold">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
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
            {errors.password && <p className="text-[11px] text-rose-600 mt-1 pl-1 font-bold">{errors.password}</p>}

            {/* Password Strength Meter */}
            {formData.password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium">
                  <span>Password strength:</span>
                  <span className={`font-bold ${strength.score === 3 ? 'text-emerald-700' : strength.score === 2 ? 'text-amber-700' : 'text-rose-700'}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 h-2 w-full bg-slate-100 rounded-full border border-slate-300 overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${strength.score >= 1 ? strength.color : 'bg-transparent'}`} />
                  <div className={`h-full transition-all duration-300 ${strength.score >= 2 ? strength.color : 'bg-transparent'}`} />
                  <div className={`h-full transition-all duration-300 ${strength.score >= 3 ? strength.color : 'bg-transparent'}`} />
                </div>
              </div>
            )}

            {/* Password Guidance Hints */}
            <div className="mt-2.5 p-3.5 rounded-2xl bg-amber-50/80 border-2 border-slate-900 shadow-pop-sm space-y-2">
              <div className="flex items-center justify-between text-[10px] font-heading font-extrabold text-slate-800 uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-slate-900">
                  <Info className="w-3.5 h-3.5 text-pop-violet shrink-0" strokeWidth={2.5} />
                  Hints to make password strong:
                </span>
                {strength.score === 3 && (
                  <span className="text-emerald-800 font-bold lowercase text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} /> strong
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                <div className={`flex items-center gap-1.5 transition-colors ${passRules.hasMinLen ? 'text-emerald-800 font-bold' : 'text-slate-500'}`}>
                  {passRules.hasMinLen ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1 shrink-0" />
                  )}
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 transition-colors ${passRules.hasUpper ? 'text-emerald-800 font-bold' : 'text-slate-500'}`}>
                  {passRules.hasUpper ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1 shrink-0" />
                  )}
                  <span>1 uppercase (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 transition-colors ${passRules.hasNumber ? 'text-emerald-800 font-bold' : 'text-slate-500'}`}>
                  {passRules.hasNumber ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1 shrink-0" />
                  )}
                  <span>1 number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 transition-colors ${passRules.hasSpecial ? 'text-emerald-800 font-bold' : 'text-slate-500'}`}>
                  {passRules.hasSpecial ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-1 mr-1 shrink-0" />
                  )}
                  <span>1 special symbol (!@#$)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-heading font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.5} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
                className={`w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:bg-white focus:shadow-pop-sm transition-all ${
                  errors.confirmPassword ? 'border-rose-500' : ''
                }`}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-[11px] text-rose-600 mt-1 pl-1 font-bold">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-candy bg-pop-violet hover:bg-violet-600 text-white w-full mt-2 py-3.5 px-4 rounded-xl border-2 border-slate-900 shadow-pop text-sm font-heading font-extrabold flex items-center justify-center gap-2 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50"
          >
            {loading ? 'Registering Account...' : 'Complete Registration'}
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </form>

        <div className="text-center text-xs text-slate-600 font-medium border-t-2 border-slate-100 pt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-pop-violet hover:underline font-bold">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
