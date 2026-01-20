import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { invoiceAPI, customerAPI, recurringInvoiceAPI } from '../services/api';
import InvoiceForm from '../components/InvoiceForm';
import InvoiceTable from '../components/InvoiceTable';
import InvoiceViewEdit from '../components/InvoiceViewEdit';
import CustomerForm from '../components/CustomerForm';
import CustomerTable from '../components/CustomerTable';
import RecurringInvoiceModal from '../components/RecurringInvoiceModal';
import PaymentModal from '../components/PaymentModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import MobileSelect from '../components/MobileSelect';

const Sales = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const [activeMainTab, setActiveMainTab] = useState('invoices'); // 'invoices', 'items'
  const [activeSubTab, setActiveSubTab] = useState('invoices'); // 'invoices' or 'customers' (for invoices tab)
  const [invoices, setInvoices] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]); // Store all invoices for dropdown
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [redirectFromInvoice, setRedirectFromInvoice] = useState(false);
  const [pendingCustomerSelect, setPendingCustomerSelect] = useState(null);
  const [deleteCustomerConfirm, setDeleteCustomerConfirm] = useState({ show: false, id: null });
  const [deleteInvoiceConfirm, setDeleteInvoiceConfirm] = useState({ show: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    year: '',
    status: '',
    clientName: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);

  // Ensure invoice form is shown when returning from customer form
  useEffect(() => {
    // If we're on invoices tab and redirectFromInvoice was true but customer form is closed
    // This is a safety net to ensure form appears even if cancel handler didn't work perfectly
    if (activeSubTab === 'invoices' && redirectFromInvoice && !showCustomerForm && !showForm) {
      console.log('🔄 Restoring invoice form after customer form cancel (safety net)');
      setShowForm(true);
      setEditingInvoice(null);
      setRedirectFromInvoice(false);
    }
  }, [activeSubTab, redirectFromInvoice, showCustomerForm, showForm]);

  // Check if returning from items/customers page and should show invoice form
  useEffect(() => {
    const returnState = location.state?.showInvoiceForm;
    
    if (returnState) {
      console.log('🔄 Detected return from items/customers - restoring invoice form');
      console.log('Location state:', location.state);
      
      // Set all states immediately - React batches these updates
      setActiveMainTab('invoices');
      setActiveSubTab('invoices');
      setShowForm(true);
      setShowCustomerForm(false);
      setRedirectFromInvoice(false);
      setEditingInvoice(null);
      
      // Clear the state after a delay to prevent re-triggering on refresh
      const clearTimer = setTimeout(() => {
        try {
          window.history.replaceState({}, document.title);
        } catch (error) {
          console.error('Error clearing history state:', error);
        }
      }, 1000);
      
      // Cleanup timer on unmount
      return () => clearTimeout(clearTimer);
    }
  }, [location.state]);

  // Fetch all invoices (without filters) for client dropdown when tab changes
  useEffect(() => {
    if (activeMainTab === 'invoices' && activeSubTab === 'invoices') {
      fetchAllInvoicesForDropdown();
    }
  }, [activeMainTab, activeSubTab]);

  useEffect(() => {
    if (activeMainTab === 'invoices' && activeSubTab === 'invoices') {
      fetchInvoices();
      // Always fetch customers when on invoices tab to keep dropdown updated
      fetchCustomers();
    } else if (activeMainTab === 'invoices' && activeSubTab === 'customers') {
      // Fetch customers when switching to customers tab
      fetchCustomers();
    }
  }, [filters, activeMainTab, activeSubTab]);

  // Ensure customers are loaded when customers tab is first accessed
  useEffect(() => {
    if (activeMainTab === 'invoices' && activeSubTab === 'customers' && !loadingCustomers && !showCustomerForm) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, activeMainTab]);

  // Ensure customers are loaded when invoice form is shown
  useEffect(() => {
    if (showForm && activeMainTab === 'invoices' && activeSubTab === 'invoices') {
      fetchCustomers();
    }
  }, [showForm, activeMainTab, activeSubTab]);

  const fetchAllInvoicesForDropdown = async () => {
    try {
      // Fetch all invoices without filters to populate client dropdown
      const response = await invoiceAPI.getAll({});
      setAllInvoices(response.data);
    } catch (error) {
      console.error('Error fetching all invoices for dropdown:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.year && filters.year !== '') params.year = parseInt(filters.year);
      if (filters.status) params.status = filters.status;

      const response = await invoiceAPI.getAll(params);
      let filteredInvoices = response.data;
      
      // Client-side filtering by client name
      if (filters.clientName && filters.clientName !== '') {
        filteredInvoices = filteredInvoices.filter(
          (invoice) => invoice.clientDetails?.name === filters.clientName
        );
      }
      
      setInvoices(filteredInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      // Only show loading if not already in a form (to avoid UI flicker)
      if (!showForm && !showCustomerForm && activeSubTab === 'customers') {
        setLoadingCustomers(true);
      }
      const response = await customerAPI.getAll();
      setCustomers(response.data || []);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
      alert('Failed to load customers. Please check your connection and try again.');
      return [];
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleCreate = () => {
    setEditingInvoice(null);
    setShowForm(true);
  };


  const handleCreateCustomer = () => {
    setEditingCustomer(null);
    setShowCustomerForm(true);
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleViewCustomer = (customer) => {
    setViewingCustomer(customer);
  };

  const handleDeleteCustomer = (id) => {
    setDeleteCustomerConfirm({ show: true, id });
  };

  const handleDeleteCustomerConfirm = async () => {
    if (!deleteCustomerConfirm.id) return;
    
    try {
      setDeleting(true);
      await customerAPI.delete(deleteCustomerConfirm.id);
      showToast('Customer deleted successfully!', 'success');
      setDeleteCustomerConfirm({ show: false, id: null });
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      showToast('Failed to delete customer', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCustomerFormSubmit = async (data) => {
    try {
      let newCustomer;
      if (editingCustomer) {
        const response = await customerAPI.update(editingCustomer._id, data);
        newCustomer = response.data;
        alert('Customer updated successfully!');
      } else {
        const response = await customerAPI.create(data);
        newCustomer = response.data;
        alert('Customer created successfully!');
        
        // If redirected from invoice form, go back to invoices tab and auto-select customer
        if (redirectFromInvoice) {
          setActiveSubTab('invoices');
          setShowCustomerForm(false);
          setEditingCustomer(null);
          setRedirectFromInvoice(false);
          await fetchCustomers();
          
          // Auto-select the newly created customer in invoice form
          if (newCustomer && showForm) {
            setPendingCustomerSelect(newCustomer._id);
          }
          return;
        }
      }
      // Close form and reset state
      setShowCustomerForm(false);
      setEditingCustomer(null);
      await fetchCustomers();
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
      
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setDeleteInvoiceConfirm({ show: true, id });
  };

  const handleDeleteInvoiceConfirm = async () => {
    if (!deleteInvoiceConfirm.id) return;
    
    try {
      setDeleting(true);
      await invoiceAPI.delete(deleteInvoiceConfirm.id);
      showToast('Invoice deleted successfully!', 'success');
      setDeleteInvoiceConfirm({ show: false, id: null });
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showToast('Failed to delete invoice', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRecordPayment = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setShowPaymentModal(true);
  };

  const handlePaymentRecorded = () => {
    fetchInvoices();
    setShowPaymentModal(false);
    setSelectedInvoiceForPayment(null);
  };

  const handleViewInvoice = async (invoice) => {
    console.log('👁️ View invoice clicked:', invoice);
    if (invoice && invoice._id) {
      try {
        // Fetch fresh invoice data to ensure we have the latest
        const response = await invoiceAPI.getById(invoice._id);
        if (response.data) {
          console.log('Setting viewing invoice:', response.data.invoiceNumber);
          setViewingInvoice(response.data);
        } else {
          setViewingInvoice(invoice);
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setViewingInvoice(invoice); // Fallback to provided invoice
      }
    } else {
      console.error('❌ Invoice is null, undefined, or missing _id:', invoice);
      alert('Error: Cannot view invoice details. Invoice data is invalid.');
    }
  };

  const handleInvoiceUpdate = (updatedInvoice) => {
    // Update the invoice in the list
    setInvoices(prevInvoices => 
      prevInvoices.map(inv => inv._id === updatedInvoice._id ? updatedInvoice : inv)
    );
    setViewingInvoice(updatedInvoice);
    // Refresh the list to ensure consistency
    fetchInvoices();
  };

  const handleClearFilters = () => {
    setFilters({
      year: '',
      status: '',
      clientName: '',
    });
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingInvoice) {
        const response = await invoiceAPI.update(editingInvoice._id, data);
        const invoiceData = response.data;
        
        // Show instant success message
        const emailToShow = invoiceData.clientEmail || data.clientEmail || 'client';
        alert(`Invoice updated successfully! Email is being sent to ${emailToShow}.`);
      } else {
        // Validate email is present for new invoices
        if (!data.clientEmail || data.clientEmail.trim() === '') {
          alert('Error: Client email is required to send the invoice');
          return;
        }
        
        // Validate base amount is present
        if (!data.baseAmount || parseFloat(data.baseAmount) <= 0) {
          alert('Error: Base amount is required and must be greater than 0');
          return;
        }
        
        const response = await invoiceAPI.create(data);
        const invoiceData = response.data;
        
        // Show instant success message
        alert(`Invoice created successfully! Email is being sent to ${invoiceData.clientEmail || data.clientEmail}.`);
      }
      setShowForm(false);
      setEditingInvoice(null);
      fetchInvoices();
    } catch (error) {
      console.error('Error saving invoice:', error);
      console.error('Error response:', error.response?.data);
      let errorMessage = 'Failed to save invoice';
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend server is running on port 5000.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleRecurringInvoiceSubmit = async (data) => {
    try {
      const response = await recurringInvoiceAPI.create(data);
      alert(`Recurring invoice created successfully for ${data.invoiceIds.length} invoice(s)!`);
      setSelectedInvoices([]);
      setShowRecurringModal(false);
      fetchInvoices(); // Refresh invoices list
    } catch (error) {
      console.error('Error creating recurring invoice:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create recurring invoice';
      alert(`Error: ${errorMessage}`);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-header">
            Sales Management
          </h1>
          <p className="page-subtitle">Manage invoices, recurring invoices, and items</p>
        </div>
        {activeMainTab === 'invoices' && activeSubTab === 'invoices' && (
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center space-x-2"
          >
            <span>+</span>
            <span>Create Invoice</span>
          </button>
        )}
        {activeMainTab === 'invoices' && activeSubTab === 'customers' && (
          <button
            onClick={handleCreateCustomer}
            className="btn-primary flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Customer</span>
          </button>
        )}
      </div>

      {/* Main Tabs - Dropdown */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <MobileSelect
            value={activeMainTab}
            onChange={(e) => {
              const newTab = e.target.value;
              setActiveMainTab(newTab);
              if (newTab === 'invoices') {
                setActiveSubTab('invoices');
              }
              // Reset form states when switching tabs
              if (newTab !== 'invoices') {
                setShowForm(false);
                setEditingInvoice(null);
              }
            }}
            className="bg-white border-2 border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-finance-blue focus:outline-none focus:border-finance-blue focus:ring-2 focus:ring-finance-blue/20 transition-colors cursor-pointer w-44"
          >
            <option value="items">Items</option>
            <option value="invoices">Invoices</option>
          </MobileSelect>
        </div>
      </div>

      {/* Invoices Tab Content */}
      {activeMainTab === 'invoices' && (
        <>
          {/* Sub-tabs for Invoices */}
          <div className="mb-6 border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveSubTab('invoices')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeSubTab === 'invoices'
                    ? 'border-finance-blue text-finance-blue'
                    : 'border-transparent text-slate-500 hover:text-finance-navy hover:border-slate-300'
                }`}
              >
                Invoices
              </button>
              <button
                onClick={() => setActiveSubTab('customers')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeSubTab === 'customers'
                    ? 'border-finance-blue text-finance-blue'
                    : 'border-transparent text-slate-500 hover:text-finance-navy hover:border-slate-300'
                }`}
              >
                Customers
              </button>
            </nav>
          </div>

          {activeSubTab === 'invoices' && (
            <>
              {/* Filter Toggle Button */}
              {!showForm && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span>Filters</span>
                  </button>
                </div>
              )}
              {/* Filters */}
              {!showForm && showFilters && (
                <div className="card-gradient p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
                    <button
                      onClick={handleClearFilters}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Year</label>
                      <MobileSelect
                        value={filters.year}
                        onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                        className="select-field"
                      >
                        <option value="">All Years</option>
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </MobileSelect>
                    </div>
                    <div>
                      <label className="form-label">Status</label>
                      <MobileSelect
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="select-field"
                      >
                        <option value="">All Status</option>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Partial">Partial</option>
                      </MobileSelect>
                    </div>
                    <div>
                      <label className="form-label">Client Name</label>
                      <MobileSelect
                        value={filters.clientName}
                        onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
                        className="select-field"
                      >
                        <option value="">All Clients</option>
                        {Array.from(
                          new Set(
                            allInvoices
                              .map((invoice) => invoice.clientDetails?.name)
                              .filter((name) => name && name.trim() !== '')
                          )
                        )
                          .sort()
                          .map((clientName) => (
                            <option key={clientName} value={clientName}>
                              {clientName}
                            </option>
                          ))}
                      </MobileSelect>
                    </div>
                  </div>
                </div>
              )}

              {showForm && activeSubTab === 'invoices' && (
                <InvoiceForm
                  key={editingInvoice?._id || 'new-invoice'}
                  invoice={editingInvoice}
                  customers={customers}
                  onSubmit={handleFormSubmit}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingInvoice(null);
                    setRedirectFromInvoice(false);
                  }}
                  onCustomerAdded={fetchCustomers}
                  onRedirectToCustomer={() => {
                    // Set redirect flag first, then navigate
                    setRedirectFromInvoice(true);
                    // Keep showForm true so invoice form stays in background
                    // This ensures we can return to it
                    setActiveSubTab('customers');
                    setShowCustomerForm(true);
                    setEditingCustomer(null);
                  }}
                  pendingCustomerSelect={pendingCustomerSelect}
                  onCustomerSelected={() => setPendingCustomerSelect(null)}
                />
              )}

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
                  <p className="mt-4 text-slate-600 font-medium">Loading invoices...</p>
                </div>
              ) : (
                <>
                  {selectedInvoices.length > 0 && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">
                        {selectedInvoices.length} invoice(s) selected
                      </span>
                      <button
                        onClick={() => setShowRecurringModal(true)}
                        className="px-4 py-2 bg-finance-blue text-white rounded-md hover:bg-finance-blueLight transition-colors text-sm font-medium"
                      >
                        Set as Recurring
                      </button>
                    </div>
                  )}
                  <InvoiceTable 
                    invoices={invoices} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete}
                    onView={handleViewInvoice}
                    onRecordPayment={handleRecordPayment}
                    selectedInvoices={selectedInvoices}
                    onSelectInvoice={(invoiceId, isSelected) => {
                      if (isSelected) {
                        setSelectedInvoices([...selectedInvoices, invoiceId]);
                      } else {
                        setSelectedInvoices(selectedInvoices.filter(id => id !== invoiceId));
                      }
                    }}
                    onSelectAll={(invoiceIds) => {
                      setSelectedInvoices(invoiceIds);
                    }}
                  />
                </>
              )}

              {/* Invoice View/Edit Modal */}
              {viewingInvoice && (
                <InvoiceViewEdit
                  invoice={viewingInvoice}
                  customers={customers}
                  onClose={() => setViewingInvoice(null)}
                  onUpdate={handleInvoiceUpdate}
                />
              )}

              {/* Old Invoice Detail View Modal - REMOVED - Using InvoiceViewEdit component instead */}
              {false && viewingInvoice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingInvoice(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex-shrink-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h2 className="text-xl font-bold">Invoice #{viewingInvoice.invoiceNumber}</h2>
                            <p className="text-sm text-white/90 mt-0.5">
                              {viewingInvoice.invoiceDate ? format(new Date(viewingInvoice.invoiceDate), 'dd MMM yyyy') : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setViewingInvoice(null)}
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
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</div>
                          <div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                              viewingInvoice.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : viewingInvoice.status === 'Partial'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {viewingInvoice.status || 'Pending'}
                            </span>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Due Date</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {viewingInvoice.dueDate ? format(new Date(viewingInvoice.dueDate), 'dd MMM yyyy') : '-'}
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Currency</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'}
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Exchange Rate</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {viewingInvoice.currencyDetails?.exchangeRate || viewingInvoice.exchangeRate || '1'}
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
                              <div className="text-sm font-semibold text-slate-900">{viewingInvoice.clientDetails?.name || '-'}</div>
                            </div>
                            {viewingInvoice.clientEmail && (
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-0.5">Email</div>
                                <div className="text-xs text-slate-700">{viewingInvoice.clientEmail}</div>
                              </div>
                            )}
                            {viewingInvoice.clientMobile && (
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-0.5">Mobile</div>
                                <div className="text-xs text-slate-700">{viewingInvoice.clientMobile}</div>
                              </div>
                            )}
                            {(viewingInvoice.clientDetails?.state || viewingInvoice.clientDetails?.country) && (
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-0.5">Location</div>
                                <div className="text-xs text-slate-700">
                                  {[viewingInvoice.clientDetails?.state, viewingInvoice.clientDetails?.country].filter(Boolean).join(', ') || '-'}
                                </div>
                              </div>
                            )}
                            {viewingInvoice.clientDetails?.gstin && (
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-0.5">GSTIN</div>
                                <div className="text-xs text-slate-700">{viewingInvoice.clientDetails.gstin}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Amount Summary - Right Column */}
                        <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-sm font-bold text-slate-900">Amount Summary</h3>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-1">Base Amount</div>
                              <div className="text-sm font-semibold text-slate-900">
                                {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(viewingInvoice.amountDetails?.baseAmount || viewingInvoice.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-1">GST ({viewingInvoice.gstPercentage || 0}%)</div>
                              <div className="text-sm font-semibold text-slate-900">
                                {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {((viewingInvoice.cgst || 0) + (viewingInvoice.sgst || 0) + (viewingInvoice.igst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            {(viewingInvoice.tdsAmount || 0) > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-1">TDS ({viewingInvoice.tdsPercentage || 0}%)</div>
                                <div className="text-sm font-semibold text-orange-600">
                                  {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(viewingInvoice.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            )}
                            {(viewingInvoice.tcsAmount || 0) > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-1">TCS ({viewingInvoice.tcsPercentage || 0}%)</div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(viewingInvoice.tcsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            )}
                            {(viewingInvoice.remittanceCharges || 0) > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-slate-500 mb-1">Remittance</div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(viewingInvoice.remittanceCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            )}
                            <div className="col-span-2 md:col-span-3 pt-2 mt-2 border-t border-slate-200">
                              <div className="flex justify-between items-center">
                                <div className="text-sm font-bold text-slate-700">Grand Total</div>
                                <div className="text-lg font-bold text-blue-600">
                                  {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(viewingInvoice.amountDetails?.invoiceTotal || viewingInvoice.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-1">Receivable</div>
                              <div className="text-sm font-semibold text-slate-900">
                                {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(viewingInvoice.amountDetails?.receivableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-1">Amount Received</div>
                              <div className="text-sm font-semibold text-emerald-600">
                                {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(viewingInvoice.receivedAmount || viewingInvoice.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-1">Balance Due</div>
                              <div className="text-sm font-semibold text-red-600">
                                {viewingInvoice.currencyDetails?.invoiceCurrency || viewingInvoice.currency || 'INR'} {(() => {
                                  const receivable = viewingInvoice.amountDetails?.receivableAmount || 0;
                                  const received = viewingInvoice.receivedAmount || viewingInvoice.paidAmount || 0;
                                  const balanceDue = Math.max(0, receivable - received);
                                  return balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Items Section */}
                      {viewingInvoice.items && viewingInvoice.items.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <h3 className="text-sm font-bold text-slate-900">Items ({viewingInvoice.items.length})</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">HSN/SAC</th>
                                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Qty</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Rate</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {viewingInvoice.items.map((item, index) => (
                                  <tr key={index} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 text-xs text-slate-900">{item.description || '-'}</td>
                                    <td className="px-3 py-2 text-xs text-center text-slate-600">{item.hsnSac || '-'}</td>
                                    <td className="px-3 py-2 text-xs text-center text-slate-600">{item.quantity || 0}</td>
                                    <td className="px-3 py-2 text-xs text-right text-slate-600">{(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-3 py-2 text-xs text-right font-semibold text-slate-900">{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Additional Details - Compact */}
                      {(viewingInvoice.serviceDetails || viewingInvoice.notes || viewingInvoice.lutArn) && (
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-sm font-bold text-slate-900">Additional Details</h3>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            {viewingInvoice.serviceDetails?.description && (
                              <div>
                                <div className="font-semibold text-slate-500 mb-0.5">Service</div>
                                <div className="text-slate-700">{viewingInvoice.serviceDetails.description || viewingInvoice.serviceDetails?.serviceType || '-'}</div>
                              </div>
                            )}
                            {viewingInvoice.serviceDetails?.engagementType && (
                              <div>
                                <div className="font-semibold text-slate-500 mb-0.5">Engagement</div>
                                <div className="text-slate-700">{viewingInvoice.serviceDetails.engagementType}</div>
                              </div>
                            )}
                            {viewingInvoice.serviceDetails?.period && (
                              <div>
                                <div className="font-semibold text-slate-500 mb-0.5">Period</div>
                                <div className="text-slate-700">
                                  {[viewingInvoice.serviceDetails.period.month, viewingInvoice.serviceDetails.period.year].filter(Boolean).join(' ') || '-'}
                                </div>
                              </div>
                            )}
                            {viewingInvoice.lutArn && (
                              <div>
                                <div className="font-semibold text-slate-500 mb-0.5">LUT/ARN</div>
                                <div className="text-slate-700">{viewingInvoice.lutArn}</div>
                              </div>
                            )}
                            {viewingInvoice.notes && (
                              <div className="col-span-2 md:col-span-3">
                                <div className="font-semibold text-slate-500 mb-0.5">Notes</div>
                                <div className="text-slate-700 bg-slate-50 p-2 rounded text-xs">{viewingInvoice.notes}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
                        <button
                          onClick={() => setViewingInvoice(null)}
                          className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-semibold text-sm"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeSubTab === 'customers' && (
            <>
              {showCustomerForm && (
                <CustomerForm
                  customer={editingCustomer}
                  onSubmit={handleCustomerFormSubmit}
                  onCancel={() => {
                    // If redirected from invoice form, restore invoice form
                    if (redirectFromInvoice) {
                      console.log('🔄 Canceling customer form - restoring invoice form');
                      // Set all states together to ensure proper rendering
                      // Order matters: tab first, then form, then cleanup
                      setActiveSubTab('invoices');
                      setShowForm(true);
                      setEditingInvoice(null);
                      setShowCustomerForm(false);
                      setEditingCustomer(null);
                      setRedirectFromInvoice(false);
                    } else {
                      // Normal cancel - just close customer form
                      setShowCustomerForm(false);
                      setEditingCustomer(null);
                    }
                  }}
                />
              )}

              {viewingCustomer && (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 p-6 mb-6 hover:shadow-xl transition-all duration-300">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {viewingCustomer.displayName || viewingCustomer.clientName || 'Customer Details'}
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {viewingCustomer.companyName || 'View customer information'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingCustomer(null)}
                      className="w-9 h-9 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-all duration-200"
                      title="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Content Sections - Compact Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Personal Information */}
                    <div className="bg-gradient-to-br from-slate-50/50 to-white rounded-xl p-4 border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-0.5">Display Name</div>
                          <div className="text-sm font-semibold text-slate-900">{viewingCustomer.displayName || viewingCustomer.clientName || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-0.5">Company Name</div>
                          <div className="text-sm font-semibold text-slate-900">{viewingCustomer.companyName || '-'}</div>
                        </div>
                        {viewingCustomer.salutation && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Salutation</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.salutation}</div>
                          </div>
                        )}
                        {viewingCustomer.firstName && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">First Name</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.firstName}</div>
                          </div>
                        )}
                        {viewingCustomer.lastName && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Last Name</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.lastName}</div>
                          </div>
                        )}
                        {viewingCustomer.customerLanguage && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Language</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.customerLanguage}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-gradient-to-br from-slate-50/50 to-white rounded-xl p-4 border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Contact Information
                      </h3>
                      <div className="space-y-2.5">
                        {viewingCustomer.email && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Email</div>
                            <div className="text-xs font-medium text-slate-900 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {viewingCustomer.email}
                            </div>
                          </div>
                        )}
                        {viewingCustomer.mobile && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Mobile</div>
                            <div className="text-xs font-medium text-slate-900 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              {typeof viewingCustomer.mobile === 'object' && viewingCustomer.mobile?.number
                                ? `${viewingCustomer.mobile.countryCode || ''} ${viewingCustomer.mobile.number}`
                                : viewingCustomer.mobile}
                            </div>
                          </div>
                        )}
                        {viewingCustomer.workPhone && typeof viewingCustomer.workPhone === 'object' && viewingCustomer.workPhone?.number && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Work Phone</div>
                            <div className="text-xs font-medium text-slate-900">
                              {`${viewingCustomer.workPhone.countryCode || ''} ${viewingCustomer.workPhone.number}`}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Information */}
                    <div className="bg-gradient-to-br from-slate-50/50 to-white rounded-xl p-4 border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Financial Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {viewingCustomer.currency && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Currency</div>
                            <div className="text-xs font-semibold text-slate-900">{viewingCustomer.currency}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-slate-500 mb-0.5">Opening Balance</div>
                          <div className="text-xs font-semibold text-slate-900">₹{parseFloat(viewingCustomer.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                        {viewingCustomer.accountsReceivable && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Accounts Receivable</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.accountsReceivable}</div>
                          </div>
                        )}
                        {viewingCustomer.paymentTerms && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Payment Terms</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.paymentTerms}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tax Information */}
                    <div className="bg-gradient-to-br from-slate-50/50 to-white rounded-xl p-4 border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Tax Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {viewingCustomer.pan && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">PAN</div>
                            <div className="text-xs font-semibold text-slate-900">{viewingCustomer.pan}</div>
                          </div>
                        )}
                        {viewingCustomer.gstin && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">GSTIN</div>
                            <div className="text-xs font-semibold text-slate-900">{viewingCustomer.gstin}</div>
                          </div>
                        )}
                        {viewingCustomer.hsnOrSac && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">HSN/SAC</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.hsnOrSac}</div>
                          </div>
                        )}
                        {(viewingCustomer.gstPercentage !== undefined && viewingCustomer.gstPercentage !== null) && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">GST %</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.gstPercentage}%</div>
                          </div>
                        )}
                        {(viewingCustomer.tdsPercentage !== undefined && viewingCustomer.tdsPercentage !== null) && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">TDS %</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.tdsPercentage}%</div>
                          </div>
                        )}
                        {(viewingCustomer.country || viewingCustomer.billingAddress?.country) && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">Country</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.country || viewingCustomer.billingAddress?.country}</div>
                          </div>
                        )}
                        {(viewingCustomer.state || viewingCustomer.billingAddress?.state) && (
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-0.5">State</div>
                            <div className="text-xs font-medium text-slate-900">{viewingCustomer.state || viewingCustomer.billingAddress?.state}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Billing Address */}
                    {viewingCustomer.billingAddress && (typeof viewingCustomer.billingAddress === 'object') && (
                      <div className="lg:col-span-2 bg-gradient-to-br from-slate-50/50 to-white rounded-xl p-4 border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Billing Address
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {viewingCustomer.billingAddress.street1 && (
                            <div className="md:col-span-2">
                              <div className="text-xs font-semibold text-slate-500 mb-0.5">Street 1</div>
                              <div className="text-xs font-medium text-slate-900">{viewingCustomer.billingAddress.street1}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.street2 && (
                            <div className="md:col-span-2">
                              <div className="text-xs font-semibold text-slate-500 mb-0.5">Street 2</div>
                              <div className="text-xs font-medium text-slate-900">{viewingCustomer.billingAddress.street2}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.city && (
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-0.5">City</div>
                              <div className="text-xs font-medium text-slate-900">{viewingCustomer.billingAddress.city}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.state && (
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-0.5">State</div>
                              <div className="text-xs font-medium text-slate-900">{viewingCustomer.billingAddress.state}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.pinCode && (
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-0.5">Pin Code</div>
                              <div className="text-xs font-medium text-slate-900">{viewingCustomer.billingAddress.pinCode}</div>
                            </div>
                          )}
                          {viewingCustomer.billingAddress.phone?.number && (
                            <div>
                              <div className="text-xs font-semibold text-slate-500 mb-0.5">Phone</div>
                              <div className="text-xs font-medium text-slate-900">
                                {`${viewingCustomer.billingAddress.phone.countryCode || ''} ${viewingCustomer.billingAddress.phone.number}`}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(!viewingCustomer.billingAddress || typeof viewingCustomer.billingAddress === 'string') && viewingCustomer.billingAddress && (
                      <div className="lg:col-span-2 bg-gradient-to-br from-slate-50/50 to-white rounded-xl p-4 border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Billing Address
                        </h3>
                        <p className="text-xs font-medium text-slate-900">{viewingCustomer.billingAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loadingCustomers ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
                  <p className="mt-4 text-slate-600 font-medium">Loading customers...</p>
                </div>
              ) : (
                <CustomerTable
                  customers={customers}
                  onEdit={handleEditCustomer}
                  onDelete={handleDeleteCustomer}
                  onView={handleViewCustomer}
                />
              )}
            </>
          )}
        </>
      )}


      {/* Items Tab Content */}
      {activeMainTab === 'items' && (
        <div className="card-gradient p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Items</h2>
          <p className="text-gray-600">Items management feature coming soon...</p>
        </div>
      )}

      {/* Recurring Invoice Modal */}
      <RecurringInvoiceModal
        isOpen={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
        }}
        selectedInvoiceIds={selectedInvoices}
        invoices={invoices}
        onSubmit={handleRecurringInvoiceSubmit}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedInvoiceForPayment(null);
        }}
        invoice={selectedInvoiceForPayment}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Delete Customer Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteCustomerConfirm.show}
        onClose={() => setDeleteCustomerConfirm({ show: false, id: null })}
        onConfirm={handleDeleteCustomerConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />

      {/* Delete Invoice Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteInvoiceConfirm.show}
        onClose={() => setDeleteInvoiceConfirm({ show: false, id: null })}
        onConfirm={handleDeleteInvoiceConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />
    </div>
  );
};

export default Sales;
