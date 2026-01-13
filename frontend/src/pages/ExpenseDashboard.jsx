import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList } from 'recharts';

const ExpenseDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchData();
  }, [month]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = { year: currentYear };
      if (month && month !== '') params.month = month;
      const response = await dashboardAPI.getExpenseDashboard(params);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching expense dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading expense dashboard...</p>
      </div>
    );
  }

  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sortedMonthSummary = monthOrder.map(month => {
    const found = data?.monthSummary?.find(m => m.month === month);
    return found || { month, totalExpense: 0, totalGST: 0, totalTDS: 0 };
  });

  // Prepare data for Category-wise chart
  const categoryChartData = data?.categoryMonthlyBreakdown?.map(category => ({
    name: category.category,
    value: category.total,
  })) || [];

  // Prepare data for Department-wise chart
  const departmentChartData = data?.departmentMonthlyBreakdown?.map(department => ({
    name: department.department,
    value: department.total,
  })) || [];

  // Color palette
  const COLORS = ['#eab308', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6'];

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="page-header">
            Expense Dashboard
          </h1>
          <p className="page-subtitle">Comprehensive expense analytics and reports</p>
        </div>
        <div className="flex gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="select-field px-5 py-2.5 font-semibold"
          >
            <option value="">All Months</option>
            {monthOrder.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Expenses</h3>
          <p className="text-3xl font-bold text-red-600">
            ₹{data?.totalExpenses?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total GST</h3>
          <p className="text-3xl font-bold text-orange-600">
            ₹{data?.totalGST?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total TDS</h3>
          <p className="text-3xl font-bold text-blue-600">
            ₹{data?.totalTDS?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">All Time Total</h3>
          <p className="text-3xl font-bold text-gray-600">
            ₹{data?.allTimeTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Current Year ({currentYear})</p>
        </div>
      </div>

      {/* Category-wise Expenses - Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category-wise Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Category-wise Expenses</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {currentYear}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={categoryChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="value" fill="#eab308" name="Total Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category-wise Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Category-wise Expenses </h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {currentYear}</p>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={80}
                innerRadius={20}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Department-wise Expenses - Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Department-wise Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Department-wise Expenses </h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {currentYear}</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={departmentChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" name="Total Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department-wise Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Department-wise Expenses </h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {currentYear}</p>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={departmentChartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={80}
                innerRadius={20}
                fill="#8884d8"
                dataKey="value"
              >
                {departmentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Monthly Expense Summary - Graphs */}
      <div className="mb-6">
        {/* Monthly Summary Line Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Monthly Expense Trend</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {currentYear}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={sortedMonthSummary}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Line type="monotone" dataKey="totalExpense" stroke="#ef4444" strokeWidth={2} name="Expense" />
              <Line type="monotone" dataKey="totalGST" stroke="#f59e0b" strokeWidth={2} name="GST" />
              <Line type="monotone" dataKey="totalTDS" stroke="#3b82f6" strokeWidth={2} name="TDS" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default ExpenseDashboard;

