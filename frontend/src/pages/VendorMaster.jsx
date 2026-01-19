import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { vendorAPI } from '../services/api';
import ActionDropdown from '../components/ActionDropdown';
import { useToast } from '../contexts/ToastContext';

const VendorMaster = () => {
  const { showToast } = useToast();
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
    isActive: true,
  });

  useEffect(() => {
    fetchVendors();
  }, []);

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
      isActive: vendor.isActive !== false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        await vendorAPI.delete(id);
        showToast('Vendor deleted successfully!', 'success');
        fetchVendors();
      } catch (error) {
        console.error('Error deleting vendor:', error);
        showToast(error.response?.data?.message || 'Failed to delete vendor', 'error');
      }
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
      fetchVendors();
    } catch (error) {
      console.error('Error saving vendor:', error);
      showToast(error.response?.data?.message || 'Failed to save vendor', 'error');
    }
  };

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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2">Vendor Master</h1>
          <p className="text-slate-600">Manage vendor information (name, GSTIN, contact details, etc.)</p>
        </div>
        <button onClick={handleCreate} className="btn-primary flex items-center space-x-2">
          <span>+</span>
          <span>Add Vendor</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h2 className="text-xl font-bold">{editingVendor ? 'Edit Vendor' : 'New Vendor'}</h2>
              <button onClick={() => { setShowForm(false); setEditingVendor(null); }} className="text-white hover:text-red-200 text-2xl font-bold">×</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Vendor Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">GSTIN</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="15-character GSTIN"
                    maxLength="15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Default Payment Terms</label>
                <input
                  type="text"
                  value={formData.defaultPaymentTerms}
                  onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Net 30, Due on Receipt"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  id="isActive"
                />
                <label htmlFor="isActive" className="ml-2 text-sm font-semibold text-gray-700">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 btn-primary">Save</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingVendor(null); }} className="px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300">Cancel</button>
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
        <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Vendor Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">GSTIN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vendors.map((vendor) => (
                  <tr key={vendor._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{vendor.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vendor.gstin || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vendor.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{vendor.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${vendor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
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
    </div>
  );
};

export default VendorMaster;
