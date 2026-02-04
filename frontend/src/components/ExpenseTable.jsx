import { format } from 'date-fns';
import ActionDropdown from './ActionDropdown';

const ExpenseTable = ({
  expenses,
  onEdit,
  onView,
  onViewHistory,
  onMarkPaid,
  onDelete,
  onDeleteSingle,
  selectedExpenses = [],
  onSelectExpense,
  onSelectAll,
  onViewVendorHistory,
  onViewCategoryHistory,
  onViewDepartmentHistory,
  onUploadPDF,
  uploadingExpenseId,
}) => {
  if (expenses.length === 0) {
    return (
      <div className="card-gradient p-12 text-center border border-gray-200/60">
        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg font-semibold text-gray-700 mb-2">No expenses found</p>
        <p className="text-sm text-gray-500">Add your first expense to get started</p>
      </div>
    );
  }

  // List View
  return (
    <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-xl font-bold text-gray-900">Expenses List</h2>
      </div>
      {/* On mobile, force horizontal scroll instead of squishing columns */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] divide-y divide-gray-200 table-auto">
            <thead className="table-header">
              <tr>
                {onSelectExpense && (
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20 w-12">
                    <input
                      type="checkbox"
                      checked={selectedExpenses.length === expenses.length && expenses.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectAll(expenses.map(exp => exp._id));
                        } else {
                          onSelectAll([]);
                        }
                      }}
                      className="w-4 h-4 text-finance-blue bg-gray-100 border-gray-300 rounded focus:ring-finance-blue"
                    />
                  </th>
                )}
                <th className="px-2 sm:px-3 py-3 sm:py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Date
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Category
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Department
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20 max-w-[120px]">
                <div className="truncate">Vendor</div>
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20 max-w-[100px]">
                <div className="truncate">Payment Mode</div>
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-center text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Recurring
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Amount Excl Tax
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Total Amount
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Paid Amount
              </th>
              {/* Disable sticky on mobile to avoid weird overlay */}
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-center text-xs font-medium uppercase tracking-wider border-r border-white/20 lg:sticky lg:right-[140px] bg-slate-800 lg:z-10">
                Status
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20 lg:sticky lg:right-[70px] bg-slate-800 lg:z-10">
                Due Amount
              </th>
              <th className="px-2 sm:px-3 py-3 sm:py-4 text-center text-xs font-medium uppercase tracking-wider lg:sticky lg:right-0 bg-slate-800 lg:z-10">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => {
              const total = Number(expense.totalAmount) || 0;
              const paidRaw = Number(expense.paidAmount) || 0;
              const paid = Math.min(Math.max(paidRaw, 0), Math.max(total, 0));
              const due = Math.max(0, Math.max(total, 0) - paid);
              const isUploadingPdf = uploadingExpenseId === expense._id;
              const hasPdf = !!expense.expensePdfUrl;

              return (
              <tr key={expense._id} className="hover:bg-slate-50 transition-all duration-150 border-b border-slate-200">
                {onSelectExpense && (
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedExpenses.includes(expense._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectExpense(expense._id, true);
                        } else {
                          onSelectExpense(expense._id, false);
                        }
                      }}
                      className="w-4 h-4 text-finance-blue bg-gray-100 border-gray-300 rounded focus:ring-finance-blue"
                    />
                  </td>
                )}
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {format(new Date(expense.date), 'dd/MM/yyyy')}
                </td>
                <td 
                  className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap cursor-pointer"
                  onClick={(e) => {
                    if (expense.category && onViewCategoryHistory) {
                      e.stopPropagation();
                      onViewCategoryHistory(expense.category);
                    }
                  }}
                  title={expense.category ? `Click to view all ${expense.category} expenses` : ''}
                >
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200 shadow-sm hover:bg-blue-200 hover:border-blue-300 transition-colors inline-block">
                    {expense.category || '-'}
                  </span>
                </td>
                <td 
                  className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-700 cursor-pointer"
                  onClick={(e) => {
                    if (expense.department && expense.department !== '-' && onViewDepartmentHistory) {
                      e.stopPropagation();
                      onViewDepartmentHistory(expense.department);
                    }
                  }}
                  title={expense.department && expense.department !== '-' ? `Click to view all ${expense.department} expenses` : ''}
                >
                  <span className="px-2 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-800 border border-purple-200 shadow-sm hover:bg-purple-200 hover:border-purple-300 transition-colors inline-block">
                    {expense.department || '-'}
                  </span>
                </td>
                <td 
                  className="px-2 sm:px-3 py-3 sm:py-4 text-sm text-gray-700 max-w-[120px] cursor-pointer"
                  onClick={(e) => {
                    if (expense.vendor && expense.vendor !== '-' && onViewVendorHistory) {
                      e.stopPropagation();
                      onViewVendorHistory(expense.vendor);
                    }
                  }}
                  title={expense.vendor && expense.vendor !== '-' ? `Click to view all expenses for ${expense.vendor}` : ''}
                >
                  <div className="truncate text-blue-600 hover:text-blue-800 hover:underline font-medium">
                    {expense.vendor || '-'}
                  </div>
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 text-sm text-gray-700 max-w-[100px]">
                  <div className="truncate" title={expense.paymentMode || '-'}>
                    {expense.paymentMode || '-'}
                  </div>
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-center text-sm text-gray-700">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                      expense.isRecurring
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {expense.isRecurring ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                  ₹{expense.amountExclTax?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                  ₹{expense.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm font-semibold text-green-700 text-right">
                  ₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-center lg:sticky lg:right-[140px] bg-white hover:bg-slate-50 lg:z-10">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm ${
                    expense.status === 'Paid' 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : expense.status === 'Partial'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      : expense.status === 'Cancel'
                      ? 'bg-gray-100 text-gray-800 border-gray-200'
                      : 'bg-red-100 text-red-800 border-red-200'
                  }`}>
                    {expense.status || 'Unpaid'}
                  </span>
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm font-semibold text-red-700 text-right lg:sticky lg:right-[70px] bg-white hover:bg-slate-50 lg:z-10">
                  ₹{due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-center lg:sticky lg:right-0 bg-white hover:bg-slate-50 lg:z-10">
                  <div className="flex items-center justify-center">
                    <ActionDropdown
                      onViewHistory={onViewHistory ? () => onViewHistory(expense) : null}
                      onMarkPaid={onMarkPaid && (expense.status !== 'Paid' && expense.status !== 'Cancel' && !(paid >= (expense.totalAmount || 0) && (expense.totalAmount || 0) > 0)) ? () => onMarkPaid(expense) : null}
                      onView={onView ? () => onView(expense) : null}
                      onEdit={() => onEdit(expense)}
                      onDelete={(onDeleteSingle || onDelete) ? () => {
                        const deleteFn = onDeleteSingle || onDelete;
                        deleteFn(expense._id);
                      } : null}
                      additionalActions={[
                        {
                          label: isUploadingPdf ? 'Uploading PDF...' : hasPdf ? 'Replace PDF' : 'Upload PDF',
                          icon: isUploadingPdf ? (
                            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          ),
                          onClick: () => {
                            if (isUploadingPdf) return;
                            if (onUploadPDF) onUploadPDF(expense);
                          },
                          className: isUploadingPdf
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                        },
                        ...(hasPdf
                          ? [
                              {
                                label: 'View PDF',
                                icon: (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                ),
                                onClick: () => {
                                  window.open(expense.expensePdfUrl, '_blank', 'noopener,noreferrer');
                                },
                                className: 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                              },
                              {
                                label: 'Download PDF',
                                icon: (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                ),
                                onClick: () => {
                                  const link = document.createElement('a');
                                  link.href = expense.expensePdfUrl;
                                  link.download = '';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                },
                                className: 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default ExpenseTable;

