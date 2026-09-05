import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Layers, ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('admin@dealflow360.com');
  const [password, setPassword] = useState('Password@123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      const user = res.user;
      const accessToken = res.accessToken;
      setAuth(user, accessToken);
      toast.success(`Welcome back, ${user.name || 'User'}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.detail || err.error || err.message || 'Login failed');
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
          <h2 className="text-2xl font-black text-white tracking-tight">DealFlow360</h2>
          <p className="text-xs text-slate-400">
            Sign in to access your CPQ dealflow platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Corporate Email"
            type="email"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Workspace'}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500 border-t border-slate-800/80 pt-4">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-400 hover:underline font-semibold">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
