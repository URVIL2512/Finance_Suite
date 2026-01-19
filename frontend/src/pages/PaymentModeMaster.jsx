import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { paymentModeAPI } from '../services/api';
import ActionDropdown from '../components/ActionDropdown';
import { useToast } from '../contexts/ToastContext';

const PaymentModeMaster = () => {
  const { showToast } = useToast();
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMode, setEditingMode] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', isActive: true });

  useEffect(() => {
    fetchPaymentModes();
  }, []);

  const fetchPaymentModes = async () => {
    try {
      setLoading(true);
      const response = await paymentModeAPI.getAll();
      setPaymentModes(response.data || []);
    } catch (error) {
      console.error('Error fetching payment modes:', error);
      showToast('Failed to fetch payment modes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingMode(null);
    setFormData({ name: '', description: '', isActive: true });
    setShowForm(true);
  };

  const handleEdit = (mode) => {
    setEditingMode(mode);
    setFormData({ name: mode.name || '', description: mode.description || '', isActive: mode.isActive !== false });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this payment mode?')) {
      try {
        await paymentModeAPI.delete(id);
        showToast('Payment mode deleted successfully!', 'success');
        fetchPaymentModes();
      } catch (error) {
        console.error('Error deleting payment mode:', error);
        showToast(error.response?.data?.message || 'Failed to delete payment mode', 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Payment mode name is required', 'error');
      return;
    }

    try {
      if (editingMode) {
        await paymentModeAPI.update(editingMode._id, formData);
        showToast('Payment mode updated successfully!', 'success');
      } else {
        await paymentModeAPI.create(formData);
        showToast('Payment mode created successfully!', 'success');
      }
      setShowForm(false);
      setEditingMode(null);
      fetchPaymentModes();
    } catch (error) {
      console.error('Error saving payment mode:', error);
      showToast(error.response?.data?.message || 'Failed to save payment mode', 'error');
    }
  };

  if (loading && paymentModes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading payment modes...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2">Payment Mode Master</h1>
          <p className="text-slate-600">Manage payment modes (Cash, Bank Transfer, UPI, etc.)</p>
        </div>
        <button onClick={handleCreate} className="btn-primary flex items-center space-x-2">
          <span>+</span>
          <span>Add Payment Mode</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h2 className="text-xl font-bold">{editingMode ? 'Edit Payment Mode' : 'New Payment Mode'}</h2>
              <button onClick={() => { setShowForm(false); setEditingMode(null); }} className="text-white hover:text-red-200 text-2xl font-bold">×</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Cash, Bank Transfer, UPI"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Optional description"
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
                <button type="button" onClick={() => { setShowForm(false); setEditingMode(null); }} className="px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModes.length === 0 ? (
        <div className="card-gradient p-12 text-center border border-gray-200/60">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-lg font-semibold text-gray-700 mb-2">No payment modes found</p>
          <p className="text-sm text-gray-500">Add your first payment mode to get started</p>
        </div>
      ) : (
        <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Created At</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentModes.map((mode) => (
                  <tr key={mode._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{mode.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{mode.description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${mode.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {mode.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mode.createdAt ? format(new Date(mode.createdAt), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <ActionDropdown onEdit={() => handleEdit(mode)} onDelete={() => handleDelete(mode._id)} />
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

export default PaymentModeMaster;
