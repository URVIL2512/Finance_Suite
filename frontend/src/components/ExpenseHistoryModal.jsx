import { format } from 'date-fns';

const ExpenseHistoryModal = ({ isOpen, onClose, expenses, filterType, filterValue, allExpenses }) => {
  if (!isOpen) return null;

  // Get filtered expenses
  const filteredExpenses = expenses || [];

  // Calculate totals
  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.totalAmount || 0), 0);
  const totalPaid = filteredExpenses.reduce((sum, exp) => sum + (exp.paidAmount || 0), 0);
  const totalPending = totalAmount - totalPaid;

  // Get title based on filter type
  const getTitle = () => {
    if (filterType === 'vendor') {
      return `${filterValue} - Expense History`;
    } else if (filterType === 'category') {
      return `${filterValue} Expense History`;
    } else if (filterType === 'department') {
      return `${filterValue} Department - Expense History`;
    }
    return 'Expense History';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{getTitle()}</h2>
            <p className="text-sm text-slate-600 mt-1">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} found
            </p>
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

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-1">Total Amount</div>
              <div className="text-xl font-bold text-blue-700">
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-1">Paid Amount</div>
              <div className="text-xl font-bold text-green-700">
                ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-1">Pending Amount</div>
              <div className="text-xl font-bold text-red-700">
                ₹{totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Date
                    </th>
                    {(filterType === 'category' || filterType === 'department') && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                        Vendor
                      </th>
                    )}
                    {(filterType === 'vendor' || filterType === 'department') && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                        Category
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                      TDS
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                      Paid
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(expense.date), 'dd MMM yyyy')}
                      </td>
                      {(filterType === 'category' || filterType === 'department') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {expense.vendor || '-'}
                        </td>
                      )}
                      {(filterType === 'vendor' || filterType === 'department') && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            {expense.category || '-'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                        <div className="truncate" title={expense.description || '-'}>
                          {expense.description || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        ₹{expense.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                        ₹{(expense.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700 text-right">
                        ₹{expense.paidAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm ${
                          expense.status === 'Paid' 
                            ? 'bg-green-100 text-green-800 border-green-200' 
                            : expense.status === 'Partial'
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {expense.status || 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-700 text-right">
                        ₹{((expense.totalAmount || 0) - (expense.paidAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseHistoryModal;
