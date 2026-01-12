import { format } from 'date-fns';
import { useState } from 'react';
import ActionDropdown from './ActionDropdown';

const ExpenseTable = ({ expenses, onEdit, onDelete, onDeleteSingle, selectedExpenses = [], onSelectExpense, onSelectAll }) => {
  const [viewMode, setViewMode] = useState('pivot'); // 'pivot' or 'list'


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

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Group expenses by category and operation type
  const categoryExpenseMap = {};
  expenses.forEach((exp) => {
    const key = `${exp.category}_${exp.operationType}`;
    if (!categoryExpenseMap[key]) {
      categoryExpenseMap[key] = {
        category: exp.category,
        operationType: exp.operationType,
        months: {},
        total: 0,
        ids: [], // Store all IDs for this group
        entries: [], // Store all expense entries for this group
      };
    }
    categoryExpenseMap[key].months[exp.month] = (categoryExpenseMap[key].months[exp.month] || 0) + (exp.totalAmount || 0);
    categoryExpenseMap[key].total += exp.totalAmount || 0;
    categoryExpenseMap[key].ids.push(exp._id);
    categoryExpenseMap[key].entries.push(exp);
  });

  const categories = Object.values(categoryExpenseMap);

  if (viewMode === 'pivot') {
    return (
      <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-bold text-gray-900">Category-wise Monthly Expenses</h2>
          <button
            onClick={() => setViewMode('list')}
            className="px-5 py-2.5 text-sm font-semibold bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-200 shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Switch to List View
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                {onSelectExpense && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20 w-12">
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Operation Type
                </th>
                {months.map((month) => (
                  <th
                    key={month}
                    className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider border-r border-white/20"
                  >
                    {month}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider border-r border-white/20">
                  Total
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category, idx) => {
                // Check if all expenses in this category are selected
                const allSelected = category.ids.length > 0 && category.ids.every(id => selectedExpenses.includes(id));
                const someSelected = category.ids.some(id => selectedExpenses.includes(id));
                
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    {onSelectExpense && (
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Add all expenses in this category
                              const newSelected = [...selectedExpenses];
                              category.ids.forEach(id => {
                                if (!newSelected.includes(id)) {
                                  newSelected.push(id);
                                }
                              });
                              onSelectAll(newSelected);
                            } else {
                              // Remove all expenses in this category
                              onSelectAll(selectedExpenses.filter(id => !category.ids.includes(id)));
                            }
                          }}
                          className="w-4 h-4 text-finance-blue bg-gray-100 border-gray-300 rounded focus:ring-finance-blue"
                          style={{ opacity: someSelected && !allSelected ? 0.5 : 1 }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                      {category.category}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border-r border-gray-200">
                      {category.operationType}
                    </td>
                    {months.map((month) => (
                      <td
                        key={month}
                        className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200"
                      >
                        {category.months[month] ? `₹${category.months[month].toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    ))}
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      ₹{category.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                      <div className="flex items-center justify-center">
                        <ActionDropdown
                          onEdit={onEdit ? () => onEdit(category.entries[0]) : null}
                          onDelete={onDelete ? () => onDelete(category.ids) : null}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Total Row */}
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100/50 font-bold border-t-2 border-blue-200">
                <td colSpan={onSelectExpense ? 3 : 2} className="px-4 py-4 text-sm text-gray-900 border-r border-gray-300">
                  Total
                </td>
                {months.map((month) => {
                  const monthTotal = categories.reduce((sum, category) => sum + (category.months[month] || 0), 0);
                  return (
                    <td
                      key={month}
                      className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-300"
                    >
                      ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  ₹{categories.reduce((sum, category) => sum + category.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    );
  }

  // List View
  return (
    <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-xl font-bold text-gray-900">Expenses List</h2>
        <button
          onClick={() => setViewMode('pivot')}
          className="px-5 py-2.5 text-sm font-semibold bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-200 shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Switch to Pivot View
        </button>
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
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Category
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Operation Type
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
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Transaction Ref
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                Executive
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => (
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
                    {expense.operationType || '-'}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {expense.paidTransactionRef || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {expense.executive || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                  <div className="flex items-center justify-center">
                    <ActionDropdown
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

