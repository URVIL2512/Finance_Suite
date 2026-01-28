import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { recurringExpenseAPI } from '../services/api';
import RecurringExpenseModal from '../components/RecurringExpenseModal';
import ActionDropdown from '../components/ActionDropdown';
import { useToast } from '../contexts/ToastContext';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const RecurringExpenses = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const initialSearch =
    typeof window !== 'undefined'
      ? new URLSearchParams(location.search).get('search') || ''
      : '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    fetchRecurringExpenses();
  }, []);

  // Track if a fetch is in progress to prevent concurrent requests
  const fetchingRef = useRef(false);
  
  const fetchRecurringExpenses = async (silent = false) => {
    // Prevent concurrent requests
    if (fetchingRef.current) {
      return;
    }
    
    try {
      fetchingRef.current = true;
      if (!silent) {
        setLoading(true);
      }
      const recurringResponse = await recurringExpenseAPI.getAll();
      setRecurringExpenses(recurringResponse.data || []);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      // Only show error toast on initial load, not on silent refresh
      if (!silent) {
        showToast('Failed to load recurring expenses', 'error');
      }
    } finally {
      fetchingRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // IMPORTANT BUSINESS LOGIC (Monthly Recurring Cost):
  // Recurring schedules are templates. Totals on this page should reflect the per-cycle cost
  // (e.g. monthly), not historical generated expenses. So we always aggregate over the
  // recurring templates (baseExpense amounts), not over Expense history.
  const getTemplateAmount = (re) => {
    const base = re?.baseExpense;
    const explicitTotal = parseFloat(base?.totalAmount);
    if (!Number.isNaN(explicitTotal) && explicitTotal > 0) return explicitTotal;

    const amountExclTax = parseFloat(base?.amountExclTax) || 0;
    const gstAmount = parseFloat(base?.gstAmount) || 0;
    const tdsAmount = parseFloat(base?.tdsAmount) || 0;
    const derivedTotal = amountExclTax + gstAmount - tdsAmount;
    return derivedTotal > 0 ? derivedTotal : 0;
  };

  // Keep search state in sync with URL query param (?search=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search') || '';
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [location.search]);

  const updateSearchInUrl = (value) => {
    const params = new URLSearchParams(location.search);
    if (value && value.trim()) {
      params.set('search', value.trim());
    } else {
      params.delete('search');
    }
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    );
  };

  const filteredRecurringExpenses = filterBySearchQuery(
    recurringExpenses,
    searchQuery,
    moduleSearchConfig.recurringExpenses
  );

  const activeRecurringExpenses = (filteredRecurringExpenses || []).filter(
    (re) => re?.isActive !== false
  );

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    try {
      await recurringExpenseAPI.delete(deleteConfirm.id);
      showToast('Recurring expense deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error deleting recurring expense:', error);
      showToast('Failed to delete recurring expense', 'error');
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, id: null });
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await recurringExpenseAPI.update(id, { isActive: !isActive });
      showToast(`Recurring expense ${!isActive ? 'activated' : 'deactivated'} successfully!`, 'success');
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      showToast('Failed to update recurring expense', 'error');
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      setDeleting(true);
      
      // Delete all entries in parallel for faster deletion
      const deletePromises = ids.map(id => recurringExpenseAPI.delete(id));
      await Promise.all(deletePromises);
      
      // Optimistic UI update - remove deleted items from list immediately
      setRecurringExpenses(prevExpenses => prevExpenses.filter(exp => !ids.includes(exp._id)));
      setSelectedExpenses([]);
      
      showToast(`Successfully deleted ${ids.length} recurring expense(s)`, 'success');
      
      // Refresh to ensure data is in sync (in background)
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error deleting recurring expenses:', error);
      showToast('Failed to delete some recurring expenses', 'error');
      fetchRecurringExpenses(); // Refresh to show current state
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkToggleStatus = async (ids) => {
    try {
      setTogglingStatus(true);
      
      // Get all expenses to check their current status
      const expensesToUpdate = recurringExpenses.filter(exp => ids.includes(exp._id));
      
      // Check if all are active or all are inactive
      const allActive = expensesToUpdate.every(exp => exp.isActive);
      const allInactive = expensesToUpdate.every(exp => !exp.isActive);
      
      // Determine the action text
      const action = allActive ? 'deactivate' : 'activate';
      
      // Update all entries in parallel
      const updatePromises = ids.map(id => {
        const expense = recurringExpenses.find(exp => exp._id === id);
        return recurringExpenseAPI.update(id, { isActive: !expense.isActive });
      });
      
      await Promise.all(updatePromises);
      
      // Optimistic UI update
      setRecurringExpenses(prevExpenses => 
        prevExpenses.map(exp => 
          ids.includes(exp._id) ? { ...exp, isActive: !exp.isActive } : exp
        )
      );
      setSelectedExpenses([]);
      
      showToast(`Successfully ${action}d ${ids.length} recurring expense(s)`, 'success');
      
      // Refresh to ensure data is in sync (in background)
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error updating recurring expenses status:', error);
      showToast('Failed to update some recurring expenses', 'error');
      fetchRecurringExpenses(); // Refresh to show current state
    } finally {
      setTogglingStatus(false);
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
      showToast('Recurring expense updated successfully!', 'success');
      setShowEditModal(false);
      setEditingRecurringExpense(null);
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update recurring expense';
      showToast(errorMessage, 'error');
    }
  };

  const handleRemoveDuplicates = async () => {
    try {
      setRemovingDuplicates(true);
      
      // Find duplicates based on key fields (excluding scheduling dates)
      const seen = new Map();
      const duplicatesToRemove = [];
      
      recurringExpenses.forEach((re) => {
        const baseExpense = re.baseExpense;
        if (!baseExpense) return;
        
        // Create a unique key based on vendor, category, amount, and repeatEvery only
        // Exclude startOn, endsOn, nextProcessDate as these are scheduling details, not core expense characteristics
        const key = JSON.stringify({
          vendor: baseExpense.vendor || '',
          category: baseExpense.category || '',
          totalAmount: baseExpense.totalAmount || 0,
          repeatEvery: re.repeatEvery || '',
          neverExpires: re.neverExpires || false,
        });
        
        if (seen.has(key)) {
          // This is a duplicate - mark for removal (keep the first one)
          duplicatesToRemove.push(re._id);
        } else {
          // First occurrence - keep it
          seen.set(key, re._id);
        }
      });
      
      if (duplicatesToRemove.length === 0) {
        showToast('No duplicate recurring expenses found', 'info');
        setRemovingDuplicates(false);
        return;
      }
      
      // Delete all duplicates in parallel
      const deletePromises = duplicatesToRemove.map(id => recurringExpenseAPI.delete(id));
      await Promise.all(deletePromises);
      
      // Optimistic UI update
      setRecurringExpenses(prevExpenses => prevExpenses.filter(exp => !duplicatesToRemove.includes(exp._id)));
      setSelectedExpenses([]);
      
      showToast(`Successfully removed ${duplicatesToRemove.length} duplicate recurring expense(s)`, 'success');
      
      // Refresh to ensure data is in sync
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error removing duplicates:', error);
      showToast('Failed to remove some duplicates', 'error');
      fetchRecurringExpenses();
    } finally {
      setRemovingDuplicates(false);
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
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="page-header">Recurring Expenses</h1>
          <p className="page-subtitle">
            Manage recurring expense schedules and automation
          </p>
        </div>
        {recurringExpenses.length > 0 && (
          <SearchBar
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              updateSearchInUrl(val);
            }}
            placeholder="Search recurring expenses..."
          />
        )}
      </div>

      {filteredRecurringExpenses.length === 0 ? (
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
        <>
          {/* Recurring Expense Summary Cards */}
          {filteredRecurringExpenses.length > 0 && (
            <div className="mb-6 lg:mb-8">
              {/* Top Card - Total Expenses Only */}
              <div className="grid grid-cols-1 gap-4 lg:gap-6 mb-6 lg:mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-600 mb-1">Total Expenses</h3>
                      <p className="text-2xl lg:text-3xl font-bold text-blue-700">
                        ₹{activeRecurringExpenses
                          .reduce((sum, re) => sum + getTemplateAmount(re), 0)
                          .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-blue-200 rounded-full p-3">
                      <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8 border border-gray-200 mb-6 lg:mb-8">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">Category Breakdown</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(() => {
                    const categoryTotals = activeRecurringExpenses.reduce((acc, re) => {
                      const baseExpense = re?.baseExpense;
                      const category = baseExpense?.category || 'Uncategorized';
                      const total = getTemplateAmount(re);
                      acc[category] = (acc[category] || 0) + total;
                      return acc;
                    }, {});
                    
                    return Object.entries(categoryTotals)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, total]) => (
                        <div key={category} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-700">{category}</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900">
                            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ));
                  })()}
                </div>
              </div>


            </div>
          )}

          {selectedExpenses.length > 0 && (
            <div className="mb-6 lg:mb-8 p-4 lg:p-6 bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 lg:gap-6">
                <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {selectedExpenses.length} recurring expense(s) selected
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveDuplicates();
                    }}
                    disabled={removingDuplicates}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    {removingDuplicates ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c0-4.418-3.582-8-8-8z"></path>
                        </svg>
                        Removing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove Duplicacy
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleBulkToggleStatus(selectedExpenses);
                    }}
                    disabled={togglingStatus}
                    className="px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    {togglingStatus ? (
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
                        Toggle Status
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleBulkDelete(selectedExpenses);
                    }}
                    disabled={deleting}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    {deleting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c0-4.418-3.582-8-8-8z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Selected
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    <input
                      type="checkbox"
                      checked={selectedExpenses.length === recurringExpenses.length && recurringExpenses.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExpenses(recurringExpenses.map(exp => exp._id));
                        } else {
                          setSelectedExpenses([]);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
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
                {filteredRecurringExpenses.map((recurringExpense) => {
                    const baseExpense = recurringExpense.baseExpense;
                    const category = baseExpense?.category || 'N/A';
                    const vendor = baseExpense?.vendor || 'N/A';
                    const amount = baseExpense?.totalAmount || 0;
                    
                    return (
                      <tr key={recurringExpense._id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedExpenses.includes(recurringExpense._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExpenses([...selectedExpenses, recurringExpense._id]);
                              } else {
                                setSelectedExpenses(selectedExpenses.filter(id => id !== recurringExpense._id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
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
                            onDelete={() => handleDeleteClick(recurringExpense._id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
        </>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleDeleteCancel}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete this recurring expense? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringExpenses;
