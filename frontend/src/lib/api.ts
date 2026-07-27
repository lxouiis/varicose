import axios from 'axios';
import { useStore } from '../store/useStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

// Attach JWT token from Zustand store to every request
api.interceptors.request.use((config) => {
  const token = useStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle global errors e.g. 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear store and redirect to login if session expires
      useStore.getState().logout();
      alert('Session expired, please login again.');
      window.location.hash = '#/login';
    }
    return Promise.reject(error);
  }
);

export default api;
