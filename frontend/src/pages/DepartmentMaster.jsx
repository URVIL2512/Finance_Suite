import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { departmentAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';
import ActionDropdown from '../components/ActionDropdown';
import SearchBar from '../components/SearchBar';
import { filterBySearchQuery, moduleSearchConfig } from '../utils/searchUtils';

const DepartmentMaster = ({ returnPath, returnState }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', isActive: true });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRows();
  }, []);

  // Auto-open form if redirected from expense form
  useEffect(() => {
    if (returnPath) {
      setShowForm(true);
      setEditing(null);
      setForm({ name: '', isActive: true });
    }
  }, [returnPath]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await departmentAPI.getAll();
      setRows(res.data || []);
    } catch (e) {
      console.error('Error fetching departments:', e);
      showToast('Failed to fetch departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditing(null);
    setForm({ name: '', isActive: true });
    setShowForm(true);
  };

  const handleEdit = (row) => {
    setEditing(row);
    setForm({
      name: row?.name || '',
      isActive: row?.isActive !== false,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);

    if (returnPath) {
      navigate(returnPath, {
        state: returnState || {},
        replace: false,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Department name is required', 'error');
      return;
    }

    try {
      if (editing) {
        await departmentAPI.update(editing._id, form);
        showToast('Department updated successfully!', 'success');
      } else {
        await departmentAPI.create(form);
        showToast('Department created successfully!', 'success');
      }
      setShowForm(false);
      setEditing(null);
      await fetchRows();

      if (returnPath) {
        navigate(returnPath, {
          state: returnState || {},
          replace: false,
        });
      }
    } catch (e2) {
      console.error('Error saving department:', e2);
      showToast(e2.response?.data?.message || 'Failed to save department', 'error');
    }
  };

  const handleDelete = (id) => setDeleteConfirm({ show: true, id });

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      setDeleting(true);
      await departmentAPI.delete(deleteConfirm.id);
      showToast('Department deleted successfully!', 'success');
      setDeleteConfirm({ show: false, id: null });
      await fetchRows();
    } catch (e) {
      console.error('Error deleting department:', e);
      showToast(e.response?.data?.message || 'Failed to delete department', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredRows = filterBySearchQuery(
    rows,
    searchQuery,
    moduleSearchConfig.departments
  );

  if (loading && rows.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 font-medium">Loading departments...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Department Master</h1>
          <p className="text-gray-600 text-sm">Manage departments used in expenses</p>
        </div>
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search departments..."
            />
          )}
          <button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Department
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={handleCancel}>
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {editing ? 'Edit Department' : 'Create Department'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-slate-300 hover:text-white hover:bg-white/10 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 font-light text-xl"
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                    placeholder="e.g., OPERATION, WEBSITE"
                    required
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="dept-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="dept-active" className="text-sm font-semibold text-gray-700">
                    Active
                  </label>
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

      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">No departments found</h3>
          <p className="text-gray-600 mb-6">Create departments to use in Expense entries.</p>
          <button onClick={handleCreate} className="btn-primary">
            Add Department
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{r.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex items-center justify-end">
                        <ActionDropdown
                          onEdit={() => handleEdit(r)}
                          onDelete={() => handleDelete(r._id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this department?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
        loading={deleting}
      />
    </div>
  );
};

export default DepartmentMaster;

