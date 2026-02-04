import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Revenue from './pages/Revenue';
import Invoices from './pages/Invoices';
import Customers from './pages/Customers';
import RecurringInvoices from './pages/RecurringInvoices';
import RecurringExpenses from './pages/RecurringExpenses';
import Payment from './pages/Payment';
import Items from './pages/Items';
import ExpenseDashboard from './pages/ExpenseDashboard';
import ExpenseAging from './pages/ExpenseAging';
import RevenueDashboard from './pages/RevenueDashboard';
import Settings from './pages/Settings';
import ClientLedger from './pages/ClientLedger';
import PaymentModeMaster from './pages/PaymentModeMaster';
import VendorMaster from './pages/VendorMaster';
import BankAccountMaster from './pages/BankAccountMaster';
import ExpenseMasters from './pages/ExpenseMasters';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Users from './pages/Users';
import Layout from './components/Layout';
import { getAuthToken, removeAuthToken, setAuthToken } from './utils/auth';
import { ToastProvider } from './contexts/ToastContext';
import { FilterProvider } from './contexts/FilterContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import FilterDrawer from './components/FilterDrawer';
import { authAPI } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastRefreshAtRef = useRef(0);

  const refreshMe = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
    try {
      const r = await authAPI.getMe();
      setUser(r.data);
      setIsAuthenticated(true);
      return true;
    } catch {
      removeAuthToken();
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  // Keep permissions/user in sync after role/permission changes
  useEffect(() => {
    const maybeRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < 3000) return; // throttle
      lastRefreshAtRef.current = now;
      refreshMe();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeRefresh();
    };
    const onFocus = () => maybeRefresh();
    const onStorage = (e) => {
      if (e.key === 'token') maybeRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshMe]);

  const handleLogin = async (token) => {
    setAuthToken(token);
    try {
      const r = await authAPI.getMe();
      setUser(r.data);
      setIsAuthenticated(true);
    } catch {
      removeAuthToken();
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const isAdmin = (user?.role || '').toString().trim().toLowerCase() === 'admin';
  const permissions = user?.permissions || {};
  const canExpenses = isAdmin || !!permissions.expenses;
  const canSales = isAdmin || !!permissions.sales;
  const canRevenue = isAdmin || !!permissions.revenue;

  return (
    <ToastProvider>
      <FilterProvider>
        <CurrencyProvider>
          <Router>
            <FilterDrawer />
            <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Register onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route
            path="users"
            element={
              (user?.role || '').toString().toLowerCase() === 'admin' ? (
                <Users />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="admin"
            element={
              (user?.role || '').toString().toLowerCase() === 'admin' ? (
                <Admin />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          {/* Expenses module */}
          <Route path="expenses" element={canExpenses ? <Expenses /> : <Navigate to="/dashboard" replace />} />
          <Route path="expense-dashboard" element={canExpenses ? <ExpenseDashboard /> : <Navigate to="/dashboard" replace />} />
          <Route path="expense-aging" element={canExpenses ? <ExpenseAging /> : <Navigate to="/dashboard" replace />} />
          <Route path="expenses/masters" element={canExpenses ? <ExpenseMasters /> : <Navigate to="/dashboard" replace />} />
          <Route path="recurring-expenses" element={canExpenses ? <RecurringExpenses /> : <Navigate to="/dashboard" replace />} />

          {/* Revenue module */}
          <Route path="revenue" element={canRevenue ? <Revenue /> : <Navigate to="/dashboard" replace />} />
          <Route path="revenue-dashboard" element={canRevenue ? <RevenueDashboard /> : <Navigate to="/dashboard" replace />} />

          {/* Sales module */}
          <Route path="items" element={canSales ? <Items /> : <Navigate to="/dashboard" replace />} />
          <Route path="customers" element={canSales ? <Customers /> : <Navigate to="/dashboard" replace />} />
          <Route path="invoices" element={canSales ? <Invoices /> : <Navigate to="/dashboard" replace />} />
          <Route path="recurring-invoices" element={canSales ? <RecurringInvoices /> : <Navigate to="/dashboard" replace />} />
          <Route path="payment" element={canSales ? <Payment /> : <Navigate to="/dashboard" replace />} />
          <Route path="client-ledger" element={canSales ? <ClientLedger /> : <Navigate to="/dashboard" replace />} />

          <Route path="masters/payment-mode" element={<PaymentModeMaster />} />
          <Route path="masters/vendor" element={<VendorMaster />} />
          <Route path="masters/bank-account" element={<BankAccountMaster />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
          </Routes>
        </Router>
        </CurrencyProvider>
      </FilterProvider>
    </ToastProvider>
  );
}

export default App;

