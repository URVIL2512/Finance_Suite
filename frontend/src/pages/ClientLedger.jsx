import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ledgerAPI } from '../services/api';
import MobileSelect from '../components/MobileSelect';

const ClientLedger = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchLedger(selectedCustomerId);
    } else {
      setLedgerData(null);
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const response = await ledgerAPI.getCustomers();
      setCustomers(response.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      alert('Failed to fetch customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchLedger = async (customerId) => {
    try {
      setLoading(true);
      const response = await ledgerAPI.getLedger(customerId);
      setLedgerData(response.data);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch ledger';
      alert(`Error: ${errorMessage}`);
      setLedgerData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `INR ${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    try {
      return format(new Date(date), 'dd-MM-yyyy');
    } catch (error) {
      return date;
    }
  };

  const getTypeBadgeColor = (type) => {
    return type === 'Invoice' 
      ? 'bg-blue-100 text-blue-800 border-blue-200' 
      : 'bg-green-100 text-green-800 border-green-200';
  };

  const getBalanceColor = (balance) => {
    if (balance === 0) return 'text-gray-600 font-semibold';
    if (balance > 0) return 'text-red-600 font-semibold';
    return 'text-green-600 font-semibold';
  };

  return (
    <div className="animate-fade-in">
      {/* Header with Customer Selector */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Client Ledger</h1>
          <p className="page-subtitle">View accounting statements with debit, credit, and running balance</p>
        </div>
        <div className="flex-shrink-0 sm:w-64">
          <MobileSelect
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="select-field w-full text-sm py-2"
            disabled={loadingCustomers}
          >
            <option value="">-- Select Customer --</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>
                {customer.name}
              </option>
            ))}
          </MobileSelect>
        </div>
      </div>

      {/* Customer Info (Compact) */}
      {ledgerData?.customer && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg inline-block">
          <span className="text-sm text-gray-700">
            <span className="font-semibold">{ledgerData.customer.name}</span>
            {ledgerData.customer.email && (
              <span className="text-gray-500 ml-2">({ledgerData.customer.email})</span>
            )}
          </span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading ledger data...</p>
        </div>
      )}

      {/* Ledger Table */}
      {!loading && ledgerData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-5">
              <div className="text-sm font-medium text-blue-700 mb-1">Total Debit</div>
              <div className="text-2xl font-bold text-blue-900">
                {formatCurrency(ledgerData.summary.totalDebit)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-5">
              <div className="text-sm font-medium text-green-700 mb-1">Total Credit</div>
              <div className="text-2xl font-bold text-green-900">
                {formatCurrency(ledgerData.summary.totalCredit)}
              </div>
            </div>
            <div className={`bg-gradient-to-br ${
              ledgerData.summary.closingBalance === 0 
                ? 'from-gray-50 to-gray-100 border-gray-200' 
                : ledgerData.summary.closingBalance > 0
                ? 'from-red-50 to-red-100 border-red-200'
                : 'from-green-50 to-green-100 border-green-200'
            } border rounded-lg p-5`}>
              <div className={`text-sm font-medium ${
                ledgerData.summary.closingBalance === 0 
                  ? 'text-gray-700' 
                  : ledgerData.summary.closingBalance > 0
                  ? 'text-red-700'
                  : 'text-green-700'
              } mb-1`}>
                Closing Balance
              </div>
              <div className={`text-2xl font-bold ${
                ledgerData.summary.closingBalance === 0 
                  ? 'text-gray-900' 
                  : ledgerData.summary.closingBalance > 0
                  ? 'text-red-900'
                  : 'text-green-900'
              }`}>
                {formatCurrency(ledgerData.summary.closingBalance)}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="card-gradient overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      Ref No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      Type
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      Debit (Invoice)
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      Credit (Payment)
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ledgerData.ledger && ledgerData.ledger.length > 0 ? (
                    ledgerData.ledger.map((entry, index) => (
                      <tr 
                        key={`${entry.type}-${entry.refNo}-${index}`}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{entry.refNo}</span>
                          {entry.relatedInvoiceNumber && (
                            <span className="text-xs text-gray-500 block">Against: {entry.relatedInvoiceNumber}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeBadgeColor(entry.type)}`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '–'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-700">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '–'}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${getBalanceColor(entry.balance)}`}>
                          {formatCurrency(entry.balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                        No ledger entries found for this customer
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !ledgerData && selectedCustomerId && (
        <div className="card-gradient p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Ledger Data</h3>
          <p className="text-gray-600">No invoices or payments found for this customer.</p>
        </div>
      )}

      {/* Initial State */}
      {!loading && !selectedCustomerId && (
        <div className="card-gradient p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Customer</h3>
          <p className="text-gray-600">Choose a customer from the dropdown above to view their ledger statement.</p>
        </div>
      )}
    </div>
  );
};

export default ClientLedger;
