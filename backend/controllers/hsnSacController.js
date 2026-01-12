import HsnSac from '../models/HsnSac.js';

// @desc    Get all HSN/SAC codes (common + user's custom)
// @route   GET /api/hsn-sac
// @access  Private
export const getHsnSacCodes = async (req, res) => {
  try {
    const { search, type } = req.query;
    
    // Build query: get common codes OR user's custom codes
    const query = {
      $or: [
        { isCommon: true },
        { user: req.user._id }
      ]
    };

    // Filter by type if provided
    if (type && (type === 'HSN' || type === 'SAC')) {
      query.type = type;
    }

    // Search functionality
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$and = [
        {
          $or: [
            { code: searchRegex },
            { description: searchRegex }
          ]
        }
      ];
    }

    const codes = await HsnSac.find(query)
      .sort({ isCommon: -1, code: 1 }) // Common codes first, then by code
      .select('code description gstRate type isCommon');

    res.json(codes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single HSN/SAC code
// @route   GET /api/hsn-sac/:id
// @access  Private
export const getHsnSacCode = async (req, res) => {
  try {
    const code = await HsnSac.findOne({
      _id: req.params.id,
      $or: [
        { isCommon: true },
        { user: req.user._id }
      ]
    });

    if (!code) {
      return res.status(404).json({ message: 'HSN/SAC code not found' });
    }

    res.json(code);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create custom HSN/SAC code
// @route   POST /api/hsn-sac
// @access  Private
export const createHsnSacCode = async (req, res) => {
  try {
    const { code, description, gstRate, type } = req.body;

    // Validate required fields
    if (!code || !description || gstRate === undefined || !type) {
      return res.status(400).json({ 
        message: 'Code, description, GST rate, and type are required' 
      });
    }

    // Validate type
    if (type !== 'HSN' && type !== 'SAC') {
      return res.status(400).json({ message: 'Type must be HSN or SAC' });
    }

    // Validate GST rate
    if (gstRate < 0 || gstRate > 100) {
      return res.status(400).json({ message: 'GST rate must be between 0 and 100' });
    }

    // Check if code already exists (common or user's custom)
    const existingCode = await HsnSac.findOne({
      code: code.trim(),
      $or: [
        { isCommon: true },
        { user: req.user._id }
      ]
    });

    if (existingCode) {
      return res.status(400).json({ message: 'This HSN/SAC code already exists' });
    }

    const hsnSacData = {
      code: code.trim(),
      description: description.trim(),
      gstRate: parseFloat(gstRate),
      type: type,
      isCommon: false,
      user: req.user._id,
    };

    const hsnSac = await HsnSac.create(hsnSacData);
    res.status(201).json(hsnSac);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'HSN/SAC code already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create HSN/SAC code' });
  }
};

// @desc    Update custom HSN/SAC code
// @route   PUT /api/hsn-sac/:id
// @access  Private
export const updateHsnSacCode = async (req, res) => {
  try {
    const code = await HsnSac.findOne({
      _id: req.params.id,
      user: req.user._id, // Only allow updating user's custom codes
      isCommon: false, // Cannot update common codes
    });

    if (!code) {
      return res.status(404).json({ message: 'HSN/SAC code not found or cannot be updated' });
    }

    const { description, gstRate } = req.body;

    if (description !== undefined) {
      code.description = description.trim();
    }
    if (gstRate !== undefined) {
      const gstRateValue = parseFloat(gstRate);
      if (gstRateValue < 0 || gstRateValue > 100) {
        return res.status(400).json({ message: 'GST rate must be between 0 and 100' });
      }
      code.gstRate = gstRateValue;
    }

    await code.save();
    res.json(code);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message || 'Failed to update HSN/SAC code' });
  }
};

// @desc    Delete custom HSN/SAC code
// @route   DELETE /api/hsn-sac/:id
// @access  Private
export const deleteHsnSacCode = async (req, res) => {
  try {
    const code = await HsnSac.findOne({
      _id: req.params.id,
      user: req.user._id, // Only allow deleting user's custom codes
      isCommon: false, // Cannot delete common codes
    });

    if (!code) {
      return res.status(404).json({ message: 'HSN/SAC code not found or cannot be deleted' });
    }

    await HsnSac.findByIdAndDelete(req.params.id);
    res.json({ message: 'HSN/SAC code removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
