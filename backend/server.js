import './config/env.js'; // Load environment variables first
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cloudinary from 'cloudinary';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import revenueRoutes from './routes/revenueRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import recurringInvoiceRoutes from './routes/recurringInvoiceRoutes.js';
import recurringExpenseRoutes from './routes/recurringExpenseRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import paymentModeRoutes from './routes/paymentModeRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import bankAccountRoutes from './routes/bankAccountRoutes.js';
import expenseCategoryRoutes from './routes/expenseCategoryRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import currencyRoutes from './routes/currencyRoutes.js';
import { startRecurringInvoiceScheduler } from './utils/recurringInvoiceScheduler.js';
import { startRecurringExpenseScheduler } from './utils/recurringExpenseScheduler.js';
import { verifyBrevoSMTP } from './utils/emailService.js';
import { initializeCurrencyService } from './services/currencyService.js';
import PaymentMode from './models/PaymentMode.js';
import { ensureDefaultAdmin } from './controllers/adminController.js';

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const app = express();

// Middleware
// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, {
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query,
      headers: { authorization: req.headers.authorization ? 'Bearer ***' : 'none' }
    });
    next();
  });
}

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    message: 'Kology Suite API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      expenses: '/api/expenses',
      revenue: '/api/revenue',
      invoices: '/api/invoices',
      customers: '/api/customers',
      items: '/api/items',
      payments: '/api/payments',
      ledger: '/api/ledger',
      dashboard: '/api/dashboard'
    },
    documentation: 'This is the backend API for Kology Suite. Use /api/health to check server status.'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/recurring-invoices', recurringInvoiceRoutes);
app.use('/api/recurring-expenses', recurringExpenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/payment-modes', paymentModeRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/users', userRoutes);
// Admin user management alias routes (for clearer admin namespace)
app.use('/api/admin/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/currency', currencyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Kology Suite API is running' });
});

// Error handling middleware
app.use(errorHandler);

// Import database connection
import connectDB from './config/db.js';

// Server configuration - Port 5004 ready
const PORT = process.env.PORT || 5004;

// Start server immediately (for Render health checks)
// Database connection happens in background
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize currency service on startup
  initializeCurrencyService()
    .then((result) => {
      console.log('✅ Currency service initialized:', result.success ? 'with live rates' : 'with fallback rates');
    })
    .catch((error) => {
      console.error('❌ Currency service initialization failed (using fallback rates):', error.message);
    });
  
  // Verify Brevo API key on startup
  verifyBrevoSMTP()
    .catch((error) => {
      console.error('❌ Brevo API initialization failed (server still running):', error.message);
      // Server continues running even if Brevo API initialization fails
    });

  // Connect to database in background (non-blocking)
  connectDB()
    .then(() => {
      console.log('✅ Database connection established');
      ensureDefaultAdmin().catch((e) => {
        console.warn('⚠️ Default admin seed failed:', e?.message || e);
      });
      // Ensure per-user uniqueness indexes are correct (removes legacy global-unique index on PaymentMode.name)
      PaymentMode.syncIndexes().catch((e) => {
        console.warn('⚠️ PaymentMode index sync failed:', e?.message || e);
      });
      // Start recurring invoice scheduler after DB connection
      startRecurringInvoiceScheduler();
      // Start recurring expense scheduler after DB connection
      startRecurringExpenseScheduler();
    })
    .catch((error) => {
      console.error('❌ Database connection failed (server still running):', error.message);
      // Server continues running even if DB connection fails
      // This allows Render health checks to pass
    });
});

