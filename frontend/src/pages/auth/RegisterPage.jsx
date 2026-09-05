import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Layers, ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/authApi';
import toast from 'react-hot-toast';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'BROKER',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.register(formData);
      setAuth(res.data.user, res.data.accessToken);
      toast.success('Corporate account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
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
          <h2 className="text-2xl font-black text-white tracking-tight">Create Seat</h2>
          <p className="text-xs text-slate-400">
            Join the DealFlow360 platform as a Broker, Analyst, or Client
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              name="firstName"
              placeholder="Elena"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
            <Input
              label="Last Name"
              name="lastName"
              placeholder="Vance"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <Input
            label="Corporate Email"
            name="email"
            type="email"
            icon={Mail}
            placeholder="elena@dealflow360.internal"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Platform Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm px-3.5 py-2.5 focus:border-brand-500 focus:outline-none"
            >
              <option value="BROKER">Deal Broker</option>
              <option value="ANALYST">M&A Analyst</option>
              <option value="CLIENT">Client / LP Investor</option>
              <option value="ADMIN">Managing Director / Admin</option>
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating Seat...' : 'Register Workspace Seat'}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500 border-t border-slate-800/80 pt-4">
          Already have credentials?{' '}
          <Link to="/login" className="text-brand-400 hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
