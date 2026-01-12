import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList } from 'recharts';

const ExpenseDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');

  useEffect(() => {
    fetchData();
  }, [year, month]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (year && year !== '') params.year = parseInt(year);
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

  // Prepare data for Operation Type-wise chart
  const operationTypeChartData = data?.operationTypeMonthlyBreakdown?.map(operationType => ({
    name: operationType.operationType,
    value: operationType.total,
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
        </div>
      </div>

      {/* Category-wise Expenses - Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category-wise Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Category-wise Expenses</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
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
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}</p>
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

      {/* Category-wise Monthly Breakdown Table */}
      <div className="card-gradient p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Category-wise Monthly Expenses</h2>
          <p className="text-sm text-gray-600">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase border-r border-white/20">Category</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Year</th>
                {monthOrder.map((month) => (
                  <th key={month} className="px-3 py-3 text-center text-xs font-medium uppercase border-r border-white/20">
                    {month}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.categoryMonthlyBreakdown?.map((category) => (
                <tr key={category.category} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    {category.category}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center border-r border-gray-200">
                    {data?.year || 'All'}
                  </td>
                  {monthOrder.map((month) => (
                    <td key={month} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                      {category.months[month] ? `₹${category.months[month].toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-green-50">
                    ₹{category.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-yellow-100 font-bold">
                <td colSpan={2} className="px-4 py-3 text-sm text-gray-900 border-r border-gray-300">Total</td>
                {monthOrder.map((month) => {
                  const monthTotal = data?.categoryMonthlyBreakdown?.reduce((sum, category) => sum + (category.months[month] || 0), 0) || 0;
                  return (
                    <td key={month} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-300">
                      ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right bg-green-100">
                  ₹{data?.categoryMonthlyBreakdown?.reduce((sum, category) => sum + category.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Operation Type-wise Expenses - Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Operation Type-wise Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Operation Type-wise Expenses </h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={operationTypeChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" name="Total Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Operation Type-wise Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Operation Type-wise Expenses </h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}</p>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={operationTypeChartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={80}
                innerRadius={20}
                fill="#8884d8"
                dataKey="value"
              >
                {operationTypeChartData.map((entry, index) => (
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

      {/* Operation Type-wise Monthly Breakdown Table */}
      <div className="card-gradient p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Operation Type-wise Monthly Expenses</h2>
          <p className="text-sm text-gray-600">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase border-r border-white/20">Operation Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Year</th>
                {monthOrder.map((month) => (
                  <th key={month} className="px-3 py-3 text-center text-xs font-medium uppercase border-r border-white/20">
                    {month}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.operationTypeMonthlyBreakdown?.map((operationType) => (
                <tr key={operationType.operationType} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    {operationType.operationType}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center border-r border-gray-200">
                    {data?.year || 'All'}
                  </td>
                  {monthOrder.map((month) => (
                    <td key={month} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                      {operationType.months[month] ? `₹${operationType.months[month].toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-blue-50">
                    ₹{operationType.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-yellow-100 font-bold">
                <td colSpan={2} className="px-4 py-3 text-sm text-gray-900 border-r border-gray-300">Total</td>
                {monthOrder.map((month) => {
                  const monthTotal = data?.operationTypeMonthlyBreakdown?.reduce((sum, operationType) => sum + (operationType.months[month] || 0), 0) || 0;
                  return (
                    <td key={month} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-300">
                      ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right bg-blue-100">
                  ₹{data?.operationTypeMonthlyBreakdown?.reduce((sum, operationType) => sum + operationType.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Expense Summary - Graphs */}
      <div className="mb-6">
        {/* Monthly Summary Line Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Monthly Expense Trend (Line Chart)</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
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

      {/* Monthly Summary Table */}
      <div className="card-gradient p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Monthly Expense Summary</h2>
          <p className="text-sm text-gray-600">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase border-r border-white/20">Month</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase border-r border-white/20">Expense</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase border-r border-white/20">GST</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase border-r border-white/20">TDS</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedMonthSummary.map((month) => (
                <tr key={month.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    {month.month}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                    ₹{month.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                    ₹{month.totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                    ₹{month.totalTDS.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    ₹{month.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpenseDashboard;

