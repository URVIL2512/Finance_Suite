import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [year]);

  const fetchSummary = async () => {
    try {
      const params = {};
      if (year && year !== '') params.year = parseInt(year);
      const response = await dashboardAPI.getSummary(params);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-header">
            Dashboard
          </h1>
          <p className="page-subtitle">Overview of your financial performance</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="select-field px-5 py-2.5 font-semibold"
        >
          <option value="">All Years</option>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card-gradient p-6 border-l-4 border-emerald-500 bg-gradient-to-br from-white to-emerald-50/20 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Revenue</h3>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent mb-2">
            ₹{summary?.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <p className="text-xs text-slate-500 font-medium">For selected period</p>
        </div>
        
        <div className="card-gradient p-6 border-l-4 border-red-500 bg-gradient-to-br from-white to-red-50/20 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Expenses</h3>
            <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent mb-2">
            ₹{summary?.totalExpenses?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <p className="text-xs text-slate-500 font-medium">For selected period</p>
        </div>
        
        <div className={`card-gradient p-6 border-l-4 ${summary?.netProfit >= 0 ? 'border-emerald-500 bg-gradient-to-br from-white to-emerald-50/20' : 'border-red-500 bg-gradient-to-br from-white to-red-50/20'} hover:shadow-xl transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Net Profit</h3>
            <div className={`w-12 h-12 ${summary?.netProfit >= 0 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-red-400 to-red-600'} rounded-xl flex items-center justify-center shadow-lg`}>
              {summary?.netProfit >= 0 ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </div>
          </div>
          <p className={`text-3xl font-bold mb-2 ${summary?.netProfit >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent' : 'bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent'}`}>
            ₹{summary?.netProfit?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <p className="text-xs text-slate-500 font-medium">Revenue - Expenses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/expense-dashboard"
          className="card-gradient p-8 group hover:scale-[1.02] transition-all duration-300"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 group-hover:text-red-600 transition-colors">Expense Dashboard</h2>
              <p className="text-sm text-gray-500">Detailed analytics</p>
            </div>
          </div>
          <p className="text-gray-600 leading-relaxed">View comprehensive expense reports, category-wise summaries, and monthly breakdowns with interactive charts.</p>
          <div className="mt-4 text-red-600 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center">
            View Dashboard →
          </div>
        </Link>
        
        <Link
          to="/revenue-dashboard"
          className="card-gradient p-8 group hover:scale-[1.02] transition-all duration-300"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 group-hover:text-green-600 transition-colors">Revenue Dashboard</h2>
              <p className="text-sm text-gray-500">Performance insights</p>
            </div>
          </div>
          <p className="text-gray-600 leading-relaxed">Analyze revenue by geography, service type, and track monthly performance with visual charts and summaries.</p>
          <div className="mt-4 text-green-600 font-semibold group-hover:translate-x-2 transition-transform inline-flex items-center">
            View Dashboard →
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;

