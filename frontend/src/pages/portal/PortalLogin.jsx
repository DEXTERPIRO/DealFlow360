import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authAPI } from '../../api';
import toast from 'react-hot-toast';

export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.magicLink(email);
      setSent(true);
      toast.success('Magic link sent to your email!');
    } catch (err) {
      toast.error(err.detail || err.error || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Customer Portal</h1>
          <p className="text-sm text-slate-400">
            Enter your email to receive a secure passwordless sign-in link
          </p>
        </div>

        {sent ? (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center space-y-2">
            <p className="text-sm text-blue-300 font-medium">Check your inbox</p>
            <p className="text-xs text-slate-400">
              We sent an access link to <span className="text-white font-medium">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending link...' : 'Send Magic Link'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
