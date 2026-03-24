import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Debug: log the baseURL
console.log('API baseURL:', import.meta.env.VITE_API_URL);

export default api;
