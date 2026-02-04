import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { paymentAPI, invoiceAPI, customerAPI } from '../services/api';
import PaymentTable from '../components/PaymentTable';
import PaymentModal from '../components/PaymentModal';
import PaymentHistory from '../components/PaymentHistory';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import MobileSelect from '../components/MobileSelect';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const Payment = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [modalMode, setModalMode] = useState('edit');
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    invoiceId: '',
    customerId: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedInvoiceForHistory, setSelectedInvoiceForHistory] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const initialSearch =
    typeof window !== 'undefined'
      ? new URLSearchParams(location.search).get('search') || ''
      : '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    fetchPayments();
    fetchInvoices();
    fetchCustomers();
  }, [filters]);

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

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.invoiceId) params.invoiceId = filters.invoiceId;
      if (filters.customerId) params.customerId = filters.customerId;

      const response = await paymentAPI.getAll(params);
      
      if (response && response.data) {
        let list = response.data;
        // Apply client-side fuzzy search on top of API filters
        list = filterBySearchQuery(
          list,
          searchQuery,
          moduleSearchConfig.payments
        );
        setPayments(list);
      } else {
        console.warn('Unexpected response format:', response);
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch payments';
      showToast(errorMessage, 'error');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await invoiceAPI.getAll();
      setInvoices(response.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleCreatePayment = () => {
    setSelectedPayment(null);
    setSelectedInvoice(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleEditPayment = (payment) => {
    setSelectedPayment(payment);
    setSelectedInvoice(payment.invoice);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleViewPayment = (payment) => {
    setSelectedPayment(payment);
    setSelectedInvoice(payment.invoice);
    setModalMode('view');
    setShowModal(true);
  };

  const handleDeletePayment = async (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      await paymentAPI.delete(deleteConfirm.id);
      showToast('Payment deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      showToast('Failed to delete payment', 'error');
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const handlePaymentRecorded = () => {
    fetchPayments();
    setShowModal(false);
    setSelectedPayment(null);
    setSelectedInvoice(null);
    setModalMode('edit');
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      startDate: '',
      endDate: '',
      invoiceId: '',
      customerId: '',
    });
    setSearchQuery('');
    updateSearchInUrl('');
  };

  const handleViewPaymentHistory = (invoice) => {
    if (invoice) {
      setSelectedInvoiceForHistory(invoice);
      setShowHistoryModal(true);
    }
  };

  const handleViewPDF = async (invoiceId) => {
    try {
      const response = await paymentAPI.getPaymentHistoryPDF(invoiceId);
      
      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `Payment-History-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading payment history PDF:', error);
      showToast('Failed to download payment history PDF. Please try again.', 'error');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="page-header">Payment Management</h1>
          <p className="page-subtitle">
            Track and manage payments for invoices
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              updateSearchInUrl(val);
            }}
            placeholder="Search payments..."
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>Filters</span>
          </button>
        </div>
      </div>

      {showFilters && (
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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="form-label">Status</label>
            <MobileSelect
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="select-field"
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Paid">Paid</option>
            </MobileSelect>
          </div>
          <div>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="form-label">Invoice</label>
            <MobileSelect
              value={filters.invoiceId}
              onChange={(e) => setFilters({ ...filters, invoiceId: e.target.value })}
              className="select-field"
            >
              <option value="">All Invoices</option>
              {invoices.map((invoice) => (
                <option key={invoice._id} value={invoice._id}>
                  {invoice.invoiceNumber}
                </option>
              ))}
            </MobileSelect>
          </div>
          <div>
            <label className="form-label">Customer</label>
            <MobileSelect
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              className="select-field"
            >
              <option value="">All Customers</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.displayName || customer.companyName || customer.clientName}
                </option>
              ))}
            </MobileSelect>
          </div>
        </div>
      </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading payments...</p>
        </div>
      ) : (
        <PaymentTable
          payments={payments}
          onEdit={handleEditPayment}
          onDelete={handleDeletePayment}
          onView={handleViewPayment}
          onViewHistory={handleViewPaymentHistory}
          onViewPDF={handleViewPDF}
        />
      )}

      <PaymentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedPayment(null);
          setSelectedInvoice(null);
          setModalMode('edit');
        }}
        invoice={selectedInvoice || selectedPayment?.invoice}
        payment={selectedPayment}
        mode={modalMode}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Payment History Modal */}
      {showHistoryModal && (
        <PaymentHistory
          invoice={selectedInvoiceForHistory}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedInvoiceForHistory(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
      />
    </div>
  );
};

export default Payment;
