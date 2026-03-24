import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://ams-server-three-khaki-41.vercel.app/api',
});

console.log('API baseURL:', import.meta.env.VITE_API_URL);

export default api;
