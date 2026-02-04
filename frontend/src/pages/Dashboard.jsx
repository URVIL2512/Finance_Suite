import { useState, useEffect } from 'react';
import { dashboardAPI, reportsAPI } from '../services/api';
import { Link } from 'react-router-dom';
import MobileSelect from '../components/MobileSelect';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [gstSummary, setGstSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [year]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const params = {};
      if (year && year !== '') params.year = parseInt(year);
      const response = await dashboardAPI.getSummary(params);
      setSummary(response.data);
      // GST KPI strip (Yearly view)
      const gstYear = year && year !== '' ? parseInt(year) : new Date().getFullYear();
      const gstResp = await reportsAPI.gst({ view: 'yearly', year: gstYear });
      setGstSummary(gstResp.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-finance-blue"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading dashboard…</p>
      </div>
    );
  }

  const netProfit = summary?.netProfit ?? 0;
  const profitTone = netProfit >= 0 ? 'positive' : 'negative';

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-header">
            Dashboard
          </h1>
          <p className="page-subtitle">Overview of your financial performance</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Year</span>
          <MobileSelect
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-10 w-full sm:w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-finance-blue focus:ring-2 focus:ring-finance-blue/20"
          >
            <option value="">All years</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </MobileSelect>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 mb-8">
        {/* Total Revenue */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Total revenue</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                ₹{summary?.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="mt-1 text-xs text-slate-500">For selected period</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
              <svg className="h-5 w-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Total expenses</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                ₹{summary?.totalExpenses?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="mt-1 text-xs text-slate-500">For selected period</p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-2.5">
              <svg className="h-5 w-5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Net profit</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                ₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-slate-500">Revenue − expenses</p>
            </div>
            <div
              className={`rounded-lg p-2.5 border ${
                profitTone === 'positive'
                  ? 'border-emerald-100 bg-emerald-50'
                  : 'border-rose-100 bg-rose-50'
              }`}
            >
              {profitTone === 'positive' ? (
                <svg className="h-5 w-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>

      {gstSummary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 mb-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <p className="text-sm font-medium text-slate-600">GST collected (YTD)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              ₹{(gstSummary.gstCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <p className="text-sm font-medium text-slate-600">GST paid (YTD)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              ₹{(gstSummary.gstPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <p className="text-sm font-medium text-slate-600">Net GST payable (YTD)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              ₹{(gstSummary.netGstPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/expense-dashboard"
          className="group rounded-xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-finance-blue/20"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Expense dashboard</h2>
              <p className="mt-1 text-sm text-slate-600">Detailed analytics</p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-2.5">
              <svg className="h-5 w-5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            View comprehensive expense reports, category-wise summaries, and monthly breakdowns with interactive charts.
          </p>
          <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 transition group-hover:text-slate-900">
            View dashboard
            <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
          </div>
        </Link>
        
        <Link
          to="/revenue-dashboard"
          className="group rounded-xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-finance-blue/20"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Revenue dashboard</h2>
              <p className="mt-1 text-sm text-slate-600">Performance insights</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
              <svg className="h-5 w-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Analyze revenue by geography, service type, and track monthly performance with visual charts and summaries.
          </p>
          <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 transition group-hover:text-slate-900">
            View dashboard
            <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;

