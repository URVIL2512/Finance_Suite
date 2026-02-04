import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { customerAPI, invoiceAPI } from '../services/api';
import CustomerForm from '../components/CustomerForm';
import CustomerTable from '../components/CustomerTable';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';
import { exportCustomersToExcel } from '../utils/excelExport';

const Customers = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [customerSummary, setCustomerSummary] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalDue: 0,
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const customerImportInputRef = useRef(null);
  const initialSearch =
    typeof window !== 'undefined'
      ? new URLSearchParams(location.search).get('search') || ''
      : '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  
  // Get return path and state from navigation
  const returnPath = location.state?.returnTo;
  const returnState = location.state?.returnState;

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Keep search state in sync with URL query param (?search=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search') || '';
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [location.search]);

  const updateSearchInUrl = useCallback(
    (value) => {
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
    },
    [location.pathname, location.search, navigate]
  );

  const handleSearchChange = useCallback(
    (val) => {
      setSearchQuery(val);
      updateSearchInUrl(val);
    },
    [updateSearchInUrl]
  );

  // Listen for refresh events from import (when invoices are imported, customers may be created)
  useEffect(() => {
    const handleRefreshMasters = () => {
      fetchCustomers();
    };
    const handleStorageChange = (e) => {
      // Only refresh when another tab sets refreshMasters; ignore other storage keys
      if (e.key === 'refreshMasters') {
        fetchCustomers();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('refreshMasters', handleRefreshMasters);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('refreshMasters', handleRefreshMasters);
    };
  }, []);

  // Auto-open form if redirected from invoice page
  useEffect(() => {
    if (returnPath) {
      setShowForm(true);
      setEditingCustomer(null);
    }
  }, [returnPath]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAll();
      setCustomers(response.data || []);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Client-side filter: no refetch on search
  const filteredCustomers = filterBySearchQuery(
    customers,
    searchQuery,
    moduleSearchConfig.customers
  );

  const handleCreateCustomer = () => {
    setEditingCustomer(null);
    setShowForm(true);
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleViewCustomer = async (customer) => {
    setViewingCustomer(customer);
    
    // Fetch customer invoices for summary
    try {
      const response = await invoiceAPI.getAll();
      const allInvoices = response.data || [];
      const customerInvoicesList = allInvoices.filter(inv => 
        inv.clientDetails?.name === customer.displayName || 
        inv.clientDetails?.name === customer.clientName ||
        inv.clientEmail === customer.email
      );
      
      setCustomerInvoices(customerInvoicesList);
      
      // Calculate summary
      const summary = customerInvoicesList.reduce((acc, inv) => {
        acc.totalInvoices += 1;
        acc.totalAmount += parseFloat(inv.amountDetails?.invoiceTotal || inv.grandTotal || 0);
        acc.totalPaid += parseFloat(inv.paidAmount || inv.receivedAmount || 0);
        acc.totalDue += parseFloat(inv.amountDetails?.receivableAmount || inv.grandTotal || 0) - parseFloat(inv.paidAmount || inv.receivedAmount || 0);
        return acc;
      }, { totalInvoices: 0, totalAmount: 0, totalPaid: 0, totalDue: 0 });
      
      setCustomerSummary(summary);
    } catch (error) {
      console.error('Error fetching customer invoices:', error);
      setCustomerInvoices([]);
      setCustomerSummary({ totalInvoices: 0, totalAmount: 0, totalPaid: 0, totalDue: 0 });
    }
  };

  const handleDeleteCustomer = async (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      await customerAPI.delete(deleteConfirm.id);
      fetchCustomers();
      showToast('Customer deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
    } catch (error) {
      console.error('Error deleting customer:', error);
      showToast('Failed to delete customer', 'error');
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const handleCustomerFormSubmit = async (data) => {
    try {
      let newCustomer;
      if (editingCustomer) {
        const response = await customerAPI.update(editingCustomer._id, data);
        newCustomer = response.data;
        showToast('Customer updated successfully!', 'success');
        
        // Update the viewing customer if it's the same customer being edited
        if (viewingCustomer && viewingCustomer._id === editingCustomer._id) {
          setViewingCustomer(newCustomer);
        }
      } else {
        const response = await customerAPI.create(data);
        newCustomer = response.data;
        showToast('Customer created successfully!', 'success');
      }
      
      // If redirected from invoice page, navigate back
      if (returnPath && (returnPath === '/invoices' || returnPath === '/sales')) {
        await fetchCustomers();
        // Navigate back to invoice page with state
        try {
          navigate(returnPath, { 
            state: returnState || { showInvoiceForm: true },
            replace: false
          });
        } catch (error) {
          console.error('Navigation error after save:', error);
          // Fallback: close form and navigate to invoices page
          setShowForm(false);
          setEditingCustomer(null);
          navigate('/invoices');
        }
      } else {
        setShowForm(false);
        setEditingCustomer(null);
        await fetchCustomers();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      
      // Extract detailed error message
      let errorMessage = 'Failed to save customer';
      
      if (error.response) {
        // Server responded with error
        errorMessage = error.response.data?.message || error.response.statusText || errorMessage;
        
        // Add field-specific error if available
        if (error.response.data?.field) {
          errorMessage = `${errorMessage} (Field: ${error.response.data.field})`;
        }
      } else if (error.request) {
        // Request was made but no response received
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = 'Cannot connect to server. Please ensure the backend server is running on port 5000.';
        } else {
          errorMessage = 'No response from server. Please check your connection.';
        }
      } else {
        // Error in request setup
        errorMessage = error.message || errorMessage;
      }
      
      showToast(errorMessage, 'error');
    }
  };

  const handleExportCustomers = async () => {
    try {
      setExporting(true);
      console.log('📊 Starting customer export...');
      console.log('Current search query:', searchQuery);
      console.log('Filtered customers count:', filteredCustomers.length);
      
      // Get current search and filter parameters
      const params = {};
      if (searchQuery && searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      
      console.log('Export parameters:', params);
      
      const response = await customerAPI.export(params);
      console.log('Export response:', response.data);
      
      if (response.data && response.data.success) {
        const { data: exportData, filename, count } = response.data;
        
        console.log(`📊 Exporting ${count} customers to Excel`);
        console.log('Export data sample:', exportData.slice(0, 2)); // Log first 2 records
        
        // Export to Excel using the utility
        exportCustomersToExcel(exportData, filename.replace('.xlsx', ''));
        
        showToast(`Successfully exported ${count} customers to Excel!`, 'success');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error exporting customers:', error);
      
      let errorMessage = 'Failed to export customers';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleCustomerImportClick = () => {
    if (importing) return;
    customerImportInputRef.current?.click?.();
  };



  const handleCustomerImportFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file
    e.target.value = '';
    if (!file) return;

    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValidFile = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidFile) {
      showToast('Invalid file type. Please upload an Excel file (.xlsx or .xls)', 'error');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showToast('File size exceeds 10MB limit. Please upload a smaller file.', 'error');
      return;
    }

    try {
      setImporting(true);
      console.log('📥 Starting customer import...', { fileName: file.name, fileSize: file.size });
      
      const response = await customerAPI.import(file);
      const imported = response?.data?.imported ?? 0;
      const updated = response?.data?.updated ?? 0;
      const skipped = response?.data?.skipped ?? 0;
      const errors = response?.data?.errors || [];

      // Build success message
      let message = response?.data?.message || `Imported ${imported} customer(s).`;
      if (updated > 0) {
        message += ` Updated ${updated} existing customer(s).`;
      }
      if (skipped > 0) {
        message += ` Skipped ${skipped} duplicate(s).`;
      }

      // Show errors if any (limit to first 5 for toast)
      if (errors.length > 0) {
        const errorPreview = errors.slice(0, 5).join('; ');
        const moreErrors = errors.length > 5 ? ` and ${errors.length - 5} more error(s)` : '';
        console.warn('⚠️ Import completed with errors:', errors);
        showToast(`${message} Errors: ${errorPreview}${moreErrors}. Check console for details.`, 'warning');
      } else {
        showToast(message, 'success');
      }

      // Refresh customer list
      await fetchCustomers();

    } catch (error) {
      console.error('❌ Error importing customers:', error);
      console.error('Error details:', error.response?.data);
      
      // Provide detailed error messages
      let errorMessage = 'Failed to import customers from Excel';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorList = error.response.data.errors.slice(0, 10).join('; ');
        errorMessage = `Import failed: ${errorList}${error.response.data.errors.length > 10 ? ' (and more...)' : ''}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="page-header">Customer Management</h1>
          <p className="page-subtitle">Create and manage your customers</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search customers..."
          />
          {/* Import Excel Button */}
          <input
            ref={customerImportInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleCustomerImportFileChange}
          />
          <button
            onClick={handleCustomerImportClick}
            disabled={importing}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              importing ? 'opacity-60 cursor-not-allowed bg-purple-300 text-purple-700' : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
            title="Import customers from Excel (.xlsx/.xls)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span>{importing ? 'Importing...' : 'Import Excel'}</span>
          </button>
          {/* Export Excel Button */}
          <button
            onClick={handleExportCustomers}
            disabled={exporting || filteredCustomers.length === 0}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              exporting || filteredCustomers.length === 0 ? 'opacity-60 cursor-not-allowed bg-green-300 text-green-700' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            title="Export customers to Excel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-4-4m4 4l4-4M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m0 3L9 8" />
            </svg>
            <span>{exporting ? 'Exporting...' : 'Download as Excel'}</span>
          </button>
          <button
            onClick={handleCreateCustomer}
            className="btn-primary flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onSubmit={handleCustomerFormSubmit}
          onCancel={() => {
            // If redirected from invoice page, navigate back
            if (returnPath && (returnPath === '/invoices' || returnPath === '/sales')) {
              console.log('🔄 Canceling customer form - navigating back to:', returnPath);
              console.log('Return state:', returnState);
              
              // Close the form first
              setShowForm(false);
              setEditingCustomer(null);
              
              // Then navigate back with state
              try {
                navigate(returnPath, { 
                  state: returnState || { showInvoiceForm: true },
                  replace: false
                });
              } catch (error) {
                console.error('Navigation error:', error);
                // Fallback: navigate without state
                navigate(returnPath);
              }
            } else {
              setShowForm(false);
              setEditingCustomer(null);
            }
          }}
        />
      )}

      {!showForm && (
        <>
          {/* Customer Detail View Modal - Matching Invoice UI */}
          {viewingCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingCustomer(null)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header - Blue Gradient */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{viewingCustomer.displayName || viewingCustomer.clientName || 'Customer'}</h2>
                        <p className="text-sm text-white/90 mt-0.5">
                          {viewingCustomer.createdAt ? format(new Date(viewingCustomer.createdAt), 'dd MMM yyyy') : viewingCustomer.companyName || 'Customer Details'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingCustomer(null)}
                      className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center transition-colors"
                      title="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-white">
                  {/* Quick Info Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Currency</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {viewingCustomer.currency || 'INR'}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Country</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {viewingCustomer.country || viewingCustomer.billingAddress?.country || '-'}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">State</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {viewingCustomer.state || viewingCustomer.billingAddress?.state || '-'}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment Terms</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {viewingCustomer.paymentTerms || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    {/* Client Info - Left Column */}
                    <div className="lg:col-span-1 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <h3 className="text-sm font-bold text-slate-900">Client</h3>
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-0.5">Name</div>
                          <div className="text-sm font-semibold text-slate-900">{viewingCustomer.displayName || viewingCustomer.clientName || '-'}</div>
                        </div>
                        {viewingCustomer.companyName && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Company</div>
                            <div className="text-xs text-slate-700">{viewingCustomer.companyName}</div>
                          </div>
                        )}
                        {viewingCustomer.email && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Email</div>
                            <div className="text-xs text-slate-700">{viewingCustomer.email}</div>
                          </div>
                        )}
                        {viewingCustomer.mobile && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Mobile</div>
                            <div className="text-xs text-slate-700">
                              {typeof viewingCustomer.mobile === 'object' && viewingCustomer.mobile?.number
                                ? `${viewingCustomer.mobile.countryCode || ''} ${viewingCustomer.mobile.number}`.trim()
                                : (typeof viewingCustomer.mobile === 'string' ? viewingCustomer.mobile : '-')}
                            </div>
                          </div>
                        )}
                        {(viewingCustomer.state || viewingCustomer.country || viewingCustomer.billingAddress?.state || viewingCustomer.billingAddress?.country) && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Location</div>
                            <div className="text-xs text-slate-700">
                              {[viewingCustomer.state || viewingCustomer.billingAddress?.state, viewingCustomer.country || viewingCustomer.billingAddress?.country].filter(Boolean).join(', ') || '-'}
                            </div>
                          </div>
                        )}
                        {viewingCustomer.gstin && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">GSTIN</div>
                            <div className="text-xs text-slate-700">{viewingCustomer.gstin}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Summary - Right Column */}
                    <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-sm font-bold text-slate-900">Financial Summary</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Total Invoices</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {customerSummary.totalInvoices}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Total Amount</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {viewingCustomer.currency || 'INR'} {customerSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Total Paid</div>
                          <div className="text-sm font-semibold text-emerald-600">
                            {viewingCustomer.currency || 'INR'} {customerSummary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Total Due</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {viewingCustomer.currency || 'INR'} {customerSummary.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-1">Opening Balance</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {viewingCustomer.currency || 'INR'} {parseFloat(viewingCustomer.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tax Information Section */}
                  {(viewingCustomer.pan || viewingCustomer.gstin || viewingCustomer.hsnOrSac || viewingCustomer.gstPercentage !== undefined || viewingCustomer.tdsPercentage !== undefined) && (
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-sm font-bold text-slate-900">Tax Information</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {viewingCustomer.pan && (
                          <div>
                            <div className="font-semibold text-slate-500 mb-0.5">PAN</div>
                            <div className="text-slate-700">{viewingCustomer.pan}</div>
                          </div>
                        )}
                        {viewingCustomer.gstin && (
                          <div>
                            <div className="font-semibold text-slate-500 mb-0.5">GSTIN</div>
                            <div className="text-slate-700">{viewingCustomer.gstin}</div>
                          </div>
                        )}
                        {viewingCustomer.hsnOrSac && (
                          <div>
                            <div className="font-semibold text-slate-500 mb-0.5">HSN/SAC</div>
                            <div className="text-slate-700">{viewingCustomer.hsnOrSac}</div>
                          </div>
                        )}
                        {(viewingCustomer.gstPercentage !== undefined && viewingCustomer.gstPercentage !== null) && (
                          <div>
                            <div className="font-semibold text-slate-500 mb-0.5">GST %</div>
                            <div className="text-slate-700">{viewingCustomer.gstPercentage}%</div>
                          </div>
                        )}
                        {(viewingCustomer.tdsPercentage !== undefined && viewingCustomer.tdsPercentage !== null) && (
                          <div>
                            <div className="font-semibold text-slate-500 mb-0.5">TDS %</div>
                            <div className="text-slate-700">{viewingCustomer.tdsPercentage}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Billing Address Section */}
                  {viewingCustomer.billingAddress && (
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <h3 className="text-sm font-bold text-slate-900">Billing Address</h3>
                      </div>
                      {typeof viewingCustomer.billingAddress === 'object' ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          {viewingCustomer.billingAddress.street1 && (
                            <div className="md:col-span-2">
                              <div className="font-semibold text-slate-500 mb-0.5">Street 1</div>
                              <div className="text-slate-700">{viewingCustomer.billingAddress.street1}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.street2 && (
                            <div className="md:col-span-2">
                              <div className="font-semibold text-slate-500 mb-0.5">Street 2</div>
                              <div className="text-slate-700">{viewingCustomer.billingAddress.street2}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.city && (
                            <div>
                              <div className="font-semibold text-slate-500 mb-0.5">City</div>
                              <div className="text-slate-700">{viewingCustomer.billingAddress.city}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.state && (
                            <div>
                              <div className="font-semibold text-slate-500 mb-0.5">State</div>
                              <div className="text-slate-700">{viewingCustomer.billingAddress.state}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.pinCode && (
                            <div>
                              <div className="font-semibold text-slate-500 mb-0.5">Pin Code</div>
                              <div className="text-slate-700">{viewingCustomer.billingAddress.pinCode}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.phone?.number && (
                            <div>
                              <div className="font-semibold text-slate-500 mb-0.5">Phone</div>
                              <div className="text-slate-700">
                                {`${viewingCustomer.billingAddress.phone.countryCode || ''} ${viewingCustomer.billingAddress.phone.number}`}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-700">{viewingCustomer.billingAddress}</p>
                      )}
                    </div>
                  )}

                  {/* Recent Invoices Section */}
                  {customerInvoices.length > 0 && (
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-sm font-bold text-slate-900">Recent Invoices ({customerInvoices.length})</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Invoice #</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerInvoices.slice(0, 5).map((invoice) => (
                              <tr key={invoice._id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 text-xs text-slate-900">{invoice.invoiceNumber || '-'}</td>
                                <td className="px-3 py-2 text-xs text-slate-600">
                                  {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'dd MMM yyyy') : '-'}
                                </td>
                                <td className="px-3 py-2 text-xs text-right text-slate-600">
                                  {invoice.currency || 'INR'} {(invoice.amountDetails?.invoiceTotal || invoice.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-xs text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                    invoice.status === 'Paid'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : invoice.status === 'Partial'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {invoice.status || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
                    <button
                      onClick={() => setViewingCustomer(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
              <p className="mt-4 text-slate-600 font-medium">Loading customers...</p>
            </div>
          ) : (
            <CustomerTable
              customers={filteredCustomers}
              onEdit={handleEditCustomer}
              onDelete={handleDeleteCustomer}
              onView={handleViewCustomer}
            />
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
      />
    </div>
  );
};

export default Customers;
