import Expense from '../models/Expense.js';
import RecurringExpense from '../models/RecurringExpense.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import PaymentMode from '../models/PaymentMode.js';
import Vendor from '../models/Vendor.js';
import BankAccount from '../models/BankAccount.js';
import Department from '../models/Department.js';
import { generateExpensesPDF } from '../utils/expensePdfGenerator.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import cloudinary from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const normalizePayment = ({ totalAmount, paidAmount }) => {
  const total = Math.max(0, parseFloat(totalAmount) || 0);
  const paidRaw = parseFloat(paidAmount) || 0;
  const paid = total > 0 ? clamp(paidRaw, 0, total) : 0;
  const epsilon = 0.01;
  let status = 'Unpaid';
  if (total > 0 && paid >= total - epsilon) status = 'Paid';
  else if (paid > epsilon) status = 'Partial';
  return { total, paid, status };
};

const normalizeCategoryName = (name) => String(name || '').trim();

const getTypeFromCategory = async (userId, categoryName) => {
  const name = normalizeCategoryName(categoryName);
  if (!name) return null;
  const cat = await ExpenseCategory.findOne({ user: userId, name }).select('costType').lean();
  return cat?.costType || null;
};

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res) => {
  try {
    const { year, month, category, department } = req.query;
    const filter = { user: req.user._id };

    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;
    if (category) filter.category = category;
    if (department) filter.department = department;

    const expenses = await Expense.find(filter)
      .select('-__v')
      .sort({ date: -1, createdAt: -1 })
      .lean();
    
    // Automatically remove duplicates (keep the oldest one based on createdAt)
    const seenExpenses = new Map();
    const duplicateIds = [];
    
    expenses.forEach(expense => {
      // Create a unique key based on vendor, category, date, totalAmount, department
      const expenseDate = expense.date ? new Date(expense.date) : new Date();
      expenseDate.setHours(0, 0, 0, 0);
      
      const key = JSON.stringify({
        vendor: (expense.vendor || '').trim(),
        category: (expense.category || '').trim(),
        department: (expense.department || '').trim(),
        totalAmount: parseFloat(expense.totalAmount) || 0,
        date: expenseDate.toISOString().split('T')[0], // YYYY-MM-DD format
      });
      
      if (seenExpenses.has(key)) {
        // Duplicate found - compare createdAt to keep the oldest
        const existing = seenExpenses.get(key);
        const existingDate = new Date(existing.createdAt);
        const currentDate = new Date(expense.createdAt);
        
        if (currentDate < existingDate) {
          // Current is older, mark existing as duplicate
          duplicateIds.push(existing._id);
          seenExpenses.set(key, expense);
        } else {
          // Existing is older, mark current as duplicate
          duplicateIds.push(expense._id);
        }
      } else {
        // First occurrence
        seenExpenses.set(key, expense);
      }
    });
    
    // Delete duplicates in bulk
    if (duplicateIds.length > 0) {
      try {
        await Expense.deleteMany({ _id: { $in: duplicateIds }, user: req.user._id });
        console.log(`Automatically deleted ${duplicateIds.length} duplicate expense(s) for user ${req.user._id}`);
      } catch (error) {
        console.error('Error deleting duplicates:', error);
        // Continue even if deletion fails
      }
    }
    
    // Filter out duplicates from the response
    const uniqueExpenses = expenses.filter(expense => !duplicateIds.includes(expense._id));
    
    // Ensure all expenses have complete data structure
    const expensesWithCompleteData = uniqueExpenses.map(expense => {
      // Ensure all numeric fields are numbers
      const numericFields = ['amountExclTax', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'totalAmount', 'paidAmount'];
      numericFields.forEach(field => {
        if (expense[field] === undefined || expense[field] === null) {
          expense[field] = 0;
        }
      });
      
      // Ensure string fields are strings
      const stringFields = ['vendor', 'description', 'bankAccount', 'paidTransactionRef', 'notes', 'invoiceUrl', 'executive', 'userName', 'userEmail', 'userPhone', 'createdBy', 'editedBy'];
      stringFields.forEach(field => {
        if (expense[field] === undefined || expense[field] === null) {
          expense[field] = '';
        }
      });
      
      // Guardrail: never allow paid > total in API responses (prevents negative due in UI)
      // But preserve "Cancel" status if it's already set
      const currentStatus = expense.status || 'Unpaid';
      const normalized = normalizePayment({
        totalAmount: expense.totalAmount,
        paidAmount: expense.paidAmount,
      });
      expense.totalAmount = normalized.total;
      expense.paidAmount = normalized.paid;
      expense.dueAmount = Math.max(0, normalized.total - normalized.paid);
      // Preserve Cancel status - don't override it
      if (currentStatus.toLowerCase() === 'cancel') {
        expense.status = 'Cancel';
      } else {
        expense.status = normalized.status;
      }

      return expense;
    });
    
    res.json(expensesWithCompleteData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
export const getExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = async (req, res) => {
  try {
    const expenseData = {
      ...req.body,
      user: req.user._id,
    };

    // Automatically set createdBy from logged-in user
    if (req.user && req.user.name) {
      expenseData.createdBy = req.user.name;
      // Also set userName from logged-in user if not provided
      if (!expenseData.userName) {
        expenseData.userName = req.user.name;
      }
      if (!expenseData.userEmail && req.user.email) {
        expenseData.userEmail = req.user.email;
      }
      if (!expenseData.userPhone && req.user.phone) {
        expenseData.userPhone = req.user.phone;
      }
    }

    // Ensure date is properly formatted
    if (expenseData.date) {
      expenseData.date = new Date(expenseData.date);
    }

    // Ensure month is set if not provided
    if (!expenseData.month && expenseData.date) {
      const date = new Date(expenseData.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      expenseData.month = monthNames[date.getMonth()];
    }

    // Ensure year is set if not provided
    if (!expenseData.year && expenseData.date) {
      expenseData.year = new Date(expenseData.date).getFullYear();
    }

    // Ensure numeric fields are numbers
    const numericFields = ['amountExclTax', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'totalAmount', 'paidAmount'];
    numericFields.forEach(field => {
      if (expenseData[field] !== undefined && expenseData[field] !== null) {
        expenseData[field] = parseFloat(expenseData[field]) || 0;
      }
    });

    // Production guardrail: paidAmount must never exceed totalAmount
    // But preserve "Cancel" status if it's explicitly set
    const requestedStatus = expenseData.status;
    const normalized = normalizePayment({
      totalAmount: expenseData.totalAmount,
      paidAmount: expenseData.paidAmount,
    });
    expenseData.totalAmount = normalized.total;
    expenseData.paidAmount = normalized.paid;
    expenseData.dueAmount = Math.max(0, normalized.total - normalized.paid);
    // Preserve Cancel status - don't auto-calculate if status is Cancel
    if (requestedStatus && requestedStatus.toLowerCase() === 'cancel') {
      expenseData.status = 'Cancel';
    } else {
      expenseData.status = normalized.status;
    }

    // If an expense is created already Paid/Partial, ensure the first payment history entry exists.
    // This makes "View History" work even for expenses created with an initial paidAmount.
    if (
      (!Array.isArray(expenseData.paymentHistory) || expenseData.paymentHistory.length === 0) &&
      expenseData.status !== 'Cancel' &&
      normalized.paid > 0.01
    ) {
      expenseData.paymentHistory = [
        {
          paymentDate: expenseData.date ? new Date(expenseData.date) : new Date(),
          amountPaid: Math.round(normalized.paid * 100) / 100,
          cumulativePaid: Math.round(normalized.paid * 100) / 100,
          status: normalized.status,
          transactionRef: expenseData.paidTransactionRef || '',
          notes: expenseData.notes || '',
          updatedBy: expenseData.createdBy || req.user?.name || '',
        },
      ];
    }

    // Cost type classification (Fixed vs Variable)
    // If type not provided or invalid, infer from Category Master.
    const requestedType = String(expenseData.type || '').trim();
    const validType = requestedType === 'Fixed' || requestedType === 'Variable';
    if (!validType) {
      const inferred = await getTypeFromCategory(req.user._id, expenseData.category);
      if (inferred) expenseData.type = inferred;
    }

    // Check for duplicate expense before creating
    // Duplicate = same vendor, category, date, totalAmount, department
    const expenseDate = expenseData.date ? new Date(expenseData.date) : new Date();
    const startOfDay = new Date(expenseDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(expenseDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const duplicateCheck = await Expense.findOne({
      user: req.user._id,
      vendor: expenseData.vendor || '',
      category: expenseData.category || '',
      department: expenseData.department || '',
      totalAmount: expenseData.totalAmount || 0,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    if (duplicateCheck) {
      // Duplicate found - return existing expense instead of creating new one
      return res.status(200).json({
        ...duplicateCheck.toObject(),
        message: 'Duplicate expense detected. Returning existing expense.'
      });
    }

    const expense = await Expense.create(expenseData);
    res.status(201).json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message || 'Failed to create expense entry' });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = async (req, res) => {
  try {
    // Automatically set editedBy from logged-in user
    if (req.user && req.user.name) {
      req.body.editedBy = req.user.name;
    }

    // Don't allow updating createdBy - preserve the original creator
    delete req.body.createdBy;
    // Don't update userName, userEmail, userPhone - preserve original creator's info
    delete req.body.userName;
    delete req.body.userEmail;
    delete req.body.userPhone;

    // Ensure date is properly formatted
    if (req.body.date) {
      req.body.date = new Date(req.body.date);
    }

    // Ensure month is set if not provided
    if (!req.body.month && req.body.date) {
      const date = new Date(req.body.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      req.body.month = monthNames[date.getMonth()];
    }

    // Ensure year is set if not provided
    if (!req.body.year && req.body.date) {
      req.body.year = new Date(req.body.date).getFullYear();
    }

    // Ensure numeric fields are numbers
    const numericFields = ['amountExclTax', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'totalAmount', 'paidAmount'];
    numericFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        req.body[field] = parseFloat(req.body[field]) || 0;
      }
    });

    // Fetch existing expense to enforce invariant: paidAmount <= totalAmount
    const existingExpense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
    if (!existingExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const existingNormalized = normalizePayment({
      totalAmount: existingExpense.totalAmount,
      paidAmount: existingExpense.paidAmount,
    });

    const nextTotalCandidate =
      req.body.totalAmount !== undefined ? req.body.totalAmount : existingExpense.totalAmount;
    const nextPaidCandidate =
      req.body.paidAmount !== undefined ? req.body.paidAmount : existingExpense.paidAmount;

    const nextNormalized = normalizePayment({
      totalAmount: nextTotalCandidate,
      paidAmount: nextPaidCandidate,
    });

    const hasInvalidExisting =
      (parseFloat(existingExpense.totalAmount) || 0) > 0 &&
      (parseFloat(existingExpense.paidAmount) || 0) > (parseFloat(existingExpense.totalAmount) || 0) + 0.01;

    const shouldNormalize =
      req.body.totalAmount !== undefined || req.body.paidAmount !== undefined || hasInvalidExisting;

    if (shouldNormalize) {
      req.body.totalAmount = nextNormalized.total;
      req.body.paidAmount = nextNormalized.paid;
      req.body.dueAmount = Math.max(0, nextNormalized.total - nextNormalized.paid);
      // Preserve Cancel status - don't auto-calculate if status is Cancel
      const currentStatus = req.body.status !== undefined ? req.body.status : existingExpense.status;
      if (currentStatus && currentStatus.toLowerCase() === 'cancel') {
        req.body.status = 'Cancel';
      } else {
        req.body.status = nextNormalized.status;
      }
    }

    // Cost type classification (Fixed vs Variable)
    // If type not provided or invalid, infer from Category Master.
    const requestedType = String(req.body.type || '').trim();
    const validType = requestedType === 'Fixed' || requestedType === 'Variable';
    if (!validType) {
      const nextCategory = req.body.category !== undefined ? req.body.category : existingExpense.category;
      const inferred = await getTypeFromCategory(req.user._id, nextCategory);
      if (inferred) req.body.type = inferred;
    }

    // Payment history tracking (based on normalized values so we never record over-payments)
    if (shouldNormalize) {
      const oldPaid = existingNormalized.paid;
      const newPaid = nextNormalized.paid;
      const delta = newPaid - oldPaid;

      if (delta > 0.001) {
        const paymentEntry = {
          paymentDate: new Date(),
          amountPaid: Math.round(delta * 100) / 100,
          cumulativePaid: Math.round(newPaid * 100) / 100,
          status: nextNormalized.status,
          transactionRef: req.body.paidTransactionRef || existingExpense.paidTransactionRef || '',
          notes: req.body.notes || '',
          updatedBy: req.body.editedBy || req.user?.name || '',
        };

        req.body.paymentHistory = [...(existingExpense.paymentHistory || []), paymentEntry];
      } else if (!req.body.paymentHistory) {
        req.body.paymentHistory = existingExpense.paymentHistory || [];
      }
    } else if (!req.body.paymentHistory) {
      // If payment wasn't touched, always preserve existing history
      req.body.paymentHistory = existingExpense.paymentHistory || [];
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message || 'Failed to update expense entry' });
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // If an expense is used as a recurring base template, removing the expense should
    // also remove its recurring schedules to avoid orphan records and mismatched UI.
    await RecurringExpense.deleteMany({
      user: req.user._id,
      baseExpense: expense._id,
    });

    res.json({ message: 'Expense removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export expenses to PDF
// @route   POST /api/expenses/export/pdf
// @access  Private
export const exportExpensesToPDF = async (req, res) => {
  try {
    const { expenses, currency = 'INR' } = req.body;

    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ message: 'No expenses data provided' });
    }

    const outputPath = path.join(__dirname, '../temp', `expenses-${Date.now()}.pdf`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate PDF with currency support
    await generateExpensesPDF(expenses, outputPath, {}, currency);

    // Check if file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF file was not created');
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the PDF file
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up: delete the temporary file after sending
      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      }, 1000);
    });

    fileStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error generating PDF' });
      }
    });
  } catch (error) {
    console.error('Error exporting expenses to PDF:', error);
    res.status(500).json({ message: error.message || 'Failed to export expenses to PDF' });
  }
};

// @desc    Import expenses from Excel file
// @route   POST /api/expenses/import
// @access  Private
export const importExpensesFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Read the uploaded file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert sheet to JSON
    // Use raw: false to get formatted strings (better for dates)
    // This will convert Excel date serial numbers to formatted strings like "12/01/2026"
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
    
    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or has no data' });
    }

    // Map Excel columns to expense fields (case-insensitive matching)
    const columnMapping = {
      'date': ['date', 'transaction date'],
      'month': ['month'],
      'year': ['year'],
      'category': ['category', 'categories'],
      'department': ['department', 'dept'],
      'vendor': ['vendor', 'vendor/party', 'party', 'vendor name'],
      'description': ['description', 'desc', 'details'],
      'paymentMode': ['payment mode', 'paymentmode', 'payment method', 'payment'],
      'bankAccount': ['bank account', 'bankaccount', 'account'],
      'amountExclTax': ['amount (excl. tax)', 'amount excl tax', 'amountexcltax', 'amount', 'amount excluding tax'],
      'gstPercentage': ['gst %', 'gst%', 'gst percentage', 'gstpercentage'],
      'gstAmount': ['gst amount', 'gstamount'],
      'tdsPercentage': ['tds %', 'tds%', 'tds percentage', 'tdspercentage', 'tds pct'],
      'tdsAmount': ['tds amount', 'tdsamount', 'tds value', 'tds total'],
      'totalAmount': ['total amount', 'totalamount', 'total'],
      'paidAmount': ['paid amount', 'paidamount'],
      'paidTransactionRef': ['transaction ref', 'transactionref', 'transaction reference', 'ref'],
      'executive': ['executive'],
      'notes': ['notes', 'note', 'remarks'],
    };

    // Find column indices - try exact match first, then partial match
    const getColumnValue = (row, searchTerms) => {
      // First try exact match (case-insensitive)
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase().trim();
        for (const term of searchTerms) {
          const lowerTerm = term.toLowerCase().trim();
          // Exact match
          if (lowerKey === lowerTerm) {
            return value;
          }
        }
      }
      // Then try partial match (contains)
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase().trim();
        for (const term of searchTerms) {
          if (lowerKey.includes(term.toLowerCase())) {
            return value;
          }
        }
      }
      return null;
    };

    const expensesToCreate = [];
    const errors = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Step 1: Collect all unique master values from Excel data
    const uniqueCategories = new Set();
    const uniqueDepartments = new Set();
    const uniquePaymentModes = new Set();
    const uniqueVendors = new Set();
    const uniqueBankAccounts = new Set();

    // First pass: collect all unique master values
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const category = getColumnValue(row, columnMapping.category);
      const department = getColumnValue(row, columnMapping.department);
      const paymentMode = getColumnValue(row, columnMapping.paymentMode);
      const vendor = getColumnValue(row, columnMapping.vendor);
      const bankAccount = getColumnValue(row, columnMapping.bankAccount);

      if (category && String(category).trim()) {
        uniqueCategories.add(String(category).trim());
      }
      if (department && String(department).trim()) {
        uniqueDepartments.add(String(department).trim());
      }
      if (paymentMode && String(paymentMode).trim()) {
        uniquePaymentModes.add(String(paymentMode).trim());
      }
      if (vendor && String(vendor).trim()) {
        uniqueVendors.add(String(vendor).trim());
      }
      if (bankAccount && String(bankAccount).trim()) {
        uniqueBankAccounts.add(String(bankAccount).trim());
      }
    }

    // Step 2: Create missing masters automatically
    const userId = req.user._id;
    const createdMasters = {
      categories: 0,
      departments: 0,
      paymentModes: 0,
      vendors: 0,
      bankAccounts: 0,
    };

    try {
      // Create missing Categories
      if (uniqueCategories.size > 0) {
        const existingCategories = await ExpenseCategory.find({
          user: userId,
        }).select('name').lean();

        const existingCategoryNames = new Set(
          existingCategories.map((cat) => cat.name.toLowerCase())
        );

        for (const categoryName of uniqueCategories) {
          if (!existingCategoryNames.has(categoryName.toLowerCase())) {
            try {
              await ExpenseCategory.create({
                name: categoryName,
                costType: 'Variable',
                isActive: true,
                user: userId,
              });
              createdMasters.categories++;
              // Add to existing set to avoid duplicates in same import
              existingCategoryNames.add(categoryName.toLowerCase());
            } catch (error) {
              // Ignore duplicate key errors (race condition or case-insensitive duplicate)
              if (error.code !== 11000) {
                console.error(`Error creating category "${categoryName}":`, error.message);
              }
            }
          }
        }
      }

      // Create missing Departments
      if (uniqueDepartments.size > 0) {
        const existingDepartments = await Department.find({
          user: userId,
        }).select('name').lean();

        const existingDepartmentNames = new Set(
          existingDepartments.map((dept) => dept.name.toLowerCase())
        );

        for (const departmentName of uniqueDepartments) {
          if (!existingDepartmentNames.has(departmentName.toLowerCase())) {
            try {
              await Department.create({
                name: departmentName,
                isActive: true,
                user: userId,
              });
              createdMasters.departments++;
              // Add to existing set to avoid duplicates in same import
              existingDepartmentNames.add(departmentName.toLowerCase());
            } catch (error) {
              // Ignore duplicate key errors (race condition or case-insensitive duplicate)
              if (error.code !== 11000) {
                console.error(`Error creating department "${departmentName}":`, error.message);
              }
            }
          }
        }
      }

      // Create missing Payment Modes
      if (uniquePaymentModes.size > 0) {
        const existingPaymentModes = await PaymentMode.find({
          user: userId,
        }).select('name').lean();

        const existingPaymentModeNames = new Set(
          existingPaymentModes.map((pm) => pm.name.toLowerCase())
        );

        for (const paymentModeName of uniquePaymentModes) {
          if (!existingPaymentModeNames.has(paymentModeName.toLowerCase())) {
            try {
              await PaymentMode.create({
                name: paymentModeName,
                description: '',
                isActive: true,
                user: userId,
              });
              createdMasters.paymentModes++;
              // Add to existing set to avoid duplicates in same import
              existingPaymentModeNames.add(paymentModeName.toLowerCase());
            } catch (error) {
              // Ignore duplicate key errors (race condition or case-insensitive duplicate)
              if (error.code !== 11000) {
                console.error(`Error creating payment mode "${paymentModeName}":`, error.message);
              }
            }
          }
        }
      }

      // Create missing Vendors
      if (uniqueVendors.size > 0) {
        const existingVendors = await Vendor.find({
          user: userId,
        }).select('name').lean();

        const existingVendorNames = new Set(
          existingVendors.map((v) => v.name.toLowerCase())
        );

        for (const vendorName of uniqueVendors) {
          if (!existingVendorNames.has(vendorName.toLowerCase())) {
            try {
              await Vendor.create({
                name: vendorName,
                gstin: '',
                email: '',
                phone: '',
                address: '',
                defaultPaymentTerms: '',
                isActive: true,
                user: userId,
              });
              createdMasters.vendors++;
              // Add to existing set to avoid duplicates in same import
              existingVendorNames.add(vendorName.toLowerCase());
            } catch (error) {
              // Ignore duplicate key errors (race condition or case-insensitive duplicate)
              if (error.code !== 11000) {
                console.error(`Error creating vendor "${vendorName}":`, error.message);
              }
            }
          }
        }
      }

      // Create missing Bank Accounts
      if (uniqueBankAccounts.size > 0) {
        const existingBankAccounts = await BankAccount.find({
          user: userId,
        }).select('accountName').lean();

        const existingBankAccountNames = new Set(
          existingBankAccounts.map((ba) => ba.accountName.toLowerCase())
        );

        for (const bankAccountName of uniqueBankAccounts) {
          if (!existingBankAccountNames.has(bankAccountName.toLowerCase())) {
            try {
              await BankAccount.create({
                accountName: bankAccountName,
                bankName: bankAccountName, // Use account name as bank name if not provided
                ifsc: '',
                accountNumber: '',
                isActive: true,
                user: userId,
              });
              createdMasters.bankAccounts++;
              // Add to existing set to avoid duplicates in same import
              existingBankAccountNames.add(bankAccountName.toLowerCase());
            } catch (error) {
              // Ignore duplicate key errors (race condition or case-insensitive duplicate)
              if (error.code !== 11000) {
                console.error(`Error creating bank account "${bankAccountName}":`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error creating masters:', error);
      // Continue with expense import even if master creation fails
    }

    // Step 3: Process each row to create expenses
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and we skip header

      try {
        // Extract values using column mapping
        const dateValue = getColumnValue(row, columnMapping.date);
        const monthValue = getColumnValue(row, columnMapping.month);
        const yearValue = getColumnValue(row, columnMapping.year);
        const category = getColumnValue(row, columnMapping.category);
        const department = getColumnValue(row, columnMapping.department);
        const paymentMode = getColumnValue(row, columnMapping.paymentMode);
        const amountExclTax = getColumnValue(row, columnMapping.amountExclTax);

        // Validate required fields
        if (!dateValue && !(monthValue && yearValue)) {
          errors.push(`Row ${rowNum}: Date is required (or Month and Year if date is split)`);
          continue;
        }
        if (!category) {
          errors.push(`Row ${rowNum}: Category is required`);
          continue;
        }
        if (!department) {
          errors.push(`Row ${rowNum}: Department is required`);
          continue;
        }
        if (!paymentMode) {
          errors.push(`Row ${rowNum}: Payment Mode is required`);
          continue;
        }
        if (!amountExclTax || amountExclTax === 0) {
          errors.push(`Row ${rowNum}: Amount (Excl. Tax) is required`);
          continue;
        }

        // Parse date - handle multiple formats
        // Priority: If Month and Year columns exist, combine with Date (day) to create full date
        let expenseDate;
        let month, year;
        
        // Check if date is split into Date, Month, Year columns
        if (monthValue && yearValue) {
          // Date is split into separate columns
          const day = parseInt(dateValue) || 1;
          const monthStr = String(monthValue).trim();
          const yearNum = parseInt(yearValue);
          
          if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
            errors.push(`Row ${rowNum}: Invalid year value: ${yearValue}`);
            continue;
          }
          
          // Parse month - can be "Jan", "January", "1", etc.
          let monthIndex = -1;
          if (!isNaN(parseInt(monthStr))) {
            // Month is a number (1-12)
            monthIndex = parseInt(monthStr) - 1;
          } else {
            // Month is a string - find index in monthNames
            const monthAbbr = monthStr.substring(0, 3);
            monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthAbbr.toLowerCase());
            if (monthIndex === -1) {
              // Try full month names
              const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                     'July', 'August', 'September', 'October', 'November', 'December'];
              monthIndex = fullMonthNames.findIndex(m => m.toLowerCase().startsWith(monthStr.toLowerCase()));
            }
          }
          
          if (monthIndex < 0 || monthIndex > 11) {
            errors.push(`Row ${rowNum}: Invalid month value: ${monthValue}`);
            continue;
          }
          
          // Validate day
          if (day < 1 || day > 31) {
            errors.push(`Row ${rowNum}: Invalid day value: ${dateValue}`);
            continue;
          }
          
          // Create date from day, month, year
          expenseDate = new Date(yearNum, monthIndex, day);
          month = monthNames[monthIndex];
          year = yearNum;
          
          // Validate the created date
          if (isNaN(expenseDate.getTime())) {
            errors.push(`Row ${rowNum}: Invalid date combination: Day=${day}, Month=${monthValue}, Year=${yearValue}`);
            continue;
          }
        } else {
          // Date is in a single column - parse it normally
          if (dateValue instanceof Date) {
            // Already a Date object
            expenseDate = dateValue;
          } else if (typeof dateValue === 'number') {
            // If we get a number, it might be an Excel serial date
            // But if it's a small number (< 100), it's likely just a day number, not a serial date
            if (dateValue < 100 && dateValue > 0) {
              // This is likely just a day number - we need month and year
              errors.push(`Row ${rowNum}: Date appears to be just a day number (${dateValue}). Please provide Month and Year columns or a complete date.`);
              continue;
            }
            // Otherwise, treat as Excel serial date
            const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
            const millisecondsPerDay = 24 * 60 * 60 * 1000;
            expenseDate = new Date(excelEpoch.getTime() + dateValue * millisecondsPerDay);
          } else if (typeof dateValue === 'string') {
            // Parse date string - XLSX with raw: false gives formatted strings
            const dateStr = String(dateValue).trim();
            
            // Try parsing common date formats
            let parsedDate = null;
            
            // Check if it's a date-like string with separators
            if (dateStr.includes('/') || dateStr.includes('-')) {
              const parts = dateStr.split(/[\/\-]/).map(p => parseInt(p.trim()));
              
              if (parts.length === 3 && parts.every(p => !isNaN(p))) {
                // Determine format by checking part lengths
                if (parts[0] > 31 || parts[0] <= 0) {
                  // First part is year (yyyy-mm-dd or yyyy/mm/dd)
                  parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
                } else if (parts[2].toString().length === 4) {
                  // Last part is year - likely dd/mm/yyyy or dd-mm-yyyy
                  parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
                } else if (parts[0] <= 12 && parts[1] > 12) {
                  // First part is month, second is day - mm/dd/yyyy or mm-dd-yyyy
                  parsedDate = new Date(parts[2], parts[0] - 1, parts[1]);
                } else {
                  // Default to dd/mm/yyyy or dd-mm-yyyy
                  parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
                }
              }
            }
            
            // If not parsed yet, try JavaScript Date constructor
            if (!parsedDate || isNaN(parsedDate.getTime())) {
              parsedDate = new Date(dateValue);
            }
            
            // Validate parsed date
            if (isNaN(parsedDate.getTime())) {
              errors.push(`Row ${rowNum}: Invalid date format: ${dateValue}`);
              continue;
            }
            
            expenseDate = parsedDate;
          } else {
            errors.push(`Row ${rowNum}: Invalid date value: ${dateValue} (type: ${typeof dateValue})`);
            continue;
          }
          
          // Final validation: ensure date is valid
          if (isNaN(expenseDate.getTime())) {
            errors.push(`Row ${rowNum}: Invalid date: ${dateValue}`);
            continue;
          }
          
          // Calculate month and year from date
          month = monthNames[expenseDate.getMonth()];
          year = expenseDate.getFullYear();
        }

        // Parse numeric values
        const parseNumber = (value) => {
          if (value === null || value === undefined || value === '') return 0;
          const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : parseFloat(value);
          return isNaN(num) ? 0 : num;
        };

        const amountExclTaxNum = parseNumber(amountExclTax);
        const gstPercentage = parseNumber(getColumnValue(row, columnMapping.gstPercentage));
        const gstAmount = parseNumber(getColumnValue(row, columnMapping.gstAmount));
        const tdsPercentage = parseNumber(getColumnValue(row, columnMapping.tdsPercentage));
        const tdsAmount = parseNumber(getColumnValue(row, columnMapping.tdsAmount));
        
        // Calculate GST amount if not provided but percentage is
        let finalGstAmount = gstAmount;
        if (gstAmount === 0 && gstPercentage > 0) {
          finalGstAmount = (amountExclTaxNum * gstPercentage) / 100;
        }
        
        // Calculate TDS amount if not provided but percentage is
        const baseAmountWithGst = amountExclTaxNum + finalGstAmount;
        let finalTdsAmount = tdsAmount;
        if (tdsAmount === 0 && tdsPercentage > 0 && baseAmountWithGst > 0) {
          finalTdsAmount = (baseAmountWithGst * tdsPercentage) / 100;
        }
        
        // Calculate total amount
        const calculatedTotalAmount = amountExclTaxNum + finalGstAmount - finalTdsAmount;
        const totalAmount = parseNumber(getColumnValue(row, columnMapping.totalAmount)) || calculatedTotalAmount;

        // Build expense object
        const expenseData = {
          date: expenseDate,
          category: String(category).trim(),
          department: String(department).trim(),
          paymentMode: String(paymentMode).trim(),
          vendor: String(getColumnValue(row, columnMapping.vendor) || '').trim(),
          description: String(getColumnValue(row, columnMapping.description) || '').trim(),
          bankAccount: String(getColumnValue(row, columnMapping.bankAccount) || '').trim(),
          amountExclTax: amountExclTaxNum,
          gstPercentage: gstPercentage,
          gstAmount: finalGstAmount,
          tdsPercentage: tdsPercentage,
          tdsAmount: finalTdsAmount,
          totalAmount: totalAmount,
          paidAmount: parseNumber(getColumnValue(row, columnMapping.paidAmount)),
          paidTransactionRef: String(getColumnValue(row, columnMapping.paidTransactionRef) || '').trim(),
          executive: String(getColumnValue(row, columnMapping.executive) || '').trim(),
          notes: String(getColumnValue(row, columnMapping.notes) || '').trim(),
          month: month,
          year: year,
          user: req.user._id,
        };

        // Set createdBy from logged-in user
        if (req.user && req.user.name) {
          expenseData.createdBy = req.user.name;
          if (!expenseData.userName) {
            expenseData.userName = req.user.name;
          }
          if (!expenseData.userEmail && req.user.email) {
            expenseData.userEmail = req.user.email;
          }
          if (!expenseData.userPhone && req.user.phone) {
            expenseData.userPhone = req.user.phone;
          }
        }

        expensesToCreate.push(expenseData);
      } catch (error) {
        errors.push(`Row ${rowNum}: ${error.message || 'Error processing row'}`);
      }
    }

    if (expensesToCreate.length === 0) {
      return res.status(400).json({
        message: 'No valid expenses to import',
        errors: errors,
      });
    }

    // Step 4: Check for duplicates before inserting
    const expensesToInsert = [];
    const duplicateExpenses = [];

    for (let i = 0; i < expensesToCreate.length; i++) {
      const expenseData = expensesToCreate[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and we skip header

      try {
        // Check for duplicate using same logic as createExpense
        // Duplicate = same vendor, category, date, totalAmount, department
        const expenseDate = expenseData.date ? new Date(expenseData.date) : new Date();
        const startOfDay = new Date(expenseDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(expenseDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const duplicateCheck = await Expense.findOne({
          user: userId,
          vendor: expenseData.vendor || '',
          category: expenseData.category || '',
          department: expenseData.department || '',
          totalAmount: expenseData.totalAmount || 0,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });

        if (duplicateCheck) {
          // Duplicate found - skip this expense
          duplicateExpenses.push({
            row: rowNum,
            vendor: expenseData.vendor || '',
            category: expenseData.category || '',
            department: expenseData.department || '',
            date: expenseData.date,
            totalAmount: expenseData.totalAmount || 0
          });
        } else {
          // No duplicate - add to list for insertion
          expensesToInsert.push(expenseData);
        }
      } catch (error) {
        // If duplicate check fails, still try to insert (fail-safe)
        console.error(`Error checking duplicate for row ${rowNum}:`, error);
        expensesToInsert.push(expenseData);
      }
    }

    // Add duplicate warnings to errors array
    if (duplicateExpenses.length > 0) {
      duplicateExpenses.forEach(dup => {
        errors.push(`Row ${dup.row}: Duplicate expense detected (Vendor: ${dup.vendor}, Category: ${dup.category}, Department: ${dup.department}, Date: ${new Date(dup.date).toLocaleDateString()}, Amount: ₹${dup.totalAmount.toFixed(2)}). Skipped.`);
      });
    }

    if (expensesToInsert.length === 0) {
      return res.status(400).json({
        message: 'All expenses are duplicates. No new expenses were imported.',
        errors: errors,
        duplicates: duplicateExpenses.length,
      });
    }

    // Insert only non-duplicate expenses (bulk insert)
    const createdExpenses = await Expense.insertMany(expensesToInsert, { ordered: false });

    // Build success message with master creation info
    const masterCreationSummary = [];
    if (createdMasters.categories > 0) {
      masterCreationSummary.push(`${createdMasters.categories} categor${createdMasters.categories === 1 ? 'y' : 'ies'}`);
    }
    if (createdMasters.departments > 0) {
      masterCreationSummary.push(`${createdMasters.departments} department${createdMasters.departments === 1 ? '' : 's'}`);
    }
    if (createdMasters.paymentModes > 0) {
      masterCreationSummary.push(`${createdMasters.paymentModes} payment mode${createdMasters.paymentModes === 1 ? '' : 's'}`);
    }
    if (createdMasters.vendors > 0) {
      masterCreationSummary.push(`${createdMasters.vendors} vendor${createdMasters.vendors === 1 ? '' : 's'}`);
    }
    if (createdMasters.bankAccounts > 0) {
      masterCreationSummary.push(`${createdMasters.bankAccounts} bank account${createdMasters.bankAccounts === 1 ? '' : 's'}`);
    }

    let message = `Successfully imported ${createdExpenses.length} expense(s)`;
    if (duplicateExpenses.length > 0) {
      message += `. ${duplicateExpenses.length} duplicate expense(s) were skipped.`;
    }
    if (masterCreationSummary.length > 0) {
      message += ` Automatically created ${masterCreationSummary.join(', ')}.`;
    }

    res.status(201).json({
      message,
      imported: createdExpenses.length,
      total: expensesToCreate.length,
      duplicates: duplicateExpenses.length,
      mastersCreated: createdMasters,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error importing expenses from Excel:', error);
    res.status(500).json({ message: error.message || 'Failed to import expenses from Excel' });
  }
};

// @desc    Remove duplicate expenses
// @route   POST /api/expenses/remove-duplicates
// @access  Private
export const removeDuplicateExpenses = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all expenses for the user
    const allExpenses = await Expense.find({ user: userId })
      .select('_id vendor category department totalAmount date createdAt')
      .sort({ createdAt: 1 }) // Sort by creation date (oldest first)
      .lean();

    // Group expenses by duplicate criteria
    const expenseGroups = new Map();
    const duplicateIds = [];

    allExpenses.forEach(expense => {
      // Create a unique key based on vendor, category, date, totalAmount, department
      const expenseDate = expense.date ? new Date(expense.date) : new Date();
      expenseDate.setHours(0, 0, 0, 0);
      
      const key = JSON.stringify({
        vendor: (expense.vendor || '').trim(),
        category: (expense.category || '').trim(),
        department: (expense.department || '').trim(),
        totalAmount: parseFloat(expense.totalAmount) || 0,
        date: expenseDate.toISOString().split('T')[0], // YYYY-MM-DD format
      });

      if (!expenseGroups.has(key)) {
        // First occurrence - keep this one
        expenseGroups.set(key, [expense]);
      } else {
        // Duplicate found - add to group
        expenseGroups.get(key).push(expense);
      }
    });

    // Identify duplicates (keep the oldest one in each group)
    expenseGroups.forEach((expenses, key) => {
      if (expenses.length > 1) {
        // Sort by createdAt to keep the oldest
        expenses.sort((a, b) => {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          return dateA - dateB;
        });

        // Keep the first (oldest) one, mark the rest as duplicates
        for (let i = 1; i < expenses.length; i++) {
          duplicateIds.push(expenses[i]._id);
        }
      }
    });

    // Delete duplicates in bulk
    let deletedCount = 0;
    if (duplicateIds.length > 0) {
      const deleteResult = await Expense.deleteMany({
        _id: { $in: duplicateIds },
        user: userId,
      });
      deletedCount = deleteResult.deletedCount || 0;
    }

    res.status(200).json({
      message: `Successfully removed ${deletedCount} duplicate expense(s)`,
      removed: deletedCount,
      totalDuplicates: duplicateIds.length,
    });
  } catch (error) {
    console.error('Error removing duplicate expenses:', error);
    res.status(500).json({ message: error.message || 'Failed to remove duplicate expenses' });
  }
};

// @desc    Upload expense PDF to Cloudinary
// @route   POST /api/expenses/upload-pdf
// @access  Private
export const uploadExpensePDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'Invalid file type. Only PDF files are allowed.' });
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'expenses/pdf',
          upload_preset: 'Kology_Suite_Expenses',
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            if (!res.headersSent) {
              res.status(500).json({ message: error.message || 'Failed to upload PDF' });
            }
            return reject(error);
          }
          if (!res.headersSent) {
            res.json({
              url: result.secure_url,
              public_id: result.public_id,
            });
          }
          resolve();
        }
      );

      uploadStream.end(req.file.buffer);
    });
  } catch (error) {
    console.error('Error uploading expense PDF:', error);
    res.status(500).json({ message: error.message || 'Failed to upload expense PDF' });
  }
};

// export const uploadExpensePDFForExpense = async (req, res) => {
//   try {
//     const expenseId = req.params.id;
//     if (!expenseId) return res.status(400).json({ message: 'Expense id is required' });
//     if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
//     if (req.file.mimetype !== 'application/pdf') {
//       return res.status(400).json({ message: 'Invalid file type. Only PDF files are allowed.' });
//     }

//     const expense = await Expense.findOne({ _id: expenseId, user: req.user._id });
//     if (!expense) return res.status(404).json({ message: 'Expense not found' });

//     let uploaded;
//     await new Promise((resolve, reject) => {
//       const uploadStream = cloudinary.v2.uploader.upload_stream(
//         {
//           resource_type: 'raw',
//           folder: 'expenses/pdf',
//           upload_preset: 'Kology_Suite_Expenses',
//         },
//         (error, result) => {
//           if (error) return reject(error);
//           uploaded = result;
//           resolve();
//         }
//       );
//       uploadStream.end(req.file.buffer);
//     });

//     expense.expensePdfUrl = uploaded?.secure_url || '';
//     await expense.save();

//     res.json({
//       expense,
//       url: uploaded?.secure_url,
//       public_id: uploaded?.public_id,
//     });
//   } catch (error) {
//     console.error('Error uploading PDF for expense:', error);
//     res.status(500).json({ message: error?.message || 'Failed to upload expense PDF' });
//   }
// };


export const uploadExpensePDFForExpense = async (req, res) => {

  try {

    const expenseId = req.params.id
    if (!expenseId) return res.status(400).json({ message: "Expense id is required" })
    if (!req.file) return res.status(400).json({ message: "No file uploaded" })
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF files are allowed" })
    }

    const expense = await Expense.findOne({ _id: expenseId, user: req.user._id })
    if (!expense) return res.status(404).json({ message: "Expense not found" })

      const uploaded = await cloudinary.v2.uploader.upload(req.file.path, {
        resource_type: "raw",
        folder: "expenses/pdf",
        use_filename: true,
        unique_filename: true,
        format: "pdf"
      })
      

    fs.unlinkSync(req.file.path)

    expense.expensePdfUrl = uploaded.secure_url
    expense.expensePdfPublicId = uploaded.public_id

    await expense.save()

    res.json({
      expense,
      url: uploaded.secure_url,
      public_id: uploaded.public_id
    })

  } catch (error) {

    res.status(500).json({ message: error.message })

  }

}
