import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ message: 'Your account is disabled. Contact administrator.' });
    }

    const currentVersion = user.tokenVersion ?? 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (currentVersion !== tokenVersion) {
      return res.status(401).json({ message: 'Session invalidated. Please log in again.' });
    }

    // Normalize role/permissions for consistent RBAC checks
    const normalizedRole = String(user.role || 'user').trim().toLowerCase();
    user.role = normalizedRole;
    if (!user.permissions || typeof user.permissions !== 'object') {
      user.permissions = { expenses: false, sales: false, revenue: false };
    }
    if (normalizedRole === 'admin') {
      user.permissions.expenses = true;
      user.permissions.sales = true;
      user.permissions.revenue = true;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

/** Require admin role. Must be used after protect(). */
export const requireAdmin = (req, res, next) => {
  if (req.user && String(req.user.role || '').toLowerCase() === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
};

/** Require module permission. Admin always bypasses. Must be used after protect(). */
export const requireModuleAccess = (moduleKey) => (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'admin') return next();

  const allowed = req.user?.permissions?.[moduleKey] === true;
  if (allowed) return next();

  return res.status(403).json({ message: `Access denied: ${moduleKey} module` });
};

