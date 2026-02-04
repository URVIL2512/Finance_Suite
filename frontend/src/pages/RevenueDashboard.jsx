import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import MobileSelect from '../components/MobileSelect';

const RevenueDashboard = () => {
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
      const response = await dashboardAPI.getRevenueDashboard(params);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching revenue dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading revenue dashboard...</p>
      </div>
    );
  }

  const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sortedMonthSummary = monthOrder.map(month => {
    const found = data?.monthSummary?.find(m => m.month === month);
    return found || { month, invoiceAmount: 0, received: 0, due: 0, gst: 0, tds: 0 };
  });

  // Prepare data for Geography charts
  const geoChartData = data?.geoSummary?.map(geo => ({
    name: geo.country,
    value: geo.total,
  })) || [];

  // Prepare data for Service charts
  const serviceChartData = data?.serviceSummary?.map(service => ({
    name: service.service,
    value: service.total,
  })) || [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#eab308', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-header">
            Revenue Dashboard
          </h1>
          <p className="page-subtitle">Comprehensive revenue analytics and reports</p>
        </div>
        <div className="w-full sm:w-auto flex flex-col gap-3 sm:flex-row">
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
          <MobileSelect
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="select-field w-full sm:w-44 px-5 py-2.5 font-semibold"
          >
            <option value="">All Years</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </MobileSelect>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Collected</h3>
          <p className="text-3xl font-bold text-green-600">
            ₹{data?.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
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
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Remittance Charges</h3>
          <p className="text-3xl font-bold text-purple-600">
            ₹{data?.totalRemittance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>

      {/* Geography-wise Revenue - Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Geography-wise Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Revenue by Geography</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={geoChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="value" fill="#0088FE" name="Total Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Geography-wise Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Revenue by Geography</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={geoChartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={80}
                innerRadius={20}
                fill="#8884d8"
                dataKey="value"
              >
                {geoChartData.map((entry, index) => (
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

      {/* Country-wise Monthly Breakdown Table */}
      <div className="card-gradient p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Country-wise Monthly Revenue</h2>
          <p className="text-sm text-gray-600">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase border-r border-white/20">Country</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Year</th>
                {monthOrder.map((m) => (
                  <th key={m} className="px-3 py-3 text-center text-xs font-medium uppercase border-r border-white/20">
                    {m}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.countryMonthlyBreakdown?.map((country) => (
                <tr key={country.country} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    {country.country}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center border-r border-gray-200">
                    {data?.year || 'All'}
                  </td>
                  {monthOrder.map((m) => (
                    <td key={m} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                      {country.months[m] ? `₹${country.months[m].toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-blue-50">
                    ₹{country.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-yellow-100 font-bold">
                <td colSpan={2} className="px-4 py-3 text-sm text-gray-900 border-r border-gray-300">Total</td>
                {monthOrder.map((m) => {
                  const monthTotal = data?.countryMonthlyBreakdown?.reduce((sum, country) => sum + (country.months[m] || 0), 0) || 0;
                  return (
                    <td key={m} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-300">
                      ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right bg-blue-100">
                  ₹{data?.countryMonthlyBreakdown?.reduce((sum, country) => sum + country.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Service-wise Revenue - Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Service-wise Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Revenue by Service</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={serviceChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="value" fill="#eab308" name="Total Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service-wise Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Revenue by Service</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={serviceChartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={80}
                innerRadius={20}
                fill="#8884d8"
                dataKey="value"
              >
                {serviceChartData.map((entry, index) => (
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

      {/* Service-wise Monthly Breakdown Table */}
      <div className="card-gradient p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Service-wise Monthly Revenue</h2>
          <p className="text-sm text-gray-600">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase border-r border-white/20">Service</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Year</th>
                {monthOrder.map((m) => (
                  <th key={m} className="px-3 py-3 text-center text-xs font-medium uppercase border-r border-white/20">
                    {m}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase border-r border-white/20">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.serviceMonthlyBreakdown?.map((service) => (
                <tr key={service.service} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    {service.service}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center border-r border-gray-200">
                    {data?.year || 'All'}
                  </td>
                  {monthOrder.map((m) => (
                    <td key={m} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                      {service.months[m] ? `₹${service.months[m].toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right bg-green-50">
                    ₹{service.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-yellow-100 font-bold">
                <td colSpan={2} className="px-4 py-3 text-sm text-gray-900 border-r border-gray-300">Total</td>
                {monthOrder.map((m) => {
                  const monthTotal = data?.serviceMonthlyBreakdown?.reduce((sum, service) => sum + (service.months[m] || 0), 0) || 0;
                  return (
                    <td key={m} className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-300">
                      ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right bg-green-100">
                  ₹{data?.serviceMonthlyBreakdown?.reduce((sum, service) => sum + service.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Summary - Graph */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Month-wise Collections</h2>
          <p className="text-sm text-gray-600 mb-4">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={sortedMonthSummary}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="invoiceAmount" fill="#10b981" name="Invoice Amount" />
              <Bar dataKey="received" fill="#3b82f6" name="Collected" />
              <Bar dataKey="due" fill="#ef4444" name="Due" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Summary Table */}
      <div className="card-gradient p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Monthly Collections Summary</h2>
          <p className="text-sm text-gray-600">Reporting Year: {data?.year || 'All'}{month ? `, Month: ${month}` : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase border-r border-white/20">Month</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase border-r border-white/20">Collected</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase border-r border-white/20">Invoice Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase border-r border-white/20">GST</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase border-r border-white/20">TDS</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase">Due</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedMonthSummary.map((monthData) => (
                <tr key={monthData.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    {monthData.month}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                    ₹{monthData.received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                    ₹{monthData.invoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                    ₹{monthData.gst?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                    ₹{monthData.tds?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                    ₹{monthData.due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

export default RevenueDashboard;
