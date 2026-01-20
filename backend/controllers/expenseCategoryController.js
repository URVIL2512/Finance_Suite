import ExpenseCategory from '../models/ExpenseCategory.js';

const normalizeName = (name) => String(name || '').trim();

// @desc    Get all expense categories
// @route   GET /api/expense-categories
// @access  Private
export const getExpenseCategories = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = { user: req.user._id };
    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const rows = await ExpenseCategory.find(filter).select('-__v').sort({ name: 1 }).lean();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch expense categories' });
  }
};

// @desc    Create expense category
// @route   POST /api/expense-categories
// @access  Private
export const createExpenseCategory = async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    const costType = req.body?.costType;
    const isActive = req.body?.isActive;

    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const doc = await ExpenseCategory.create({
      name,
      costType: costType === 'Fixed' ? 'Fixed' : 'Variable',
      isActive: isActive === undefined ? true : !!isActive,
      user: req.user._id,
    });

    res.status(201).json(doc);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create expense category' });
  }
};

// @desc    Update expense category
// @route   PUT /api/expense-categories/:id
// @access  Private
export const updateExpenseCategory = async (req, res) => {
  try {
    const category = await ExpenseCategory.findOne({ _id: req.params.id, user: req.user._id });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    if (req.body?.name !== undefined) category.name = normalizeName(req.body.name);
    if (req.body?.costType !== undefined) category.costType = req.body.costType === 'Fixed' ? 'Fixed' : 'Variable';
    if (req.body?.isActive !== undefined) category.isActive = !!req.body.isActive;

    await category.save();
    res.json(category);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to update expense category' });
  }
};

// @desc    Delete expense category
// @route   DELETE /api/expense-categories/:id
// @access  Private
export const deleteExpenseCategory = async (req, res) => {
  try {
    const category = await ExpenseCategory.findOne({ _id: req.params.id, user: req.user._id });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await category.deleteOne();
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to delete expense category' });
  }
};

