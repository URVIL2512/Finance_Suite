import PaymentMode from '../models/PaymentMode.js';

// @desc    Get all payment modes
// @route   GET /api/payment-modes
// @access  Private
export const getPaymentModes = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const filter = { user: req.user._id };
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else {
      filter.isActive = true;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const paymentModes = await PaymentMode.find(filter)
      .select('-__v')
      .sort({ name: 1, createdAt: -1 })
      .lean();

    res.json(paymentModes);
  } catch (error) {
    console.error('Error fetching payment modes:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch payment modes',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single payment mode
// @route   GET /api/payment-modes/:id
// @access  Private
export const getPaymentMode = async (req, res) => {
  try {
    const paymentMode = await PaymentMode.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .select('-__v')
      .lean();

    if (!paymentMode) {
      return res.status(404).json({ message: 'Payment mode not found' });
    }

    res.json(paymentMode);
  } catch (error) {
    console.error('Error fetching payment mode:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch payment mode',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Create payment mode
// @route   POST /api/payment-modes
// @access  Private
export const createPaymentMode = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Payment mode name is required' });
    }

    const normalizedName = name.trim();

    // Check if payment mode with same name already exists for this user
    const existingPaymentMode = await PaymentMode.findOne({
      name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      user: req.user._id,
    });

    if (existingPaymentMode) {
      return res.status(400).json({ message: 'Payment mode with this name already exists' });
    }

    const paymentMode = await PaymentMode.create({
      name: normalizedName,
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
      user: req.user._id,
    });

    res.status(201).json(paymentMode);
  } catch (error) {
    console.error('Error creating payment mode:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Payment mode with this name already exists' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to create payment mode',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update payment mode
// @route   PUT /api/payment-modes/:id
// @access  Private
export const updatePaymentMode = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    const paymentMode = await PaymentMode.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!paymentMode) {
      return res.status(404).json({ message: 'Payment mode not found' });
    }

    // If name is being updated, check for duplicates
    if (name && name.trim() !== paymentMode.name) {
      const normalizedName = name.trim();
      const existingPaymentMode = await PaymentMode.findOne({
        name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        user: req.user._id,
        _id: { $ne: req.params.id },
      });

      if (existingPaymentMode) {
        return res.status(400).json({ message: 'Payment mode with this name already exists' });
      }
      paymentMode.name = normalizedName;
    }

    if (description !== undefined) {
      paymentMode.description = description || '';
    }
    if (isActive !== undefined) {
      paymentMode.isActive = isActive;
    }

    await paymentMode.save();

    res.json(paymentMode);
  } catch (error) {
    console.error('Error updating payment mode:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Payment mode with this name already exists' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to update payment mode',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete payment mode
// @route   DELETE /api/payment-modes/:id
// @access  Private
export const deletePaymentMode = async (req, res) => {
  try {
    const paymentMode = await PaymentMode.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!paymentMode) {
      return res.status(404).json({ message: 'Payment mode not found' });
    }

    await paymentMode.deleteOne();

    res.json({ message: 'Payment mode deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment mode:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete payment mode',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
