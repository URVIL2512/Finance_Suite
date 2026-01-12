import Salesperson from '../models/Salesperson.js';

// @desc    Get all salespersons
// @route   GET /api/salespersons
// @access  Private
export const getSalespersons = async (req, res) => {
  try {
    const salespersons = await Salesperson.find({ user: req.user._id, isActive: true })
      .sort({ name: 1 });
    res.json(salespersons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get salesperson by ID
// @route   GET /api/salespersons/:id
// @access  Private
export const getSalespersonById = async (req, res) => {
  try {
    const salesperson = await Salesperson.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true, // Only return active salespersons
    });

    if (!salesperson) {
      return res.status(404).json({ message: 'Salesperson not found or has been deleted' });
    }

    res.json(salesperson);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create salesperson
// @route   POST /api/salespersons
// @access  Private
export const createSalesperson = async (req, res) => {
  try {
    const salespersonData = {
      ...req.body,
      user: req.user._id,
    };

    const salesperson = await Salesperson.create(salespersonData);
    res.status(201).json(salesperson);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message || 'Failed to create salesperson' });
  }
};

// @desc    Update salesperson
// @route   PUT /api/salespersons/:id
// @access  Private
export const updateSalesperson = async (req, res) => {
  try {
    const salesperson = await Salesperson.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!salesperson) {
      return res.status(404).json({ message: 'Salesperson not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      salesperson[key] = req.body[key];
    });

    await salesperson.save();
    res.json(salesperson);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message || 'Failed to update salesperson' });
  }
};

// @desc    Delete salesperson
// @route   DELETE /api/salespersons/:id
// @access  Private
export const deleteSalesperson = async (req, res) => {
  try {
    const salesperson = await Salesperson.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!salesperson) {
      return res.status(404).json({ message: 'Salesperson not found' });
    }

    // Soft delete by setting isActive to false
    salesperson.isActive = false;
    await salesperson.save();
    
    res.json({ message: 'Salesperson removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
