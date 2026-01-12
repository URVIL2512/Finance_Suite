import Expense from '../models/Expense.js';

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res) => {
  try {
    const { year, month, category, operationType } = req.query;
    const filter = { user: req.user._id };

    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;
    if (category) filter.category = category;
    if (operationType) filter.operationType = operationType;

    const expenses = await Expense.find(filter)
      .select('-__v')
      .sort({ date: -1, createdAt: -1 })
      .lean();
    
    // Ensure all expenses have complete data structure
    const expensesWithCompleteData = expenses.map(expense => {
      // Ensure all numeric fields are numbers
      const numericFields = ['amountExclTax', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'totalAmount', 'paidAmount'];
      numericFields.forEach(field => {
        if (expense[field] === undefined || expense[field] === null) {
          expense[field] = 0;
        }
      });
      
      // Ensure string fields are strings
      const stringFields = ['vendor', 'description', 'bankAccount', 'paidTransactionRef', 'notes', 'invoiceUrl', 'executive'];
      stringFields.forEach(field => {
        if (expense[field] === undefined || expense[field] === null) {
          expense[field] = '';
        }
      });
      
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

    res.json({ message: 'Expense removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

