import User from '../models/User.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createUserAsAdmin = async (req, res) => {
  try {
    const { username, email, password, role, permissions } = req.body;

    const un = String(username || '').trim();
    const em = String(email || '').trim().toLowerCase();
    const pw = String(password || '');
    const r = String(role || 'User').trim().toLowerCase() === 'admin' ? 'admin' : 'user';

    if (!un) return res.status(400).json({ message: 'Username is required' });
    if (!em) return res.status(400).json({ message: 'Email is required' });
    if (!emailRegex.test(em)) return res.status(400).json({ message: 'Invalid email format' });
    if (!pw || pw.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existingEmail = await User.findOne({ email: em }).lean();
    if (existingEmail) return res.status(400).json({ message: 'Email already registered' });

    const unameKey = un.toLowerCase();
    const existingUsername = await User.findOne({ username: unameKey }).lean();
    if (existingUsername) return res.status(400).json({ message: 'Username already exists' });

    const perms =
      r === 'admin'
        ? { expenses: true, sales: true, revenue: true }
        : {
            expenses: !!permissions?.expenses,
            sales: !!permissions?.sales,
            revenue: !!permissions?.revenue,
          };

    const user = await User.create({
      name: un,
      username: unameKey,
      email: em,
      password: pw,
      role: r,
      permissions: perms,
      status: 'active',
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    const out = await User.findById(user._id).select('-password').lean();
    res.status(201).json(out);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    console.error('Admin create-user error:', error);
    res.status(500).json({ message: error?.message || 'Failed to create user' });
  }
};

export const changeOwnAdminPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const pw = String(newPassword || '');
    if (!pw || pw.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user.role || '').toLowerCase() !== 'admin') return res.status(403).json({ message: 'Admin access required' });

    user.password = pw;
    user.updatedBy = user._id;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Admin change-password error:', error);
    res.status(500).json({ message: error?.message || 'Failed to update password' });
  }
};

export const ensureDefaultAdmin = async () => {
  const email = 'akshay@gmail.com';
  const existing = await User.findOne({ email });
  if (existing) {
    const existingRole = String(existing.role || '').trim().toLowerCase();
    const desiredPerms = { expenses: true, sales: true, revenue: true };
    const nextRole = 'admin';
    const nextStatus = 'active';

    const needsUpdate =
      existingRole !== nextRole ||
      existing.status !== nextStatus ||
      !existing.permissions ||
      existing.permissions.expenses !== true ||
      existing.permissions.sales !== true ||
      existing.permissions.revenue !== true;

    if (needsUpdate) {
      existing.role = nextRole;
      existing.status = nextStatus;
      existing.permissions = desiredPerms;
      // Force re-login if something was out of sync
      existing.tokenVersion = (existing.tokenVersion || 0) + 1;
      await existing.save();
    }
    return;
  }

  await User.create({
    name: 'Akshay',
    username: 'akshay',
    email,
    password: '123456',
    role: 'admin',
    permissions: { expenses: true, sales: true, revenue: true },
    status: 'active',
  });
};

