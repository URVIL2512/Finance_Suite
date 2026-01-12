import axios from 'axios';
import { getAuthToken, removeAuthToken } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeAuthToken();
      window.location.href = '/login';
    }
    
    // Handle network errors
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('Network Error: Backend server is not running or not accessible');
      console.error('Please ensure the backend server is running on http://localhost:5000');
      error.message = 'Cannot connect to server. Please ensure the backend server is running on port 5000.';
    }
    
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  getMe: () => api.get('/auth/me'),
};

// Expense APIs
export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
};

// Revenue APIs
export const revenueAPI = {
  getAll: (params) => api.get('/revenue', { params }),
  getById: (id) => api.get(`/revenue/${id}`),
  create: (data) => api.post('/revenue', data),
  update: (id, data) => api.put(`/revenue/${id}`, data),
  delete: (id) => api.delete(`/revenue/${id}`),
};

// Invoice APIs
export const invoiceAPI = {
  getAvailableRevenue: () => api.get('/invoices/available-revenue'),
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
};

// Dashboard APIs
export const dashboardAPI = {
  getExpenseDashboard: (params) => api.get('/dashboard/expenses', { params }),
  getRevenueDashboard: (params) => api.get('/dashboard/revenue', { params }),
  getSummary: (params) => api.get('/dashboard/summary', { params }),
};

// Customer APIs
export const customerAPI = {
  getAll: () => api.get('/customers'),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// Item APIs
export const itemAPI = {
  getAll: () => api.get('/items'),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};

// Salesperson APIs
export const salespersonAPI = {
  getAll: () => api.get('/salespersons'),
  getById: (id) => api.get(`/salespersons/${id}`),
  create: (data) => api.post('/salespersons', data),
  update: (id, data) => api.put(`/salespersons/${id}`, data),
  delete: (id) => api.delete(`/salespersons/${id}`),
};

// HSN/SAC APIs
export const hsnSacAPI = {
  getAll: (params) => api.get('/hsn-sac', { params }),
  getById: (id) => api.get(`/hsn-sac/${id}`),
  create: (data) => api.post('/hsn-sac', data),
  update: (id, data) => api.put(`/hsn-sac/${id}`, data),
  delete: (id) => api.delete(`/hsn-sac/${id}`),
};

// Settings APIs
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Recurring Invoice APIs
export const recurringInvoiceAPI = {
  getAll: () => api.get('/recurring-invoices'),
  getById: (id) => api.get(`/recurring-invoices/${id}`),
  create: (data) => api.post('/recurring-invoices', data),
  update: (id, data) => api.put(`/recurring-invoices/${id}`, data),
  delete: (id) => api.delete(`/recurring-invoices/${id}`),
};

// Recurring Expense APIs
export const recurringExpenseAPI = {
  getAll: () => api.get('/recurring-expenses'),
  getById: (id) => api.get(`/recurring-expenses/${id}`),
  create: (data) => api.post('/recurring-expenses', data),
  update: (id, data) => api.put(`/recurring-expenses/${id}`, data),
  delete: (id) => api.delete(`/recurring-expenses/${id}`),
};

// Payment APIs
export const paymentAPI = {
  getAll: (params) => api.get('/payments', { params }),
  getById: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
};

export default api;

