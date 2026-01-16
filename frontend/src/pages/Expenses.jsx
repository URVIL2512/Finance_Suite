import { useState, useEffect } from 'react';
import { expenseAPI, recurringExpenseAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ExpenseForm from '../components/ExpenseForm';
import ExpenseTable from '../components/ExpenseTable';
import RecurringExpenseModal from '../components/RecurringExpenseModal';
import ViewExpenseModal from '../components/ViewExpenseModal';
import { exportExpensesToExcel, exportExpensesToPDF } from '../utils/expenseExports';
import { getAuthToken } from '../utils/auth';

const Expenses = () => {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [filters, setFilters] = useState({
    month: '',
    category: '',
    department: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.month) params.month = filters.month;
      if (filters.category) params.category = filters.category;
      if (filters.department) params.department = filters.department;

      const response = await expenseAPI.getAll(params);
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleDelete = async (id, skipConfirmation = false) => {
    if (!skipConfirmation && !window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }
    try {
      await expenseAPI.delete(id);
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      showToast('Failed to delete expense', 'error');
    }
  };

  const handleBulkDelete = async (ids) => {
    if (window.confirm(`Are you sure you want to delete ${ids.length} expense entry/entries?`)) {
      try {
        // Delete all entries sequentially
        for (const id of ids) {
          await expenseAPI.delete(id);
        }
        fetchExpenses();
        showToast(`Successfully deleted ${ids.length} expense entry/entries`, 'success');
      } catch (error) {
        console.error('Error deleting expense entries:', error);
        showToast('Failed to delete some expense entries', 'error');
        fetchExpenses(); // Refresh to show current state
      }
    }
  };

  const handleClearFilters = () => {
    setFilters({
      month: '',
      category: '',
      department: '',
    });
  };

  const handleFormSubmit = async (data) => {
    try {
      // Ensure month is properly formatted
      if (!data.month || !['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].includes(data.month)) {
        const date = new Date(data.date);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        data.month = monthNames[date.getMonth()];
      }
      
      // Ensure year is a number
      if (data.year) {
        data.year = parseInt(data.year);
      }
      
      // Ensure all numeric fields are numbers, not empty strings
      const numericFields = ['amountExclTax', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'totalAmount', 'paidAmount'];
      numericFields.forEach(field => {
        if (data[field] === '' || data[field] === null || data[field] === undefined) {
          data[field] = 0;
        } else {
          data[field] = parseFloat(data[field]) || 0;
        }
      });
      
      if (editingExpense) {
        await expenseAPI.update(editingExpense._id, data);
        showToast('Expense updated successfully!', 'success');
      } else {
        await expenseAPI.create(data);
        showToast('Expense created successfully!', 'success');
      }
      setShowForm(false);
      setEditingExpense(null);
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      console.error('Error response:', error.response?.data);
      let errorMessage = 'Failed to save expense';
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend server is running on port 5000.\n\nTo start the backend:\n1. Open a terminal\n2. Navigate to the backend folder\n3. Run: npm run dev';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    }
  };

  const handleRecurringExpenseSubmit = async (data) => {
    try {
      const response = await recurringExpenseAPI.create(data);
      showToast(`Recurring expense created successfully for ${data.expenseIds.length} expense(s)!`, 'success');
      setSelectedExpenses([]);
      setShowRecurringModal(false);
      fetchExpenses(); // Refresh expenses list
    } catch (error) {
      console.error('Error creating recurring expense:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create recurring expense';
      showToast(errorMessage, 'error');
    }
  };

  const categories = [
    'Salaries',
    'Office Rent',
    'Internet',
    'Electricity',
    'Software Tools',
    'HR/Admin',
    'Travel',
    'Food',
    'Marketing',
    'Compliance',
    'Misc',
    'Chai n Snacks',
    'Loan Interest',
    'Purchase',
  ];

  const departments = [
    'OPERATION',
    'SOCIAL MEDIA',
    'WEBSITE',
    'BUSINESS DEVELOPMENT',
    'TELE CALLING',
  ];

  return (
    <div className="animate-fade-in min-h-screen">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Expenses
          </h1>
          <p className="text-sm text-gray-600 font-medium">Track and manage your business expenses efficiently</p>
        </div>
        <div className="flex items-center gap-3">
          {!showForm && (
            <>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters</span>
              </button>
              <button
                onClick={async () => await exportExpensesToExcel(expenses, filters)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-700 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                disabled={expenses.length === 0}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download as Excel</span>
              </button>
              <button
                onClick={() => exportExpensesToPDF(expenses, getAuthToken, filters)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-700 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                disabled={expenses.length === 0}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download as PDF</span>
              </button>
            </>
          )}
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {!showForm && showFilters && (
        <div className="card-gradient p-6 mb-6 border border-gray-200/60">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
            <h2 className="text-lg font-bold text-gray-800">Filter Expenses</h2>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            >
              Clear All Filters
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Month</label>
              <select
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="select-field w-full"
              >
                <option value="">All Months</option>
                <option value="Jan">January</option>
                <option value="Feb">February</option>
                <option value="Mar">March</option>
                <option value="Apr">April</option>
                <option value="May">May</option>
                <option value="Jun">June</option>
                <option value="Jul">July</option>
                <option value="Aug">August</option>
                <option value="Sep">September</option>
                <option value="Oct">October</option>
                <option value="Nov">November</option>
                <option value="Dec">December</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="select-field w-full"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Department</label>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="select-field w-full"
              >
                <option value="">All Departments</option>
                {departments.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
        />
      )}

      {!showForm && (
        <>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
              <p className="mt-4 text-slate-600 font-medium">Loading expenses...</p>
            </div>
          ) : (
            <>
              {selectedExpenses.length > 0 ? (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {selectedExpenses.length} expense(s) selected
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Set as Recurring clicked, selected expenses:', selectedExpenses);
                      setShowRecurringModal(true);
                    }}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Set as Recurring
                  </button>
                </div>
              ) : null}
              <ExpenseTable 
                expenses={expenses} 
                onEdit={handleEdit}
                onView={(expense) => setViewingExpense(expense)}
                onDelete={handleBulkDelete} 
                onDeleteSingle={handleDelete}
                selectedExpenses={selectedExpenses}
                onSelectExpense={(expenseId, isSelected) => {
                  if (isSelected) {
                    setSelectedExpenses([...selectedExpenses, expenseId]);
                  } else {
                    setSelectedExpenses(selectedExpenses.filter(id => id !== expenseId));
                  }
                }}
                onSelectAll={(expenseIds) => {
                  setSelectedExpenses(expenseIds);
                }}
              />
            </>
          )}
        </>
      )}

      {/* Recurring Expense Modal */}
      {showRecurringModal && (
        <RecurringExpenseModal
          isOpen={showRecurringModal}
          onClose={() => {
            setShowRecurringModal(false);
            setSelectedExpenses([]);
          }}
          selectedExpenseIds={selectedExpenses}
          expenses={expenses}
          onSubmit={handleRecurringExpenseSubmit}
        />
      )}

      {/* View Expense Modal */}
      <ViewExpenseModal
        isOpen={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
        expense={viewingExpense}
      />
    </div>
  );
};

export default Expenses;

