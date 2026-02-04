import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { budgetAPI, reportsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import * as XLSX from 'xlsx';

const money = (n) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b'];

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const getQuarterForDate = (d) => Math.floor(d.getMonth() / 3) + 1;

const REPORT_GROUPS = [
  {
    id: 'financial',
    title: 'Financial',
    items: [
      { id: 'pl', title: 'P&L' },
      { id: 'incomeVsExpense', title: 'Income vs Expense' },
      { id: 'cashFlow', title: 'Cash Flow' },
      { id: 'outstanding', title: 'Outstanding' },
      { id: 'clientProfit', title: 'Client Profitability' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    items: [
      { id: 'incomeSummary', title: 'Income Summary' },
      { id: 'recurringIncome', title: 'Recurring vs One-time' },
      { id: 'invoiceAging', title: 'Invoice Aging' },
      { id: 'topClients', title: 'Top Clients' },
    ],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    items: [
      { id: 'categoryExpense', title: 'Expense Category' },
      { id: 'deptExpense', title: 'Department Expense' },
      { id: 'vendorExpense', title: 'Vendor/Tool Expense' },
      { id: 'fixedVar', title: 'Fixed vs Variable' },
      { id: 'topExpenseCats', title: 'Top Expense Categories' },
    ],
  },
  {
    id: 'budget',
    title: 'Budget & Forecast',
    items: [
      { id: 'budgetVsActual', title: 'Budget vs Actual' },
      { id: 'expenseForecast', title: 'Expense Forecast' },
      { id: 'revenueForecast', title: 'Revenue Forecast' },
    ],
  },
  {
    id: 'tax',
    title: 'Tax & Payment',
    items: [
      { id: 'gst', title: 'GST Report' },
      { id: 'pmIncome', title: 'Payment Mode (Income)' },
      { id: 'pmExpense', title: 'Payment Mode (Expense)' },
    ],
  },
];

const REPORT_META_BY_ID = REPORT_GROUPS.reduce((acc, g) => {
  for (const item of g.items) acc[item.id] = { ...item, groupId: g.id, groupTitle: g.title };
  return acc;
}, {});

const exportToExcel = (filename, sheets) => {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows || []);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
  }
  XLSX.writeFile(wb, filename);
};

const Kpi = ({ label, value }) => (
  <div className="kpi-card">
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
  </div>
);

const Reports = () => {
  const { showToast } = useToast();

  const now = useMemo(() => new Date(), []);
  const [active, setActive] = useState('pl');

  // Filters are edited in UI, then "Apply" pushes them to the API layer.
  const [filters, setFilters] = useState(() => ({
    view: 'monthly', // monthly | quarterly | yearly | custom
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    quarter: getQuarterForDate(new Date()),
    startDate: '',
    endDate: '',
    invoiceStatus: '',
    expenseStatus: '',
  }));

  const [appliedFilters, setAppliedFilters] = useState(() => ({
    view: 'monthly',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    quarter: getQuarterForDate(new Date()),
    startDate: '',
    endDate: '',
    invoiceStatus: '',
    expenseStatus: '',
  }));

  const hasPendingFilterChanges = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(appliedFilters),
    [filters, appliedFilters]
  );

  const canAutoApply = useMemo(() => {
    // Only auto-apply "custom" view once the range is valid.
    if (filters.view !== 'custom') return true;
    if (!filters.startDate || !filters.endDate) return false;
    const s = new Date(filters.startDate);
    const e = new Date(filters.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
    return s <= e;
  }, [filters.endDate, filters.startDate, filters.view]);

  const appliedParams = useMemo(() => {
    const p = {
      view: appliedFilters.view,
      year: appliedFilters.year,
      month: appliedFilters.month,
      quarter: appliedFilters.quarter,
    };
    if (appliedFilters.invoiceStatus) p.invoiceStatus = appliedFilters.invoiceStatus;
    if (appliedFilters.expenseStatus) p.expenseStatus = appliedFilters.expenseStatus;
    if (appliedFilters.view === 'custom') {
      if (appliedFilters.startDate) p.startDate = appliedFilters.startDate;
      if (appliedFilters.endDate) p.endDate = appliedFilters.endDate;
    }
    return p;
  }, [appliedFilters]);

  const appliedPeriodLabel = useMemo(() => {
    const y = appliedFilters.year;
    if (appliedFilters.view === 'yearly') return `Yearly · ${y}`;
    if (appliedFilters.view === 'quarterly') return `Quarterly · Q${appliedFilters.quarter} ${y}`;
    if (appliedFilters.view === 'monthly') {
      const m = MONTH_OPTIONS.find((x) => x.value === appliedFilters.month)?.label || `Month ${appliedFilters.month}`;
      return `Monthly · ${m} ${y}`;
    }
    if (appliedFilters.view === 'custom') {
      if (appliedFilters.startDate && appliedFilters.endDate) return `Custom · ${appliedFilters.startDate} → ${appliedFilters.endDate}`;
      return 'Custom';
    }
    return 'Monthly';
  }, [appliedFilters]);

  const [pl, setPl] = useState(null);
  const [incomeVsExpense, setIncomeVsExpense] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [incomeSummary, setIncomeSummary] = useState(null);
  const [recurringIncome, setRecurringIncome] = useState(null);
  const [invoiceAging, setInvoiceAging] = useState(null);
  const [topClients, setTopClients] = useState(null);
  const [fixedVar, setFixedVar] = useState(null);
  const [deptExpense, setDeptExpense] = useState(null);
  const [vendorExpense, setVendorExpense] = useState(null);
  const [categoryExpense, setCategoryExpense] = useState(null);
  const [topExpenseCats, setTopExpenseCats] = useState(null);
  const [clientProfit, setClientProfit] = useState(null);
  const [budgetVsActual, setBudgetVsActual] = useState(null);
  const [expenseForecast, setExpenseForecast] = useState(null);
  const [revenueForecast, setRevenueForecast] = useState(null);
  const [gst, setGst] = useState(null);
  const [pmIncome, setPmIncome] = useState(null);
  const [pmExpense, setPmExpense] = useState(null);

  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default: show filters on desktop, hide on mobile
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024; // Tailwind lg breakpoint
  });

  // Premium navbar indicator positioning (so tabs don't look "basic")
  const groupTabsRef = useRef(null);
  const groupBtnRefs = useRef({});
  const reportTabsRef = useRef(null);
  const reportBtnRefs = useRef({});

  const [groupIndicator, setGroupIndicator] = useState({ left: 4, width: 0, opacity: 0 });
  const [reportIndicator, setReportIndicator] = useState({ left: 4, width: 0, opacity: 0 });

  // Budget form (for quick entry)
  const [budgetForm, setBudgetForm] = useState({
    periodStart: '',
    periodEnd: '',
    department: 'Unassigned',
    category: 'All',
    amount: '',
    reason: '',
  });
  const [showBudgetForm, setShowBudgetForm] = useState(false);

  const fetchActive = async () => {
    try {
      setLoading(true);
      if (active === 'pl') setPl((await reportsAPI.profitLoss(appliedParams)).data);
      else if (active === 'incomeVsExpense') setIncomeVsExpense((await reportsAPI.incomeVsExpense(appliedParams)).data);
      else if (active === 'cashFlow') setCashFlow((await reportsAPI.cashFlow(appliedParams)).data);
      else if (active === 'outstanding') setOutstanding((await reportsAPI.outstandingSummary(appliedParams)).data);
      else if (active === 'incomeSummary') setIncomeSummary((await reportsAPI.incomeSummary(appliedParams)).data);
      else if (active === 'recurringIncome') setRecurringIncome((await reportsAPI.recurringIncome(appliedParams)).data);
      else if (active === 'invoiceAging') setInvoiceAging((await reportsAPI.invoiceAging(appliedParams)).data);
      else if (active === 'topClients') setTopClients((await reportsAPI.topClients(appliedParams)).data);
      else if (active === 'fixedVar') setFixedVar((await reportsAPI.fixedVsVariableExpense(appliedParams)).data);
      else if (active === 'deptExpense') setDeptExpense((await reportsAPI.expenseDepartment(appliedParams)).data);
      else if (active === 'vendorExpense') setVendorExpense((await reportsAPI.expenseVendor(appliedParams)).data);
      else if (active === 'categoryExpense') setCategoryExpense((await reportsAPI.expenseCategory(appliedParams)).data);
      else if (active === 'topExpenseCats') setTopExpenseCats((await reportsAPI.topExpenseCategories(appliedParams)).data);
      else if (active === 'clientProfit') setClientProfit((await reportsAPI.clientProfitability(appliedParams)).data);
      else if (active === 'budgetVsActual') setBudgetVsActual((await reportsAPI.budgetVsActual(appliedParams)).data);
      else if (active === 'expenseForecast') setExpenseForecast((await reportsAPI.expenseForecast(appliedParams)).data);
      else if (active === 'revenueForecast') setRevenueForecast((await reportsAPI.revenueForecast(appliedParams)).data);
      else if (active === 'gst') setGst((await reportsAPI.gst(appliedParams)).data);
      else if (active === 'pmIncome') setPmIncome((await reportsAPI.paymentModeIncome(appliedParams)).data);
      else if (active === 'pmExpense') setPmExpense((await reportsAPI.paymentModeExpense(appliedParams)).data);
    } catch (error) {
      console.error('Report fetch error:', error);
      showToast(error.response?.data?.message || 'Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
  }, [active, appliedParams]);

  const activeMeta = REPORT_META_BY_ID[active] || { title: 'Report', groupId: 'financial', groupTitle: 'Financial' };
  const activeGroup = REPORT_GROUPS.find((g) => g.id === activeMeta.groupId) || REPORT_GROUPS[0];

  const updateIndicator = useCallback((containerEl, activeEl, setState) => {
    if (!containerEl || !activeEl) return;
    const cRect = containerEl.getBoundingClientRect();
    const aRect = activeEl.getBoundingClientRect();

    // Add scrollLeft so it works with horizontal scrolling tabbars.
    const left = aRect.left - cRect.left + (containerEl.scrollLeft || 0);
    const width = aRect.width;
    setState({ left, width, opacity: width > 0 ? 1 : 0 });
  }, []);

  const updateGroupIndicator = useCallback(() => {
    const container = groupTabsRef.current;
    const activeEl = groupBtnRefs.current?.[activeGroup?.id];
    updateIndicator(container, activeEl, setGroupIndicator);
  }, [activeGroup?.id, updateIndicator]);

  const updateReportIndicator = useCallback(() => {
    const container = reportTabsRef.current;
    const activeEl = reportBtnRefs.current?.[active];
    updateIndicator(container, activeEl, setReportIndicator);
  }, [active, updateIndicator]);

  useEffect(() => {
    // Defer to next paint so DOM sizes are correct.
    const t = window.requestAnimationFrame(() => {
      updateGroupIndicator();
      updateReportIndicator();
    });
    const onResize = () => {
      updateGroupIndicator();
      updateReportIndicator();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(t);
      window.removeEventListener('resize', onResize);
    };
  }, [updateGroupIndicator, updateReportIndicator]);

  // Auto-apply filters (debounced) to avoid needing an "Apply" click.
  useEffect(() => {
    if (!hasPendingFilterChanges) return;
    if (!canAutoApply) return;
    const t = window.setTimeout(() => {
      setAppliedFilters(filters);
    }, 250);
    return () => window.clearTimeout(t);
  }, [canAutoApply, filters, hasPendingFilterChanges]);

  const resetFilters = () => {
    const d = {
      view: 'monthly',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      quarter: getQuarterForDate(now),
      startDate: '',
      endDate: '',
      invoiceStatus: '',
      expenseStatus: '',
    };
    setFilters(d);
    setAppliedFilters(d);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-header">Reports</h1>
          <p className="page-subtitle">Financial, Sales, Expense, Budget, Forecast, Tax & Payment reports</p>
        </div>

        {/* Filters toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>Filters</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: filters */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:col-span-4 space-y-3`}>
          <div className="report-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">Report Filters</div>
              <div className="text-xs text-slate-500">
                {hasPendingFilterChanges ? 'Not applied' : 'Applied'}
              </div>
            </div>
            <div>
              <label className="form-label">View</label>
              <select
                className="select-field"
                value={filters.view}
                onChange={(e) => {
                  const nextView = e.target.value;
                  setFilters((prev) => {
                    const next = { ...prev, view: nextView };
                    if (nextView === 'monthly') {
                      next.month = prev.month || (now.getMonth() + 1);
                      next.startDate = '';
                      next.endDate = '';
                    } else if (nextView === 'quarterly') {
                      next.quarter = prev.quarter || getQuarterForDate(now);
                      next.startDate = '';
                      next.endDate = '';
                    } else if (nextView === 'yearly') {
                      next.startDate = '';
                      next.endDate = '';
                    } else if (nextView === 'custom') {
                      // keep any existing custom dates
                    }
                    return next;
                  });
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 sm:col-span-1">
                <label className="form-label">Year</label>
                <select
                  className="select-field"
                  value={filters.year}
                  onChange={(e) => setFilters((p) => ({ ...p, year: parseInt(e.target.value, 10) }))}
                >
                  {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {filters.view === 'monthly' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="form-label">Month</label>
                  <select
                    className="select-field"
                    value={filters.month}
                    onChange={(e) => setFilters((p) => ({ ...p, month: parseInt(e.target.value, 10) }))}
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filters.view === 'quarterly' && (
                <div className="col-span-2">
                  <label className="form-label">Quarter</label>
                  <select
                    className="select-field"
                    value={filters.quarter}
                    onChange={(e) => setFilters((p) => ({ ...p, quarter: parseInt(e.target.value, 10) }))}
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </select>
                </div>
              )}

              {filters.view === 'custom' && (
                <div className="col-span-2">
                  <label className="form-label">Custom range</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      className="input-field"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
                    />
                    <input
                      className="input-field"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <div>
                <label className="form-label">Invoice Status</label>
                <select
                  className="select-field"
                  value={filters.invoiceStatus}
                  onChange={(e) => setFilters((p) => ({ ...p, invoiceStatus: e.target.value }))}
                >
                  <option value="">All (exclude Cancel)</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial">Partial</option>
                  <option value="Cancel">Cancel</option>
                </select>
              </div>
              <div>
                <label className="form-label">Expense Status</label>
                <select
                  className="select-field"
                  value={filters.expenseStatus}
                  onChange={(e) => setFilters((p) => ({ ...p, expenseStatus: e.target.value }))}
                >
                  <option value="">All (exclude Cancel)</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial">Partial</option>
                  <option value="Cancel">Cancel</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button type="button" className="btn-reset" onClick={resetFilters} title="Reset all report filters">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 00-14.9-3M4 16a8 8 0 0014.9 3"
                  />
                </svg>
                Reset filters
              </button>
            </div>
            <div className="report-subtle">
              Applied: {appliedPeriodLabel}
            </div>
          </div>
        </div>

        {/* Right: report content */}
        <div className={`${sidebarOpen ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {/* Reports navbar */}
          <div className="report-card mb-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{activeMeta.title}</div>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <div className="font-semibold text-slate-700">{activeMeta.groupTitle}</div>
                  <div>{appliedPeriodLabel}</div>
                </div>
              </div>

              <div
                ref={groupTabsRef}
                className="report-primary-tabs"
                role="tablist"
                aria-label="Report groups"
                onScroll={updateGroupIndicator}
                style={{
                  '--indicator-left': `${groupIndicator.left}px`,
                  '--indicator-width': `${groupIndicator.width}px`,
                  '--indicator-opacity': groupIndicator.opacity,
                }}
              >
                {REPORT_GROUPS.map((g) => {
                  const isActiveGroup = g.id === activeGroup.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setActive(g.items[0]?.id || 'pl')}
                      className={`report-primary-tab ${isActiveGroup ? 'report-primary-tab-active' : ''}`}
                      role="tab"
                      aria-selected={isActiveGroup}
                      ref={(el) => {
                        if (el) groupBtnRefs.current[g.id] = el;
                      }}
                    >
                      {g.title}
                    </button>
                  );
                })}
              </div>

              <div ref={reportTabsRef} className="report-secondary-tabs" role="tablist" aria-label="Reports" onScroll={updateReportIndicator}>
                {activeGroup.items.map((item) => {
                  const isActiveReport = item.id === active;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActive(item.id)}
                      className={`report-secondary-tab ${isActiveReport ? 'report-secondary-tab-active' : ''}`}
                      role="tab"
                      aria-selected={isActiveReport}
                      ref={(el) => {
                        if (el) reportBtnRefs.current[item.id] = el;
                      }}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="report-card">
            {loading && (
              <div className="mb-4 text-sm text-slate-600 flex items-center">
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                Loading…
              </div>
            )}

            {/* P&L */}
            {active === 'pl' && pl && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  <Kpi label="Total Income (ex GST)" value={money(pl.totalIncome)} />
                  <Kpi label="Total Expenses (ex GST)" value={money(pl.totalExpenses)} />
                  <Kpi label="Gross Profit (INR)" value={money(pl.grossProfit)} />
                  <Kpi label="Net Profit (INR)" value={money(pl.netProfit)} />
                  <Kpi label="Profit Margin %" value={`${money(pl.profitMarginPct)}%`} />
                </div>
                <div>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      exportToExcel('profit-loss.xlsx', [
                        {
                          name: 'P&L',
                          rows: [
                            {
                              startDate: pl.startDate,
                              endDate: pl.endDate,
                              totalIncome: pl.totalIncome,
                              totalExpenses: pl.totalExpenses,
                              grossProfit: pl.grossProfit,
                              netProfit: pl.netProfit,
                              profitMarginPct: pl.profitMarginPct,
                            },
                          ],
                        },
                      ])
                    }
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            )}

            {/* Income vs Expense */}
            {active === 'incomeVsExpense' && incomeVsExpense && (
              <div className="space-y-4">
                <div className="report-section-title">Monthly Trend</div>
                <div>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      exportToExcel('income-vs-expense.xlsx', [
                        { name: 'Trend', rows: incomeVsExpense.trend || [] },
                      ])
                    }
                  >
                    Export Excel
                  </button>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={incomeVsExpense.trend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip formatter={(v) => money(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} />
                      <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="gap" name="Gap" stroke="#2563eb" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeVsExpense.trend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip formatter={(v) => money(v)} />
                      <Legend />
                      <Bar dataKey="income" name="Income" fill="#22c55e" />
                      <Bar dataKey="expense" name="Expense" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Cash Flow */}
            {active === 'cashFlow' && cashFlow && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  <Kpi label="Cash Received" value={money(cashFlow.cashIn)} />
                  <Kpi label="Cash Paid" value={money(cashFlow.cashOut)} />
                  <Kpi label="Net Cash Balance" value={money(cashFlow.netCashFlow)} />
                </div>
              </div>
            )}

            {/* Outstanding Summary */}
            {active === 'outstanding' && outstanding && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <Kpi label="Total Receivable" value={money(outstanding.receivable?.total)} />
                  <Kpi label="Receivable Count" value={String(outstanding.receivable?.count || 0)} />
                  <Kpi label="Total Payable" value={money(outstanding.payable?.total)} />
                  <Kpi label="Payable Count" value={String(outstanding.payable?.count || 0)} />
                </div>
                <div>
                  <button
                    className="btn-secondary"
                    onClick={() => exportToExcel('outstanding-summary.xlsx', [{ name: 'Summary', rows: [outstanding] }])}
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            )}

            {/* Income summary */}
            {active === 'incomeSummary' && incomeSummary && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <Kpi label="Total Income (ex GST)" value={money(incomeSummary.totalIncome)} />
                  <Kpi label="Clients" value={String((incomeSummary.byClient || []).length)} />
                  <Kpi label="Services" value={String((incomeSummary.byService || []).length)} />
                  <Kpi label="Departments" value={String((incomeSummary.byDepartment || []).length)} />
                </div>
                <div>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      exportToExcel('income-summary.xlsx', [
                        { name: 'By Month', rows: incomeSummary.byMonth || [] },
                        { name: 'By Client', rows: incomeSummary.byClient || [] },
                        { name: 'By Service', rows: incomeSummary.byService || [] },
                        { name: 'By Department', rows: incomeSummary.byDepartment || [] },
                      ])
                    }
                  >
                    Export Excel
                  </button>
                </div>

                <div>
                  <div className="report-section-title mb-2">Income by Month</div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={incomeSummary.byMonth || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip formatter={(v) => money(v)} />
                        <Bar dataKey="total" name="Income" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="report-section-title mb-2">Income by Client</div>
                    <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
                      <table className="report-table">
                        <thead className="report-thead">
                          <tr>
                            <th className="report-th">Client</th>
                            <th className="report-th-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(incomeSummary.byClient || []).map((r) => (
                            <tr key={r.client} className="report-divider-row">
                              <td className="report-td">{r.client}</td>
                              <td className="report-td-right">{money(r.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <div className="report-section-title mb-2">Income by Service</div>
                    <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
                      <table className="report-table">
                        <thead className="report-thead">
                          <tr>
                            <th className="report-th">Service</th>
                            <th className="report-th-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(incomeSummary.byService || []).map((r) => (
                            <tr key={r.service} className="report-divider-row">
                              <td className="report-td">{r.service}</td>
                              <td className="report-td-right">{money(r.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recurring vs one-time */}
            {active === 'recurringIncome' && recurringIncome && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Kpi label="Total Income (ex GST)" value={money(recurringIncome.totalIncome)} />
                  <Kpi label="MRR (INR)" value={money(recurringIncome.mrr)} />
                  <Kpi label="One-time (INR)" value={money(recurringIncome.oneTimeRevenue)} />
                  <Kpi label="Stability %" value={`${money(recurringIncome.stabilityPct)}%`} />
                </div>
              </div>
            )}

            {/* Invoice aging */}
            {active === 'invoiceAging' && invoiceAging && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Kpi label="Paid invoices (INR)" value={money(invoiceAging.paidInvoices?.total)} />
                  <Kpi label="Paid count" value={String(invoiceAging.paidInvoices?.count || 0)} />
                  <Kpi label="Outstanding (INR)" value={money(invoiceAging.outstanding?.total)} />
                  <Kpi label="Overdue (INR)" value={money(invoiceAging.outstanding?.overdueTotal)} />
                </div>
                <div className="max-h-80 overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-2">Bucket</th>
                        <th className="text-right p-2">Count</th>
                        <th className="text-right p-2">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoiceAging.outstanding?.buckets || []).map((b) => (
                        <tr key={b.bucket} className="border-t">
                          <td className="p-2">{b.bucket}</td>
                          <td className="p-2 text-right">{b.count}</td>
                          <td className="p-2 text-right">{money(b.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top Clients */}
            {active === 'topClients' && topClients && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Kpi label="Total Revenue (ex GST)" value={money(topClients.totalRevenue)} />
                  <Kpi label="Top Clients" value={String((topClients.top || []).length)} />
                </div>
                <div className="max-h-80 overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-2">Client</th>
                        <th className="text-right p-2">Revenue</th>
                        <th className="text-right p-2">Contribution %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(topClients.top || []).map((r) => (
                        <tr key={r.client} className="border-t">
                          <td className="p-2">{r.client}</td>
                          <td className="p-2 text-right">{money(r.total)}</td>
                          <td className="p-2 text-right">{money(r.contributionPct)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <button
                    className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                    onClick={() => exportToExcel('top-clients.xlsx', [{ name: 'Top Clients', rows: topClients.top || [] }])}
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            )}

            {/* Fixed vs Variable */}
            {active === 'fixedVar' && fixedVar && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <Kpi label="Total Expenses (ex GST)" value={money(fixedVar.totalExpenses)} />
                  <Kpi label="Fixed Cost (ex GST)" value={money(fixedVar.fixedCost)} />
                  <Kpi label="Variable Cost (ex GST)" value={money(fixedVar.variableCost)} />
                  <Kpi label="Fixed %" value={`${money(fixedVar.fixedPct)}%`} />
                  <Kpi label="Break-even Revenue" value={money(fixedVar.breakEvenRevenue)} />
                </div>
              </div>
            )}

            {/* Department expense */}
            {active === 'deptExpense' && deptExpense && (
              <div className="space-y-4">
                <Kpi label="Total Expenses (ex GST)" value={money(deptExpense.totalExpenses)} />
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptExpense.byDepartment || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" />
                      <YAxis />
                      <Tooltip formatter={(v) => money(v)} />
                      <Bar dataKey="total" name="Expense" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Vendor expense */}
            {active === 'vendorExpense' && vendorExpense && (
              <div className="space-y-4">
                <div className="text-sm font-bold text-slate-900">Top Vendors</div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(vendorExpense.byVendor || []).slice(0, 15)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="vendor" interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis />
                      <Tooltip formatter={(v) => money(v)} />
                      <Bar dataKey="total" name="Expense" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Expense category */}
            {active === 'categoryExpense' && categoryExpense && (
              <div className="space-y-4">
                <div className="text-sm font-bold text-slate-900">By Category</div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(categoryExpense.byCategory || []).slice(0, 20)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis />
                      <Tooltip formatter={(v) => money(v)} />
                      <Bar dataKey="total" name="Expense" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Expense Categories */}
            {active === 'topExpenseCats' && topExpenseCats && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Kpi label="Total Expenses (ex GST)" value={money(topExpenseCats.totalExpenses)} />
                  <Kpi label="Top Categories" value={String((topExpenseCats.top || []).length)} />
                </div>
                <div className="max-h-80 overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-right p-2">Contribution %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(topExpenseCats.top || []).map((r) => (
                        <tr key={r.category} className="border-t">
                          <td className="p-2">{r.category}</td>
                          <td className="p-2 text-right">{money(r.total)}</td>
                          <td className="p-2 text-right">{money(r.contributionPct)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <button
                    className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                    onClick={() =>
                      exportToExcel('top-expense-categories.xlsx', [{ name: 'Top Categories', rows: topExpenseCats.top || [] }])
                    }
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            )}

            {/* Client profitability */}
            {active === 'clientProfit' && clientProfit && (
              <div className="space-y-4">
                <div>
                  <button
                    className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                    onClick={() =>
                      exportToExcel('client-profitability.xlsx', [
                        {
                          name: 'Clients',
                          rows: (clientProfit.clients || []).map((c) => ({
                            client: c.client,
                            revenue: c.revenue,
                            allocatedExpense: c.allocatedExpense,
                            profit: c.profit,
                            marginPct: c.marginPct,
                            lossMaking: !!c.flags?.lossMaking,
                            lowMargin: !!c.flags?.lowMargin,
                          })),
                        },
                      ])
                    }
                  >
                    Export Excel
                  </button>
                </div>
                <div className="max-h-[520px] overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-2">Client</th>
                        <th className="text-right p-2">Revenue</th>
                        <th className="text-right p-2">Allocated Expense</th>
                        <th className="text-right p-2">Profit</th>
                        <th className="text-right p-2">Margin %</th>
                        <th className="text-left p-2">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clientProfit.clients || []).map((c) => (
                        <tr key={c.client} className="border-t">
                          <td className="p-2">{c.client}</td>
                          <td className="p-2 text-right">{money(c.revenue)}</td>
                          <td className="p-2 text-right">{money(c.allocatedExpense)}</td>
                          <td className={`p-2 text-right ${c.profit < 0 ? 'text-red-600 font-semibold' : 'text-slate-900'}`}>
                            {money(c.profit)}
                          </td>
                          <td className="p-2 text-right">{money(c.marginPct)}%</td>
                          <td className="p-2">
                            {c.flags?.lossMaking ? <span className="text-red-600 font-semibold">Loss</span> : null}
                            {c.flags?.lowMargin ? <span className="ml-2 text-amber-600 font-semibold">Low margin</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Budget vs Actual */}
            {active === 'budgetVsActual' && budgetVsActual && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Kpi label="Budgeted (ex GST)" value={money(budgetVsActual.totals?.budgeted)} />
                  <Kpi label="Actual (ex GST)" value={money(budgetVsActual.totals?.actual)} />
                </div>
                <div>
                  <button
                    className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                    onClick={() => exportToExcel('budget-vs-actual.xlsx', [{ name: 'Budget vs Actual', rows: budgetVsActual.rows || [] }])}
                  >
                    Export Excel
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-slate-900">Add Budget</div>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
                      onClick={() => setShowBudgetForm((v) => !v)}
                    >
                      {showBudgetForm ? 'Hide Form' : 'Add Budget'}
                    </button>
                  </div>
                  {showBudgetForm && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="form-label">Period Start</label>
                      <input
                        type="date"
                        className="input-field"
                        value={budgetForm.periodStart}
                        onChange={(e) => setBudgetForm({ ...budgetForm, periodStart: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Period End</label>
                      <input
                        type="date"
                        className="input-field"
                        value={budgetForm.periodEnd}
                        onChange={(e) => setBudgetForm({ ...budgetForm, periodEnd: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Amount</label>
                      <input
                        type="number"
                        className="input-field"
                        value={budgetForm.amount}
                        onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Department</label>
                      <input
                        className="input-field"
                        value={budgetForm.department}
                        onChange={(e) => setBudgetForm({ ...budgetForm, department: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Category</label>
                      <input
                        className="input-field"
                        value={budgetForm.category}
                        onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="form-label">Reason</label>
                      <input
                        className="input-field"
                        value={budgetForm.reason}
                        onChange={(e) => setBudgetForm({ ...budgetForm, reason: e.target.value })}
                      />
                    </div>
                  </div>
                  )}
                  {showBudgetForm && (
                  <div className="mt-3">
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        try {
                          await budgetAPI.create({
                            ...budgetForm,
                            amount: Number(budgetForm.amount) || 0,
                          });
                          showToast('Budget added', 'success');
                          setBudgetForm({
                            periodStart: '',
                            periodEnd: '',
                            department: 'Unassigned',
                            category: 'All',
                            amount: '',
                            reason: '',
                          });
                          setBudgetVsActual((await reportsAPI.budgetVsActual(appliedParams)).data);
                        } catch (error) {
                          showToast(error.response?.data?.message || 'Failed to add budget', 'error');
                        }
                      }}
                    >
                      Save Budget
                    </button>
                  </div>
                  )}
                </div>

                <div className="max-h-[520px] overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-2">Department</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">Budget</th>
                        <th className="text-right p-2">Actual</th>
                        <th className="text-right p-2">Variance</th>
                        <th className="text-right p-2">Variance %</th>
                        <th className="text-left p-2">Reason(s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(budgetVsActual.rows || []).map((r, idx) => (
                        <tr key={`${r.department}-${r.category}-${idx}`} className="border-t">
                          <td className="p-2">{r.department}</td>
                          <td className="p-2">{r.category}</td>
                          <td className="p-2 text-right">{money(r.budgeted)}</td>
                          <td className="p-2 text-right">{money(r.actual)}</td>
                          <td className={`p-2 text-right ${r.variance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {money(r.variance)}
                          </td>
                          <td className="p-2 text-right">
                            {r.budgeted > 0 && typeof r.variancePct === 'number'
                              ? `${money(r.variancePct)}%`
                              : 'N/A'}
                          </td>
                          <td className="p-2">{(r.reasons || []).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expense forecast */}
            {active === 'expenseForecast' && expenseForecast && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Kpi label="Next Month (Base)" value={money(expenseForecast.nextMonthForecast)} />
                  <Kpi label="Next Quarter" value={money(expenseForecast.nextQuarterForecast)} />
                  <Kpi label="Aggressive (+20%)" value={money(expenseForecast.scenarios?.aggressive)} />
                  <Kpi label="Conservative (-10%)" value={money(expenseForecast.scenarios?.conservative)} />
                </div>
              </div>
            )}

            {/* Revenue forecast */}
            {active === 'revenueForecast' && revenueForecast && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Kpi label="Expected MRR" value={money(revenueForecast.expectedMRR)} />
                  <Kpi label="Churn Rate" value={`${money((revenueForecast.churnRate || 0) * 100)}%`} />
                  <Kpi label="Churn Loss" value={money(revenueForecast.churnLoss)} />
                  <Kpi label="Expected Revenue" value={money(revenueForecast.expectedRevenue)} />
                </div>
                {Number(revenueForecast.expectedMRR || 0) <= 0 && (
                  <div className="text-sm text-slate-600">
                    One-time forecast: last month revenue {money(revenueForecast.lastMonthRevenue)} with growth rate{' '}
                    {money((revenueForecast.growthRate || 0) * 100)}%.
                  </div>
                )}
              </div>
            )}

            {/* GST */}
            {active === 'gst' && gst && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Kpi label="GST Collected" value={money(gst.gstCollected)} />
                  <Kpi label="GST Paid" value={money(gst.gstPaid)} />
                  <Kpi label="Net GST Payable" value={money(gst.netGstPayable)} />
                </div>
                <div>
                  <button
                    className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                    onClick={() =>
                      exportToExcel('gst-report.xlsx', [
                        {
                          name: 'GST',
                          rows: [
                            {
                              startDate: gst.startDate,
                              endDate: gst.endDate,
                              gstCollected: gst.gstCollected,
                              gstPaid: gst.gstPaid,
                              netGstPayable: gst.netGstPayable,
                            },
                          ],
                        },
                      ])
                    }
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            )}

            {/* Payment mode income */}
            {active === 'pmIncome' && pmIncome && (
              <div className="space-y-4">
                <div className="text-sm font-bold text-slate-900">Income by Payment Mode</div>
                <div>
                  <button
                    className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                    onClick={() => exportToExcel('payment-mode-income.xlsx', [{ name: 'Income', rows: pmIncome.byMode || [] }])}
                  >
                    Export Excel
                  </button>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pmIncome.byMode || []} dataKey="total" nameKey="mode" outerRadius={120} label>
                        {(pmIncome.byMode || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Payment mode expense */}
            {active === 'pmExpense' && pmExpense && (
              <div className="space-y-4">
                <div className="text-sm font-bold text-slate-900">Expense by Payment Mode</div>
                <div>
                  <button
                    className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                    onClick={() => exportToExcel('payment-mode-expense.xlsx', [{ name: 'Expense', rows: pmExpense.byMode || [] }])}
                  >
                    Export Excel
                  </button>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pmExpense.byMode || []} dataKey="total" nameKey="mode" outerRadius={120} label>
                        {(pmExpense.byMode || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!loading &&
              ((active === 'pl' && !pl) ||
                (active === 'incomeVsExpense' && !incomeVsExpense) ||
                (active === 'outstanding' && !outstanding) ||
                (active === 'incomeSummary' && !incomeSummary) ||
                (active === 'recurringIncome' && !recurringIncome) ||
                (active === 'invoiceAging' && !invoiceAging) ||
                (active === 'topClients' && !topClients) ||
                (active === 'fixedVar' && !fixedVar) ||
                (active === 'deptExpense' && !deptExpense) ||
                (active === 'vendorExpense' && !vendorExpense) ||
                (active === 'categoryExpense' && !categoryExpense) ||
                (active === 'topExpenseCats' && !topExpenseCats) ||
                (active === 'clientProfit' && !clientProfit) ||
                (active === 'budgetVsActual' && !budgetVsActual) ||
                (active === 'expenseForecast' && !expenseForecast) ||
                (active === 'revenueForecast' && !revenueForecast) ||
                (active === 'gst' && !gst) ||
                (active === 'pmIncome' && !pmIncome) ||
                (active === 'pmExpense' && !pmExpense)) && (
                <div className="text-sm text-slate-600">No data available for this report.</div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;

