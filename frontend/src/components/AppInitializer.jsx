import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { setToken } from '../api/client';

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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">💼</div>
        <div className="text-white text-xl font-bold">DealFlow360</div>
        <div className="text-slate-400 text-sm mt-2">Loading platform...</div>
        <div className="flex gap-2 justify-center mt-4">
          {[0,150,300].map(d => (
            <div key={d} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );

  return children;
}
