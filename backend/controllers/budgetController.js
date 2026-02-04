import Budget from '../models/Budget.js';

const parseISODate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

// @desc    Get all budgets
// @route   GET /api/budgets
// @access  Private
export const getBudgets = async (req, res) => {
  try {
    const { startDate, endDate, department, category } = req.query;
    const filter = { user: req.user._id };

    const start = parseISODate(startDate);
    const end = parseISODate(endDate);
    if (start && end) {
      filter.periodStart = { $lte: end };
      filter.periodEnd = { $gte: start };
    }
    if (department) filter.department = department;
    if (category) filter.category = category;

    const budgets = await Budget.find(filter).sort({ periodStart: -1, createdAt: -1 }).lean();
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch budgets' });
  }
};

// @desc    Get single budget
// @route   GET /api/budgets/:id
// @access  Private
export const getBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    res.json(budget);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch budget' });
  }
};

// @desc    Create budget
// @route   POST /api/budgets
// @access  Private
export const createBudget = async (req, res) => {
  try {
    const { periodStart, periodEnd, department, category, amount, reason } = req.body;
    const start = parseISODate(periodStart);
    const end = parseISODate(periodEnd);
    if (!start || !end) return res.status(400).json({ message: 'periodStart and periodEnd are required (valid dates)' });
    if (end < start) return res.status(400).json({ message: 'periodEnd must be after periodStart' });

    const budget = await Budget.create({
      periodStart: start,
      periodEnd: end,
      department: department || 'Unassigned',
      category: category || 'All',
      amount: Number(amount) || 0,
      reason: reason || '',
      user: req.user._id,
    });
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to create budget' });
  }
};

// @desc    Update budget
// @route   PUT /api/budgets/:id
// @access  Private
export const updateBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, user: req.user._id });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });

    const { periodStart, periodEnd, department, category, amount, reason } = req.body;
    if (periodStart !== undefined) {
      const d = parseISODate(periodStart);
      if (!d) return res.status(400).json({ message: 'Invalid periodStart' });
      budget.periodStart = d;
    }
    if (periodEnd !== undefined) {
      const d = parseISODate(periodEnd);
      if (!d) return res.status(400).json({ message: 'Invalid periodEnd' });
      budget.periodEnd = d;
    }
    if (budget.periodEnd < budget.periodStart) {
      return res.status(400).json({ message: 'periodEnd must be after periodStart' });
    }
    if (department !== undefined) budget.department = department || 'Unassigned';
    if (category !== undefined) budget.category = category || 'All';
    if (amount !== undefined) budget.amount = Number(amount) || 0;
    if (reason !== undefined) budget.reason = reason || '';

    await budget.save();
    res.json(budget);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update budget' });
  }
};

// @desc    Delete budget
// @route   DELETE /api/budgets/:id
// @access  Private
export const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, user: req.user._id });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    await budget.deleteOne();
    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to delete budget' });
  }
};

