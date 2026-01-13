import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import revenueRoutes from './routes/revenueRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import salespersonRoutes from './routes/salespersonRoutes.js';
import hsnSacRoutes from './routes/hsnSacRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import recurringInvoiceRoutes from './routes/recurringInvoiceRoutes.js';
import recurringExpenseRoutes from './routes/recurringExpenseRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import { startRecurringInvoiceScheduler } from './utils/recurringInvoiceScheduler.js';
import { startRecurringExpenseScheduler } from './utils/recurringExpenseScheduler.js';

dotenv.config();

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
    message: 'Finance Suite API',
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
    documentation: 'This is the backend API for Finance Suite. Use /api/health to check server status.'
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
app.use('/api/salespersons', salespersonRoutes);
app.use('/api/hsn-sac', hsnSacRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/recurring-invoices', recurringInvoiceRoutes);
app.use('/api/recurring-expenses', recurringExpenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ledger', ledgerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Finance Suite API is running' });
});

// Error handling middleware
app.use(errorHandler);

// Import database connection
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

// Start server immediately (for Render health checks)
// Database connection happens in background
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  
  // Connect to database in background (non-blocking)
  connectDB()
    .then(() => {
      console.log('✅ Database connection established');
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

