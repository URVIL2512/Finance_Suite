import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const Layout = ({ user, onLogout }) => {
  const location = useLocation();
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [revenueExpanded, setRevenueExpanded] = useState(false);
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin';
  const permissions = user?.permissions || {};
  const canExpenses = isAdmin || !!permissions.expenses;
  const canSales = isAdmin || !!permissions.sales;
  const canRevenue = isAdmin || !!permissions.revenue;

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Reports', href: '/reports', icon: '📑' },
  ];

  const salesSubMenu = [
    { name: 'Items', href: '/items', icon: '📦' },
    { name: 'Customers', href: '/customers', icon: '👥' },
    { name: 'Invoices', href: '/invoices', icon: '🧾' },
    { name: 'Recurring Invoices', href: '/recurring-invoices', icon: '🔄' },
    { name: 'Payment', href: '/payment', icon: '💳' },
    { name: 'Client Ledger', href: '/client-ledger', icon: '📋' },
  ];

  const revenueSubMenu = [
    { name: 'Revenue', href: '/revenue', icon: '📈' },
    { name: 'Revenue Dashboard', href: '/revenue-dashboard', icon: '📊' },
  ];

  const expensesSubMenu = [
    { name: 'Dashboard', href: '/expense-dashboard', icon: '📊' },
    { name: 'Masters', href: '/expenses/masters', icon: '📋' },
    { name: 'Expenses', href: '/expenses', icon: '💰' },
    { name: 'Recurring Expenses', href: '/recurring-expenses', icon: '🔄' },
    { name: 'Ages', href: '/expense-aging', icon: '📈' },
  ];

  const isActive = (path) => location.pathname === path;
  const isSalesActive = canSales && salesSubMenu.some(item => isActive(item.href));
  const isRevenueActive = canRevenue && revenueSubMenu.some(item => isActive(item.href));
  const isExpensesActive = canExpenses && (expensesSubMenu.some(item => isActive(item.href)) || location.pathname.startsWith('/expenses/masters'));

  // Auto-expand Sales menu if any sub-item is active
  useEffect(() => {
    if (isSalesActive) {
      setSalesExpanded(true);
    }
  }, [location.pathname]);

  // Auto-expand Revenue menu if any sub-item is active
  useEffect(() => {
    if (isRevenueActive) {
      setRevenueExpanded(true);
    }
  }, [location.pathname]);

  // Auto-expand Expenses menu if any sub-item is active
  useEffect(() => {
    if (isExpensesActive) {
      setExpensesExpanded(true);
    }
  }, [location.pathname]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent background scroll when sidebar is open (mobile)
  useEffect(() => {
    if (!sidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden ${
          sidebarOpen ? 'block' : 'hidden'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/80 flex flex-col h-full shadow-[2px_0_8px_rgba(0,0,0,0.04)]
        transform transition-transform duration-200 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0`}
        aria-label="Sidebar"
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-blue-500/20">
              <span className="text-white text-xl font-bold">K</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Kology Suite
              </h1>
              <p className="text-xs text-slate-500 -mt-0.5 font-medium">Financial Management</p>
            </div>
            </div>

            {/* Close button (mobile) */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1.5">
            {/* Dashboard + Reports */}
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive(item.href)
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                    : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/30 hover:text-slate-900'
                } px-4 py-3 text-sm font-semibold flex items-center space-x-3 rounded-xl 
                transition-all duration-200 group relative`}
              >
                <span className={`text-lg transition-transform ${isActive(item.href) ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span className="tracking-tight">{item.name}</span>
                {isActive(item.href) && (
                  <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"></div>
                )}
              </Link>
            ))}

            {/* Expenses Menu with Dropdown */}
            {canExpenses && (
            <div className="space-y-1">
              <button
                onClick={() => setExpensesExpanded(!expensesExpanded)}
                className={`${
                  isExpensesActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/30 hover:text-slate-900'
                } w-full px-4 py-3 text-sm font-semibold flex items-center justify-between rounded-xl 
                transition-all duration-200 group`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`text-lg transition-transform ${isExpensesActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    💰
                  </span>
                  <span className="tracking-tight">Expenses</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${expensesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expenses Sub-menu Items */}
              {expensesExpanded && (
                <div className="ml-4 space-y-1 pl-4 border-l-2 border-slate-200">
                  {expensesSubMenu.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } block px-4 py-2 text-sm rounded-lg transition-all duration-200`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Sales Menu with Dropdown */}
            {canSales && (
            <div className="space-y-1">
              <button
                onClick={() => setSalesExpanded(!salesExpanded)}
                className={`${
                  isSalesActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/30 hover:text-slate-900'
                } w-full px-4 py-3 text-sm font-semibold flex items-center justify-between rounded-xl 
                transition-all duration-200 group`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`text-lg transition-transform ${isSalesActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    🧾
                  </span>
                  <span className="tracking-tight">Sales</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${salesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Sales Sub-menu Items */}
              {salesExpanded && (
                <div className="ml-4 space-y-1 pl-4 border-l-2 border-slate-200">
                  {salesSubMenu.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } block px-4 py-2 text-sm rounded-lg transition-all duration-200`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Revenue Menu with Dropdown */}
            {canRevenue && (
            <div className="space-y-1">
              <button
                onClick={() => setRevenueExpanded(!revenueExpanded)}
                className={`${
                  isRevenueActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/30 hover:text-slate-900'
                } w-full px-4 py-3 text-sm font-semibold flex items-center justify-between rounded-xl 
                transition-all duration-200 group`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`text-lg transition-transform ${isRevenueActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    📈
                  </span>
                  <span className="tracking-tight">Revenue</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${revenueExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Revenue Sub-menu Items */}
              {revenueExpanded && (
                <div className="ml-4 space-y-1 pl-4 border-l-2 border-slate-200">
                  {revenueSubMenu.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } block px-4 py-2 text-sm rounded-lg transition-all duration-200`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Admin (Admin only) */}
            {isAdmin && (
              <Link
                to="/admin"
                className={`${
                  isActive('/admin')
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                    : 'text-slate-700 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/30 hover:text-slate-900'
                } px-4 py-3 text-sm font-semibold flex items-center space-x-3 rounded-xl 
                transition-all duration-200 group relative`}
              >
                <span className={`text-lg transition-transform ${isActive('/admin') ? 'scale-110' : 'group-hover:scale-110'}`} aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </span>
                <span className="tracking-tight">Admin</span>
                {isActive('/admin') && (
                  <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"></div>
                )}
              </Link>
            )}

          </div>
        </nav>

        {/* Settings, Profile, and Logout Buttons */}
        <div className="p-4 border-t border-slate-200/60 bg-gradient-to-t from-white to-slate-50/30 space-y-2">
          {/* Settings Button */}
          <Link
            to="/settings"
            className={`${
              isActive('/settings')
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                : 'bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 text-slate-700'
            } w-full font-semibold flex items-center justify-center space-x-2 py-3 rounded-xl
                     transition-all duration-200 shadow-sm hover:shadow-md border border-slate-200/60
                     active:scale-[0.98] relative`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
            {isActive('/settings') && (
              <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"></div>
            )}
          </Link>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 
                     text-slate-700 font-semibold flex items-center justify-center space-x-2 py-3 rounded-xl
                     transition-all duration-200 shadow-sm hover:shadow-md border border-slate-200/60
                     active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 animate-fade-in min-w-0">
        <div className="w-full max-w-full px-3 sm:px-4 lg:px-5 xl:px-6 py-6 lg:py-8 xl:py-10">
          {/* Mobile top bar */}
          <div className="md:hidden mb-4 flex items-center justify-between">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-sm font-semibold text-slate-900 capitalize">
              {location.pathname === '/dashboard'
                ? 'Dashboard'
                : location.pathname === '/admin'
                  ? 'Admin'
                  : location.pathname.split('/').filter(Boolean).slice(-1)[0]?.replace(/-/g, ' ') || 'Menu'}
            </div>
            <div className="w-10" />
          </div>
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default Layout;

