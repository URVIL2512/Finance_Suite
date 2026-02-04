import { useState, useEffect } from 'react';
import { adminAPI, authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const ProfileModal = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUserProfile();
    }
  }, [isOpen]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      showToast('Failed to load profile information', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const isAdmin = (user?.role || '').toString().trim().toLowerCase() === 'admin';


  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    try {
      setUpdatingPassword(true);
      await adminAPI.changePassword(newPassword);
      showToast('Password updated successfully', 'success');
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Change password error:', error);
      showToast(error.response?.data?.message || 'Failed to update password', 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Profile</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors text-2xl font-bold leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : user ? (
            <div className="space-y-6">
              {/* User Avatar */}
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-3xl font-bold">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* User Information */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Username
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900 font-medium">{user.name || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Email Address
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900 font-medium break-all">{user.email || 'N/A'}</p>
                  </div>
                </div>

                {user.phone && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Phone Number
                    </label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-900 font-medium">{user.phone}</p>
                    </div>
                  </div>
                )}

                {/* Role & Access summary */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Role
                    </label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between gap-3">
                      <p className="text-gray-900 font-semibold capitalize">
                        {user.role || 'user'}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                          isAdmin
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {isAdmin ? 'Full access (Admin)' : 'Limited access'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Account Status
                    </label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between gap-3">
                      <p className="text-gray-900 font-medium capitalize">
                        {user.status || 'active'}
                      </p>
                      <span
                        className={`inline-flex h-2.5 w-2.5 rounded-full ${
                          (user.status || 'active') === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Module-level permissions */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Module Access
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-3">
                      These permissions control which sections are visible in your left sidebar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['expenses', 'sales', 'revenue'].map((key) => {
                        // const enabled = isAdmin || !!user.permissions?.[key];
                        const enabled = isAdmin || user.permissions?.[key] === true;

                        const label =
                          key === 'expenses' ? 'Expenses' : key === 'sales' ? 'Sales' : 'Revenue';
                        return (
                          <div
                            key={key}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border ${
                              enabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-flex h-1.5 w-1.5 rounded-full ${
                                enabled ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            />
                            <span>{label}</span>
                            <span className="text-[10px] uppercase tracking-wide">
                              {enabled ? 'Allowed' : 'No access'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Change Password</p>
                      <p className="text-xs text-gray-600">Admin only</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(true)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Failed to load profile information</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>

      {showChangePassword && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => {
            if (updatingPassword) return;
            setShowChangePassword(false);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Change Password</h3>
              <button
                type="button"
                onClick={() => {
                  if (updatingPassword) return;
                  setShowChangePassword(false);
                }}
                className="text-white hover:text-gray-200 transition-colors text-2xl font-bold leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-field"
                  minLength={6}
                  disabled={updatingPassword}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-field"
                  minLength={6}
                  disabled={updatingPassword}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  disabled={updatingPassword}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileModal;
