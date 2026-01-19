import { useState, useEffect, useRef } from 'react';
import { expenseAPI, recurringExpenseAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ExpenseForm from '../components/ExpenseForm';
import ExpenseTable from '../components/ExpenseTable';
import RecurringExpenseModal from '../components/RecurringExpenseModal';
import ViewExpenseModal from '../components/ViewExpenseModal';
import ExpensePaymentHistoryModal from '../components/ExpensePaymentHistoryModal';
import ExpenseHistoryModal from '../components/ExpenseHistoryModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { exportExpensesToExcel, exportExpensesToPDF } from '../utils/expenseExports';
import { getAuthToken } from '../utils/auth';

const Expenses = () => {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]); // Store all expenses for vendor dropdown
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [viewingPaymentHistory, setViewingPaymentHistory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    month: '',
    category: '',
    department: '',
    startDate: '',
    endDate: '',
    vendor: '',
    status: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    month: '',
    category: '',
    department: '',
    startDate: '',
    endDate: '',
    vendor: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [showMarkPaidInput, setShowMarkPaidInput] = useState(false);
  const [bulkPaidAmount, setBulkPaidAmount] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markPaidExpense, setMarkPaidExpense] = useState(null);
  const [markPaidAmount, setMarkPaidAmount] = useState('');
  const [markingPaidSingle, setMarkingPaidSingle] = useState(false);
  const [historyModal, setHistoryModal] = useState({ isOpen: false, filterType: null, filterValue: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({ show: false, ids: [] });
  const fileInputRef = useRef(null);
  const vendorDropdownRef = useRef(null);


  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (appliedFilters.month) params.month = appliedFilters.month;
      if (appliedFilters.category) params.category = appliedFilters.category;
      if (appliedFilters.department) params.department = appliedFilters.department;

      const response = await expenseAPI.getAll(params);
      let filteredExpenses = response.data;

      // Client-side filtering for date range
      if (appliedFilters.startDate) {
        const startDate = new Date(appliedFilters.startDate);
        startDate.setHours(0, 0, 0, 0);
        filteredExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          expenseDate.setHours(0, 0, 0, 0);
          return expenseDate >= startDate;
        });
      }

      if (appliedFilters.endDate) {
        const endDate = new Date(appliedFilters.endDate);
        endDate.setHours(23, 59, 59, 999);
        filteredExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate <= endDate;
        });
      }

      // Client-side filtering for vendor (exact match)
      if (appliedFilters.vendor) {
        filteredExpenses = filteredExpenses.filter(expense => 
          expense.vendor && expense.vendor === appliedFilters.vendor
        );
      }

      // Client-side filtering for status
      if (appliedFilters.status) {
        filteredExpenses = filteredExpenses.filter(expense => 
          expense.status && expense.status.toLowerCase() === appliedFilters.status.toLowerCase()
        );
      }

      // Client-side search filtering - search across multiple fields
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filteredExpenses = filteredExpenses.filter(expense => {
          // Search in vendor
          const vendorMatch = expense.vendor && expense.vendor.toLowerCase().includes(query);
          
          // Search in category
          const categoryMatch = expense.category && expense.category.toLowerCase().includes(query);
          
          // Search in department
          const departmentMatch = expense.department && expense.department.toLowerCase().includes(query);
          
          // Search in description
          const descriptionMatch = expense.description && expense.description.toLowerCase().includes(query);
          
          // Search in payment mode
          const paymentModeMatch = expense.paymentMode && expense.paymentMode.toLowerCase().includes(query);
          
          // Search in date (format: DD/MM/YYYY)
          const expenseDate = new Date(expense.date);
          const dateStr = `${String(expenseDate.getDate()).padStart(2, '0')}/${String(expenseDate.getMonth() + 1).padStart(2, '0')}/${expenseDate.getFullYear()}`;
          const dateMatch = dateStr.includes(query);
          
          // Search in amount
          const amountStr = (expense.totalAmount || 0).toString();
          const amountMatch = amountStr.includes(query);

          return vendorMatch || categoryMatch || departmentMatch || descriptionMatch || paymentModeMatch || dateMatch || amountMatch;
        });
      }

      setExpenses(filteredExpenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all expenses for vendor dropdown
  useEffect(() => {
    const fetchAllExpenses = async () => {
      try {
        const response = await expenseAPI.getAll({});
        setAllExpenses(response.data);
      } catch (error) {
        console.error('Error fetching all expenses:', error);
      }
    };
    fetchAllExpenses();
  }, []);

  useEffect(() => {
    fetchExpenses();
    
    let intervalId = null;
    
    // Sync refresh to 10-second intervals (00, 10, 20, 30, 40, 50 seconds of each minute)
    // This ensures Expenses, Recurring Expenses, and Dashboard all refresh at the same time
    const syncToNext10Second = () => {
      const now = new Date();
      const seconds = now.getSeconds();
      const milliseconds = now.getMilliseconds();
      const remainder = seconds % 10;
      const delayToNext = remainder === 0 
        ? 10000 - milliseconds // Already at a 10-second mark, wait for next one
        : (10 - remainder) * 1000 - milliseconds; // Wait until next 10-second mark
      
      return delayToNext;
    };
    
    const delay = syncToNext10Second();
    
    const timeoutId = setTimeout(() => {
      fetchExpenses();
      // Then continue with regular 10-second intervals
      intervalId = setInterval(() => {
        fetchExpenses();
      }, 10000);
    }, delay);
    
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [searchQuery, appliedFilters]);

  // Get unique vendors from all expenses
  const uniqueVendors = [...new Set(allExpenses
    .map(expense => expense.vendor)
    .filter(vendor => vendor && vendor.trim() !== '')
  )].sort();

  // Filter vendors based on search
  const filteredVendors = uniqueVendors.filter(vendor =>
    vendor.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  // Close vendor dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(event.target)) {
        setShowVendorDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCreate = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleViewHistory = (expense) => {
    setViewingPaymentHistory(expense);
  };

  const handleMarkPaid = async (expense, customPaidAmount = null) => {
    try {
      const totalAmount = expense.totalAmount || 0;
      const currentPaidAmount = expense.paidAmount || 0;
      
      // If customPaidAmount is provided, use it; otherwise, if paidAmount is already set in expense (from View modal), use it
      let newPaidAmount;
      if (customPaidAmount !== null) {
        newPaidAmount = parseFloat(customPaidAmount) || 0;
      } else if (expense.paidAmount !== undefined && expense.paidAmount !== null) {
        // Expense object already has paidAmount set (from View modal input)
        newPaidAmount = parseFloat(expense.paidAmount) || 0;
      } else {
        // Should not reach here - should use modal first
        newPaidAmount = totalAmount;
      }
      
      // Calculate status based on new paid amount
      let newStatus = 'Unpaid';
      const epsilon = 0.01; // For floating point comparison
      const dueAmount = totalAmount - newPaidAmount;
      
      if (dueAmount <= epsilon && totalAmount > 0) {
        newStatus = 'Paid';
      } else if (newPaidAmount > epsilon) {
        newStatus = 'Partial';
      }

      const updatedExpense = {
        ...expense,
        paidAmount: newPaidAmount,
        status: newStatus,
      };
      await expenseAPI.update(expense._id, updatedExpense);
      showToast('Expense updated successfully', 'success');
      setViewingExpense(null); // Close the modal
      fetchExpenses();
    } catch (error) {
      console.error('Error marking expense as paid:', error);
      showToast('Failed to update expense', 'error');
    }
  };

  const handleMarkPaidClick = (expense) => {
    // Show modal to enter paid amount
    setMarkPaidExpense(expense);
    setMarkPaidAmount('');
  };

  const handleMarkPaidSubmit = async () => {
    if (!markPaidExpense) return;
    
    if (!markPaidAmount || parseFloat(markPaidAmount) < 0) {
      showToast('Please enter a valid paid amount', 'error');
      return;
    }

    const currentPaidAmount = markPaidExpense.paidAmount || 0;
    const totalAmount = markPaidExpense.totalAmount || 0;
    const newPaidAmount = currentPaidAmount + parseFloat(markPaidAmount);
    
    // Ensure we don't exceed total amount
    const finalPaidAmount = Math.min(newPaidAmount, totalAmount);

    try {
      setMarkingPaidSingle(true);
      const updatedExpense = {
        ...markPaidExpense,
        paidAmount: finalPaidAmount,
      };
      await handleMarkPaid(updatedExpense);
      setMarkPaidExpense(null);
      setMarkPaidAmount('');
      setMarkingPaidSingle(false);
    } catch (error) {
      setMarkingPaidSingle(false);
    }
  };

  const handleBulkMarkPaid = async (expenseIds, paidAmount) => {
    try {
      let updatedCount = 0;
      const skippedExpenses = [];

      const updatePromises = expenseIds.map(async (id) => {
        const expense = expenses.find(exp => exp._id === id);
        if (!expense) return null;

        // Skip if already paid
        if (expense.status === 'Paid' || (expense.paidAmount >= (expense.totalAmount || 0) && (expense.totalAmount || 0) > 0)) {
          skippedExpenses.push(expense.vendor || 'Unknown');
          return null;
        }

        const totalAmount = expense.totalAmount || 0;
        const newPaidAmount = parseFloat(paidAmount) || 0;
        let newStatus = 'Unpaid';
        
        if (newPaidAmount >= totalAmount) {
          newStatus = 'Paid';
        } else if (newPaidAmount > 0) {
          newStatus = 'Partial';
        }

        const updatedExpense = {
          ...expense,
          paidAmount: newPaidAmount,
          status: newStatus,
        };
        updatedCount++;
        return expenseAPI.update(id, updatedExpense);
      });

      const results = await Promise.all(updatePromises.filter(p => p !== null));
      
      if (skippedExpenses.length > 0) {
        showToast(`${updatedCount} expense(s) updated. ${skippedExpenses.length} already paid expense(s) skipped.`, 'info');
      } else {
        showToast(`Successfully marked ${updatedCount} expense(s) as paid`, 'success');
      }
      setSelectedExpenses([]);
      fetchExpenses();
    } catch (error) {
      console.error('Error marking expenses as paid:', error);
      showToast('Failed to mark some expenses as paid', 'error');
      fetchExpenses();
    }
  };

  const handleDelete = async (id, skipConfirmation = false) => {
    if (skipConfirmation) {
      try {
        await expenseAPI.delete(id);
        showToast('Expense deleted successfully', 'success');
        fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        showToast('Failed to delete expense', 'error');
      }
    } else {
      setDeleteConfirm({ show: true, id });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      await expenseAPI.delete(deleteConfirm.id);
      showToast('Expense deleted successfully', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      showToast('Failed to delete expense', 'error');
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const handleBulkDelete = async (ids) => {
    setBulkDeleteConfirm({ show: true, ids });
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = bulkDeleteConfirm.ids;
    if (!ids || ids.length === 0) return;

    try {
      setDeleting(true);
      setBulkDeleteConfirm({ show: false, ids: [] });
      
      // Delete all entries in parallel for faster deletion
      const deletePromises = ids.map(id => expenseAPI.delete(id));
      await Promise.all(deletePromises);
      
      // Optimistic UI update - remove deleted items from list immediately
      setExpenses(prevExpenses => prevExpenses.filter(exp => !ids.includes(exp._id)));
      setSelectedExpenses([]);
      
      showToast(`Successfully deleted ${ids.length} expense entry/entries`, 'success');
      
      // Refresh to ensure data is in sync (in background)
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense entries:', error);
      showToast('Failed to delete some expense entries', 'error');
      fetchExpenses(); // Refresh to show current state
    } finally {
      setDeleting(false);
    }
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      month: '',
      category: '',
      department: '',
      startDate: '',
      endDate: '',
      vendor: '',
      status: '',
    };
    setFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
    setSearchQuery('');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    ];

    if (!validTypes.includes(file.type)) {
      showToast('Invalid file type. Please upload an Excel file (.xlsx, .xls)', 'error');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size too large. Please upload a file smaller than 10MB', 'error');
      return;
    }

    try {
      setImporting(true);
      const response = await expenseAPI.import(file);
      
      const message = response.data.message || `Successfully imported ${response.data.imported || 0} expense(s)`;
      
      if (response.data.errors && response.data.errors.length > 0) {
        const errorCount = response.data.errors.length;
        const errorMessage = response.data.errors.slice(0, 3).join('\n');
        showToast(
          `${message}\n\n${errorCount} error(s) encountered:\n${errorMessage}${errorCount > 3 ? `\n... and ${errorCount - 3} more` : ''}`,
          'warning'
        );
      } else {
        showToast(message, 'success');
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh expenses list
      fetchExpenses();
    } catch (error) {
      console.error('Error importing expenses:', error);
      const errorMessage = error.response?.data?.message || 'Failed to import expenses from Excel file';
      showToast(errorMessage, 'error');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setImporting(false);
    }
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
      return Promise.resolve(); // Signal success to modal
    } catch (error) {
      console.error('Error creating recurring expense:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create recurring expense';
      showToast(errorMessage, 'error');
      return Promise.reject(error); // Signal error to modal
    }
  };

  const handleViewVendorHistory = (vendor) => {
    setHistoryModal({
      isOpen: true,
      filterType: 'vendor',
      filterValue: vendor,
    });
  };

  const handleViewCategoryHistory = (category) => {
    setHistoryModal({
      isOpen: true,
      filterType: 'category',
      filterValue: category,
    });
  };

  const handleViewDepartmentHistory = (department) => {
    setHistoryModal({
      isOpen: true,
      filterType: 'department',
      filterValue: department,
    });
  };

  const handleCloseHistoryModal = () => {
    setHistoryModal({ isOpen: false, filterType: null, filterValue: null });
  };

  // Get filtered expenses for history modal
  const getHistoryExpenses = () => {
    if (!historyModal.filterType || !historyModal.filterValue) return [];
    
    return allExpenses.filter((expense) => {
      if (historyModal.filterType === 'vendor') {
        return expense.vendor === historyModal.filterValue;
      } else if (historyModal.filterType === 'category') {
        return expense.category === historyModal.filterValue;
      } else if (historyModal.filterType === 'department') {
        return expense.department === historyModal.filterValue;
      }
      return false;
    });
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
      <div className="mb-8 lg:mb-10 xl:mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 lg:gap-6">
        <div>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2 lg:mb-3">
            Expenses
          </h1>
          <p className="text-sm lg:text-base text-gray-600 font-medium">Track and manage your business expenses efficiently</p>
        </div>
        <div className="flex items-center gap-3 lg:gap-4 flex-nowrap">
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={handleImportClick}
                disabled={importing}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-purple-700 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c0-4.418-3.582-8-8-8z"></path>
                    </svg>
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Import Excel</span>
                  </>
                )}
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
              <button
                onClick={handleCreate}
                className="btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Expense</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      {!showForm && showFilters && (
        <div className="card-gradient p-6 lg:p-8 mb-6 lg:mb-8 border border-gray-200/60" style={{ overflow: 'visible' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
            <h2 className="text-lg font-bold text-gray-800">Filter Expenses</h2>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            >
              Clear All Filters
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5 relative" style={{ overflow: 'visible' }}>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Month</label>
              <select
                value={filters.month}
                onChange={(e) => {
                  const newFilters = { ...filters, month: e.target.value };
                  setFilters(newFilters);
                  setAppliedFilters(newFilters);
                }}
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
                onChange={(e) => {
                  const newFilters = { ...filters, category: e.target.value };
                  setFilters(newFilters);
                  setAppliedFilters(newFilters);
                }}
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
                onChange={(e) => {
                  const newFilters = { ...filters, department: e.target.value };
                  setFilters(newFilters);
                  setAppliedFilters(newFilters);
                }}
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
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Status</label>
              <select
                value={filters.status}
                onChange={(e) => {
                  const newFilters = { ...filters, status: e.target.value };
                  setFilters(newFilters);
                  setAppliedFilters(newFilters);
                }}
                className="select-field w-full"
              >
                <option value="">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  const newFilters = { ...filters, startDate: e.target.value };
                  setFilters(newFilters);
                  setAppliedFilters(newFilters);
                }}
                className="select-field w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  const newFilters = { ...filters, endDate: e.target.value };
                  setFilters(newFilters);
                  setAppliedFilters(newFilters);
                }}
                className="select-field w-full"
              />
            </div>
            <div className="space-y-2 relative">
              <label className="block text-sm font-semibold text-gray-700">Vendor</label>
              <div className="relative" ref={vendorDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowVendorDropdown(!showVendorDropdown);
                    if (!showVendorDropdown) {
                      setVendorSearch('');
                    }
                  }}
                  className="select-field w-full pr-10 text-left flex items-center justify-between"
                >
                  <span className={filters.vendor ? 'text-gray-900' : 'text-gray-400'}>
                    {filters.vendor || 'Search or select vendor...'}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${showVendorDropdown ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showVendorDropdown && (
                  <div className="absolute z-[99999] w-full bottom-full mb-1 bg-white border border-gray-300 rounded-lg shadow-2xl">
                    <div className="p-2 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                      <div className="relative">
                        <svg
                          className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={vendorSearch}
                          onChange={(e) => setVendorSearch(e.target.value)}
                          placeholder="Search vendor..."
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="overflow-auto" style={{ maxHeight: '500px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const newFilters = { ...filters, vendor: '' };
                          setFilters(newFilters);
                          setAppliedFilters(newFilters);
                          setVendorSearch('');
                          setShowVendorDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          !filters.vendor 
                            ? 'bg-blue-50 text-blue-700 font-semibold' 
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        All Vendors
                      </button>
                      {filteredVendors.length > 0 ? (
                        filteredVendors.map((vendor) => (
                          <button
                            key={vendor}
                            type="button"
                            onClick={() => {
                              const newFilters = { ...filters, vendor: vendor };
                              setFilters(newFilters);
                              setAppliedFilters(newFilters);
                              setVendorSearch('');
                              setShowVendorDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              filters.vendor === vendor 
                                ? 'bg-blue-50 text-blue-700 font-semibold' 
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {vendor}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">No vendors found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by date, vendor, category, department, description, payment mode, or amount..."
                className="select-field w-full pl-10 pr-4"
              />
              <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
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
                <div className="mb-6 lg:mb-8 p-4 lg:p-6 bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 lg:gap-6">
                    <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {selectedExpenses.length} expense(s) selected
                    </span>
                    {showMarkPaidInput ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Paid Amount:</label>
                          <input
                            type="number"
                            value={bulkPaidAmount}
                            onChange={(e) => setBulkPaidAmount(e.target.value)}
                            placeholder="Enter amount"
                            step="0.01"
                            min="0"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              if (!bulkPaidAmount || parseFloat(bulkPaidAmount) < 0) {
                                showToast('Please enter a valid paid amount', 'error');
                                return;
                              }
                              
                              // Check how many expenses are already paid
                              const alreadyPaidCount = selectedExpenses.filter(id => {
                                const expense = expenses.find(exp => exp._id === id);
                                return expense && (expense.status === 'Paid' || (expense.paidAmount >= (expense.totalAmount || 0) && (expense.totalAmount || 0) > 0));
                              }).length;
                              
                              if (alreadyPaidCount > 0) {
                                const unpaidCount = selectedExpenses.length - alreadyPaidCount;
                                const message = `${alreadyPaidCount} expense(s) are already paid and will be skipped. Only ${unpaidCount} unpaid expense(s) will be updated. Continue?`;
                                // Note: For now, we'll proceed directly. If confirmation needed, add state for this.
                              }
                              
                              setMarkingPaid(true);
                              await handleBulkMarkPaid(selectedExpenses, bulkPaidAmount);
                              setShowMarkPaidInput(false);
                              setBulkPaidAmount('');
                              setMarkingPaid(false);
                            }}
                            disabled={markingPaid}
                            className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                          >
                            {markingPaid ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20c0-4.418-3.582-8-8-8z"></path>
                                </svg>
                                Marking...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Mark as Paid
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowMarkPaidInput(false);
                              setBulkPaidAmount('');
                            }}
                            disabled={markingPaid}
                            className="px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        {(() => {
                          // Check if all selected expenses are already paid
                          const allPaid = selectedExpenses.every(id => {
                            const expense = expenses.find(exp => exp._id === id);
                            return expense && (expense.status === 'Paid' || (expense.paidAmount >= (expense.totalAmount || 0) && (expense.totalAmount || 0) > 0));
                          });
                          
                          return (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowMarkPaidInput(true);
                              }}
                              disabled={allPaid}
                              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              type="button"
                              title={allPaid ? 'All selected expenses are already paid' : ''}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Mark as Paid
                            </button>
                          );
                        })()}
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
                    )}
                  </div>
                </div>
              ) : null}
              <ExpenseTable 
                expenses={expenses} 
                onEdit={handleEdit}
                onViewHistory={handleViewHistory}
                onMarkPaid={handleMarkPaidClick}
                onView={(expense) => setViewingExpense(expense)}
                onDelete={handleBulkDelete} 
                onDeleteSingle={handleDelete}
                selectedExpenses={selectedExpenses}
                onViewVendorHistory={handleViewVendorHistory}
                onViewCategoryHistory={handleViewCategoryHistory}
                onViewDepartmentHistory={handleViewDepartmentHistory}
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
        onMarkPaid={handleMarkPaid}
      />

      {/* Payment History Modal */}
      <ExpensePaymentHistoryModal
        isOpen={!!viewingPaymentHistory}
        onClose={() => setViewingPaymentHistory(null)}
        expense={viewingPaymentHistory}
      />

      {/* Expense History Modal */}
      <ExpenseHistoryModal
        isOpen={historyModal.isOpen}
        onClose={handleCloseHistoryModal}
        expenses={getHistoryExpenses()}
        filterType={historyModal.filterType}
        filterValue={historyModal.filterValue}
        allExpenses={allExpenses}
      />

      {/* Mark as Paid Modal */}
      {markPaidExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setMarkPaidExpense(null); setMarkPaidAmount(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <h2 className="text-xl font-bold text-slate-900">Mark as Paid</h2>
              <button
                type="button"
                onClick={() => { setMarkPaidExpense(null); setMarkPaidAmount(''); }}
                className="text-slate-400 hover:text-red-600 transition-colors text-3xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 bg-slate-50">
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">
                  <span className="font-semibold">Vendor:</span> {markPaidExpense.vendor || '-'}
                </p>
                <p className="text-sm text-slate-600 mb-4">
                  <span className="font-semibold">Total Amount:</span> ₹{markPaidExpense.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </p>
                {markPaidExpense.paidAmount > 0 && (
                  <p className="text-sm text-slate-600 mb-4">
                    <span className="font-semibold">Current Paid:</span> ₹{markPaidExpense.paidAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                  </p>
                )}
                <p className="text-sm text-red-600 mb-4">
                  <span className="font-semibold">Due Amount:</span> ₹{((markPaidExpense.totalAmount || 0) - (markPaidExpense.paidAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Enter Paid Amount</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={markPaidAmount}
                    onChange={(e) => setMarkPaidAmount(e.target.value)}
                    placeholder="Enter amount"
                    step="0.01"
                    min="0"
                    max={(markPaidExpense.totalAmount || 0) - (markPaidExpense.paidAmount || 0)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-40"
                    autoFocus
                  />
                  <span className="text-sm text-gray-600">
                    / ₹{((markPaidExpense.totalAmount || 0) - (markPaidExpense.paidAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-white flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setMarkPaidExpense(null); setMarkPaidAmount(''); }}
                disabled={markingPaidSingle}
                className="px-6 py-2.5 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkPaidSubmit}
                disabled={markingPaidSingle || !markPaidAmount || parseFloat(markPaidAmount) < 0}
                className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingPaidSingle ? (
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
                    Update Paid Amount
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={bulkDeleteConfirm.show}
        onClose={() => setBulkDeleteConfirm({ show: false, ids: [] })}
        onConfirm={handleBulkDeleteConfirm}
        title="Confirm Bulk Delete"
        message={`Are you sure you want to delete ${bulkDeleteConfirm.ids.length} expense entry/entries? This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />
    </div>
  );
};

export default Expenses;

