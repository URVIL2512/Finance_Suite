import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!email || String(email).trim() === '') {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user exists (email required)
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone: phone || undefined,
      password,
    });

    if (user) {
      const tokenVersion = user.tokenVersion ?? 0;
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id, tokenVersion),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Auth user & get token (login by email or username)
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const loginId = (email || username || '').toString().trim().toLowerCase();
    if (!loginId || !password) {
      return res.status(400).json({ message: 'Email or username and password are required' });
    }

    const isEmail = loginId.includes('@');
    const user = await User.findOne(
      isEmail ? { email: loginId } : { username: loginId }
    );

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (user.status !== 'active') {
      return res.status(401).json({ message: 'Your account is disabled. Contact administrator.' });
    }

    // Update last login timestamp (without re-hashing password)
    user.lastLoginAt = new Date();
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      token: generateToken(user._id, user.tokenVersion),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    // `protect` already loaded and normalized req.user (role + permissions)
    const u = req.user?.toObject ? req.user.toObject() : req.user;
    res.json(u);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

