import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { bankAccountAPI } from '../services/api';
import ActionDropdown from '../components/ActionDropdown';
import { useToast } from '../contexts/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const BankAccountMaster = ({ returnPath, returnState }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const effectiveReturnPath = returnPath ?? location.state?.returnPath;
  const effectiveReturnState = returnState ?? location.state?.returnState;
  const openCreate = !!location.state?.openCreate;
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    accountName: '',
    bankName: '',
    ifsc: '',
    accountNumber: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  // Auto-open form if redirected from expense form
  useEffect(() => {
    if (effectiveReturnPath || openCreate) {
      setShowForm(true);
      setEditingAccount(null);
      setFormData({ accountName: '', bankName: '', ifsc: '', accountNumber: '' });
    }
  }, [effectiveReturnPath, openCreate]);

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      const response = await bankAccountAPI.getAll();
      setBankAccounts(response.data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      showToast('Failed to fetch bank accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAccount(null);
    setFormData({ accountName: '', bankName: '', ifsc: '', accountNumber: '', isActive: true });
    setShowForm(true);
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      accountName: account.accountName || '',
      bankName: account.bankName || '',
      ifsc: account.ifsc || '',
      accountNumber: account.accountNumber || '',
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
      await bankAccountAPI.delete(deleteConfirm.id);
      showToast('Bank account deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
      fetchBankAccounts();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      showToast(error.response?.data?.message || 'Failed to delete bank account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.accountName.trim()) {
      showToast('Account name is required', 'error');
      return;
    }
    if (!formData.bankName.trim()) {
      showToast('Bank name is required', 'error');
      return;
    }

    try {
      if (editingAccount) {
        await bankAccountAPI.update(editingAccount._id, formData);
        showToast('Bank account updated successfully!', 'success');
      } else {
        const createdRes = await bankAccountAPI.create(formData);
        showToast('Bank account created successfully!', 'success');

        // If redirected from another screen, return and auto-select the new bank account
        const createdName = createdRes?.data?.accountName || formData.accountName?.trim() || '';
        if (effectiveReturnPath && createdName) {
          navigate(effectiveReturnPath, {
            state: {
              ...(effectiveReturnState || {}),
              bankAccountCreatedName: createdName,
            },
            replace: false,
          });
          setShowForm(false);
          setEditingAccount(null);
          await fetchBankAccounts();
          return;
        }
      }
      setShowForm(false);
      setEditingAccount(null);
      await fetchBankAccounts();
      
      // If redirected from expense form, navigate back
      if (effectiveReturnPath) {
        navigate(effectiveReturnPath, {
          state: effectiveReturnState || { showExpenseForm: true },
          replace: false
        });
      }
    } catch (error) {
      console.error('Error saving bank account:', error);
      showToast(error.response?.data?.message || 'Failed to save bank account', 'error');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAccount(null);
    
    // If redirected from expense form, navigate back
    if (effectiveReturnPath) {
      navigate(effectiveReturnPath, {
        state: effectiveReturnState || { showExpenseForm: true },
        replace: false
      });
    }
  };

  const filteredBankAccounts = filterBySearchQuery(
    bankAccounts,
    searchQuery,
    moduleSearchConfig.bankAccounts
  );

  if (loading && bankAccounts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading bank accounts...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2">Bank Account Master</h1>
          <p className="text-slate-600">Manage bank accounts (account name, bank name, IFSC, account number, etc.)</p>
        </div>
        <div className="flex items-center gap-3">
          {bankAccounts.length > 0 && (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search bank accounts..."
            />
          )}
          <button onClick={handleCreate} className="btn-primary flex items-center space-x-2">
            <span>+</span>
            <span>Add Bank Account</span>
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
                {editingAccount ? 'Edit Bank Account' : 'Create Bank Account'}
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
                      Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                      placeholder="e.g., Kology ICICI"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                      placeholder="e.g., ICICI Bank"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={formData.ifsc}
                      onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm uppercase"
                      placeholder="e.g., ICIC0001234"
                      maxLength="11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      {/* Opening Balance removed */}
                    </label>
                  </div>
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

      {bankAccounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-2">No bank accounts found</p>
          <p className="text-sm text-gray-500 mb-6">Get started by creating your first bank account</p>
          <button 
            onClick={handleCreate} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm"
          >
            Create Bank Account
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Account Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Bank Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">IFSC</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Account Number</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBankAccounts.map((account) => (
                  <tr key={account._id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{account.accountName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{account.bankName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{account.ifsc || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{account.accountNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <ActionDropdown onEdit={() => handleEdit(account)} onDelete={() => handleDelete(account._id)} />
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
        message="Are you sure you want to delete this bank account? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />
    </div>
  );
};

export default BankAccountMaster;
