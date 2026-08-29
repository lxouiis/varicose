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
    } else if (error.response?.data?.code === 'PASSWORD_RESET_REQUIRED') {
      // The server is the source of truth here, not the locally-cached
      // currentUser.mustResetPassword flag — this can fire even if that
      // flag is stale (e.g. an admin reset this doctor's password from
      // another session while this tab was already open). Sync the local
      // flag and force the redirect regardless of what page triggered it.
      const currentUser = useStore.getState().currentUser;
      if (currentUser) {
        useStore.setState({ currentUser: { ...currentUser, mustResetPassword: true } });
      }
      if (window.location.hash !== '#/reset-password') {
        window.location.hash = '#/reset-password';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
