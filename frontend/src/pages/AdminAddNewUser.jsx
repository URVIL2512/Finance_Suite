import { useMemo, useState } from 'react';
import { adminAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AdminAddNewUser = () => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'User',
    permissions: { expenses: false, sales: false, revenue: false },
  });

  const isUserRole = useMemo(() => String(form.role || '').toLowerCase() !== 'admin', [form.role]);

  const validate = () => {
    if (!form.username.trim()) return 'Username is required';
    if (!form.email.trim()) return 'Email is required';
    if (!EMAIL_REGEX.test(form.email.trim())) return 'Invalid email format';
    if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      showToast(err, 'error');
      return;
    }

    try {
      setSaving(true);
      await adminAPI.createUser({
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        permissions: isUserRole ? form.permissions : undefined,
      });
      showToast('User created successfully', 'success');
      setForm({
        username: '',
        email: '',
        password: '',
        role: 'User',
        permissions: { expenses: false, sales: false, revenue: false },
      });
    } catch (error) {
      console.error('Admin create user error:', error);
      showToast(error.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Add New User</h2>
        <p className="text-gray-600 text-sm mt-1">Create users and assign access permissions.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 sm:p-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="input-field"
                autoComplete="username"
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Email ID</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="input-field"
                autoComplete="email"
                required
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="input-field"
                autoComplete="new-password"
                required
                minLength={6}
                disabled={saving}
              />
              <p className="text-xs text-gray-500">Minimum 6 characters</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Role</label>
              <select
                value={form.role}
                onChange={(e) => {
                  const nextRole = e.target.value;
                  setForm((p) => ({
                    ...p,
                    role: nextRole,
                    permissions:
                      String(nextRole).toLowerCase() === 'admin'
                        ? { expenses: true, sales: true, revenue: true }
                        : p.permissions,
                  }));
                }}
                className="select-field w-full"
                disabled={saving}
              >
                <option value="Admin">Admin</option>
                <option value="User">User</option>
              </select>
            </div>
          </div>

          {isUserRole && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-slate-900">Permissions</h3>
                <p className="text-xs text-slate-600">Select module access for this user.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form.permissions.expenses}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, permissions: { ...p.permissions, expenses: e.target.checked } }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    disabled={saving}
                  />
                  Expenses Access
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form.permissions.sales}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, permissions: { ...p.permissions, sales: e.target.checked } }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    disabled={saving}
                  />
                  Sales Access
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form.permissions.revenue}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, permissions: { ...p.permissions, revenue: e.target.checked } }))
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    disabled={saving}
                  />
                  Revenue Access
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminAddNewUser;

