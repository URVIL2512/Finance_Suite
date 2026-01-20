import { format } from 'date-fns';

const ExpensePaymentHistoryModal = ({ isOpen, onClose, expense }) => {
  if (!isOpen || !expense) return null;

  const paymentHistory = expense.paymentHistory || [];
  const totalAmount = expense.totalAmount || 0;
  const gstAmount = expense.gstAmount || 0;
  const tdsAmount = expense.tdsAmount || 0;
  
  // Sort payment history by date (oldest first)
  const sortedHistory = [...paymentHistory].sort((a, b) => {
    const dateA = new Date(a.paymentDate);
    const dateB = new Date(b.paymentDate);
    return dateA - dateB;
  });

  // Fallback: older records may have paidAmount/status but no paymentHistory.
  const effectiveHistory =
    sortedHistory.length > 0
      ? sortedHistory
      : (expense.paidAmount || 0) > 0
        ? [
            {
              paymentDate: expense.updatedAt || expense.date || new Date(),
              amountPaid: expense.paidAmount || 0,
              cumulativePaid: expense.paidAmount || 0,
              status: expense.status || ((expense.paidAmount || 0) >= totalAmount ? 'Paid' : 'Partial'),
              transactionRef: expense.paidTransactionRef || '',
              notes: expense.notes || '',
              updatedBy: expense.editedBy || expense.createdBy || expense.userName || '',
            },
          ]
        : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Payment History</h2>
            <p className="text-sm text-slate-600 mt-1">
              {expense.vendor || 'Expense'} - Total Amount: ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            {(gstAmount || tdsAmount) ? (
              <p className="text-xs text-slate-500 mt-1">
                GST: ₹{Number(gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} • TDS: ₹{Number(tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-red-600 transition-colors text-3xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {effectiveHistory.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-semibold text-gray-700 mb-2">No Payment History</p>
              <p className="text-sm text-gray-500">Payment history will appear here when payments are made.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Timeline */}
              {effectiveHistory.map((payment, index) => {
                const paymentDate = new Date(payment.paymentDate);
                const cumulativePaid = payment.cumulativePaid || 0;
                const balance = totalAmount - cumulativePaid;
                const isLast = index === effectiveHistory.length - 1;

                return (
                  <div key={index} className="relative">
                    {/* Timeline Line */}
                    {!isLast && (
                      <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-slate-200"></div>
                    )}
                    
                    {/* Payment Card */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 relative ml-0">
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                          payment.status === 'Paid' 
                            ? 'bg-green-100' 
                            : payment.status === 'Partial'
                            ? 'bg-yellow-100'
                            : 'bg-red-100'
                        }`}>
                          {payment.status === 'Paid' ? (
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : payment.status === 'Partial' ? (
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>

                        {/* Payment Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-base font-bold text-slate-900">
                                Payment #{index + 1}
                              </h3>
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                payment.status === 'Paid'
                                  ? 'bg-green-100 text-green-800'
                                  : payment.status === 'Partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {payment.status}
                              </span>
                            </div>
                            <span className="text-sm text-slate-600">
                              {format(paymentDate, 'dd MMM yyyy, hh:mm a')}
                            </span>
                          </div>

                          {/* Amount Details */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                              <div className="text-xs font-semibold text-blue-700 mb-1">Amount Paid</div>
                              <div className="text-base font-bold text-blue-900">
                                ₹{payment.amountPaid?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                              </div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                              <div className="text-xs font-semibold text-green-700 mb-1">Cumulative Paid</div>
                              <div className="text-base font-bold text-green-900">
                                ₹{cumulativePaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                              <div className="text-xs font-semibold text-red-700 mb-1">Balance Due</div>
                              <div className="text-base font-bold text-red-900">
                                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>

                          {/* Additional Info */}
                          {(payment.transactionRef || payment.notes || payment.updatedBy) && (
                            <div className="space-y-1 text-sm text-slate-600">
                              {payment.transactionRef && (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Transaction Ref:</span>
                                  <span>{payment.transactionRef}</span>
                                </div>
                              )}
                              {payment.notes && (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Notes:</span>
                                  <span>{payment.notes}</span>
                                </div>
                              )}
                              {payment.updatedBy && (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Updated By:</span>
                                  <span>{payment.updatedBy}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Summary Card */}
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-700 mb-1">Total Amount</div>
                    <div className="text-2xl font-bold text-blue-900">
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-700 mb-1">Total Paid</div>
                    <div className="text-2xl font-bold text-green-900">
                      ₹{(expense.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-red-700 mb-1">Balance Due</div>
                    <div className="text-2xl font-bold text-red-900">
                      ₹{((totalAmount - (expense.paidAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 text-sm shadow-md hover:shadow-lg active:shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpensePaymentHistoryModal;
