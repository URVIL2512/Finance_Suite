import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { bankAccountAPI } from '../services/api';
import ActionDropdown from '../components/ActionDropdown';
import { useToast } from '../contexts/ToastContext';

const BankAccountMaster = () => {
  const { showToast } = useToast();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    accountName: '',
    bankName: '',
    ifsc: '',
    accountNumber: '',
    openingBalance: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchBankAccounts();
  }, []);

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
    setFormData({ accountName: '', bankName: '', ifsc: '', accountNumber: '', openingBalance: 0, isActive: true });
    setShowForm(true);
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      accountName: account.accountName || '',
      bankName: account.bankName || '',
      ifsc: account.ifsc || '',
      accountNumber: account.accountNumber || '',
      openingBalance: account.openingBalance || 0,
      isActive: account.isActive !== false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this bank account?')) {
      try {
        await bankAccountAPI.delete(id);
        showToast('Bank account deleted successfully!', 'success');
        fetchBankAccounts();
      } catch (error) {
        console.error('Error deleting bank account:', error);
        showToast(error.response?.data?.message || 'Failed to delete bank account', 'error');
      }
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
        await bankAccountAPI.create(formData);
        showToast('Bank account created successfully!', 'success');
      }
      setShowForm(false);
      setEditingAccount(null);
      fetchBankAccounts();
    } catch (error) {
      console.error('Error saving bank account:', error);
      showToast(error.response?.data?.message || 'Failed to save bank account', 'error');
    }
  };

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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2">Bank Account Master</h1>
          <p className="text-slate-600">Manage bank accounts (account name, bank name, IFSC, account number, etc.)</p>
        </div>
        <button onClick={handleCreate} className="btn-primary flex items-center space-x-2">
          <span>+</span>
          <span>Add Bank Account</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h2 className="text-xl font-bold">{editingAccount ? 'Edit Bank Account' : 'New Bank Account'}</h2>
              <button onClick={() => { setShowForm(false); setEditingAccount(null); }} className="text-white hover:text-red-200 text-2xl font-bold">×</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Account Name *</label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Kology ICICI"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name *</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., ICICI Bank"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., ICIC0001234"
                    maxLength="11"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Opening Balance</label>
                  <input
                    type="number"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
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
                <button type="button" onClick={() => { setShowForm(false); setEditingAccount(null); }} className="px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bankAccounts.length === 0 ? (
        <div className="card-gradient p-12 text-center border border-gray-200/60">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-lg font-semibold text-gray-700 mb-2">No bank accounts found</p>
          <p className="text-sm text-gray-500">Add your first bank account to get started</p>
        </div>
      ) : (
        <div className="card overflow-hidden border border-gray-200/60 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Account Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Bank Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">IFSC</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Account Number</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Opening Balance</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bankAccounts.map((account) => (
                  <tr key={account._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{account.accountName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{account.bankName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{account.ifsc || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{account.accountNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      ₹{account.openingBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${account.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
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
    </div>
  );
};

export default BankAccountMaster;
