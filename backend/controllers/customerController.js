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

    // Validate email format only if email is provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ 
          message: 'Invalid email format',
          field: 'email'
        });
      }
    }

    // Check if customer with same email already exists (only if email is provided)
    if (email && email.trim()) {
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

    // Generate display name if not provided
    let finalDisplayName = displayName || clientName;
    if (!finalDisplayName && (salutation || firstName || lastName)) {
      const nameParts = [];
      if (salutation) nameParts.push(salutation);
      if (firstName) nameParts.push(firstName);
      if (lastName) nameParts.push(lastName);
      finalDisplayName = nameParts.join(' ');
    }

    const customerData = {
      // Primary Contact
      salutation: salutation || '',
      firstName: firstName || '',
      lastName: lastName || '',
      companyName: companyName || '',
      displayName: finalDisplayName || '',
      email: email ? email.toLowerCase() : '',
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
      clientName: finalDisplayName || '',
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

    // Extract fields from request body
    const {
      salutation,
      firstName,
      lastName,
      companyName,
      displayName,
      email,
      workPhone,
      mobile,
      customerLanguage,
      billingAddress,
      shippingAddress,
      contactPersons,
      // Business Information
      pan,
      currency,
      paymentTerms,
      tdsPercentage,
      // Legacy fields
      clientName,
      gstin,
      state,
      country,
      hsnOrSac,
      gstPercentage,
      website,
      notes,
      isActive
    } = req.body;

    // Check if email is being changed and if new email already exists
    if (email && email.toLowerCase() !== customer.email) {
      const existingCustomer = await Customer.findOne({
        email: email.toLowerCase(),
        user: req.user._id,
        isActive: true,
        _id: { $ne: req.params.id },
      });

      if (existingCustomer) {
        return res.status(400).json({ message: 'Customer with this email already exists' });
      }
    }

    // Handle billingAddress properly
    let finalBillingAddress = customer.billingAddress || {};
    if (typeof billingAddress === 'object' && billingAddress !== null) {
      finalBillingAddress = billingAddress;
    } else if (typeof billingAddress === 'string') {
      finalBillingAddress = { street1: billingAddress };
    }

    // Generate display name if not provided
    let finalDisplayName = displayName;
    if (!finalDisplayName && (salutation || firstName || lastName)) {
      const nameParts = [];
      if (salutation) nameParts.push(salutation);
      if (firstName) nameParts.push(firstName);
      if (lastName) nameParts.push(lastName);
      finalDisplayName = nameParts.join(' ');
    }

    // Update customer
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        // Primary Contact
        salutation: salutation || customer.salutation,
        firstName: firstName || customer.firstName,
        lastName: lastName || customer.lastName,
        companyName: companyName || customer.companyName,
        displayName: finalDisplayName || customer.displayName,
        email: email ? email.toLowerCase() : customer.email,
        workPhone: workPhone || customer.workPhone,
        mobile: mobile || customer.mobile,
        customerLanguage: customerLanguage || customer.customerLanguage,
        // Address
        billingAddress: finalBillingAddress,
        shippingAddress: shippingAddress || customer.shippingAddress,
        // Contact Persons
        contactPersons: contactPersons || customer.contactPersons,
        // Business Information
        pan: pan || customer.pan,
        currency: currency || customer.currency,
        paymentTerms: paymentTerms || customer.paymentTerms,
        tdsPercentage: tdsPercentage || customer.tdsPercentage,
        // Legacy fields (for backward compatibility)
        clientName: finalDisplayName || clientName || customer.clientName,
        gstin: gstin || customer.gstin,
        state: state || finalBillingAddress?.state || customer.state,
        country: country || finalBillingAddress?.country || customer.country,
        hsnOrSac: hsnOrSac || customer.hsnOrSac,
        gstPercentage: gstPercentage || customer.gstPercentage,
        website: website || customer.website,
        notes: notes || customer.notes,
        isActive: isActive !== undefined ? isActive : customer.isActive,
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

// @desc    Export customers to Excel
// @route   GET /api/customers/export
// @access  Private
export const exportCustomers = async (req, res) => {
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
      .select('-__v -user')
      .sort({ displayName: 1, clientName: 1, createdAt: -1 })
      .lean();

    console.log(`📊 Exporting ${customers.length} customers for user ${req.user._id}`);
    console.log('Export filters applied:', { search, country, isActive });

    // Transform data for Excel export
    const exportData = customers.map((customer, index) => {
      // Helper function to safely get nested values
      const getNestedValue = (obj, path, defaultValue = '') => {
        return path.split('.').reduce((current, key) => {
          return current && current[key] !== undefined ? current[key] : defaultValue;
        }, obj);
      };

      // Format mobile number
      const formatMobile = (mobile) => {
        if (!mobile) return '';
        if (typeof mobile === 'string') return mobile;
        if (typeof mobile === 'object' && mobile.number) {
          return `${mobile.countryCode || ''} ${mobile.number}`.trim();
        }
        return '';
      };

      // Format billing address
      const formatAddress = (address) => {
        if (!address) return '';
        if (typeof address === 'string') return address;
        if (typeof address === 'object') {
          const parts = [
            address.street1,
            address.street2,
            address.city,
            address.state,
            address.pinCode
          ].filter(Boolean);
          return parts.join(', ');
        }
        return '';
      };

      return {
        'S.No': index + 1,
        'Client Name': customer.displayName || customer.clientName || '',
        'Company Name': customer.companyName || '',
        'Email': customer.email || '',
        'Mobile': formatMobile(customer.mobile),
        'Country': customer.country || '',
        'State': customer.state || getNestedValue(customer, 'billingAddress.state', ''),
        'GSTIN': customer.gstin || '',
        'PAN': customer.pan || '',
        'Currency': customer.currency || 'INR',
        'Payment Terms': customer.paymentTerms || '',
        'Opening Balance': customer.openingBalance || 0,
        'GST Percentage': customer.gstPercentage || '',
        'TDS Percentage': customer.tdsPercentage || '',
        'HSN/SAC': customer.hsnOrSac || '',
        'Billing Address': formatAddress(customer.billingAddress),
        'Work Phone': formatMobile(customer.workPhone),
        'Website': customer.website || '',
        'Notes': customer.notes || '',
        'Created At': customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : '',
        'Status': customer.isActive ? 'Active' : 'Inactive'
      };
    });

    // Set response headers for Excel download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `customers_export_${timestamp}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the data as JSON (will be converted to Excel on frontend)
    res.json({
      success: true,
      data: exportData,
      filename: filename,
      count: customers.length
    });

  } catch (error) {
    console.error('Error exporting customers:', error);
    res.status(500).json({
      message: error.message || 'Failed to export customers',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Import customers from Excel
// @route   POST /api/customers/import
// @access  Private
export const importCustomers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const XLSX = await import('xlsx');
    console.log('📥 Starting customer import for user:', req.user._id);
    console.log('File details:', { 
      filename: req.file.originalname, 
      size: req.file.size,
      mimetype: req.file.mimetype 
    });

    // Read the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Processing ${jsonData.length} rows from Excel`);

    if (jsonData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or has no valid data' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel row number (accounting for header)

      try {
        // Map Excel columns to customer fields (flexible column mapping)
        const customerData = {
          user: req.user._id,
          displayName: row['Client Name'] || row['Display Name'] || row['Name'] || '',
          clientName: row['Client Name'] || row['Display Name'] || row['Name'] || '',
          companyName: row['Company Name'] || row['Company'] || '',
          email: row['Email'] || row['Email Address'] || '',
          mobile: parsePhoneNumber(row['Mobile'] || row['Phone'] || row['Mobile Number'] || ''),
          workPhone: parsePhoneNumber(row['Work Phone'] || row['Office Phone'] || ''),
          country: normalizeCountry(row['Country'] || 'India'),
          state: row['State'] || '',
          currency: row['Currency'] || 'INR',
          gstin: row['GSTIN'] || row['GST Number'] || '',
          pan: row['PAN'] || row['PAN Number'] || '',
          paymentTerms: row['Payment Terms'] || '',
          openingBalance: parseFloat(row['Opening Balance'] || 0) || 0,
          gstPercentage: parseFloat(row['GST Percentage'] || row['GST %'] || 0) || 0,
          tdsPercentage: parseFloat(row['TDS Percentage'] || row['TDS %'] || 0) || 0,
          hsnOrSac: row['HSN/SAC'] || row['HSN'] || row['SAC'] || '',
          website: row['Website'] || '',
          notes: row['Notes'] || row['Remarks'] || '',
          isActive: true
        };

        // Parse billing address if provided
        if (row['Billing Address'] || row['Address']) {
          customerData.billingAddress = {
            street1: row['Billing Address'] || row['Address'] || '',
            city: row['City'] || '',
            state: row['State'] || '',
            pinCode: row['Pin Code'] || row['Postal Code'] || row['ZIP'] || '',
            country: customerData.country
          };
        }

        // Validate required fields
        if (!customerData.displayName && !customerData.clientName) {
          errors.push(`Row ${rowNumber}: Customer name is required`);
          skipped++;
          continue;
        }

        // Validate email format only if email is provided
        if (customerData.email && customerData.email.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(customerData.email)) {
            errors.push(`Row ${rowNumber}: Invalid email format`);
            skipped++;
            continue;
          }
        }

        // Check if customer already exists (by email)
        const existingCustomer = await Customer.findOne({
          email: customerData.email,
          user: req.user._id,
          isActive: true
        });

        if (existingCustomer) {
          // Update existing customer
          Object.assign(existingCustomer, customerData);
          await existingCustomer.save();
          updated++;
          console.log(`✅ Updated customer: ${customerData.email}`);
        } else {
          // Create new customer
          await Customer.create(customerData);
          imported++;
          console.log(`✅ Created customer: ${customerData.email}`);
        }

      } catch (error) {
        console.error(`❌ Error processing row ${rowNumber}:`, error);
        errors.push(`Row ${rowNumber}: ${error.message}`);
        skipped++;
      }
    }

    const message = `Import completed: ${imported} imported, ${updated} updated, ${skipped} skipped`;
    console.log(`📊 ${message}`);

    res.json({
      success: true,
      message,
      imported,
      updated,
      skipped,
      errors: errors.slice(0, 50), // Limit errors to prevent large responses
      totalProcessed: jsonData.length
    });

  } catch (error) {
    console.error('❌ Error importing customers:', error);
    res.status(500).json({
      message: error.message || 'Failed to import customers',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Helper function to parse phone numbers
const parsePhoneNumber = (phoneStr) => {
  if (!phoneStr || typeof phoneStr !== 'string') return { countryCode: '+91', number: '' };
  
  const cleaned = phoneStr.trim();
  if (!cleaned) return { countryCode: '+91', number: '' };
  
  // Extract country code and number
  const match = cleaned.match(/^(\+\d{1,3})?\s*(.+)$/);
  if (match) {
    return {
      countryCode: match[1] || '+91',
      number: match[2].replace(/\D/g, '') // Remove non-digits
    };
  }
  
  return { countryCode: '+91', number: cleaned.replace(/\D/g, '') };
};

// Helper function to normalize country names
const normalizeCountry = (country) => {
  if (!country) return 'India';
  const normalized = country.toString().toLowerCase().trim();
  
  if (normalized.includes('india') || normalized === 'in') return 'India';
  if (normalized.includes('usa') || normalized.includes('united states') || normalized === 'us') return 'USA';
  if (normalized.includes('canada') || normalized === 'ca') return 'Canada';
  if (normalized.includes('australia') || normalized === 'au') return 'Australia';
  
  // Return original if no match found
  return country.toString();
};

