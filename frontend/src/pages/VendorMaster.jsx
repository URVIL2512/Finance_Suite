import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { vendorAPI } from '../services/api';
import ActionDropdown from '../components/ActionDropdown';
import { useToast } from '../contexts/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const VendorMaster = ({ returnPath, returnState }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    email: '',
    phone: '',
    address: '',
    defaultPaymentTerms: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchVendors();
  }, []);

  // Auto-open form if redirected from expense form
  useEffect(() => {
    if (returnPath) {
      setShowForm(true);
      setEditingVendor(null);
      setFormData({ name: '', gstin: '', email: '', phone: '', address: '', defaultPaymentTerms: '' });
    }
  }, [returnPath]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await vendorAPI.getAll();
      setVendors(response.data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      showToast('Failed to fetch vendors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingVendor(null);
    setFormData({ name: '', gstin: '', email: '', phone: '', address: '', defaultPaymentTerms: '', isActive: true });
    setShowForm(true);
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name || '',
      gstin: vendor.gstin || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      defaultPaymentTerms: vendor.defaultPaymentTerms || '',
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    try {
      setDeleting(true);
      await vendorAPI.delete(deleteConfirm.id);
      showToast('Vendor deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
      showToast(error.response?.data?.message || 'Failed to delete vendor', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Vendor name is required', 'error');
      return;
    }

    try {
      if (editingVendor) {
        await vendorAPI.update(editingVendor._id, formData);
        showToast('Vendor updated successfully!', 'success');
      } else {
        await vendorAPI.create(formData);
        showToast('Vendor created successfully!', 'success');
      }
      setShowForm(false);
      setEditingVendor(null);
      await fetchVendors();
      
      // If redirected from expense form, navigate back
      if (returnPath) {
        navigate(returnPath, {
          state: returnState || { showExpenseForm: true },
          replace: false
        });
      }
    } catch (error) {
      console.error('Error saving vendor:', error);
      showToast(error.response?.data?.message || 'Failed to save vendor', 'error');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVendor(null);
    
    // If redirected from expense form, navigate back
    if (returnPath) {
      navigate(returnPath, {
        state: returnState || { showExpenseForm: true },
        replace: false
      });
    }
  };

  const filteredVendors = filterBySearchQuery(
    vendors,
    searchQuery,
    moduleSearchConfig.vendors
  );

  if (loading && vendors.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading vendors...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Vendor Master</h1>
          <p className="text-gray-600 text-sm">Manage vendor information and contact details</p>
        </div>
        <div className="flex items-center gap-3">
          {vendors.length > 0 && (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search vendors..."
            />
          )}
          <button 
            onClick={handleCreate} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </button>
        </div>
      </div>

      {showForm && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={handleCancel}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {editingVendor ? 'Edit Vendor' : 'Create Vendor'}
              </h2>
              <button 
                onClick={handleCancel} 
                className="text-slate-300 hover:text-white hover:bg-white/10 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 font-light text-xl"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      Vendor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm uppercase"
                      placeholder="15-character GSTIN"
                      maxLength="15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm resize-none"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                    Default Payment Terms
                  </label>
                  <input
                    type="text"
                    value={formData.defaultPaymentTerms}
                    onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                    placeholder="e.g., Net 30, Due on Receipt"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
                <button 
                  type="submit" 
                  className="flex-1 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 text-sm"
                >
                  Save Changes
                </button>
                <button 
                  type="button" 
                  onClick={handleCancel} 
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {vendors.length === 0 ? (
        <div className="card-gradient p-12 text-center border border-gray-200/60">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-lg font-semibold text-gray-700 mb-2">No vendors found</p>
          <p className="text-sm text-gray-500">Add your first vendor to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Vendor Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">GSTIN</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor._id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{vendor.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{vendor.gstin || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{vendor.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{vendor.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <ActionDropdown onEdit={() => handleEdit(vendor)} onDelete={() => handleDelete(vendor._id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this vendor? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />
    </div>
  );
};

export default VendorMaster;
