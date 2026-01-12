import Customer from '../models/Customer.js';

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res) => {
  try {
    const { search, country, isActive } = req.query;
    const filter = { user: req.user._id };
    
    // Filter by active status (default to active only)
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    } else {
      filter.isActive = true; // Default to active customers only
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Country filter
    if (country) {
      filter.country = country;
    }

    const customers = await Customer.find(filter)
      .select('-__v')
      .sort({ displayName: 1, clientName: 1, createdAt: -1 })
      .lean();
    
    // Ensure all customers have complete data structure
    const customersWithCompleteData = customers.map(customer => {
      // Ensure nested objects exist
      if (!customer.billingAddress) {
        customer.billingAddress = {};
      }
      if (!customer.shippingAddress) {
        customer.shippingAddress = {};
      }
      if (!customer.workPhone) {
        customer.workPhone = { countryCode: '+91', number: '' };
      }
      if (!customer.mobile) {
        customer.mobile = { countryCode: '+91', number: '' };
      }
      if (!customer.contactPersons) {
        customer.contactPersons = [];
      }
      return customer;
    });

    res.json(customersWithCompleteData);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch customers',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
export const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true, // Only return active customers
    })
      .select('-__v')
      .lean();

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found or has been deleted' });
    }

    // Ensure complete data structure
    if (!customer.billingAddress) {
      customer.billingAddress = {};
    }
    if (!customer.shippingAddress) {
      customer.shippingAddress = {};
    }
    if (!customer.workPhone) {
      customer.workPhone = { countryCode: '+91', number: '' };
    }
    if (!customer.mobile) {
      customer.mobile = { countryCode: '+91', number: '' };
    }
    if (!customer.contactPersons) {
      customer.contactPersons = [];
    }

    // Optionally fetch related invoices and payments
    try {
      const Invoice = (await import('../models/Invoice.js')).default;
      const Payment = (await import('../models/Payment.js')).default;
      
      // Get customer invoices
      const invoices = await Invoice.find({
        'clientDetails.name': { $regex: customer.displayName || customer.clientName || '', $options: 'i' },
        user: req.user._id
      })
        .select('invoiceNumber invoiceDate grandTotal status receivedAmount paidAmount')
        .sort({ invoiceDate: -1 })
        .limit(10)
        .lean();
      
      // Get customer payments
      const customerPayments = await Payment.find({
        customer: customer._id,
        user: req.user._id
      })
        .populate({
          path: 'invoice',
          select: 'invoiceNumber invoiceDate grandTotal',
          options: { lean: true }
        })
        .select('paymentNumber paymentDate amountReceived status')
        .sort({ paymentDate: -1 })
        .limit(10)
        .lean();
      
      customer.recentInvoices = invoices || [];
      customer.recentPayments = customerPayments || [];
    } catch (relatedError) {
      console.error('Error fetching related data for customer:', relatedError);
      customer.recentInvoices = [];
      customer.recentPayments = [];
    }

    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch customer',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (req, res) => {
  try {
    const {
      // Primary Contact
      salutation,
      firstName,
      lastName,
      companyName,
      displayName,
      email,
      workPhone,
      mobile,
      customerLanguage,
      // Address
      billingAddress,
      shippingAddress,
      // Contact Persons
      contactPersons,
      // Other Details
      pan,
      currency,
      accountsReceivable,
      openingBalance,
      paymentTerms,
      documents,
      // Legacy fields
      clientName,
      gstin,
      state,
      country,
      hsnOrSac,
      gstPercentage,
      tdsPercentage,
    } = req.body;

    // Validate required fields
    if (!displayName && !clientName) {
      return res.status(400).json({ 
        message: 'Display Name is required',
        field: 'displayName'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ 
        message: 'Email Address is required',
        field: 'email'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ 
        message: 'Invalid email format',
        field: 'email'
      });
    }

    // Check if customer with same email already exists
    const existingCustomer = await Customer.findOne({
      email: email.toLowerCase().trim(),
      user: req.user._id,
      isActive: true,
    });

    if (existingCustomer) {
      return res.status(400).json({ 
        message: 'Customer with this email already exists',
        field: 'email'
      });
    }

    // Prepare customer data
    let finalBillingAddress = {};
    if (typeof billingAddress === 'object' && billingAddress !== null) {
      finalBillingAddress = billingAddress;
    } else if (typeof billingAddress === 'string') {
      finalBillingAddress = { street1: billingAddress };
    }

    let finalMobile = { countryCode: '+91', number: '' };
    if (typeof mobile === 'object' && mobile !== null) {
      finalMobile = mobile;
    } else if (typeof mobile === 'string') {
      finalMobile = { countryCode: '+91', number: mobile };
    }

    const customerData = {
      // Primary Contact
      salutation: salutation || '',
      firstName: firstName || '',
      lastName: lastName || '',
      companyName: companyName || '',
      displayName: displayName || clientName || '',
      email: email.toLowerCase(),
      workPhone: workPhone || { countryCode: '+91', number: '' },
      mobile: finalMobile,
      customerLanguage: customerLanguage || 'English',
      // Address
      billingAddress: finalBillingAddress,
      shippingAddress: shippingAddress || {},
      // Contact Persons
      contactPersons: contactPersons || [],
      // Other Details
      pan: pan || '',
      currency: currency || 'INR',
      accountsReceivable: accountsReceivable || '',
      openingBalance: openingBalance || 0,
      paymentTerms: paymentTerms || 'Due on Receipt',
      documents: documents || [],
      // Legacy fields (for backward compatibility)
      clientName: displayName || clientName || '',
      gstin: gstin || '',
      state: state || finalBillingAddress?.state || '',
      country: country || finalBillingAddress?.country || 'India',
      hsnOrSac: hsnOrSac || '',
      gstPercentage: gstPercentage || 0,
      tdsPercentage: tdsPercentage || 0,
      isActive: true,
      user: req.user._id,
    };

    const customer = await Customer.create(customerData);

    // Populate customer data before sending response
    const populatedCustomer = await Customer.findById(customer._id)
      .select('-__v')
      .lean();

    res.status(201).json(populatedCustomer);
  } catch (error) {
    console.error('Error creating customer:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: messages.join(', '),
        errors: error.errors
      });
    }
    
    // Handle duplicate key errors (unique constraint violations)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Customer with this ${field} already exists`,
        field: field
      });
    }
    
    // Handle database connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return res.status(503).json({ 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Generic error
    res.status(500).json({ 
      message: error.message || 'Failed to create customer',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if email is being changed and if new email already exists
    if (req.body.email && req.body.email.toLowerCase() !== customer.email) {
      const existingCustomer = await Customer.findOne({
        email: req.body.email.toLowerCase(),
        user: req.user._id,
        isActive: true,
        _id: { $ne: req.params.id },
      });

      if (existingCustomer) {
        return res.status(400).json({ message: 'Customer with this email already exists' });
      }
    }

    // Update customer
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        ...req.body,
        email: req.body.email ? req.body.email.toLowerCase() : customer.email,
      },
      { new: true, runValidators: true }
    );

    const populatedCustomer = await Customer.findById(updatedCustomer._id)
      .select('-__v')
      .lean();

    res.json(populatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: messages.join(', '),
        errors: error.errors
      });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Customer with this ${field} already exists`,
        field: field
      });
    }
    
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return res.status(503).json({ 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to update customer',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete customer (soft delete)
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Soft delete by setting isActive to false
    customer.isActive = false;
    await customer.save();

    res.json({ message: 'Customer removed' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return res.status(503).json({ 
        message: 'Database connection error. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to delete customer',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

