import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
});

let _token = null;
export const setToken = (t) => { _token = t; };

api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const res = await axios.post(
          'http://localhost:5000/api/auth/refresh',
          {}, { withCredentials: true }
        );
        _token = res.data.accessToken;
        original.headers.Authorization = `Bearer ${_token}`;
        return api(original);
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
