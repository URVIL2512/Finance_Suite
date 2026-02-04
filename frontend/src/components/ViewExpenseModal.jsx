import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import BankAccountPicker from './BankAccountPicker';

const ViewExpenseModal = ({ isOpen, onClose, expense, onMarkPaid, addNewReturnState }) => {
  const { showToast } = useToast();
  const [showPaidAmountInput, setShowPaidAmountInput] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [updating, setUpdating] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedBankAccount(expense?.bankAccount || '');
  }, [isOpen, expense?.bankAccount]);

  const hasExpense = !!expense;

  // Derived values (safe even when expense is null)
  const total = Math.max(0, Number(expense?.totalAmount) || 0);
  const paid = Math.min(Math.max(0, Number(expense?.paidAmount) || 0), total);
  const dueAmount = Math.max(0, total - paid);
  const isAlreadyPaid = expense?.status === 'Paid' || (paid >= total && total > 0);
  const isCanceled = expense?.status === 'Cancel';

  if (!isOpen || !hasExpense) return null;

  const handleMarkPaidClick = async () => {
    // Prevent marking as paid if status is Cancel
    if (expense?.status === 'Cancel') {
      showToast('Cannot mark canceled expenses as paid', 'error');
      return;
    }
    
    if (showPaidAmountInput) {
      // Submit with entered amount
      if (!paidAmount || parseFloat(paidAmount) < 0) {
        showToast('Please enter a valid paid amount', 'error');
        return;
      }

      if (expense?.paymentMode === 'Bank Transfer' && !selectedBankAccount) {
        showToast('Please select a bank account for Bank Transfer', 'error');
        return;
      }

      setUpdating(true);
      // Add to existing paid amount
      const currentPaidAmount = paid;
      const newPaidAmount = currentPaidAmount + (parseFloat(paidAmount) || 0);
      const finalPaidAmount = Math.min(newPaidAmount, total);
      const updatedExpense = {
        ...expense,
        paidAmount: finalPaidAmount,
        bankAccount: selectedBankAccount || expense?.bankAccount || '',
      };
      await onMarkPaid(updatedExpense);
      setShowPaidAmountInput(false);
      setPaidAmount('');
      setSelectedBankAccount('');
      setUpdating(false);
    } else {
      // Show input field
      setShowPaidAmountInput(true);
      setPaidAmount(''); // Start with blank input
      setSelectedBankAccount(expense?.bankAccount || '');
    }
  };

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
                      <div className="text-sm font-semibold text-red-600">
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
                      <div className="text-sm font-semibold text-red-600">
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

              {expense.expensePdfUrl && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-sm font-bold text-slate-900">Expense PDF Bill</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={expense.expensePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View PDF
                    </a>
                    <a
                      href={expense.expensePdfUrl}
                      download
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-white">
          {onMarkPaid && !isAlreadyPaid && !isCanceled && showPaidAmountInput && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Enter Paid Amount</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="Enter amount"
                  step="0.01"
                  min="0"
                  max={dueAmount}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-40"
                  autoFocus
                />
                <span className="text-sm text-gray-600">/ ₹{dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="mt-4 space-y-2">
                <BankAccountPicker
                  value={selectedBankAccount}
                  onChange={setSelectedBankAccount}
                  paymentMode={expense?.paymentMode}
                  addNewReturnState={
                    addNewReturnState || {
                      resumeViewExpense: { expenseId: expense?._id },
                    }
                  }
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            {onMarkPaid && !isAlreadyPaid && !isCanceled && (
              <>
                {showPaidAmountInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaidAmountInput(false);
                      setPaidAmount('');
                      setSelectedBankAccount('');
                    }}
                    disabled={updating}
                    className="px-6 py-2.5 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMarkPaidClick}
                  disabled={
                    updating ||
                    isCanceled ||
                    (showPaidAmountInput && (!paidAmount || parseFloat(paidAmount) < 0)) ||
                    (showPaidAmountInput && expense?.paymentMode === 'Bank Transfer' && !selectedBankAccount)
                  }
                  className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c0-4.418-3.582-8-8-8z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {showPaidAmountInput ? 'Update Paid Amount' : 'Mark as Paid'}
                    </>
                  )}
                </button>
              </>
            )}
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
    </div>
  );
};

export default ViewExpenseModal;
