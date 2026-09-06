import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_BASE_URL = rawBaseUrl.endsWith('/api')
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let _token = null;
export const setToken = (t) => { _token = t; };

api.interceptors.request.use((config) => {
  const token = _token || useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/login') && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {}, { withCredentials: true }
        );
        _token = res.data.accessToken;
        useAuthStore.getState().updateToken(_token);
        original.headers.Authorization = `Bearer ${_token}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    const rejectedError = error.response?.data || error;
    if (rejectedError && typeof rejectedError === 'object' && !rejectedError.response && error.response) {
      rejectedError.response = error.response;
    }
    return Promise.reject(rejectedError);
  }
);

export default api;
