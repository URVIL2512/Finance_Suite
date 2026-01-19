import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList } from 'recharts';
import MobileSelect from '../components/MobileSelect';

const ExpenseDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
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
    
    fetchData();
  }, [month, currentYear]);

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
      <div className="mb-8 lg:mb-10 xl:mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:gap-6">
        <div>
          <h1 className="page-header">
            Expense Dashboard
          </h1>
          <p className="page-subtitle">Comprehensive expense analytics and reports</p>
        </div>
        <div className="w-full sm:w-auto">
          <MobileSelect
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="select-field w-full sm:w-48 px-5 py-2.5 font-semibold"
          >
            <option value="">All Months</option>
            {monthOrder.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </MobileSelect>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-8 lg:mb-10 xl:mb-12">
        {/* First Row - Main 4 Cards */}
        <div className="bg-white rounded-lg shadow-lg p-6 lg:p-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Expenses</h3>
          <p className="text-3xl font-bold text-red-600">
            ₹{data?.totalExpenses?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 lg:p-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Paid Amount</h3>
          <p className="text-3xl font-bold text-green-600">
            ₹{data?.paidAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 lg:p-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Unpaid Amount</h3>
          <p className="text-3xl font-bold text-orange-600">
            ₹{data?.unpaidAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>
      
      {/* Second Row - All Time Total and Smaller GST/TDS Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-8 lg:mb-10 xl:mb-12">
        <div className="bg-white rounded-lg shadow-lg p-6 lg:p-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">All Time Total</h3>
          <p className="text-3xl font-bold text-gray-600">
            ₹{data?.allTimeTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Current Year ({currentYear})</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-4 lg:p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-2">Total GST</h3>
          <p className="text-2xl font-bold text-orange-600">
            ₹{data?.totalGST?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-4 lg:p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-2">Total TDS</h3>
          <p className="text-2xl font-bold text-blue-600">
            ₹{data?.totalTDS?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>

      {/* Category-wise Expenses - Pie Chart Only */}
      <div className="mb-8 lg:mb-10 xl:mb-12">
        <div className="bg-white rounded-lg shadow-lg p-8 lg:p-10 xl:p-12">
          <h2 className="text-xl lg:text-2xl font-bold mb-4 lg:mb-6">Category-wise Expenses</h2>
          <p className="text-sm lg:text-base text-gray-600 mb-6 lg:mb-8">Reporting Year: {currentYear}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={500}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                  const RADIAN = Math.PI / 180;
                  // Position labels outside the pie for better visibility
                  const radius = outerRadius + 30;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  
                  // Only show label if percentage is significant enough to avoid clutter
                  if (percent < 0.01) return null;
                  
                  return (
                    <text 
                      x={x} 
                      y={y} 
                      fill="#333" 
                      textAnchor={x > cx ? 'start' : 'end'} 
                      dominantBaseline="central"
                      fontSize={13}
                      fontWeight="500"
                    >
                      {`${name} (${(percent * 100).toFixed(0)}%)`}
                    </text>
                  );
                }}
                outerRadius={140}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [`₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, name]}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={60}
                wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
                iconSize={16}
                formatter={(value) => value}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Department-wise Expenses - Bar Chart Only */}
      <div className="mb-8 lg:mb-10 xl:mb-12">
        <div className="bg-white rounded-lg shadow-lg p-6 lg:p-8 xl:p-10">
          <h2 className="text-xl lg:text-2xl font-bold mb-4 lg:mb-6">Department-wise Expenses</h2>
          <p className="text-sm lg:text-base text-gray-600 mb-6 lg:mb-8">Reporting Year: {currentYear}</p>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={departmentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={140}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" name="Total Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Monthly Expense Summary - Graphs */}
      <div className="mb-8 lg:mb-10 xl:mb-12">
        {/* Monthly Summary Line Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6 lg:p-8 xl:p-10">
          <h2 className="text-xl lg:text-2xl font-bold mb-4 lg:mb-6">Monthly Expense Trend</h2>
          <p className="text-sm lg:text-base text-gray-600 mb-6 lg:mb-8">Reporting Year: {currentYear}{month ? `, Month: ${month}` : ''}</p>
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

