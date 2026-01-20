import Department from '../models/Department.js';

const normalizeName = (name) => String(name || '').trim();

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
export const getDepartments = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = { user: req.user._id };
    if (isActive !== undefined) {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const rows = await Department.find(filter).select('-__v').sort({ name: 1 }).lean();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch departments' });
  }
};

// @desc    Create department
// @route   POST /api/departments
// @access  Private
export const createDepartment = async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    const isActive = req.body?.isActive;

    if (!name) return res.status(400).json({ message: 'Department name is required' });

    const doc = await Department.create({
      name,
      isActive: isActive === undefined ? true : !!isActive,
      user: req.user._id,
    });

    res.status(201).json(doc);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Department already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create department' });
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private
export const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findOne({ _id: req.params.id, user: req.user._id });
    if (!department) return res.status(404).json({ message: 'Department not found' });

    if (req.body?.name !== undefined) department.name = normalizeName(req.body.name);
    if (req.body?.isActive !== undefined) department.isActive = !!req.body.isActive;

    await department.save();
    res.json(department);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Department already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to update department' });
  }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private
export const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findOne({ _id: req.params.id, user: req.user._id });
    if (!department) return res.status(404).json({ message: 'Department not found' });

    await department.deleteOne();
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to delete department' });
  }
};

