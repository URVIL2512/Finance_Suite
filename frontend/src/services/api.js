import axios from 'axios';
import { getAuthToken, removeAuthToken } from '../utils/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  maxRedirects: 5,
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
      const msg = error.response?.data?.message || '';
      if (msg === 'Your account is disabled. Contact administrator.') {
        try {
          sessionStorage.setItem('loginMessage', msg);
        } catch (_) {}
      }
      removeAuthToken();
      window.location.href = '/login';
    }
    
    // Handle network errors
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ERR_INSUFFICIENT_RESOURCES') {
      // For insufficient resources, don't log as error - it's usually temporary due to too many concurrent requests
      if (error.code === 'ERR_INSUFFICIENT_RESOURCES') {
        console.warn('Too many concurrent requests. Some requests may be queued.');
        // Silently fail - the request will retry on next refresh
        return Promise.reject(error);
      }
      console.error('Network Error: Backend server is not running or not accessible');
      console.error('Please ensure the backend server is running on http://localhost:5003');
      error.message = 'Cannot connect to server. Please ensure the backend server is running on port 5003.';
    }
    
    return Promise.reject(error);
  }
);

// Auth APIs (login accepts email or username in the first argument)
export const authAPI = {
  login: (emailOrUsername, password) =>
    api.post('/auth/login', { email: emailOrUsername, username: emailOrUsername, password }),
  register: (name, email, phone, password) => api.post('/auth/register', { name, email, phone, password }),
  getMe: () => api.get('/auth/me'),
};

// User management APIs (admin only)
export const userAPI = {
  create: (data) => api.post('/admin/users/create', data),
  list: (params) => api.get('/admin/users/list', { params }),
  update: (id, data) => api.put(`/admin/users/update/${id}`, data),
  updateStatus: (id, status) => api.put(`/admin/users/status/${id}`, { status }),
  resetPassword: (id, newPassword) => api.put(`/admin/users/reset-password/${id}`, { newPassword }),
  delete: (id) => api.delete(`/admin/users/delete/${id}`),
};

export const adminAPI = {
  createUser: (data) => api.post('/admin/create-user', data),
  changePassword: (newPassword) => api.put('/admin/change-password', { newPassword }),
};

// Expense APIs
export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/expenses/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  uploadPDF: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/expenses/upload-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  uploadExpensePDF: (expenseId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/expenses/${expenseId}/upload-expense`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  removeDuplicates: () => api.post('/expenses/remove-duplicates'),
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
  deleteMultiple: (invoiceIds) => api.delete('/invoices/bulk', { data: { invoiceIds } }),
  void: (id) => api.put(`/invoices/${id}/void`),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/invoices/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Dashboard APIs
export const dashboardAPI = {
  getExpenseDashboard: (params) => api.get('/dashboard/expenses', { params }),
  getExpenseAging: () => api.get('/dashboard/expenses/aging'),
  getExpenseAgingPDF: () => api.get('/dashboard/expenses/aging/pdf', { responseType: 'blob' }),
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
  export: (params = {}) => api.get('/customers/export', { params }),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/customers/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Item APIs
export const itemAPI = {
  getAll: () => api.get('/items'),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
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
  getPaymentHistoryPDF: (invoiceId) => api.get(`/payments/invoice/${invoiceId}/pdf`, { responseType: 'blob' }),
};

// Ledger APIs
export const ledgerAPI = {
  getCustomers: () => api.get('/ledger/customers'),
  getLedger: (customerId) => api.get('/ledger', { params: { customerId } }),
};

// Payment Mode Master APIs
export const paymentModeAPI = {
  getAll: (params) => api.get('/payment-modes', { params }),
  getById: (id) => api.get(`/payment-modes/${id}`),
  create: (data) => api.post('/payment-modes', data),
  update: (id, data) => api.put(`/payment-modes/${id}`, data),
  delete: (id) => api.delete(`/payment-modes/${id}`),
};

// Vendor Master APIs
export const vendorAPI = {
  getAll: (params) => api.get('/vendors', { params }),
  getById: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};

// Bank Account Master APIs
export const bankAccountAPI = {
  getAll: (params) => api.get('/bank-accounts', { params }),
  getById: (id) => api.get(`/bank-accounts/${id}`),
  create: (data) => api.post('/bank-accounts', data),
  update: (id, data) => api.put(`/bank-accounts/${id}`, data),
  delete: (id) => api.delete(`/bank-accounts/${id}`),
};

// Expense Category Master APIs
export const expenseCategoryAPI = {
  getAll: (params) => api.get('/expense-categories', { params }),
  create: (data) => api.post('/expense-categories', data),
  update: (id, data) => api.put(`/expense-categories/${id}`, data),
  delete: (id) => api.delete(`/expense-categories/${id}`),
};

// Department Master APIs
export const departmentAPI = {
  getAll: (params) => api.get('/departments', { params }),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
};

// Reports APIs
export const reportsAPI = {
  profitLoss: (params) => api.get('/reports/profit-loss', { params }),
  incomeVsExpense: (params) => api.get('/reports/income-vs-expense', { params }),
  cashFlow: (params) => api.get('/reports/cash-flow', { params }),
  outstandingSummary: (params) => api.get('/reports/outstanding-summary', { params }),
  incomeSummary: (params) => api.get('/reports/income-summary', { params }),
  recurringIncome: (params) => api.get('/reports/recurring-income', { params }),
  invoiceAging: (params) => api.get('/reports/invoice-aging', { params }),
  topClients: (params) => api.get('/reports/top-clients', { params }),
  collectionEfficiency: (params) => api.get('/reports/collection-efficiency', { params }),
  fixedVsVariableExpense: (params) => api.get('/reports/fixed-vs-variable-expense', { params }),
  expenseDepartment: (params) => api.get('/reports/expense-department', { params }),
  expenseVendor: (params) => api.get('/reports/expense-vendor', { params }),
  expenseCategory: (params) => api.get('/reports/expense-category', { params }),
  topExpenseCategories: (params) => api.get('/reports/top-expense-categories', { params }),
  clientProfitability: (params) => api.get('/reports/client-profitability', { params }),
  budgetVsActual: (params) => api.get('/reports/budget-vs-actual', { params }),
  expenseForecast: (params) => api.get('/reports/expense-forecast', { params }),
  revenueForecast: (params) => api.get('/reports/revenue-forecast', { params }),
  gst: (params) => api.get('/reports/gst', { params }),
  paymentModeIncome: (params) => api.get('/reports/payment-mode-income', { params }),
  paymentModeExpense: (params) => api.get('/reports/payment-mode-expense', { params }),
};

// Budget APIs (for Budget vs Actual inputs)
export const budgetAPI = {
  getAll: (params) => api.get('/budgets', { params }),
  getById: (id) => api.get(`/budgets/${id}`),
  create: (data) => api.post('/budgets', data),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  delete: (id) => api.delete(`/budgets/${id}`),
};

// Currency APIs
export const currencyAPI = {
  getRates: () => api.get('/currency/rates'),
  convert: (data) => api.post('/currency/convert', data),
  getSupportedCurrencies: () => api.get('/currency/supported'),
};

export default api;

