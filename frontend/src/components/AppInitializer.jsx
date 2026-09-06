import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { setToken } from '../api/client';
import { Briefcase } from 'lucide-react';

export default function AppInitializer({ children }) {
  const [ready, setReady] = useState(false);
  const { user, setAuth, logout } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      if (user) {
        try {
          const res = await fetch('http://localhost:5000/api/auth/refresh', {
            method: 'POST', credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            setToken(data.accessToken);
            setAuth(user, data.accessToken);
          } else { logout(); }
        } catch { }
      }
      setReady(true);
    };
    init();
  }, []);

  if (!ready) return (
    <div className="min-h-screen bg-paper bg-dot-grid flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-900 shadow-pop-lg rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-pop-violet text-white border-2 border-slate-900 shadow-pop flex items-center justify-center animate-bounce">
          <Briefcase size={32} strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-slate-900 text-2xl font-heading font-extrabold tracking-tight">DealFlow360</div>
          <div className="text-slate-600 text-xs font-medium mt-1">Initializing enterprise pipeline...</div>
        </div>
        <div className="flex gap-2 justify-center pt-2">
          {[0, 150, 300].map(d => (
            <div
              key={d}
              className="w-3 h-3 bg-pop-yellow border-2 border-slate-900 rounded-full animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return children;
}
