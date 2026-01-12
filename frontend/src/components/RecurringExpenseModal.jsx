import { useState, useEffect } from 'react';
import { format } from 'date-fns';

const RecurringExpenseModal = ({ isOpen, onClose, selectedExpenseIds, expenses, onSubmit, editingRecurringExpense }) => {
  const [formData, setFormData] = useState({
    repeatEvery: 'Month',
    startOn: format(new Date(), 'yyyy-MM-dd'),
    endsOn: '',
    neverExpires: false,
  });

  useEffect(() => {
    if (isOpen) {
      if (editingRecurringExpense) {
        // Pre-fill form with existing data when editing
        setFormData({
          repeatEvery: editingRecurringExpense.repeatEvery || 'Month',
          startOn: editingRecurringExpense.startOn 
            ? format(new Date(editingRecurringExpense.startOn), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd'),
          endsOn: editingRecurringExpense.endsOn 
            ? format(new Date(editingRecurringExpense.endsOn), 'yyyy-MM-dd')
            : '',
          neverExpires: editingRecurringExpense.neverExpires || false,
        });
      } else {
        // Reset form when creating new
        setFormData({
          repeatEvery: 'Month',
          startOn: format(new Date(), 'yyyy-MM-dd'),
          endsOn: '',
          neverExpires: false,
        });
      }
    }
  }, [isOpen, editingRecurringExpense]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.startOn) {
      alert('Start On date is required');
      return;
    }

    if (!formData.neverExpires && !formData.endsOn) {
      alert('Ends On date is required when "Never Expires" is not checked');
      return;
    }

    if (formData.neverExpires && formData.endsOn) {
      alert('Please uncheck "Never Expires" if you want to set an end date');
      return;
    }

    // Validate dates
    const startDate = new Date(formData.startOn);
    const endDate = formData.endsOn ? new Date(formData.endsOn) : null;

    if (endDate && endDate <= startDate) {
      alert('Ends On date must be after Start On date');
      return;
    }

    onSubmit({
      expenseIds: selectedExpenseIds,
      repeatEvery: formData.repeatEvery,
      startOn: formData.startOn,
      endsOn: formData.neverExpires ? null : formData.endsOn,
      neverExpires: formData.neverExpires,
    });
  };

  if (!isOpen) return null;

  const selectedExpensesList = (expenses || []).filter(exp => 
    exp && exp._id && (selectedExpenseIds || []).includes(exp._id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {editingRecurringExpense ? 'Edit Recurring Expense' : 'Set Recurring Expense'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Selected Expenses List - Only show when creating, not editing */}
          {!editingRecurringExpense && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Expenses ({selectedExpenseIds.length})
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                {selectedExpensesList.map((expense) => {
                  let formattedDate = 'N/A';
                  try {
                    if (expense.date) {
                      const date = new Date(expense.date);
                      if (!isNaN(date.getTime())) {
                        formattedDate = format(date, 'dd/MM/yyyy');
                      }
                    }
                  } catch (error) {
                    console.error('Error formatting expense date:', error);
                  }
                  
                  return (
                    <div key={expense._id} className="text-sm text-gray-700 py-1">
                      <span className="font-medium">{expense.category}</span>
                      {' - '}
                      <span>{expense.vendor || 'N/A'}</span>
                      {' - '}
                      <span className="text-gray-500">
                        ₹{expense.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                      </span>
                      {' - '}
                      <span className="text-gray-500">{formattedDate}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Repeat Every */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repeat Every *
            </label>
            <select
              name="repeatEvery"
              value={formData.repeatEvery}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-finance-blue"
            >
              <option value="Week">Week</option>
              <option value="Month">Month</option>
              <option value="Quarter">Quarter</option>
              <option value="Half Yearly">Half Yearly (6 Months)</option>
              <option value="Year">Year</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              How often the expense should be created automatically
            </p>
          </div>

          {/* Start On */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start On *
            </label>
            <input
              type="date"
              name="startOn"
              value={formData.startOn}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-finance-blue"
            />
            <p className="mt-1 text-xs text-gray-500">
              When the first recurring expense should be created
            </p>
          </div>

          {/* Ends On */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ends On {!formData.neverExpires && '*'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                name="endsOn"
                value={formData.endsOn}
                onChange={handleChange}
                required={!formData.neverExpires}
                disabled={formData.neverExpires}
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-finance-blue ${
                  formData.neverExpires ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="neverExpires"
                  name="neverExpires"
                  checked={formData.neverExpires}
                  onChange={handleChange}
                  className="w-4 h-4 text-finance-blue border-gray-300 rounded focus:ring-finance-blue"
                />
                <label htmlFor="neverExpires" className="ml-2 text-sm text-gray-700">
                  Never Expires
                </label>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {formData.neverExpires 
                ? 'Expense will be created indefinitely based on the repeat frequency'
                : 'When to stop creating recurring expenses'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-finance-blue rounded-md hover:bg-finance-blueLight transition-colors"
            >
              {editingRecurringExpense ? 'Update Recurring Expense' : 'Create Recurring Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecurringExpenseModal;
