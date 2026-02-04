import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { invoiceAPI, customerAPI, recurringInvoiceAPI } from '../services/api';
import InvoiceForm from '../components/InvoiceForm';
import InvoiceTable from '../components/InvoiceTable';
import InvoiceViewEdit from '../components/InvoiceViewEdit';
import RecurringInvoiceModal from '../components/RecurringInvoiceModal';
import PaymentModal from '../components/PaymentModal';
import ConfirmationModal from '../components/ConfirmationModal';
import EmailConfirmationModal from '../components/EmailConfirmationModal';
import { getAuthToken } from '../utils/auth';
import { useToast } from '../contexts/ToastContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { formatCurrency } from '../utils/currencyConverter';
import MobileSelect from '../components/MobileSelect';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';

const Invoices = () => {
  const { showToast } = useToast();
  const { exchangeRates, isReady: currencyReady } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]); // Store all invoices for dropdown
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [pendingCustomerSelect, setPendingCustomerSelect] = useState(null);
  const searchParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(location.search).get('search') || ''
      : '';
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [filters, setFilters] = useState({
    year: '',
    status: '',
    clientName: '',
  });
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [selectedInvoiceForPDF, setSelectedInvoiceForPDF] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({ show: false, invoiceIds: [] });
  const [emailConfirm, setEmailConfirm] = useState({ show: false, invoiceData: null, clientEmail: '', isNewInvoice: false });
  const [importing, setImporting] = useState(false);
  const invoiceImportInputRef = useRef(null);

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

  // Check if returning from items/customers page and should show invoice form
  useEffect(() => {
    const returnState = location.state?.showInvoiceForm;
    const invoiceId = location.state?.invoiceId;
    
    if (returnState) {
      console.log('🔄 Detected return from items/customers - restoring invoice form in Invoices page');
      console.log('Location state:', location.state);
      console.log('Invoice ID from return state:', invoiceId);
      
      // Set form state immediately
      setShowForm(true);
      
      // If there's an invoiceId, reload the invoice to preserve editing state
      if (invoiceId) {
        console.log('📥 Reloading invoice with ID:', invoiceId);
        invoiceAPI.getById(invoiceId)
          .then((response) => {
            if (response.data) {
              console.log('✅ Invoice reloaded successfully:', response.data);
              setEditingInvoice(response.data);
            } else {
              console.warn('⚠️ No invoice data in response');
              setEditingInvoice(null);
            }
          })
          .catch((error) => {
            console.error('❌ Error reloading invoice:', error);
            showToast('Failed to reload invoice data', 'warning');
            setEditingInvoice(null);
          });
      } else {
        // No invoiceId means it's a new invoice
        setEditingInvoice(null);
      }
      
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

  // Fetch all invoices (without filters) for client dropdown
  useEffect(() => {
    fetchAllInvoicesForDropdown();
  }, []);

  useEffect(() => {
    fetchInvoices();
    // Always fetch customers to keep dropdown updated
    fetchCustomers();
  }, [filters, searchQuery]);

  // Ensure customers are loaded when invoice form is shown
  useEffect(() => {
    if (showForm) {
      fetchCustomers();
    }
  }, [showForm]);

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
      
      // Client-side search filtering using shared fuzzy matcher
      filteredInvoices = filterBySearchQuery(
        filteredInvoices,
        searchQuery,
        moduleSearchConfig.invoices
      );
      
      setInvoices(filteredInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      setCustomers(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  };

  const handleCreate = () => {
    setEditingInvoice(null);
    setShowForm(true);
  };


  const handleEdit = async (invoice) => {
    console.log('✏️ Edit invoice clicked:', invoice);
    if (invoice && invoice._id) {
      try {
        // Fetch fresh invoice data to ensure we have all fields including clientDetails
        console.log('📥 Fetching full invoice data for editing...');
        const response = await invoiceAPI.getById(invoice._id);
        if (response.data) {
          console.log('✅ Full invoice data fetched:', response.data);
          console.log('📋 Client Details:', response.data.clientDetails);
          console.log('📧 Client Email:', response.data.clientEmail);
          console.log('📱 Client Mobile:', response.data.clientMobile);
          setEditingInvoice(response.data);
          setShowForm(true);
        } else {
          console.warn('⚠️ No invoice data in response, using provided invoice');
          setEditingInvoice(invoice);
          setShowForm(true);
        }
      } catch (error) {
        console.error('❌ Error fetching invoice for editing:', error);
        showToast('Failed to load invoice data. Using cached data.', 'warning');
        // Fallback to provided invoice data
        setEditingInvoice(invoice);
        setShowForm(true);
      }
    } else {
      console.error('❌ Invoice is null, undefined, or missing _id:', invoice);
      showToast('Error: Cannot edit invoice. Invoice data is invalid.', 'error');
    }
  };

  const handleDelete = async (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      await invoiceAPI.delete(deleteConfirm.id);
      showToast('Invoice deleted successfully', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showToast('Failed to delete invoice', 'error');
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const handleBulkDelete = () => {
    if (selectedInvoices.length === 0) {
      showToast('Please select at least one invoice to delete', 'warning');
      return;
    }
    setBulkDeleteConfirm({ show: true, invoiceIds: selectedInvoices });
  };

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteConfirm.invoiceIds || bulkDeleteConfirm.invoiceIds.length === 0) return;
    try {
      const response = await invoiceAPI.deleteMultiple(bulkDeleteConfirm.invoiceIds);
      showToast(`Successfully deleted ${response.data.deletedCount} invoice(s)`, 'success');
      setBulkDeleteConfirm({ show: false, invoiceIds: [] });
      setSelectedInvoices([]); // Clear selection
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoices:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete invoices';
      showToast(errorMessage, 'error');
      setBulkDeleteConfirm({ show: false, invoiceIds: [] });
    }
  };

  const handleClearFilters = () => {
    setFilters({
      year: '',
      status: '',
      clientName: '',
    });
    setSearchQuery(''); // Also clear search when clearing filters
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingInvoice) {
        // Show email confirmation modal for editing invoices
        const clientEmail = data.clientEmail || editingInvoice.clientEmail || '';
        setEmailConfirm({ 
          show: true, 
          invoiceData: data, 
          clientEmail: clientEmail 
        });
      } else {
        // For new invoices, also show email confirmation modal
        // Validate email is present for new invoices
        if (!data.clientEmail || data.clientEmail.trim() === '') {
          showToast('Error: Client email is required to send the invoice', 'error');
          return;
        }
        
        // Validate base amount is present
        if (!data.baseAmount || parseFloat(data.baseAmount) <= 0) {
          showToast('Error: Base amount is required and must be greater than 0', 'error');
          return;
        }
        
        // Show email confirmation modal for new invoices too
        setEmailConfirm({ 
          show: true, 
          invoiceData: data, 
          clientEmail: data.clientEmail,
          isNewInvoice: true // Flag to indicate this is a new invoice
        });
      }
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
      
      showToast(errorMessage, 'error');
    }
  };

  const handleEmailConfirm = async (sendEmail) => {
    if (!emailConfirm.invoiceData) return;
    
    try {
      // Add sendEmail flag to the data
      const dataWithEmailFlag = {
        ...emailConfirm.invoiceData,
        sendEmail: sendEmail, // Add flag to control email sending
      };
      
      let response;
      let invoiceData;
      
      if (emailConfirm.isNewInvoice) {
        // Create new invoice
        response = await invoiceAPI.create(dataWithEmailFlag);
        invoiceData = response.data;
        
        // Show success message based on email sending
        if (sendEmail && emailConfirm.clientEmail) {
          showToast(`Invoice created successfully! Email is being sent to ${emailConfirm.clientEmail}.`, 'success');
        } else {
          showToast('Invoice created successfully!', 'success');
        }
      } else {
        // Update existing invoice
        response = await invoiceAPI.update(editingInvoice._id, dataWithEmailFlag);
        invoiceData = response.data;
        
        // Show success message based on email sending
        if (sendEmail && emailConfirm.clientEmail) {
          showToast(`Invoice updated successfully! Email is being sent to ${emailConfirm.clientEmail}.`, 'success');
        } else {
          showToast('Invoice updated successfully!', 'success');
        }
      }
      
      setEmailConfirm({ show: false, invoiceData: null, clientEmail: '', isNewInvoice: false });
      setShowForm(false);
      setEditingInvoice(null);
      fetchInvoices();
    } catch (error) {
      console.error('Error saving invoice:', error);
      console.error('Error response:', error.response?.data);
      let errorMessage = emailConfirm.isNewInvoice ? 'Failed to create invoice' : 'Failed to update invoice';
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend server is running on port 5000.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
      setEmailConfirm({ show: false, invoiceData: null, clientEmail: '', isNewInvoice: false });
    }
  };

  const handleRecurringInvoiceSubmit = async (data) => {
    try {
      const response = await recurringInvoiceAPI.create(data);
      showToast(`Recurring invoice created successfully for ${data.invoiceIds.length} invoice(s)!`, 'success');
      setSelectedInvoices([]);
      setShowRecurringModal(false);
      fetchInvoices(); // Refresh invoices list
    } catch (error) {
      console.error('Error creating recurring invoice:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create recurring invoice';
      showToast(errorMessage, 'error');
    }
  };

  const handleRecordPayment = (invoice) => {
    if (invoice.status === 'Void') {
      showToast('Cannot record payment for a voided invoice', 'error');
      return;
    }
    setSelectedInvoiceForPayment(invoice);
    setShowPaymentModal(true);
  };

  const handleVoid = async (id) => {
    try {
      await invoiceAPI.void(id);
      showToast('Invoice voided successfully', 'success');
      fetchInvoices();
    } catch (error) {
      console.error('Error voiding invoice:', error);
      const errorMessage = error.response?.data?.message || 'Failed to void invoice';
      showToast(errorMessage, 'error');
    }
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
      showToast('Error: Cannot view invoice details. Invoice data is invalid.', 'error');
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

  const handleViewPDF = async (invoice) => {
    if (!invoice || !invoice._id) {
      return;
    }

    setSelectedInvoiceForPDF(invoice);
    setPdfLoading(true);
    setPdfBlobUrl(null);

    try {
      const token = getAuthToken();
      if (!token) {
        showToast('Please login to view PDF', 'error');
        setSelectedInvoiceForPDF(null);
        setPdfLoading(false);
        return;
      }

      const url = `${API_URL}/invoices/${invoice._id}/pdf?t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf',
        },
      });

      if (!response.ok) {
        let message = 'Failed to fetch PDF';
        try {
          const errData = await response.json();
          if (errData?.message) {
            message = errData.message;
          }
        } catch (_) {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (error) {
      console.error('Error loading PDF:', error);
      showToast(`Failed to load PDF: ${error.message || 'Please try again.'}`, 'error');
      setSelectedInvoiceForPDF(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadInvoicePDF = async (invoice) => {
    if (!invoice || !invoice._id) {
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        showToast('Please login to download PDF', 'error');
        return;
      }

      const url = `${API_URL}/invoices/${invoice._id}/pdf?t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/pdf',
        },
      });

      if (!response.ok) {
        let message = 'Failed to download PDF';
        try {
          const errData = await response.json();
          if (errData?.message) {
            message = errData.message;
          }
        } catch (_) {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast(error.message || 'Failed to download PDF', 'error');
    }
  };

  const handleClosePDF = () => {
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
    }
    setSelectedInvoiceForPDF(null);
    setPdfBlobUrl(null);
    setPdfLoading(false);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const handleInvoiceImportClick = () => {
    if (importing) return;
    invoiceImportInputRef.current?.click?.();
  };

  const handleInvoiceImportFileChange = async (e) => {
    const file = e.target.files?.[0];
    // allow re-selecting the same file
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
      console.log('📥 Starting invoice import...', { fileName: file.name, fileSize: file.size });
      
      const resp = await invoiceAPI.import(file);
      const imported = resp?.data?.imported ?? 0;
      const skipped = resp?.data?.skipped ?? 0;
      const mastersCreated = resp?.data?.mastersCreated || { customers: 0, items: 0 };
      const errors = resp?.data?.errors || [];

      // Build message with master creation info
      let message = resp?.data?.message || `Imported ${imported} invoice(s). Skipped ${skipped}.`;
      if (mastersCreated.customers > 0 || mastersCreated.items > 0) {
        const masterParts = [];
        if (mastersCreated.customers > 0) {
          masterParts.push(`${mastersCreated.customers} customer${mastersCreated.customers === 1 ? '' : 's'}`);
        }
        if (mastersCreated.items > 0) {
          masterParts.push(`${mastersCreated.items} item${mastersCreated.items === 1 ? '' : 's'}`);
        }
        message += ` Created ${masterParts.join(' and ')}.`;
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

      // Refresh lists
      await fetchInvoices();
      await fetchAllInvoicesForDropdown();
      await fetchCustomers(); // Refresh customers as they may have been created during import

      // Notify other pages to refresh (Items and Customers pages)
      // This will trigger a refresh if those pages are open
      // Dispatch custom event for same-tab communication
      window.dispatchEvent(new CustomEvent('refreshMasters'));
      // Also set in localStorage to trigger storage event (works across tabs)
      localStorage.setItem('refreshMasters', Date.now().toString());
      // Remove immediately to allow future updates
      setTimeout(() => localStorage.removeItem('refreshMasters'), 100);
    } catch (error) {
      console.error('❌ Error importing invoices:', error);
      console.error('Error details:', error.response?.data);
      
      // Provide more detailed error messages
      let errorMessage = 'Failed to import invoices from Excel';
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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-header">
            Invoice Management
          </h1>
          <p className="page-subtitle">Create and manage professional invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={invoiceImportInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleInvoiceImportFileChange}
          />
          {!showForm && (
            <>
              <SearchBar
                value={searchQuery}
                onChange={(val) => {
                  setSearchQuery(val);
                  updateSearchInUrl(val);
                }}
                placeholder="Search invoices..."
                widthClass="hidden sm:block w-64"
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters</span>
              </button>
            </>
          )}
          {!showForm && (
            <button
              onClick={handleInvoiceImportClick}
              disabled={importing}
              className={`px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                importing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              title="Import Invoice Excel (.xlsx/.xls)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
              </svg>
              <span>{importing ? 'Importing...' : 'Import Excel'}</span>
            </button>
          )}
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center space-x-2"
          >
            <span>+</span>
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      <>
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

          {showForm && (
            <InvoiceForm
              key={editingInvoice?._id || 'new-invoice'}
              invoice={editingInvoice}
              customers={customers}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingInvoice(null);
              }}
              onCustomerAdded={fetchCustomers}
              onRedirectToCustomer={() => {
                navigate('/customers');
              }}
              pendingCustomerSelect={pendingCustomerSelect}
              onCustomerSelected={() => setPendingCustomerSelect(null)}
            />
          )}

          {!showForm && (
            <>
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
                  <p className="mt-4 text-slate-600 font-medium">Loading invoices...</p>
                </div>
              ) : selectedInvoiceForPDF ? (
                // Split View: Invoice List (Left) + PDF Viewer (Right)
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-250px)]">
                  {/* Left Sidebar - Invoice List */}
                  <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">All Invoices</h3>
                        <button
                          onClick={handleClosePDF}
                          className="text-gray-500 hover:text-gray-700 transition-colors"
                          title="Close PDF"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {invoices.map((invoice) => {
                        const totalGst = (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);
                        const currency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
                        const invoiceTotal = invoice.amountDetails?.invoiceTotal || invoice.grandTotal || 0;
                        const isSelected = selectedInvoiceForPDF?._id === invoice._id;
                        
                        return (
                          <div
                            key={invoice._id}
                            onClick={() => handleViewPDF(invoice)}
                            className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-blue-50 border-l-4 border-l-blue-600' 
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-sm font-medium ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                                {invoice.clientDetails?.name || 'N/A'}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                invoice.status === 'Paid' 
                                  ? 'bg-green-100 text-green-700' 
                                  : invoice.status === 'Partial'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {invoice.status || 'Unpaid'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mb-1">
                              {invoice.invoiceNumber}
                            </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {currency} {invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Side - PDF Viewer */}
                  <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                    {/* PDF Viewer Header */}
                    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {selectedInvoiceForPDF?.invoiceNumber}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {selectedInvoiceForPDF?.clientDetails?.name || 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Download Button */}
                        <button
                          onClick={() => downloadInvoicePDF(selectedInvoiceForPDF)}
                          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1.5"
                          title="Download PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download</span>
                        </button>
                        {/* Close Button */}
                        <button
                          onClick={handleClosePDF}
                          className="w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
                          title="Close"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* PDF Viewer */}
                    <div className="flex-1 overflow-hidden bg-gray-100 relative">
                      {pdfLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                          <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                            <p className="text-slate-600 font-medium">Loading PDF...</p>
                          </div>
                        </div>
                      ) : pdfBlobUrl ? (
                        <iframe
                          src={pdfBlobUrl}
                          className="w-full h-full border-0"
                          title={`Invoice PDF - ${selectedInvoiceForPDF.invoiceNumber}`}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                          <p className="text-slate-600">Failed to load PDF</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Normal View - Invoice Table
                <>
                  {selectedInvoices.length > 0 && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">
                        {selectedInvoices.length} invoice(s) selected
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleBulkDelete}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Selected
                        </button>
                        <button
                          onClick={() => setShowRecurringModal(true)}
                          className="px-4 py-2 bg-finance-blue text-white rounded-md hover:bg-finance-blueLight transition-colors text-sm font-medium"
                        >
                          Set as Recurring
                        </button>
                      </div>
                    </div>
                  )}
                  <InvoiceTable 
                    invoices={invoices} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete}
                    onView={handleViewInvoice}
                    onRecordPayment={handleRecordPayment}
                    onViewPDF={handleViewPDF}
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
            </>
          )}
      </>

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

      {/* Invoice View/Edit Modal */}
      {viewingInvoice && (
        <InvoiceViewEdit
          invoice={viewingInvoice}
          customers={customers}
          onClose={() => setViewingInvoice(null)}
          onUpdate={handleInvoiceUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={bulkDeleteConfirm.show}
        onClose={() => setBulkDeleteConfirm({ show: false, invoiceIds: [] })}
        onConfirm={handleBulkDeleteConfirm}
        title="Confirm Bulk Delete"
        message={`Are you sure you want to delete ${bulkDeleteConfirm.invoiceIds.length} invoice(s)? This action cannot be undone.`}
        confirmText={`Delete ${bulkDeleteConfirm.invoiceIds.length} Invoice(s)`}
        cancelText="Cancel"
        confirmButtonColor="red"
      />

      {/* Email Confirmation Modal */}
      <EmailConfirmationModal
        isOpen={emailConfirm.show}
        onClose={() => setEmailConfirm({ show: false, invoiceData: null, clientEmail: '', isNewInvoice: false })}
        onConfirm={handleEmailConfirm}
        clientEmail={emailConfirm.clientEmail}
        isNewInvoice={emailConfirm.isNewInvoice}
      />

    </div>
  );
};

export default Invoices;
