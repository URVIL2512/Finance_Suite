import Vendor from '../models/Vendor.js';

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private
export const getVendors = async (req, res) => {
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
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } }
      ];
    }

    const vendors = await Vendor.find(filter)
      .select('-__v')
      .sort({ name: 1, createdAt: -1 })
      .lean();

    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch vendors',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single vendor
// @route   GET /api/vendors/:id
// @access  Private
export const getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .select('-__v')
      .lean();

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch vendor',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Create vendor
// @route   POST /api/vendors
// @access  Private
export const createVendor = async (req, res) => {
  try {
    const { name, gstin, email, phone, address, defaultPaymentTerms, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Vendor name is required' });
    }

    // Check if vendor with same name already exists for this user
    const existingVendor = await Vendor.findOne({
      name: name.trim(),
      user: req.user._id,
    });

    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor with this name already exists' });
    }

    const vendor = await Vendor.create({
      name: name.trim(),
      gstin: gstin ? gstin.trim().toUpperCase() : '',
      email: email ? email.trim().toLowerCase() : '',
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      defaultPaymentTerms: defaultPaymentTerms ? defaultPaymentTerms.trim() : '',
      isActive: isActive !== undefined ? isActive : true,
      user: req.user._id,
    });

    res.status(201).json(vendor);
  } catch (error) {
    console.error('Error creating vendor:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Vendor with this name already exists' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to create vendor',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update vendor
// @route   PUT /api/vendors/:id
// @access  Private
export const updateVendor = async (req, res) => {
  try {
    const { name, gstin, email, phone, address, defaultPaymentTerms, isActive } = req.body;

    const vendor = await Vendor.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // If name is being updated, check for duplicates
    if (name && name.trim() !== vendor.name) {
      const existingVendor = await Vendor.findOne({
        name: name.trim(),
        user: req.user._id,
        _id: { $ne: req.params.id },
      });

      if (existingVendor) {
        return res.status(400).json({ message: 'Vendor with this name already exists' });
      }
      vendor.name = name.trim();
    }

    if (gstin !== undefined) {
      vendor.gstin = gstin ? gstin.trim().toUpperCase() : '';
    }
    if (email !== undefined) {
      vendor.email = email ? email.trim().toLowerCase() : '';
    }
    if (phone !== undefined) {
      vendor.phone = phone ? phone.trim() : '';
    }
    if (address !== undefined) {
      vendor.address = address ? address.trim() : '';
    }
    if (defaultPaymentTerms !== undefined) {
      vendor.defaultPaymentTerms = defaultPaymentTerms ? defaultPaymentTerms.trim() : '';
    }
    if (isActive !== undefined) {
      vendor.isActive = isActive;
    }

    await vendor.save();

    res.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Vendor with this name already exists' });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to update vendor',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete vendor
// @route   DELETE /api/vendors/:id
// @access  Private
export const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    await vendor.deleteOne();

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete vendor',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
