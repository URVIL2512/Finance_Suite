import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { revenueAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import RevenueForm from '../components/RevenueForm';
import RevenueTable from '../components/RevenueTable';
import ConfirmationModal from '../components/ConfirmationModal';
import MobileSelect from '../components/MobileSelect';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const Revenue = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState(null);
  const [filters, setFilters] = useState({
    year: '',
    month: '',
    country: '',
    service: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    id: null,
    skipConfirmation: false,
  });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({
    show: false,
    ids: [],
  });
  const [deleting, setDeleting] = useState(false);
  const initialSearch =
    typeof window !== 'undefined'
      ? new URLSearchParams(location.search).get('search') || ''
      : '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    fetchRevenue();
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

  const fetchRevenue = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.year && filters.year !== '') params.year = parseInt(filters.year);
      if (filters.month) params.month = filters.month;
      if (filters.country) params.country = filters.country;
      if (filters.service) params.service = filters.service;

      const response = await revenueAPI.getAll(params);
      const list = filterBySearchQuery(
        response.data || [],
        searchQuery,
        moduleSearchConfig.revenue
      );
      setRevenue(list);
    } catch (error) {
      console.error('Error fetching revenue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRevenue(null);
    setShowForm(true);
  };

  const handleEdit = (rev) => {
    setEditingRevenue(rev);
    setShowForm(true);
  };

  const handleDelete = (id, skipConfirmation = false) => {
    if (skipConfirmation) {
      // Direct delete without confirmation
      handleDeleteConfirm(id);
    } else {
      setDeleteConfirm({ show: true, id, skipConfirmation: false });
    }
  };

  const handleDeleteConfirm = async (idToDelete = null) => {
    const id = idToDelete || deleteConfirm.id;
    if (!id) return;
    
    try {
      setDeleting(true);
      await revenueAPI.delete(id);
      showToast('Revenue entry deleted successfully', 'success');
      setDeleteConfirm({ show: false, id: null, skipConfirmation: false });
      fetchRevenue();
    } catch (error) {
      console.error('Error deleting revenue:', error);
      showToast('Failed to delete revenue entry', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = (ids) => {
    setBulkDeleteConfirm({ show: true, ids });
  };

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteConfirm.ids || bulkDeleteConfirm.ids.length === 0) return;
    
    try {
      setDeleting(true);
      // Delete all entries sequentially
      for (const id of bulkDeleteConfirm.ids) {
        await revenueAPI.delete(id);
      }
      fetchRevenue();
      showToast(`Successfully deleted ${bulkDeleteConfirm.ids.length} revenue entry/entries`, 'success');
      setBulkDeleteConfirm({ show: false, ids: [] });
    } catch (error) {
      console.error('Error deleting revenue entries:', error);
      showToast('Failed to delete some revenue entries', 'error');
      fetchRevenue(); // Refresh to show current state
    } finally {
      setDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      year: '',
      month: '',
      country: '',
      service: '',
    });
    setSearchQuery('');
    updateSearchInUrl('');
  };

  const handleFormSubmit = async (data) => {
    try {
      // Only allow editing existing revenue, not creating new ones
      if (!editingRevenue) {
        showToast('Cannot create revenue manually. Revenue entries are automatically created when you create invoices.', 'error');
        return;
      }

      // Ensure month is properly formatted
      if (!data.month || !['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].includes(data.month)) {
        const date = new Date(data.invoiceDate);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        data.month = monthNames[date.getMonth()];
      }
      
      // Ensure year is a number
      if (data.year) {
        data.year = parseInt(data.year);
      }
      
      // Ensure all numeric fields are numbers, not empty strings
      const numericFields = ['invoiceAmount', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'remittanceCharges', 'receivedAmount', 'dueAmount'];
      numericFields.forEach(field => {
        if (data[field] === '' || data[field] === null || data[field] === undefined) {
          data[field] = 0;
        } else {
          data[field] = parseFloat(data[field]) || 0;
        }
      });
      
      await revenueAPI.update(editingRevenue._id, data);
      showToast('Revenue updated successfully!', 'success');
      setShowForm(false);
      setEditingRevenue(null);
      fetchRevenue();
    } catch (error) {
      console.error('Error saving revenue:', error);
      console.error('Error response:', error.response?.data);
      let errorMessage = 'Failed to save revenue entry';
      
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

  const countries = ['India', 'USA', 'Canada', 'Australia'];
  const services = [
    'Website Design',
    'B2B Sales Consulting',
    'Outbound Lead Generation',
    'Social Media Marketing',
    'SEO',
    'TeleCalling',
    'Other Services',
  ];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="page-header">Revenue</h1>
          <p className="page-subtitle">
            Revenue entries are automatically created when you create invoices
          </p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-3">
            <SearchBar
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                updateSearchInUrl(val);
              }}
              placeholder="Search revenue..."
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
        )}
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Month</label>
              <MobileSelect
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="select-field"
              >
                <option value="">All Months</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </MobileSelect>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
              <MobileSelect
                value={filters.country}
                onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                className="select-field"
              >
                <option value="">All Countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </MobileSelect>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Service</label>
              <MobileSelect
                value={filters.service}
                onChange={(e) => setFilters({ ...filters, service: e.target.value })}
                className="select-field"
              >
                <option value="">All Services</option>
                {services.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </MobileSelect>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <RevenueForm
          revenue={editingRevenue}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingRevenue(null);
          }}
        />
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading revenue...</p>
        </div>
      ) : (
        <RevenueTable revenue={revenue} />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null, skipConfirmation: false })}
        onConfirm={() => handleDeleteConfirm()}
        title="Confirm Delete"
        message="Are you sure you want to delete this revenue entry? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={bulkDeleteConfirm.show}
        onClose={() => setBulkDeleteConfirm({ show: false, ids: [] })}
        onConfirm={handleBulkDeleteConfirm}
        title="Confirm Bulk Delete"
        message={`Are you sure you want to delete ${bulkDeleteConfirm.ids.length} revenue entry/entries? This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />
    </div>
  );
};

export default Revenue;

