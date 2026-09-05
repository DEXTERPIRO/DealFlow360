import { create } from 'zustand';

const storedUser = localStorage.getItem('df360_user');

export const useAuthStore = create((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  accessToken: localStorage.getItem('df360_access_token') || null,
  isAuthenticated: !!localStorage.getItem('df360_access_token'),

  setAuth: (user, accessToken) => {
    localStorage.setItem('df360_user', JSON.stringify(user));
    localStorage.setItem('df360_access_token', accessToken);
    set({ user, accessToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('df360_user');
    localStorage.removeItem('df360_access_token');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
