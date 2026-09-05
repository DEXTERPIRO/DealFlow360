import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Layers, ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api';
import toast from 'react-hot-toast';

export default function Signup() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SALES_REP',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.signup(formData);
      const user = res.user;
      const accessToken = res.accessToken;
      setAuth(user, accessToken);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.detail || err.error || err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 items-center justify-center shadow-lg shadow-brand-600/30 text-white">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Create Account</h2>
          <p className="text-xs text-slate-400">
            Join DealFlow360 CPQ platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            name="name"
            placeholder="John Doe"
            icon={User}
            value={formData.name}
            onChange={handleChange}
            required
          />

          <Input
            label="Work Email"
            name="email"
            type="email"
            placeholder="john@example.com"
            icon={Mail}
            value={formData.email}
            onChange={handleChange}
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            icon={Lock}
            value={formData.password}
            onChange={handleChange}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-colors"
            >
              <option value="SALES_REP">Sales Representative</option>
              <option value="SALES_MANAGER">Sales Manager</option>
              <option value="FINANCE">Finance Team</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? 'Creating Account...' : 'Get Started'}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500 border-t border-slate-800/80 pt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:underline font-semibold">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
