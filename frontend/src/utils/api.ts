import axios from 'axios';

let baseUrl = import.meta.env.VITE_API_URL || '/api';
if (baseUrl !== '/api' && !baseUrl.endsWith('/api')) {
  baseUrl = `${baseUrl.replace(/\/$/, '')}/api`;
}

const api = axios.create({
  baseURL: baseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor to append JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
