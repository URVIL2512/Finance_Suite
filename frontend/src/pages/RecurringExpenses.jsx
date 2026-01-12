import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { recurringExpenseAPI } from '../services/api';
import RecurringExpenseModal from '../components/RecurringExpenseModal';
import ActionDropdown from '../components/ActionDropdown';

const RecurringExpenses = () => {
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchRecurringExpenses();
  }, []);

  const fetchRecurringExpenses = async () => {
    try {
      setLoading(true);
      const response = await recurringExpenseAPI.getAll();
      setRecurringExpenses(response.data || []);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      alert('Failed to load recurring expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this recurring expense?')) {
      try {
        await recurringExpenseAPI.delete(id);
        alert('Recurring expense deleted successfully!');
        fetchRecurringExpenses();
      } catch (error) {
        console.error('Error deleting recurring expense:', error);
        alert('Failed to delete recurring expense');
      }
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await recurringExpenseAPI.update(id, { isActive: !isActive });
      alert(`Recurring expense ${!isActive ? 'activated' : 'deactivated'} successfully!`);
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      alert('Failed to update recurring expense');
    }
  };

  const handleEdit = (recurringExpense) => {
    setEditingRecurringExpense(recurringExpense);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (data) => {
    try {
      await recurringExpenseAPI.update(editingRecurringExpense._id, {
        repeatEvery: data.repeatEvery,
        startOn: data.startOn,
        endsOn: data.endsOn,
        neverExpires: data.neverExpires,
      });
      alert('Recurring expense updated successfully!');
      setShowEditModal(false);
      setEditingRecurringExpense(null);
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update recurring expense';
      alert(`Error: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading recurring expenses...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-header">Recurring Expenses</h1>
          <p className="page-subtitle">Manage recurring expense schedules and automation</p>
        </div>
      </div>

      {recurringExpenses.length === 0 ? (
        <div className="card-gradient p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Recurring Expenses</h2>
          <p className="text-gray-600 mb-6">
            You haven't created any recurring expenses yet.
          </p>
          <p className="text-gray-500 text-sm">
            Go to <strong>Expenses</strong> page, select expenses, and click "Set as Recurring" to create recurring expenses.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Repeat Every
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Start On
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Ends On
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Next Process
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recurringExpenses.map((recurringExpense) => {
                  const baseExpense = recurringExpense.baseExpense;
                  const category = baseExpense?.category || 'N/A';
                  const vendor = baseExpense?.vendor || 'N/A';
                  const amount = baseExpense?.totalAmount || 0;
                  
                  return (
                    <tr key={recurringExpense._id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="badge-primary">{category}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vendor}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {recurringExpense.repeatEvery}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(recurringExpense.startOn), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {recurringExpense.neverExpires 
                          ? 'Never' 
                          : recurringExpense.endsOn 
                            ? format(new Date(recurringExpense.endsOn), 'dd/MM/yyyy')
                            : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {recurringExpense.nextProcessDate
                          ? format(new Date(recurringExpense.nextProcessDate), 'dd/MM/yyyy')
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={
                            recurringExpense.isActive
                              ? 'badge-success'
                              : 'badge-neutral'
                          }
                        >
                          {recurringExpense.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <ActionDropdown
                          onEdit={() => handleEdit(recurringExpense)}
                          onToggleActive={handleToggleActive}
                          isActive={recurringExpense.isActive}
                          itemId={recurringExpense._id}
                          onDelete={() => handleDelete(recurringExpense._id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRecurringExpense && (
        <RecurringExpenseModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingRecurringExpense(null);
          }}
          selectedExpenseIds={
            editingRecurringExpense.baseExpense?._id 
              ? [editingRecurringExpense.baseExpense._id]
              : editingRecurringExpense.baseExpense
              ? [editingRecurringExpense.baseExpense]
              : []
          }
          expenses={
            editingRecurringExpense.baseExpense 
              ? (typeof editingRecurringExpense.baseExpense === 'object' 
                  ? [editingRecurringExpense.baseExpense] 
                  : [])
              : []
          }
          onSubmit={handleEditSubmit}
          editingRecurringExpense={editingRecurringExpense}
        />
      )}
    </div>
  );
};

export default RecurringExpenses;
