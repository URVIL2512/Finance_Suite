import { format } from 'date-fns';

const ViewExpenseModal = ({ isOpen, onClose, expense }) => {
  if (!isOpen || !expense) return null;

  const dueAmount = (expense.totalAmount || 0) - (expense.paidAmount || 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="text-xl font-bold text-slate-900">Expense Details</h2>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-1">Total Amount</div>
              <div className="text-base font-bold text-slate-900">
                ₹{expense.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-1">Payment Mode</div>
              <div className="text-sm font-semibold text-slate-900">{expense.paymentMode || '-'}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-1">Bank Account</div>
              <div className="text-sm font-semibold text-slate-900">{expense.bankAccount || '-'}</div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Expense Information - Left Column */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900">Expense Information</h3>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Date</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {expense.date ? format(new Date(expense.date), 'dd MMM yyyy') : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Category</div>
                    <div className="text-sm font-semibold text-slate-900">{expense.category || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Department</div>
                    <div className="text-sm font-semibold text-slate-900">{expense.department || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">Vendor/Party</div>
                    <div className="text-sm text-slate-700">{expense.vendor || '-'}</div>
                  </div>
                  {expense.description && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">Description</div>
                      <div className="text-sm text-slate-700">{expense.description}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* User Information */}
              {(expense.createdBy || expense.editedBy || expense.userName) && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="text-sm font-bold text-slate-900">User Information</h3>
                  </div>
                  <div className="space-y-2.5">
                    {expense.userName && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Name</div>
                        <div className="text-sm font-semibold text-slate-900">{expense.userName}</div>
                      </div>
                    )}
                    {expense.userEmail && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Email</div>
                        <div className="text-xs text-slate-700 break-all">{expense.userEmail}</div>
                      </div>
                    )}
                    {expense.userPhone && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Phone</div>
                        <div className="text-xs text-slate-700">{expense.userPhone}</div>
                      </div>
                    )}
                    {expense.createdBy && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Created By</div>
                        <div className="text-xs text-slate-700">{expense.createdBy}</div>
                      </div>
                    )}
                    {expense.editedBy && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Edited By</div>
                        <div className="text-xs text-slate-700">{expense.editedBy}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Financial Details - Right Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900">Financial Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">Amount (Excl. Tax)</div>
                      <div className="text-sm font-semibold text-slate-900">
                        ₹{expense.amountExclTax?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">GST %</div>
                      <div className="text-sm text-slate-700">{expense.gstPercentage || 0}%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">GST Amount</div>
                      <div className="text-sm text-slate-700">
                        ₹{expense.gstAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">TDS %</div>
                      <div className="text-sm text-slate-700">{expense.tdsPercentage || 0}%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">TDS Amount</div>
                      <div className="text-sm text-slate-700">
                        ₹{expense.tdsAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">Total Amount</div>
                      <div className="text-base font-bold text-blue-600">
                        ₹{expense.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900">Payment Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">Paid Amount</div>
                      <div className="text-sm font-semibold text-green-700">
                        ₹{expense.paidAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">Due Amount</div>
                      <div className={`text-sm font-semibold ${dueAmount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        ₹{dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  {expense.paidTransactionRef && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">Transaction Reference</div>
                      <div className="text-sm text-slate-700">{expense.paidTransactionRef}</div>
                    </div>
                  )}
                  {expense.executive && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-0.5">Executive</div>
                      <div className="text-sm text-slate-700">{expense.executive}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewExpenseModal;
