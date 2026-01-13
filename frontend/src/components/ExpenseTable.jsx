import { format } from 'date-fns';
import ActionDropdown from './ActionDropdown';

const ExpenseTable = ({ expenses, onEdit, onView, onDelete, onDeleteSingle, selectedExpenses = [], onSelectExpense, onSelectAll }) => {
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '2000px' }}>
            <thead className="table-header">
              <tr>
                {onSelectExpense && (
                  <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20 w-12">
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
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Sr. No
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Category
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Department
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Vendor
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Description
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Payment Mode
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Bank Account
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Amount Excl Tax
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                GST %
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                GST Amount
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                TDS %
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                TDS Amount
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Total Amount
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Paid Amount
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Due Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Transaction Ref
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Executive
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Created By
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Edited By
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense, index) => (
              <tr key={expense._id} className="hover:bg-slate-50 transition-all duration-150 border-b border-slate-200">
                {onSelectExpense && (
                  <td className="px-4 py-4 whitespace-nowrap">
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
                <td 
                  className={`px-6 py-4 whitespace-nowrap text-center ${onView ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''}`}
                  onClick={onView ? () => onView(expense) : undefined}
                  title={onView ? "Click to view expense details" : undefined}
                >
                  <span className={`text-sm font-semibold ${onView ? 'text-blue-600 hover:text-blue-800' : 'text-gray-700'}`}>
                    {index + 1}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {format(new Date(expense.date), 'dd/MM/yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  <span className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-purple-100 text-purple-800 border border-purple-200 shadow-sm">
                    {expense.department || '-'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {expense.vendor || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" title={expense.description || ''}>
                  {expense.description || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {expense.paymentMode || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {expense.bankAccount || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                  ₹{expense.amountExclTax?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {expense.gstPercentage || 0}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  ₹{expense.gstAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  {expense.tdsPercentage || 0}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                  ₹{expense.tdsAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                  ₹{expense.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700 text-right">
                  ₹{expense.paidAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-700 text-right">
                  ₹{((expense.totalAmount || 0) - (expense.paidAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {expense.paidTransactionRef || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {expense.executive || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {expense.createdBy || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {expense.editedBy || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                  <div className="flex items-center justify-center">
                    <ActionDropdown
                      onView={onView ? () => onView(expense) : null}
                      onEdit={() => onEdit(expense)}
                      onDelete={(onDeleteSingle || onDelete) ? () => {
                        const deleteFn = onDeleteSingle || onDelete;
                        deleteFn(expense._id);
                      } : null}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default ExpenseTable;

