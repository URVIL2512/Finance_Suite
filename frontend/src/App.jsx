import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
import Users from './pages/Users';
import Layout from './components/Layout';
import { getAuthToken, removeAuthToken, setAuthToken } from './utils/auth';
import { ToastProvider } from './contexts/ToastContext';
import { FilterProvider } from './contexts/FilterContext';
import FilterDrawer from './components/FilterDrawer';
import { authAPI } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authAPI
      .getMe()
      .then((r) => {
        setUser(r.data);
        setIsAuthenticated(true);
      })
      .catch(() => {
        removeAuthToken();
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <ToastProvider>
      <FilterProvider>
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
              user?.role === 'admin' ? (
                <Users />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route path="expenses" element={<Expenses />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="customers" element={<Customers />} />
          <Route path="recurring-invoices" element={<RecurringInvoices />} />
          <Route path="recurring-expenses" element={<RecurringExpenses />} />
          <Route path="payment" element={<Payment />} />
          <Route path="items" element={<Items />} />
          <Route path="expense-dashboard" element={<ExpenseDashboard />} />
          <Route path="expense-aging" element={<ExpenseAging />} />
          <Route path="expenses/masters" element={<ExpenseMasters />} />
          <Route path="revenue-dashboard" element={<RevenueDashboard />} />
          <Route path="client-ledger" element={<ClientLedger />} />
          <Route path="masters/payment-mode" element={<PaymentModeMaster />} />
          <Route path="masters/vendor" element={<VendorMaster />} />
          <Route path="masters/bank-account" element={<BankAccountMaster />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
          </Routes>
        </Router>
      </FilterProvider>
    </ToastProvider>
  );
}

export default App;

