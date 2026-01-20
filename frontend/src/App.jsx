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
import Layout from './components/Layout';
import { getAuthToken, removeAuthToken } from './utils/auth';
import { ToastProvider } from './contexts/ToastContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    removeAuthToken();
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
      <Router>
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
              <Layout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
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
    </ToastProvider>
  );
}

export default App;

