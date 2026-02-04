import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { recurringInvoiceAPI } from '../services/api';
import RecurringInvoiceModal from '../components/RecurringInvoiceModal';
import ActionDropdown from '../components/ActionDropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const RecurringInvoices = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecurringInvoice, setEditingRecurringInvoice] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const initialSearch =
    typeof window !== 'undefined'
      ? new URLSearchParams(location.search).get('search') || ''
      : '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    fetchRecurringInvoices();
  }, []);

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

  const fetchRecurringInvoices = async () => {
    try {
      setLoading(true);
      const response = await recurringInvoiceAPI.getAll();
      setRecurringInvoices(response.data || []);
    } catch (error) {
      console.error('Error fetching recurring invoices:', error);
      showToast('Failed to load recurring invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    try {
      setDeleting(true);
      await recurringInvoiceAPI.delete(deleteConfirm.id);
      showToast('Recurring invoice deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchRecurringInvoices();
    } catch (error) {
      console.error('Error deleting recurring invoice:', error);
      showToast('Failed to delete recurring invoice', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await recurringInvoiceAPI.update(id, { isActive: !isActive });
      alert(`Recurring invoice ${!isActive ? 'activated' : 'deactivated'} successfully!`);
      fetchRecurringInvoices();
    } catch (error) {
      console.error('Error updating recurring invoice:', error);
      alert('Failed to update recurring invoice');
    }
  };

  const handleEdit = (recurringInvoice) => {
    setEditingRecurringInvoice(recurringInvoice);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (data) => {
    try {
      await recurringInvoiceAPI.update(editingRecurringInvoice._id, {
        repeatEvery: data.repeatEvery,
        startOn: data.startOn,
        endsOn: data.endsOn,
        neverExpires: data.neverExpires,
      });
      alert('Recurring invoice updated successfully!');
      setShowEditModal(false);
      setEditingRecurringInvoice(null);
      fetchRecurringInvoices();
    } catch (error) {
      console.error('Error updating recurring invoice:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update recurring invoice';
      alert(`Error: ${errorMessage}`);
    }
  };

  const filteredRecurringInvoices = filterBySearchQuery(
    recurringInvoices,
    searchQuery,
    moduleSearchConfig.recurringInvoices
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading recurring invoices...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="page-header">Recurring Invoices</h1>
          <p className="page-subtitle">
            Manage recurring invoice schedules and automation
          </p>
        </div>
        {recurringInvoices.length > 0 && (
          <SearchBar
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              updateSearchInUrl(val);
            }}
            placeholder="Search recurring invoices..."
          />
        )}
      </div>

      {filteredRecurringInvoices.length === 0 ? (
        <div className="card-gradient p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Recurring Invoices</h2>
          <p className="text-gray-600 mb-6">
            You haven't created any recurring invoices yet.
          </p>
          <p className="text-gray-500 text-sm">
            Go to <strong>Invoices</strong> page, select invoices, and click "Set as Recurring" to create recurring invoices.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Base Invoice
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-r border-white/20">
                    Client
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
                    Next Send
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
                {filteredRecurringInvoices.map((recurringInvoice) => {
                  const baseInvoice = recurringInvoice.baseInvoice;
                  const clientName = baseInvoice?.clientDetails?.name || 'N/A';
                  const invoiceNumber = baseInvoice?.invoiceNumber || 'N/A';
                  
                  return (
                    <tr key={recurringInvoice._id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoiceNumber}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {clientName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {recurringInvoice.repeatEvery}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(recurringInvoice.startOn), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {recurringInvoice.neverExpires 
                          ? 'Never' 
                          : recurringInvoice.endsOn 
                            ? format(new Date(recurringInvoice.endsOn), 'dd/MM/yyyy')
                            : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {recurringInvoice.nextSendDate
                          ? format(new Date(recurringInvoice.nextSendDate), 'dd/MM/yyyy')
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={
                            recurringInvoice.isActive
                              ? 'badge-success'
                              : 'badge-neutral'
                          }
                        >
                          {recurringInvoice.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <ActionDropdown
                          onEdit={() => handleEdit(recurringInvoice)}
                          onToggleActive={handleToggleActive}
                          isActive={recurringInvoice.isActive}
                          itemId={recurringInvoice._id}
                          onDelete={() => handleDelete(recurringInvoice._id)}
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
      {showEditModal && editingRecurringInvoice && (
        <RecurringInvoiceModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingRecurringInvoice(null);
          }}
          selectedInvoiceIds={
            editingRecurringInvoice.baseInvoice?._id 
              ? [editingRecurringInvoice.baseInvoice._id]
              : editingRecurringInvoice.baseInvoice
              ? [editingRecurringInvoice.baseInvoice]
              : []
          }
          invoices={
            editingRecurringInvoice.baseInvoice 
              ? (typeof editingRecurringInvoice.baseInvoice === 'object' 
                  ? [editingRecurringInvoice.baseInvoice] 
                  : [])
              : []
          }
          onSubmit={handleEditSubmit}
          editingRecurringInvoice={editingRecurringInvoice}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this recurring invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />
    </div>
  );
};

export default RecurringInvoices;
