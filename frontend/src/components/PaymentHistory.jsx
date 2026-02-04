import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { paymentAPI, invoiceAPI } from '../services/api';

const PaymentHistory = ({ invoice, onClose }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState(invoice);

  useEffect(() => {
    if (invoice) {
      fetchPaymentHistory();
      fetchInvoiceDetails();
    }
  }, [invoice]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const invoiceId = invoice?._id || invoice?.invoiceId;
      if (!invoiceId) {
        setPayments([]);
        return;
      }

      const response = await paymentAPI.getAll({ invoiceId });
      if (response && response.data) {
        // Sort by payment date descending (most recent first)
        const sortedPayments = response.data.sort((a, b) => {
          const dateA = new Date(a.paymentDate);
          const dateB = new Date(b.paymentDate);
          return dateB - dateA;
        });
        setPayments(sortedPayments);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceDetails = async () => {
    try {
      const invoiceId = invoice?._id || invoice?.invoiceId;
      if (invoiceId && !invoice?.invoiceNumber) {
        const response = await invoiceAPI.getById(invoiceId);
        if (response.data) {
          setInvoiceData(response.data);
        }
      } else {
        setInvoiceData(invoice);
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      setInvoiceData(invoice);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount, currency = 'INR') => {
    return `${currency} ${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const calculateTotalReceived = () => {
    return payments.reduce((sum, payment) => sum + (payment.amountReceived || 0), 0);
  };

  const getReceivableAmount = () => {
    return invoiceData?.amountDetails?.receivableAmount || 
           invoiceData?.grandTotal || 
           invoiceData?.invoiceTotal || 
           0;
  };

  const getBalanceDue = () => {
    const receivable = getReceivableAmount();
    const received = calculateTotalReceived();
    return Math.max(0, receivable - received);
  };

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Payment History</h2>
                <p className="text-sm text-white/90 mt-0.5">
                  Invoice #{invoiceData?.invoiceNumber || invoice?.invoiceNumber || 'N/A'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-white">
          {/* Invoice Summary */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-sm font-bold text-slate-900">Invoice Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Invoice Date</div>
                <div className="text-sm font-semibold text-slate-900">
                  {invoiceData?.invoiceDate ? formatDate(invoiceData.invoiceDate) : '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Receivable Amount</div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatCurrency(getReceivableAmount(), invoiceData?.currencyDetails?.invoiceCurrency || invoiceData?.currency || 'INR')}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Total Received</div>
                <div className="text-sm font-semibold text-emerald-600">
                  {formatCurrency(calculateTotalReceived(), invoiceData?.currencyDetails?.invoiceCurrency || invoiceData?.currency || 'INR')}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Balance Due</div>
                <div className="text-sm font-semibold text-red-600">
                  {formatCurrency(getBalanceDue(), invoiceData?.currencyDetails?.invoiceCurrency || invoiceData?.currency || 'INR')}
                </div>
              </div>
            </div>
          </div>

          {/* Payment History Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-bold text-slate-900">
                  Payment History ({payments.length})
                </h3>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-slate-600 font-medium">Loading payment history...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-600 font-medium">No payments recorded for this invoice</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Payment #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Payment Mode
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {payments.map((payment) => (
                      <tr key={payment._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                          {payment.paymentNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-900">
                          {formatCurrency(payment.amountReceived, invoiceData?.currencyDetails?.invoiceCurrency || invoiceData?.currency || 'INR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {payment.hasDepartmentSplit && payment.departmentSplits && payment.departmentSplits.length > 0 ? (
                            <div className="space-y-1">
                              {payment.departmentSplits.map((split, index) => (
                                <div key={index} className="flex justify-between items-center bg-purple-50 px-2 py-1 rounded text-xs">
                                  <span className="font-medium text-purple-700">{split.departmentName}</span>
                                  <span className="font-semibold text-purple-900">
                                    {formatCurrency(split.amount, invoiceData?.currencyDetails?.invoiceCurrency || invoiceData?.currency || 'INR')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No splits</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                          <div className="flex flex-col">
                            <span>{payment.paymentMode || '-'}</span>
                            {payment.depositTo && (
                              <span className="text-xs text-slate-500">{payment.depositTo}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {payment.status === 'Paid' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700">
                              {payment.status}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                              {payment.status || 'Draft'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {payment.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-sm font-bold text-slate-900 text-right">
                        Total Received:
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-emerald-600">
                        {formatCurrency(calculateTotalReceived(), invoiceData?.currencyDetails?.invoiceCurrency || invoiceData?.currency || 'INR')}
                      </td>
                      <td colSpan="3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 mt-4">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistory;
