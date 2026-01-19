import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { dashboardAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const ExpenseAging = () => {
  const { showToast } = useToast();
  const [agingData, setAgingData] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [asOfDate, setAsOfDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState(null);

  useEffect(() => {
    fetchAgingData();
  }, []);

  const fetchAgingData = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getExpenseAging();
      setAgingData(response.data.agingData || []);
      setTotalOutstanding(response.data.totalOutstanding || 0);
      setAsOfDate(response.data.asOfDate || '');
    } catch (error) {
      console.error('Error fetching aging data:', error);
      showToast('Failed to fetch aging report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getBucketColor = (bucketLabel) => {
    if (bucketLabel === '0-5 Days') return { bg: 'from-green-500 to-green-600', text: 'text-green-50', border: 'border-green-300' };
    if (bucketLabel === '6-15 Days') return { bg: 'from-yellow-500 to-yellow-600', text: 'text-yellow-50', border: 'border-yellow-300' };
    if (bucketLabel === '16-30 Days') return { bg: 'from-orange-500 to-orange-600', text: 'text-orange-50', border: 'border-orange-300' };
    return { bg: 'from-red-500 to-red-600', text: 'text-red-50', border: 'border-red-300' };
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading aging report...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2">Expense Aging Report</h1>
          <p className="text-slate-600">
            Track overdue payments by age buckets {asOfDate && `(As of ${format(new Date(asOfDate), 'dd MMM yyyy')})`}
          </p>
        </div>
      </div>

      {/* Total Outstanding Card */}
      <div className="mb-6 p-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-semibold mb-1">Total Outstanding</p>
            <p className="text-3xl font-bold">₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <svg className="w-12 h-12 text-blue-200 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>

      {/* Age Bucket Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {agingData.map((bucket) => {
          const colors = getBucketColor(bucket.label);
          const percentage = totalOutstanding > 0 ? ((bucket.amount / totalOutstanding) * 100).toFixed(1) : 0;
          
          return (
            <div
              key={bucket.label}
              className={`bg-gradient-to-br ${colors.bg} rounded-xl shadow-lg p-6 cursor-pointer transform transition-all hover:scale-105 hover:shadow-xl ${colors.text} border-2 ${colors.border}`}
              onClick={() => setSelectedBucket(selectedBucket === bucket.label ? null : bucket.label)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-90">{bucket.label}</h3>
                <svg className="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-3xl font-bold mb-2">₹{bucket.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-90">{bucket.count} {bucket.count === 1 ? 'Expense' : 'Expenses'}</span>
                <span className="opacity-75">({percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Table for Selected Bucket */}
      {selectedBucket && (
        <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {agingData.find(b => b.label === selectedBucket)?.label} - Expense Details
              </h2>
              <button
                onClick={() => setSelectedBucket(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Paid Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Outstanding</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agingData
                  .find(b => b.label === selectedBucket)
                  ?.expenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(expense.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{expense.vendor || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{expense.category || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        ₹{expense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700 text-right">
                        ₹{expense.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                        ₹{expense.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          expense.daysDifference <= 5 ? 'bg-green-100 text-green-800' :
                          expense.daysDifference <= 15 ? 'bg-yellow-100 text-yellow-800' :
                          expense.daysDifference <= 30 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {expense.daysDifference} days
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Table */}
      {!selectedBucket && (
        <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-xl font-bold text-gray-900">Aging Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Outstanding Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">No. of Expenses</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Percentage</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agingData.map((bucket) => {
                  const percentage = totalOutstanding > 0 ? ((bucket.amount / totalOutstanding) * 100).toFixed(1) : 0;
                  const colors = getBucketColor(bucket.label);
                  
                  return (
                    <tr
                      key={bucket.label}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedBucket(bucket.label)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {bucket.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                        ₹{bucket.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{bucket.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{percentage}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {agingData.reduce((sum, b) => sum + b.count, 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseAging;
