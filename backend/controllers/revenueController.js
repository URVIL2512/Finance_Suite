import Revenue from '../models/Revenue.js';
import Invoice from '../models/Invoice.js';

// @desc    Get all revenue
// @route   GET /api/revenue
// @access  Private
export const getRevenue = async (req, res) => {
  try {
    const { year, month, country, service, clientName } = req.query;
    const filter = { user: req.user._id };

    if (year) filter.year = parseInt(year);
    if (month) filter.month = month;
    if (country) filter.country = country;
    if (service) filter.service = service;
    if (clientName) {
      filter.clientName = { $regex: clientName, $options: 'i' };
    }

    // Sync: Find paid invoices without revenue entries and create them
    try {
      const paidInvoicesWithoutRevenue = await Invoice.find({
        user: req.user._id,
        status: 'Paid',
        $or: [
          { revenueId: { $exists: false } },
          { revenueId: null }
        ]
      }).lean();

      if (paidInvoicesWithoutRevenue.length > 0) {
        console.log(`🔄 Syncing ${paidInvoicesWithoutRevenue.length} paid invoice(s) to revenue entries...`);
        
        for (const invoice of paidInvoicesWithoutRevenue) {
          try {
            const invoiceDateValue = invoice.invoiceDate || new Date();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const invoiceMonth = monthNames[invoiceDateValue.getMonth()];
            const invoiceYear = invoiceDateValue.getFullYear();
            
            // Get service description from invoice
            const serviceFromInvoice = invoice.serviceDetails?.description || 
                                     invoice.serviceDetails?.serviceType || 
                                     invoice.items?.[0]?.description || 
                                     'Other Services';
            
            // Map to valid service enum values
            const validServices = [
              'Website Design',
              'B2B Sales Consulting',
              'Outbound Lead Generation',
              'Social Media Marketing',
              'SEO',
              'TeleCalling',
              'Other Services'
            ];
            
            let serviceDescription = 'Other Services';
            const serviceLower = serviceFromInvoice.toLowerCase();
            for (const validService of validServices) {
              if (serviceLower.includes(validService.toLowerCase()) || 
                  validService.toLowerCase().includes(serviceLower)) {
                serviceDescription = validService;
                break;
              }
            }
            
            // Calculate GST amount
            const totalGst = (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);
            
            // Calculate received amount for revenue: Base Amount + GST - TDS - Remittance
            const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
            const tdsAmount = invoice.tdsAmount || 0;
            const remittanceCharges = invoice.remittanceCharges || 0;
            
            // Received Amount = Base Amount + GST - TDS - Remittance (for Revenue)
            const receivedAmount = baseAmount + totalGst - tdsAmount - remittanceCharges;
            const dueAmount = 0; // Fully paid

            // Ensure country is valid enum value
            const validCountries = ['India', 'USA', 'Canada', 'Australia'];
            const invoiceCountry = invoice.clientDetails?.country || 'India';
            const revenueCountry = validCountries.includes(invoiceCountry) ? invoiceCountry : 'India';
            
            // Ensure engagementType is valid enum value
            const invoiceEngagementType = invoice.serviceDetails?.engagementType || 'One Time';
            const revenueEngagementType = (invoiceEngagementType === 'Recurring') ? 'Recurring' : 'One Time';

            // Validate required fields
            if (!invoice.clientDetails?.name || invoice.clientDetails.name.trim() === '') {
              console.log(`⚠️ Skipping invoice ${invoice.invoiceNumber}: Client name is missing`);
              continue;
            }
            if (!invoiceMonth || !invoiceYear) {
              console.log(`⚠️ Skipping invoice ${invoice.invoiceNumber}: Invoice date is missing`);
              continue;
            }

            const revenueData = {
              clientName: invoice.clientDetails.name.trim(),
              country: revenueCountry,
              service: serviceDescription,
              engagementType: revenueEngagementType,
              invoiceNumber: invoice.invoiceNumber || '',
              invoiceDate: invoiceDateValue,
              invoiceAmount: baseAmount,
              gstPercentage: invoice.gstPercentage || 0,
              gstAmount: totalGst,
              tdsPercentage: invoice.tdsPercentage || 0,
              tdsAmount: tdsAmount,
              remittanceCharges: remittanceCharges,
              receivedAmount: Math.round(receivedAmount * 100) / 100,
              dueAmount: dueAmount,
              month: invoice.serviceDetails?.period?.month || invoiceMonth,
              year: invoice.serviceDetails?.period?.year || invoiceYear,
              invoiceGenerated: true,
              invoiceId: invoice._id,
              user: req.user._id,
            };

            const newRevenue = await Revenue.create(revenueData);
            
            // Link the revenue to the invoice
            await Invoice.findByIdAndUpdate(invoice._id, {
              revenueId: newRevenue._id,
            });
            
            console.log(`✅ Synced invoice ${invoice.invoiceNumber} to revenue entry ${newRevenue._id}`);
          } catch (syncError) {
            console.error(`❌ Error syncing invoice ${invoice.invoiceNumber} to revenue:`, syncError.message);
            // Continue with other invoices
          }
        }
      }
    } catch (syncError) {
      console.error('Error during revenue sync:', syncError);
      // Continue with fetching revenue even if sync fails
    }

    const revenue = await Revenue.find(filter)
      .populate({
        path: 'invoiceId',
        select: 'invoiceNumber invoiceDate dueDate grandTotal amountDetails clientDetails status receivedAmount paidAmount items subTotal gstType gstPercentage cgst sgst igst tdsPercentage tdsAmount remittanceCharges currency exchangeRate',
        options: { lean: true }
      })
      .select('-__v')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .lean();

    // Filter out revenue entries where invoice is deleted (invoiceId is null after deletion)
    const validRevenue = revenue.filter(rev => {
      // If invoiceId was populated but invoice doesn't exist, it means invoice was deleted
      // Keep revenue entries even if invoice is deleted (for historical records)
      // But ensure invoice data structure is correct
      return true; // Keep all revenue entries for historical purposes
    });

    // Ensure all revenue entries have complete data structure
    const revenueWithCompleteData = validRevenue.map(rev => {
      // Ensure invoice data is properly structured if exists
      if (rev.invoiceId) {
        if (!rev.invoiceId.clientDetails) {
          rev.invoiceId.clientDetails = {};
        }
        if (!rev.invoiceId.amountDetails) {
          rev.invoiceId.amountDetails = {
            baseAmount: rev.invoiceId.subTotal || 0,
            invoiceTotal: rev.invoiceId.grandTotal || 0,
            receivableAmount: rev.invoiceId.grandTotal || 0
          };
        }
      }
      return rev;
    });

    res.json(revenueWithCompleteData);
  } catch (error) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch revenue',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single revenue
// @route   GET /api/revenue/:id
// @access  Private
export const getRevenueById = async (req, res) => {
  try {
    const revenue = await Revenue.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate({
        path: 'invoiceId',
        select: 'invoiceNumber invoiceDate dueDate grandTotal amountDetails clientDetails status receivedAmount paidAmount items subTotal gstType gstPercentage cgst sgst igst tdsPercentage tdsAmount remittanceCharges currency exchangeRate notes serviceDetails',
        options: { lean: true }
      })
      .select('-__v')
      .lean();

    if (!revenue) {
      return res.status(404).json({ message: 'Revenue not found' });
    }

    // Ensure invoice data is properly structured if exists
    if (revenue.invoiceId) {
      if (!revenue.invoiceId.clientDetails) {
        revenue.invoiceId.clientDetails = {};
      }
      if (!revenue.invoiceId.amountDetails) {
        revenue.invoiceId.amountDetails = {
          baseAmount: revenue.invoiceId.subTotal || 0,
          invoiceTotal: revenue.invoiceId.grandTotal || 0,
          receivableAmount: revenue.invoiceId.grandTotal || 0
        };
      }
      if (!revenue.invoiceId.serviceDetails) {
        revenue.invoiceId.serviceDetails = {
          description: '',
          serviceType: '',
          engagementType: 'One Time',
          period: { month: 'Jan', year: new Date().getFullYear() }
        };
      }
    }

    res.json(revenue);
  } catch (error) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch revenue',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Create revenue
// @route   POST /api/revenue
// @access  Private
export const createRevenue = async (req, res) => {
  try {
    const revenueData = {
      ...req.body,
      user: req.user._id,
    };

    // Ensure invoiceDate is properly formatted
    if (revenueData.invoiceDate) {
      revenueData.invoiceDate = new Date(revenueData.invoiceDate);
    }

    // Ensure month is set if not provided
    if (!revenueData.month && revenueData.invoiceDate) {
      const date = new Date(revenueData.invoiceDate);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      revenueData.month = monthNames[date.getMonth()];
    }

    // Ensure year is set if not provided
    if (!revenueData.year && revenueData.invoiceDate) {
      revenueData.year = new Date(revenueData.invoiceDate).getFullYear();
    }

    // Ensure numeric fields are numbers
    const numericFields = ['invoiceAmount', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'remittanceCharges', 'receivedAmount', 'dueAmount'];
    numericFields.forEach(field => {
      if (revenueData[field] !== undefined && revenueData[field] !== null) {
        revenueData[field] = parseFloat(revenueData[field]) || 0;
      }
    });

    const revenue = await Revenue.create(revenueData);
    res.status(201).json(revenue);
  } catch (error) {
    console.error('Error creating revenue:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message || 'Failed to create revenue entry' });
  }
};

// @desc    Update revenue
// @route   PUT /api/revenue/:id
// @access  Private
export const updateRevenue = async (req, res) => {
  try {
    // Ensure invoiceDate is properly formatted
    if (req.body.invoiceDate) {
      req.body.invoiceDate = new Date(req.body.invoiceDate);
    }

    // Ensure month is set if not provided
    if (!req.body.month && req.body.invoiceDate) {
      const date = new Date(req.body.invoiceDate);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      req.body.month = monthNames[date.getMonth()];
    }

    // Ensure year is set if not provided
    if (!req.body.year && req.body.invoiceDate) {
      req.body.year = new Date(req.body.invoiceDate).getFullYear();
    }

    // Ensure numeric fields are numbers
    const numericFields = ['invoiceAmount', 'gstPercentage', 'gstAmount', 'tdsPercentage', 'tdsAmount', 'remittanceCharges', 'receivedAmount', 'dueAmount'];
    numericFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        req.body[field] = parseFloat(req.body[field]) || 0;
      }
    });

    const revenue = await Revenue.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!revenue) {
      return res.status(404).json({ message: 'Revenue not found' });
    }

    res.json(revenue);
  } catch (error) {
    console.error('Error updating revenue:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message || 'Failed to update revenue entry' });
  }
};

// @desc    Delete revenue
// @route   DELETE /api/revenue/:id
// @access  Private
export const deleteRevenue = async (req, res) => {
  try {
    const revenue = await Revenue.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!revenue) {
      return res.status(404).json({ message: 'Revenue not found' });
    }

    // If revenue has an associated invoice, update it
    if (revenue.invoiceId) {
      const Invoice = (await import('../models/Invoice.js')).default;
      await Invoice.findByIdAndUpdate(revenue.invoiceId, {
        revenueId: null,
      });
    }

    // Hard delete revenue - completely remove from database
    await Revenue.findByIdAndDelete(req.params.id);

    res.json({ message: 'Revenue removed' });
  } catch (error) {
    console.error('Error deleting revenue:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to delete revenue',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

