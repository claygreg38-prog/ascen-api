import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('ascen_jwt');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const refresh = localStorage.getItem('ascen_refresh');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('ascen_jwt', data.token || data.jwt);
          err.config.headers.Authorization = `Bearer ${data.token || data.jwt}`;
          return api(err.config);
        } catch {
          localStorage.clear();
          window.location.href = '/app/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
