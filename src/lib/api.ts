import axios from 'axios';

// Normalize the base URL: the Vercel dashboard env var historically pointed at
// the bare backend domain (without /api), so append /api when it is missing.
const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const apiBase = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL: apiBase,
});

// Attach the JWT to every request. The token is stored by AuthProvider under
// the 'authToken' key on login.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a protected endpoint rejects the token (expired/invalid), clear the
// session and send the user back to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('authToken');
      const path = window.location.pathname;
      // Public pages must never bounce to the admin login screen.
      if (path !== '/login' && path !== '/enroll') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
