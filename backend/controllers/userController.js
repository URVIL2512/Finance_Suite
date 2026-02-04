import User from '../models/User.js';
import UserAuditLog from '../models/UserAuditLog.js';
import bcrypt from 'bcryptjs';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(str) {
  return typeof str === 'string' && emailRegex.test(str.trim());
}

async function logAudit(userId, action, performedBy, details = null) {
  try {
    await UserAuditLog.create({ userId, action, performedBy, details });
  } catch (e) {
    console.error('UserAuditLog create error:', e);
  }
}

// @desc    Create user (admin only)
// @route   POST /api/users/create
// @access  Private/Admin
export const createUser = async (req, res) => {
  try {
    const { fullName, username, email, password, role, status } = req.body;
    const adminId = req.user._id;

    if (!fullName || String(fullName).trim() === '') {
      return res.status(400).json({ message: 'Full name is required' });
    }
    if (!username || String(username).trim() === '') {
      return res.status(400).json({ message: 'Username is required' });
    }
    if (!email || String(email).trim() === '') {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const r = (role || 'user').toLowerCase();
    if (!['admin', 'user'].includes(r)) {
      return res.status(400).json({ message: 'Role must be Admin or User' });
    }
    const s = (status || 'active').toLowerCase();
    if (!['active', 'inactive'].includes(s)) {
      return res.status(400).json({ message: 'Status must be Active or Inactive' });
    }

    const un = String(username).trim().toLowerCase();
    if (/\s/.test(un)) {
      return res.status(400).json({ message: 'Username cannot contain spaces' });
    }
    const em = String(email).trim().toLowerCase();
    const existingUsername = await User.findOne({ username: un });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const existingEmail = await User.findOne({ email: em });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name: String(fullName).trim(),
      username: un,
      email: em,
      password: String(password),
      role: r,
      status: s,
      createdBy: adminId,
      updatedBy: adminId,
    });

    await logAudit(user._id, 'created', adminId, { fullName: user.name, username: user.username, email: user.email, role: user.role, status: user.status });

    const u = await User.findById(user._id).select('-password').lean();
    u.createdAt = u.createdAt ? new Date(u.createdAt).toISOString() : null;
    res.status(201).json(u);
  } catch (error) {
    if (error.code === 11000) {
      const field = error.message.includes('username') ? 'Username' : 'Email';
      return res.status(400).json({ message: `${field} already exists` });
    }
    console.error('Create user error:', error);
    res.status(500).json({ message: error.message || 'Failed to create user' });
  }
};

// @desc    List users with search, filters, pagination, sort
// @route   GET /api/users/list
// @access  Private/Admin
export const listUsers = async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
    const sortField = sortBy === 'createdDate' ? 'createdAt' : (sortBy || 'createdAt');
    const order = (sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const filter = {};
    if (role && ['admin', 'user'].includes(String(role).toLowerCase())) {
      filter.role = String(role).toLowerCase();
    }
    if (status && ['active', 'inactive'].includes(String(status).toLowerCase())) {
      filter.status = String(status).toLowerCase();
    }
    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { username: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ [sortField]: order }).skip(skip).limit(Math.min(100, Math.max(1, parseInt(limit, 10)))).lean(),
      User.countDocuments(filter),
    ]);

    const items = users.map((u) => ({
      ...u,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
    }));

    res.json({ users: items, total, page: Math.max(1, parseInt(page, 10)), limit: Math.min(100, Math.max(1, parseInt(limit, 10))) });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: error.message || 'Failed to list users' });
  }
};

// @desc    Update user (admin only)
// @route   PUT /api/users/update/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, username, email, role, status } = req.body;
    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = {};
    const details = {};

    if (fullName !== undefined && String(fullName).trim()) {
      updates.name = String(fullName).trim();
      details.name = updates.name;
    }
    if (username !== undefined) {
      const un = String(username).trim().toLowerCase();
      if (!un) {
        return res.status(400).json({ message: 'Username cannot be empty' });
      }
      if (/\s/.test(un)) {
        return res.status(400).json({ message: 'Username cannot contain spaces' });
      }
      const existing = await User.findOne({ username: un, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      updates.username = un;
      details.username = un;
    }
    if (email !== undefined) {
      const em = String(email).trim().toLowerCase();
      if (!em) {
        return res.status(400).json({ message: 'Email cannot be empty' });
      }
      if (!isValidEmail(em)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existing = await User.findOne({ email: em, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      updates.email = em;
      details.email = em;
    }
    if (role !== undefined) {
      const r = String(role).toLowerCase();
      if (!['admin', 'user'].includes(r)) {
        return res.status(400).json({ message: 'Role must be Admin or User' });
      }
      if (user.role === 'admin' && r === 'user') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot demote the last admin user' });
        }
      }
      updates.role = r;
      details.role = r;
    }
    if (status !== undefined) {
      const s = String(status).toLowerCase();
      if (!['active', 'inactive'].includes(s)) {
        return res.status(400).json({ message: 'Status must be Active or Inactive' });
      }
      updates.status = s;
      details.status = s;
    }

    if (Object.keys(updates).length === 0) {
      const u = await User.findById(id).select('-password').lean();
      u.createdAt = u.createdAt ? new Date(u.createdAt).toISOString() : null;
      u.updatedAt = u.updatedAt ? new Date(u.updatedAt).toISOString() : null;
      return res.json(u);
    }

    const roleChanged = updates.role !== undefined && updates.role !== user.role;
    const statusChanged = updates.status !== undefined && updates.status !== user.status;
    if (roleChanged || statusChanged) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      updates.tokenVersion = user.tokenVersion;
    }

    updates.updatedBy = adminId;
    Object.assign(user, updates);
    await user.save();

    const action = roleChanged ? 'role_change' : (statusChanged ? 'status_change' : 'updated');
    await logAudit(user._id, action, adminId, details);

    const out = await User.findById(id).select('-password').lean();
    out.createdAt = out.createdAt ? new Date(out.createdAt).toISOString() : null;
    out.updatedAt = out.updatedAt ? new Date(out.updatedAt).toISOString() : null;
    res.json(out);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ message: error.message || 'Failed to update user' });
  }
};

// @desc    Update user status (admin only)
// @route   PUT /api/users/status/:id
// @access  Private/Admin
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user._id;

    const s = (status || '').toLowerCase();
    if (!['active', 'inactive'].includes(s)) {
      return res.status(400).json({ message: 'Status must be Active or Inactive' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = s;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.updatedBy = adminId;
    await user.save();

    await logAudit(user._id, 'status_change', adminId, { status: s });

    const out = await User.findById(id).select('-password').lean();
    out.createdAt = out.createdAt ? new Date(out.createdAt).toISOString() : null;
    out.updatedAt = out.updatedAt ? new Date(out.updatedAt).toISOString() : null;
    res.json(out);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: error.message || 'Failed to update status' });
  }
};

// @desc    Reset user password (admin only)
// @route   PUT /api/users/reset-password/:id
// @access  Private/Admin
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const adminId = req.user._id;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = String(newPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.updatedBy = adminId;
    await user.save();

    await logAudit(user._id, 'password_reset', adminId, {});

    const out = await User.findById(id).select('-password').lean();
    out.createdAt = out.createdAt ? new Date(out.createdAt).toISOString() : null;
    out.updatedAt = out.updatedAt ? new Date(out.updatedAt).toISOString() : null;
    res.json(out);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message || 'Failed to reset password' });
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/users/delete/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    if (id === adminId.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }

    await User.findByIdAndDelete(id);
    await logAudit(id, 'deleted', adminId, { username: user.username, email: user.email });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete user' });
  }
};
